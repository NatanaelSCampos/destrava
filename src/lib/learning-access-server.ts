import "server-only";
import type { Activity, Course } from "@/content/schema";
import { publicCourse } from "@/content/public";
import { assessmentRequestSchema, type AssessmentRequest } from "@/content/assessment-results";
import { evaluateAssessment, assessmentSummary } from "@/domain/assessments/assessment-engine";
import {
  evaluateLearningAccess,
  protectedExamForActivity,
  resolveLearningTarget,
} from "@/domain/study/learning-access";
import {
  evidenceHash,
  canonicalLearningTimestamp,
  signLearningEvidence,
  verifyLearningEvidence,
} from "./signed-learning-evidence";
import { createSupabaseServerClient } from "./supabase/server";
import type { StoredAssessmentRow } from "./assessment-api";
import type { LanguagePackage } from "@/content/contracts";
const key = () => process.env.SUPABASE_SECRET_KEY ?? "";
const scope = (course: Course, userId: string) => ({
  owner: userId,
  courseId: course.id,
  contentVersion: course.contentVersion,
});
function participationEvidence(course: Course, userId: string, activity: Activity) {
  return {
    v: 1,
    kind: "participation",
    ...scope(course, userId),
    activityId: activity.id,
    definitionHash: evidenceHash(activity),
  };
}
export function activityEvidence(course: Course, userId: string, activityId: string) {
  const activity = course.units
    .flatMap((u) => u.lessons.flatMap((l) => l.activities))
    .find((a) => a.id === activityId);
  if (!activity) throw new Error("Unknown learning activity");
  return participationEvidence(course, userId, activity);
}
export function completionReceipt(course: Course, userId: string, activityId: string) {
  return signLearningEvidence(activityEvidence(course, userId, activityId), key());
}
function assessmentEvidence(
  course: Course,
  userId: string,
  input: AssessmentRequest,
  finishedAt: string,
  variantId?: string,
  language?: LanguagePackage,
) {
  const definition = course.assessments.find((a) => a.id === input.assessmentId);
  const ids =
    definition?.method === "fixed"
      ? definition.activityIds
      : (definition?.bank.map((b) => b.activityId) ?? []);
  const activities = course.units
    .flatMap((u) => u.lessons.flatMap((l) => l.activities))
    .filter((a) => ids.includes(a.id));
  return {
    v: 1,
    kind: "assessment",
    ...scope(course, userId),
    attemptId: input.attemptId,
    finishedAt: canonicalLearningTimestamp(finishedAt),
    variantId: variantId ?? "",
    inputHash: evidenceHash(input),
    definitionHash: evidenceHash({
      definition,
      activities,
      normalization: language?.normalization,
      variants: language?.variants,
      courseVariants: { default: course.defaultVariant, accepted: course.acceptedVariants },
    }),
  };
}
export function assessmentAttestation(
  course: Course,
  userId: string,
  input: AssessmentRequest,
  finishedAt: string,
  variantId?: string,
  language?: LanguagePackage,
) {
  return signLearningEvidence(
    assessmentEvidence(course, userId, input, finishedAt, variantId, language),
    key(),
  );
}
export function trustedAssessmentRow(
  row: StoredAssessmentRow,
  course: Course,
  userId: string,
  language?: LanguagePackage,
) {
  const input = assessmentRequestSchema.safeParse(row.result?.input);
  return (
    canonicalLearningTimestamp(row.finished_at) !== null &&
    input.success &&
    input.data.courseId === course.id &&
    row.result.contentVersion === course.contentVersion &&
    input.data.attemptId === row.id &&
    input.data.assessmentId === row.assessment_id &&
    verifyLearningEvidence(
      row.result.attestation,
      assessmentEvidence(
        course,
        userId,
        input.data,
        row.finished_at,
        row.result.variantId,
        language,
      ),
      key(),
    )
  );
}
export async function loadLearningAccess(
  userId: string,
  course: Course,
  language: LanguagePackage,
) {
  const db = await createSupabaseServerClient();
  if (!db || !key()) throw new Error("Learning access store unavailable");
  const completed = new Set<string>();
  const eligible = new Set(
    course.assessments.flatMap((a) =>
      a.method === "fixed" && a.exam ? a.exam.entry.activityIds : [],
    ),
  );
  const { data: progress, error: progressError } = await db
    .from("user_course_state")
    .select("state")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .maybeSingle();
  if (progressError) throw progressError;
  const attempts = progress?.state?.attempts;
  if (attempts !== undefined && !Array.isArray(attempts))
    throw new Error("Unreadable learning evidence");
  // Definitions and their hashes are request-local. User evidence is always verified.
  const activities = new Map<string, Activity>();
  for (const unit of course.units) for (const lesson of unit.lessons)
    for (const activity of lesson.activities)
      if (!activities.has(activity.id)) activities.set(activity.id, activity);
  const definitions = new Map<string, ReturnType<typeof participationEvidence>>();
  for (const attempt of attempts ?? []) {
    if (!eligible.has(attempt?.activityId)) continue;
    let definition = definitions.get(attempt.activityId);
    if (!definition) {
      const activity = activities.get(attempt.activityId);
      if (!activity) throw new Error("Unknown learning activity");
      definition = participationEvidence(course, userId, activity);
      definitions.set(attempt.activityId, definition);
    }
    if (verifyLearningEvidence(attempt.serverReceipt, definition, key()))
      completed.add(attempt.activityId);
  }
  const required = new Set(course.units.flatMap((u) => (u.access ? [u.access.assessmentId] : [])));
  const results = [];
  if (required.size) {
    // Page through history so a later failed retry never hides an earlier passing attempt.
    for (let offset = 0; ; offset += 500) {
      const { data: rows, error } = await db
        .from("assessment_attempts")
        .select("id,assessment_id,started_at,finished_at,objective_score,result")
        .eq("user_id", userId)
        .in("assessment_id", [...required])
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      for (const row of rows ?? []) {
        if (!trustedAssessmentRow(row, course, userId, language)) continue;
        const input = assessmentRequestSchema.parse(row.result.input);
        const grade = evaluateAssessment(
          course,
          input.assessmentId,
          input.responses,
          language.normalization,
          { language, course, preference: row.result.variantId },
        );
        results.push({
          id: row.id,
          courseId: course.id,
          assessmentId: input.assessmentId,
          ...assessmentSummary(grade.definition),
          contentVersion: course.contentVersion,
          source: "server" as const,
          startedAt: input.startedAt,
          finishedAt: row.finished_at,
          status: grade.status,
          objectiveScore: grade.objectiveScore,
          passed: grade.passed,
          answers: grade.answers,
          responseKey: grade.responseKey,
        });
      }
      if ((rows?.length ?? 0) < 500) break;
    }
  }
  return evaluateLearningAccess(publicCourse(course, language), {
    completedActivityIds: [...completed],
    assessmentResults: results,
  });
}
export async function authorizeLearningTarget(
  userId: string | null,
  course: Course,
  language: LanguagePackage,
  target: { activityId?: string; lessonId?: string; assessmentId?: string; unitId?: string },
) {
  if (target.activityId && protectedExamForActivity(course, target.activityId))
    return { allowed: false, message: "As respostas da prova são conferidas juntas, ao terminar." };
  const resolved = resolveLearningTarget(course, target);
  if (!resolved.valid)
    return { allowed: false, message: "Não foi possível identificar esta atividade no percurso." };
  const { unit, exam } = resolved;
  if (!unit?.access && !(exam?.method === "fixed" && exam.exam))
    return { allowed: true, message: "Disponível." };
  if (!userId) return { allowed: false, message: "Entre na sua conta para continuar." };
  const access = await loadLearningAccess(userId, course, language);
  return target.assessmentId ? access.assessments[target.assessmentId] : access.units[unit!.id];
}
