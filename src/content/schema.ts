import { z } from "zod";

export const skillSchema = z.enum([
  "vocabulary",
  "grammar",
  "listening",
  "writing",
  "speaking",
  "reading",
]);
export type Skill = z.infer<typeof skillSchema>;

export const activityTypeSchema = z.enum([
  "lesson_content",
  "multiple_choice",
  "true_false",
  "fill_blank",
  "matching",
  "ordering",
  "short_answer",
  "writing",
  "listening",
  "speaking",
  "flashcard",
  "review",
  "quiz",
]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

const activityBase = z.object({
  id: z.string().min(1),
  type: activityTypeSchema,
  title: z.string().min(1),
  prompt: z.string().default(""),
  skill: skillSchema,
  conceptIds: z.array(z.string().min(1)).default([]),
  minutes: z.number().positive(),
  explanation: z.string().optional(),
  source: z.object({ book: z.enum(["student", "workbook"]), pages: z.string() }).optional(),
  media: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("tts"), language: z.string().default("es-ES") }),
      z.object({
        kind: z.literal("audio"),
        url: z.string().min(1),
        transcriptAvailableAfterAttempt: z.boolean().default(true),
      }),
    ])
    .optional(),
});

export const activitySchema = z.discriminatedUnion("type", [
  activityBase.extend({
    type: z.literal("lesson_content"),
    body: z.string(),
    highlights: z.array(z.string()).default([]),
  }),
  activityBase.extend({
    type: z.literal("multiple_choice"),
    options: z.array(z.string()).min(2),
    answer: z.string(),
  }),
  activityBase.extend({ type: z.literal("true_false"), answer: z.enum(["true", "false"]) }),
  activityBase.extend({
    type: z.literal("fill_blank"),
    answer: z.string(),
    accepted: z.array(z.string()).default([]),
  }),
  activityBase.extend({
    type: z.literal("matching"),
    pairs: z.array(z.tuple([z.string(), z.string()])),
  }),
  activityBase.extend({
    type: z.literal("ordering"),
    words: z.array(z.string()).min(2),
    answer: z.string(),
  }),
  activityBase.extend({
    type: z.literal("short_answer"),
    answer: z.string(),
    accepted: z.array(z.string()).default([]),
  }),
  activityBase.extend({
    type: z.literal("writing"),
    guidance: z.array(z.string()).default([]),
    minWords: z.number().nonnegative(),
  }),
  activityBase.extend({
    type: z.literal("listening"),
    transcript: z.string(),
    options: z.array(z.string()).min(2),
    answer: z.string(),
  }),
  activityBase.extend({
    type: z.literal("speaking"),
    guidance: z.array(z.string()).default([]),
    referenceText: z.string().min(1).optional(),
  }),
  activityBase.extend({
    type: z.literal("flashcard"),
    front: z.string(),
    back: z.string(),
    example: z.string(),
  }),
  activityBase.extend({
    type: z.literal("review"),
    body: z.string(),
    steps: z.array(z.string()).default([]),
    cards: z
      .array(
        z.object({
          label: z.string(),
          structure: z.string().optional(),
          examples: z.array(z.string()).min(1),
          practice: z.string(),
        }),
      )
      .default([]),
  }),
  activityBase.extend({ type: z.literal("quiz"), body: z.string() }),
]);

export const lessonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  eyebrow: z.string(),
  description: z.string(),
  minutes: z.number().positive(),
  order: z.number().int().positive(),
  active: z.boolean(),
  activities: z.array(activitySchema).min(1),
});

export const unitSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  number: z.number().int().positive(),
  description: z.string(),
  objectives: z.array(z.string()),
  active: z.boolean(),
  lessons: z.array(lessonSchema),
});

export const courseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  languageCode: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
  level: z.string(),
  description: z.string(),
  learningConcepts: z
    .array(z.object({ id: z.string().min(1), label: z.string().min(1) }))
    .default([]),
  units: z.array(unitSchema),
});

export type Activity = z.infer<typeof activitySchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Course = z.infer<typeof courseSchema>;

export function allActivities(course: Course) {
  return course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities));
}

export function findActivity(course: Course, id: string) {
  return allActivities(course).find((activity) => activity.id === id);
}

export function findLesson(course: Course, slug: string) {
  return course.units.flatMap((unit) => unit.lessons).find((lesson) => lesson.slug === slug);
}
