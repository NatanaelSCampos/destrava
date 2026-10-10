import { z } from "zod";
import { skillIdSchema, assessmentPurposeSchema } from "./contract-vocabulary";

const reference = z.string().trim().min(1);
const references = z
  .array(reference)
  .max(500)
  .refine((items) => new Set(items).size === items.length, "Duplicate policy reference");
const base = { id: reference, label: reference };
const count = z.number().int().positive();
const score = z.number().min(0).max(100);

export const learningRequirementSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("participation"),
      activityIds: references.min(1),
      minimumCount: count.optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("submission"),
      activityIds: references.min(1),
      practice: z.enum(["writing", "speaking"]),
      minimumCount: count.default(1),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("objective_score"),
      activityIds: references.min(1),
      skill: skillIdSchema.optional(),
      minimumScore: score,
      minimumSamples: count.default(1),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("assessment"),
      assessmentId: reference,
      purpose: assessmentPurposeSchema,
      minimumScore: score.optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("review_score"),
      vocabularyIds: references.default([]),
      activityIds: references.default([]),
      minimumScore: score,
      minimumSamples: count.default(1),
      minimumReviews: count.default(1),
    })
    .strict(),
  z.object({ ...base, kind: z.literal("unit_completed") }).strict(),
]);
const policySchema = z
  .object({ requirements: z.array(learningRequirementSchema).max(50) })
  .strict();
export const unitLearningPolicySchema = z
  .object({
    completion: policySchema,
    mastery: policySchema,
  })
  .strict();
export type LearningRequirement = z.infer<typeof learningRequirementSchema>;
export type LearningPolicy = z.infer<typeof policySchema>;
export type UnitLearningPolicy = z.infer<typeof unitLearningPolicySchema>;
