import { z } from "zod";

const text = z
  .string()
  .trim()
  .min(1)
  .max(600)
  .regex(/^[^<>\u0000-\u0008]+$/u, "Use plain text, without markup.");
const id = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[^<>\u0000-\u001f]+$/u, "Use a plain identifier.");
export const journeyIcons = [
  "book-open",
  "message-circle",
  "map-pin",
  "headphones",
  "brain",
  "clock",
  "handshake",
  "coffee",
  "shopping-bag",
  "target",
  "flag",
  "trophy",
  "sparkles",
  "compass",
  "play",
  "lightbulb",
] as const;
export const journeyTones = ["forest", "sage", "amber", "sky", "rose"] as const;
export type JourneyIcon = (typeof journeyIcons)[number];
export type JourneyTone = (typeof journeyTones)[number];
const illustration = z
  .object({
    src: z.string().regex(/^\/journeys\/[a-zA-Z0-9_/-]+\.(?:png|webp|jpg|jpeg|avif)$/),
    alt: text,
  })
  .strict();
const appearance = {
  title: text,
  description: text.optional(),
  objective: text.optional(),
  character: text.optional(),
  setting: text.optional(),
  icon: z.enum(journeyIcons).optional(),
  tone: z.enum(journeyTones).optional(),
  illustration: illustration.optional(),
  /** References only: the existing lesson renderer resolves and plays these resources. */
  audioActivityIds: z.array(id).max(20).optional(),
};
export const journeyMomentSchema = z
  .object({
    id,
    ...appearance,
    target: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("lesson"),
          lessonId: id,
          stageIds: z.array(id).min(1).max(100).optional(),
        })
        .strict(),
      z.object({ kind: z.literal("assessment"), assessmentId: id }).strict(),
    ]),
  })
  .strict();
