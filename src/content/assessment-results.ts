import { z } from "zod";
import { assessmentPurposeSchema, skillIdSchema } from "./contracts";

export const assessmentResponseSchema = z
  .object({ activityId: z.string().min(1), answer: z.string().max(10000) })
  .strict();
export const assessmentRequestSchema = z
  .object({
    courseId: z.string().min(1),
    assessmentId: z.string().min(1),
    attemptId: z.uuid(),
    startedAt: z.iso.datetime(),
    responses: z.array(assessmentResponseSchema).min(1).max(100),
  })
  .strict();
export const assessedAnswerSchema = z.object({
  activityId: z.string(),
  answer: z.string(),
  correct: z.boolean().nullable(),
  skill: skillIdSchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().optional(),
  variantId: z.string().min(1).optional(),
});
export const serverAssessmentResultSchema = z
  .object({
    id: z.uuid(),
    courseId: z.string(),
    assessmentId: z.string(),
    purpose: assessmentPurposeSchema,
    method: z.enum(["adaptive", "fixed"]),
    unitId: z.string().optional(),
    lessonId: z.string().optional(),
    contentVersion: z.string(),
    variantId: z.string().min(1).optional(),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime(),
    source: z.literal("server"),
    status: z.enum(["completed", "insufficient"]),
    objectiveScore: z.number().min(0).max(100).nullable(),
    passed: z.boolean().nullable(),
    answers: z.array(assessedAnswerSchema),
    responseKey: z.string(),
  })
  .strict();
export type AssessmentRequest = z.infer<typeof assessmentRequestSchema>;
export type AssessmentResponse = z.infer<typeof assessmentResponseSchema>;
export type AssessedAnswer = z.infer<typeof assessedAnswerSchema>;
export type ServerAssessmentResult = z.infer<typeof serverAssessmentResultSchema>;

// Parse both inputs to normalize object-key order, including JSONB responses.
// Array order is significant for the adaptive path and is preserved.
export function sameAssessmentRequest(stored: unknown, input: AssessmentRequest) {
  const parsed = assessmentRequestSchema.safeParse(stored);
  return parsed.success && JSON.stringify(parsed.data) === JSON.stringify(input);
}
