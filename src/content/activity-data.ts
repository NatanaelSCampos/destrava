import { z } from "zod";
import { teachingSchema, recordedBackSchema, authoredFeedbackSchema, recallSceneSchema, legacyRecallSceneSchema } from "./teaching";
import { activitySceneSchema } from "./activity-scene";
import { reconstructionSchema, textRequirementSchema, legacyMinWordsSchema } from "./text-strategies";

export const normalizationRulesSchema = z.object({
  trimWhitespace: z.boolean(),
  collapseWhitespace: z.boolean(),
  caseInsensitive: z.boolean(),
  ignoreTerminalPunctuation: z.boolean(),
  ignoreDiacritics: z.boolean(),
});
export type NormalizationRules = z.infer<typeof normalizationRulesSchema>;
export const activityTypeSchema = z.enum([
  "lesson_content",
  "multiple_choice",
  "true_false",
  "fill_blank",
  "ordering",
  "short_answer",
  "writing",
  "listening",
  "speaking",
  "flashcard",
  "review",
  "quiz",
]);
export const objectiveActivityTypes = [
  "multiple_choice",
  "true_false",
  "fill_blank",
  "ordering",
  "short_answer",
  "listening",
] as const;
const common = {
  scene: activitySceneSchema.optional(),
  supportActivityIds: z.array(z.string().min(1)).max(4).optional(),
  feedback: authoredFeedbackSchema.optional(),
  explanation: z.string().optional(),
  source: z.object({ book: z.enum(["student", "workbook"]), pages: z.string() }).optional(),
  media: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("tts"), language: z.string().min(2) }),
      z.object({
        kind: z.literal("audio"),
        url: z.string().min(1),
        transcriptAvailableAfterAttempt: z.boolean().default(true),
      }),
    ])
    .optional(),
};
// One source of truth for authoring, runtime parsing and the capability catalog.
export const activityPayloadSchemas = {
  lesson_content: z
    .object({ ...common, body: z.string(), highlights: z.array(z.string()).default([]), teaching: teachingSchema.optional() })
    .strict(),
  multiple_choice: z
    .object({ ...common, options: z.array(z.string()).min(2), answer: z.string() })
    .strict(),
  true_false: z.object({ ...common, answer: z.enum(["true", "false"]) }).strict(),
  fill_blank: z
    .object({
      ...common,
      answer: z.string(),
      accepted: z.array(z.string()).default([]),
      fullAnswers: z.array(z.string()).default([]),
    })
    .strict(),
  ordering: z.object({ ...common, words: z.array(z.string()).min(2), answer: z.string(),
    reconstruction: reconstructionSchema.optional(), answerOrder: z.array(z.number().int().nonnegative()).optional(),
  }).strict(),
  short_answer: z
    .object({ ...common, answer: z.string(), accepted: z.array(z.string()).default([]) })
    .strict(),
  writing: z
    .object({
      ...common,
      guidance: z.array(z.string()).default([]),
      minWords: legacyMinWordsSchema.optional(),
      textRequirement: textRequirementSchema.optional(),
    })
    .strict(),
  listening: z
    .object({
      ...common,
      transcript: z.string(),
      options: z.array(z.string()).min(2),
      answer: z.string(),
    })
    .strict(),
  speaking: z
    .object({
      ...common,
      guidance: z.array(z.string()).default([]),
      referenceText: z.string().min(1).optional(),
    })
    .strict(),
  flashcard: z
    .object({ ...common, front: z.string(), back: z.string(), example: z.string(), recordedBack: recordedBackSchema.optional(), recallScene: recallSceneSchema.optional() })
    .strict(),
  review: z
    .object({
      ...common,
      reviewMode: z.literal("recall").optional(),
      body: z.string(),
      steps: z.array(z.string()).default([]),
      cards: z
        .array(
          z.object({
            label: z.string(),
            structure: z.string().optional(),
            examples: z.array(z.string()).min(1),
            practice: z.string(),
            audioMediaIds: z.array(z.string().trim().min(1)).min(1).optional(),
          }),
        )
        .default([]),
    })
    .strict(),
  quiz: z.object({ ...common, body: z.string() }).strict(),
};
export const legacyOrderingPayloadSchema = activityPayloadSchemas.ordering.omit({ scene: true, reconstruction: true, answerOrder: true });
export const legacyWritingPayloadSchema = activityPayloadSchemas.writing.omit({ scene: true, textRequirement: true }).extend({ minWords: legacyMinWordsSchema });

export function previousActivityPayloadSchema(type: keyof typeof activityPayloadSchemas) {
  const shape: Record<string, z.ZodType> = {...activityPayloadSchemas[type].shape};
  delete shape.scene; delete shape.reviewMode;
  if (type === "flashcard") shape.recallScene = legacyRecallSceneSchema.optional();
  if (type === "review") shape.cards = z.array(activityPayloadSchemas.review.shape.cards.unwrap().element.omit({audioMediaIds: true})).default([]);
  return z.object(shape).strict();
}
export function legacyActivityPayloadSchema(type: keyof typeof activityPayloadSchemas) {
  const shape: Record<string, z.ZodType> = {...previousActivityPayloadSchema(type).shape};
  for (const key of ["scene","reviewMode","feedback","supportActivityIds","teaching","recordedBack","recallScene"]) delete shape[key];
  return z.object(shape).strict();
}