export const journeyPresentationSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    presentationVersion: id,
    courseId: id,
    contentVersion: id,
    structureFingerprint: id.optional(),
    chapters: z
      .array(
        z
          .object({
            id,
            unitId: id,
            ...appearance,
            moments: z.array(journeyMomentSchema).min(1).max(300),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
export type JourneyPresentation = z.infer<typeof journeyPresentationSchema>;
export type JourneyMoment = z.infer<typeof journeyMomentSchema>;

/** Public structural data only. No dependency on engine types, storage or private answers. */
export type JourneyCourseStructure = {
  id: string;
  contentVersion: string;
  units: readonly {
    id: string;
    active: boolean;
    lessons: readonly {
      id: string;
      active: boolean;
      interactiveLessonRef?: string;
      stages?: readonly { id: string; activityIds: readonly string[] }[];
      activities: readonly { id: string }[];
    }[];
  }[];
  assessments: readonly { id: string; lessonId?: string; unitId?: string }[];
};

/** Staleness hint, not a cryptographic signature or authorization. References are checked independently. */
export function journeyCourseFingerprint(course: JourneyCourseStructure): string {
  const bytes = JSON.stringify([
    course.id,
    course.contentVersion,
    course.units
      .filter((u) => u.active)
      .map((u) => [
        u.id,
        u.lessons
          .filter((l) => l.active)
          .map((l) => [
            l.id,
            l.interactiveLessonRef ?? null,
            l.activities.map((a) => a.id),
            l.stages?.map((s) => [s.id, s.activityIds]) ?? null,
          ]),
      ]),
    course.assessments.map((a) => [a.id, a.unitId ?? null, a.lessonId ?? null]),
  ]);
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < bytes.length; i++) {
    a = Math.imul(a ^ bytes.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ bytes.charCodeAt(i);
  }
  return (
    "structure-v1-" +
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0")
  );
}

export function journeyPresentationIssues(
  presentation: JourneyPresentation,
  course: JourneyCourseStructure,
): string[] {
  const issues: string[] = [];
  if (presentation.courseId !== course.id || presentation.contentVersion !== course.contentVersion)
    issues.push("Presentation belongs to a different course or content version.");
  if (
    presentation.structureFingerprint &&
    presentation.structureFingerprint !== journeyCourseFingerprint(course)
  )
    issues.push("Presentation structure fingerprint is stale.");
  const units = course.units.filter((u) => u.active && u.lessons.some((l) => l.active));
  if (
    JSON.stringify(presentation.chapters.map((c) => c.unitId)) !==
    JSON.stringify(units.map((u) => u.id))
  )
    issues.push("Chapters must cover active units exactly once in curricular order.");
  const identifiers = presentation.chapters.flatMap((c) => [c.id, ...c.moments.map((m) => m.id)]);
  if (new Set(identifiers).size !== identifiers.length)
    issues.push("Presentation IDs must be globally unique.");
  for (const chapter of presentation.chapters) {
    const unit = units.find((u) => u.id === chapter.unitId);
    if (!unit) {
      issues.push("Unknown chapter unit: " + chapter.unitId);
      continue;
    }
    const chapterActivityIds = new Set(
      unit.lessons.filter((l) => l.active).flatMap((l) => l.activities.map((a) => a.id)),
    );
    if (chapter.audioActivityIds?.some((reference) => !chapterActivityIds.has(reference)))
      issues.push("Chapter audio references must belong to its active lessons: " + chapter.id);
    const expected: string[] = [];
    for (const lesson of unit.lessons.filter((l) => l.active)) {
      const assessments = course.assessments.filter(
        (a) => a.lessonId === lesson.id && (!a.unitId || a.unitId === unit.id),
      );
      if (assessments.length) expected.push(...assessments.map((a) => "assessment:" + a.id));
      else
        expected.push(
          ...(lesson.stages ?? [{ id: lesson.id }]).map((s) => "lesson:" + lesson.id + ":" + s.id),
        );
    }
    const observed: string[] = [];
    for (const moment of chapter.moments) {
      const target = moment.target;
      let activityIds: string[] = [];
      if (target.kind === "assessment") {
        const assessment = course.assessments.find((a) => a.id === target.assessmentId);
        const lesson = unit.lessons.find((l) => l.id === assessment?.lessonId && l.active);
        if (!assessment || !lesson || (assessment.unitId && assessment.unitId !== unit.id))
          issues.push("Unknown or cross-unit assessment target: " + target.assessmentId);
        observed.push("assessment:" + target.assessmentId);
        activityIds = lesson?.activities.map((a) => a.id) ?? [];
      } else {
        const lesson = unit.lessons.find((l) => l.id === target.lessonId && l.active);
        if (!lesson) {
          issues.push("Unknown lesson target: " + target.lessonId);
          continue;
        }
        if (course.assessments.some((a) => a.lessonId === lesson.id))
          issues.push("Assessment banks must use assessment targets: " + lesson.id);
        if (target.stageIds && (!lesson.stages || lesson.interactiveLessonRef))
          issues.push(
            "Stage selection requires an ordinary lesson with declared stages: " + lesson.id,
          );
        const stages = lesson.stages ?? [
          { id: lesson.id, activityIds: lesson.activities.map((a) => a.id) },
        ];
        const selected = target.stageIds ?? stages.map((s) => s.id);
        for (const stageId of selected) {
          const stage = stages.find((s) => s.id === stageId);
          if (!stage) issues.push("Unknown stage: " + stageId);
          observed.push("lesson:" + lesson.id + ":" + stageId);
          activityIds.push(...(stage?.activityIds ?? []));
        }
      }
      if (moment.audioActivityIds?.some((reference) => !activityIds.includes(reference)))
        issues.push("Audio references must belong to the moment's activities: " + moment.id);
    }
    if (JSON.stringify(expected) !== JSON.stringify(observed))
      issues.push(
        "Moments must partition every active lesson stage and assessment exactly once in curricular order: " +
          chapter.unitId,
      );
  }
  return issues;
}

/** Invalid optional editorial metadata cannot remove or block curricular content. */
export function parseJourneyPresentation(
  value: unknown,
  course: JourneyCourseStructure,
): {
  presentation: JourneyPresentation | null;
  issues: string[];
} {
  if (value === undefined || value === null) return { presentation: null, issues: [] };
  const parsed = journeyPresentationSchema.safeParse(value);
  if (!parsed.success)
    return {
      presentation: null,
      issues: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message),
    };
  const issues = journeyPresentationIssues(parsed.data, course);
  return { presentation: issues.length ? null : parsed.data, issues };
}
