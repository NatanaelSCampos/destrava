import { z } from "zod";

const uniqueIds = z
  .array(z.string().min(1))
  .min(1)
  .max(2000)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate access activity");
export const unitAccessSchema = z
  .object({
    assessmentId: z.string().min(1),
    minimumScore: z.number().min(0).max(100),
  })
  .strict();
export const examPolicySchema = z
  .object({
    entry: z
      .object({
        activityIds: uniqueIds,
        minimumRatio: z.number().gt(0).max(1),
      })
      .strict(),
    feedback: z.literal("after_submission"),
  })
  .strict();
export type ExamPolicy = z.infer<typeof examPolicySchema>;
export type UnitAccess = z.infer<typeof unitAccessSchema>;

type Activity = { id: string; type: string; payload: Record<string, unknown> };
type Assessment = {
  id: string;
  method: string;
  purpose: string;
  unitId?: string;
  lessonId?: string;
  activityIds?: string[];
  bank?: { activityId: string }[];
  exam?: ExamPolicy;
};
type AccessCourse = {
  schemaVersion: string;
  assessments: Assessment[];
  units: {
    id: string;
    order: number;
    access?: UnitAccess;
    assessmentRefs: { final?: string };
    lessons: { id: string; interactiveLessonRef?: string; activities: Activity[] }[];
  }[];
};
const objective = new Set([
  "multiple_choice",
  "true_false",
  "fill_blank",
  "ordering",
  "short_answer",
  "listening",
]);
/** Public, producer-side validation; policies never infer a smaller denominator. */
export function learningAccessIssues(course: AccessCourse): string[] {
  const errors: string[] = [];
  const assessments = new Map(course.assessments.map((a) => [a.id, a]));
  const banks = new Set(
    course.assessments.flatMap((a) => a.activityIds ?? a.bank?.map((b) => b.activityId) ?? []),
  );
  const owners = new Map(
    course.units.flatMap((u) =>
      u.lessons.flatMap((l) => l.activities.map((a) => [a.id, { u, l, a }] as const)),
    ),
  );
  const hasAccess = course.units.some((u) => u.access) || course.assessments.some((a) => a.exam);
  if (hasAccess && !["1.10", "1.11", "1.12"].includes(course.schemaVersion))
    errors.push("Learning access and exams require CoursePackage 1.10.");
  for (const unit of course.units) {
    if (unit.access) {
      const prior = assessments.get(unit.access.assessmentId);
      const priorUnit = course.units.find((u) => u.id === prior?.unitId);
      if (
        !prior ||
        !prior.exam ||
        !priorUnit ||
        priorUnit.order >= unit.order ||
        priorUnit.assessmentRefs.final !== prior.id
      )
        errors.push(unit.id + ": access must reference the protected final of an earlier unit.");
    }
  }
  for (const exam of course.assessments.filter((a) => a.exam)) {
    const unit = course.units.find((u) => u.id === exam.unitId);
    if (
      exam.method !== "fixed" ||
      exam.purpose !== "summative" ||
      !unit ||
      unit.assessmentRefs.final !== exam.id ||
      (exam.activityIds?.length ?? 0) < 15
    )
      errors.push(exam.id + ": exam requires a unit final with at least 15 activities.");
    const types = new Set<string>();
    for (const id of exam.activityIds ?? []) {
      const item = owners.get(id);
      if (!item || item.u.id !== exam.unitId || !objective.has(item.a.type))
        errors.push(exam.id + ": exam items must be objective and belong to its unit.");
      if (item) {
        types.add(item.a.type);
        for (const field of [
          "supportActivityIds",
          "teaching",
          "recallScene",
          "scene",
          "hint",
          "hints",
          "referenceText",
        ])
          if (item.a.payload[field] !== undefined)
            errors.push(id + ": exam items cannot contain learning support: " + field);
        if (
          item.a.type === "listening" &&
          item.a.payload.media &&
          (item.a.payload.media as { transcriptAvailableAfterAttempt?: boolean })
            .transcriptAvailableAfterAttempt === false
        )
          errors.push(id + ": exam transcript cannot be public before submission.");
      }
    }
    if (types.size < 4) errors.push(exam.id + ": exam requires at least four objective formats.");
    for (const id of exam.exam!.entry.activityIds) {
      const item = owners.get(id);
      if (
        !item ||
        item.u.id !== exam.unitId ||
        item.l.interactiveLessonRef ||
        banks.has(id) ||
        !objective.has(item.a.type)
      )
        errors.push(
          exam.id +
            ": entry must reference ordinary objective practice in its own unit, outside all assessment banks.",
        );
    }
  }
  return errors;
}
