import { z } from "zod";
import { segmentEvidenceSchema } from "./session-state";
export const interactiveLessonProgressReceiptSchema = z.object({
  evidence: segmentEvidenceSchema,
  answer: z.string().max(3000),
  createdAt: z.iso.datetime({ offset: true }),
  grade: z.object({ correct: z.boolean(), correctAnswer: z.string(), explanation: z.string(), variantId: z.string().optional() }).optional(),
  recordingIds: z.record(z.string(), z.uuid()),
});
export type InteractiveLessonProgressReceipt = z.infer<typeof interactiveLessonProgressReceiptSchema>;
