import type { PublicCourse } from "@/content/public";
import type { ServerAssessmentResult } from "@/content/assessment-results";

export type LearningEvidence = {
  completedActivityIds: string[];
  assessmentResults: ServerAssessmentResult[];
};
export type AccessDecision = {
  allowed: boolean;
  message: string;
  completed?: number;
  total?: number;
  required?: number;
};
export type LearningAccessSnapshot = {
  courseId: string;
  contentVersion: string;
  units: Record<string, AccessDecision>;
  assessments: Record<string, AccessDecision>;
};
/** Apply progression locks to the capability-projected course; server guards remain authoritative. */
export function courseWithLearningAccess(
  course: PublicCourse,
  snapshot: LearningAccessSnapshot | null,
): PublicCourse {
  if (!course.units.some((unit) => unit.access)) return course;
  const current =
    snapshot?.courseId === course.id && snapshot.contentVersion === course.contentVersion
      ? snapshot
      : null;
  const locked = course.units.filter((unit) => unit.access && !current?.units[unit.id]?.allowed);
  const activityIds = locked.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id)),
  );
  const base = course.availability ?? { unavailableActivityIds: [], spacedRepetition: false };
  const reasons = Object.fromEntries(
    activityIds.map((id) => [id, ["Conclua o desafio anterior para abrir esta prática."]]),
  );
  return {
    ...course,
    availability: {
      ...base,
      lockedUnitIds: locked.map((unit) => unit.id),
      unavailableUnitIds: [
        ...new Set([...(base.unavailableUnitIds ?? []), ...locked.map((unit) => unit.id)]),
      ],
      unavailableActivityIds: [...new Set([...base.unavailableActivityIds, ...activityIds])],
      unavailableAssessmentIds: [
        ...new Set([
          ...(base.unavailableAssessmentIds ?? []),
          ...course.assessments
            .filter((assessment) => locked.some((unit) => unit.id === assessment.unitId))
            .map((assessment) => assessment.id),
        ]),
      ],
      reasons: { ...base.reasons, ...reasons },
    },
  };
}

export function protectedExamForActivity(
  course: Pick<PublicCourse, "assessments">,
  activityId: string,
) {
  return course.assessments.find(
    (a) => a.method === "fixed" && a.exam && a.activityIds.includes(activityId),
  );
}
export function evaluateLearningAccess(
  course: PublicCourse,
  evidence: LearningEvidence,
): LearningAccessSnapshot {
  const completed = new Set(evidence.completedActivityIds);
  const units: Record<string, AccessDecision> = {};
  const assessments: Record<string, AccessDecision> = {};
  for (const unit of course.units) {
    const rule = unit.access;
    const passed =
      !rule ||
      evidence.assessmentResults.some(
        (r) =>
          r.courseId === course.id &&
          r.contentVersion === course.contentVersion &&
          r.assessmentId === rule.assessmentId &&
          r.source === "server" &&
          r.status === "completed" &&
          r.passed === true &&
          r.objectiveScore !== null &&
          // Compare actual answers; display rounding never grants access.
          r.answers.filter((a) => a.correct !== null).length > 0 &&
          r.answers.filter((a) => a.correct === true).length * 100 >=
            rule.minimumScore * r.answers.filter((a) => a.correct !== null).length,
      );
    units[unit.id] = {
      allowed: passed,
      message: passed
        ? "Trecho disponível."
        : "Conclua o desafio anterior com pelo menos " +
          rule!.minimumScore +
          "% de acertos para seguir neste caminho.",
    };
  }
  for (const assessment of course.assessments) {
    const unit = course.units.find((u) => u.id === assessment.unitId);
    if (unit && !units[unit.id].allowed) {
      assessments[assessment.id] = units[unit.id];
      continue;
    }
    if (assessment.method !== "fixed" || !assessment.exam) {
      assessments[assessment.id] = { allowed: true, message: "Avaliação disponível." };
      continue;
    }
    const ids = new Set(assessment.exam.entry.activityIds);
    const count = [...ids].filter((id) => completed.has(id)).length;
    const required = Math.ceil(ids.size * assessment.exam.entry.minimumRatio);
    const allowed = ids.size > 0 && count >= required;
    assessments[assessment.id] = {
      allowed,
      completed: count,
      total: ids.size,
      required,
      message: allowed
        ? "Você já pode fazer a prova."
        : "Faça " +
          required +
          " das " +
          ids.size +
          " práticas deste trecho para abrir a prova. Você já fez " +
          count +
          ".",
    };
  }
  return { courseId: course.id, contentVersion: course.contentVersion, units, assessments };
}

/** Resolve every supplied identifier together; conflicting scopes never select an easier gate. */
export function resolveLearningTarget(
  course: Pick<PublicCourse, "units" | "assessments">,
  target: { activityId?: string; lessonId?: string; assessmentId?: string; unitId?: string },
) {
  const globalAssessment = target.assessmentId
    ? course.assessments.find((a) => a.id === target.assessmentId && !a.unitId)
    : undefined;
  if (globalAssessment && Object.values(target).filter((v) => v !== undefined).length === 1)
    return { valid: true as const, unit: undefined, exam: globalAssessment };
  const owners: string[] = [];
  let activityLesson: string | undefined;
  for (const [kind, id] of Object.entries(target)) {
    if (id === undefined) continue;
    let owner: string | undefined;
    if (kind === "unitId") owner = course.units.find((u) => u.id === id)?.id;
    if (kind === "lessonId")
      owner = course.units.find((u) => u.lessons.some((l) => l.id === id))?.id;
    if (kind === "activityId") {
      for (const u of course.units)
        for (const l of u.lessons)
          if (l.activities.some((a) => a.id === id)) {
            owner = u.id;
            activityLesson = l.id;
          }
    }
    if (kind === "assessmentId") owner = course.assessments.find((a) => a.id === id)?.unitId;
    if (!owner) return { valid: false as const };
    owners.push(owner);
  }
  if (
    new Set(owners).size > 1 ||
    (target.lessonId && activityLesson && target.lessonId !== activityLesson)
  )
    return { valid: false as const };
  return {
    valid: true as const,
    unit: course.units.find((u) => u.id === owners[0]),
    exam: course.assessments.find((a) => a.id === target.assessmentId),
  };
}

/** Multipart scope uses a single value in every handler. */
export function hasDuplicateLearningScope(form: Pick<FormData, "getAll">) {
  return [
    "courseId",
    "activityId",
    "lessonId",
    "unitId",
    "assessmentId",
    "contentVersion",
    "numberPromptId",
  ].some((name) => form.getAll(name).length > 1);
}
