import { z } from "zod";
import {
  activityTypeSchema,
  normalizationRulesSchema,
  skillIdSchema,
  assessmentSchema,
  assessmentRefsSchema,
} from "./contracts";
import { activityPayloadSchemas } from "./activity-data";
import {
  capabilityRequirementsSchema,
  type CapabilityReport,
  type CapabilityRequirement,
} from "./capability-contracts";
export { activityTypeSchema } from "./contracts";
import { unitLearningPolicySchema } from "./learning-policies";
import { coreSkillSchema } from "./contract-vocabulary";
import { activityPresentationSchema } from "./text-presentation";
import { activityVariantSchema, answerPolicySchema, variantIdsSchema } from "./variant-contracts";

export const skillSchema = coreSkillSchema;
export type Skill = z.infer<typeof skillSchema>;

export type ActivityType = z.infer<typeof activityTypeSchema>;

const activityBase = z.object({
  id: z.string().min(1),
  variant: activityVariantSchema.optional(),
  presentation: activityPresentationSchema.optional(),
  answerPolicy: answerPolicySchema.optional(),
  capabilityRequirements: capabilityRequirementsSchema.optional(),
  type: activityTypeSchema,
  title: z.string().min(1),
  prompt: z.string().default(""),
  skill: skillSchema,
  skills: z.array(skillIdSchema).default([]),
  conceptIds: z.array(z.string().min(1)).default([]),
  goals: z.array(z.string()).optional(),
  contexts: z.array(z.string()).optional(),
  minutes: z.number().positive(),
  normalization: normalizationRulesSchema.optional(),
});

export const activitySchema = z.discriminatedUnion("type", [
  activityBase.extend({
    ...activityPayloadSchemas.lesson_content.shape,
    type: z.literal("lesson_content"),
  }),
  activityBase.extend({
    ...activityPayloadSchemas.multiple_choice.shape,
    type: z.literal("multiple_choice"),
  }),
  activityBase.extend({
    ...activityPayloadSchemas.true_false.shape,
    type: z.literal("true_false"),
  }),
  activityBase.extend({
    ...activityPayloadSchemas.fill_blank.shape,
    type: z.literal("fill_blank"),
  }),
  activityBase.extend({ ...activityPayloadSchemas.ordering.shape, type: z.literal("ordering") }),
  activityBase.extend({
    ...activityPayloadSchemas.short_answer.shape,
    type: z.literal("short_answer"),
  }),
  activityBase.extend({ ...activityPayloadSchemas.writing.shape, type: z.literal("writing") }),
  activityBase.extend({ ...activityPayloadSchemas.listening.shape, type: z.literal("listening") }),
  activityBase.extend({ ...activityPayloadSchemas.speaking.shape, type: z.literal("speaking") }),
  activityBase.extend({ ...activityPayloadSchemas.flashcard.shape, type: z.literal("flashcard") }),
  activityBase.extend({ ...activityPayloadSchemas.review.shape, type: z.literal("review") }),
  activityBase.extend({ ...activityPayloadSchemas.quiz.shape, type: z.literal("quiz") }),
]);

export const lessonSchema = z.object({
  capabilityRequirements: capabilityRequirementsSchema.optional(),
  id: z.string(),
  interactiveLessonRef: z.string().optional(),
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
  capabilityRequirements: capabilityRequirementsSchema.optional(),
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  number: z.number().int().positive(),
  skills: z.array(skillIdSchema).default([]),
  description: z.string(),
  objectives: z.array(z.string()),
  active: z.boolean(),
  lessons: z.array(lessonSchema),
  assessmentRefs: assessmentRefsSchema.default({ formative: [] }),
  learningPolicy: unitLearningPolicySchema.optional(),
});

export const courseSchema = z.object({
  capabilityRequirements: capabilityRequirementsSchema.optional(),
  languageRequirements: capabilityRequirementsSchema.optional(),
  capabilityReport: z.custom<CapabilityReport>().optional(),
  capabilityRequests: z
    .custom<Array<{ requirement: CapabilityRequirement; location: string }>>()
    .optional(),
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  languageCode: z.string().min(2),
  sourceLanguage: z.string().optional(),
  defaultVariant: z.string().optional(),
  acceptedVariants: variantIdsSchema.optional(),
  level: z.string(),
  description: z.string(),
  contentVersion: z.string().default("legacy"),
  assessments: z.array(assessmentSchema).default([]),
  assessmentRefs: z.object({ diagnostic: z.string().min(1).optional() }).default({}),
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
