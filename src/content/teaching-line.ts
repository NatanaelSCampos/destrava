import { z } from "zod";
export const teachingLineSchema = z.object({
  text: z.string().trim().min(1).max(500),
  translation: z.string().trim().min(1).max(500).optional(),
  speaker: z.string().trim().min(1).max(80).optional(),
  audioMediaId: z.string().trim().min(1).optional(),
}).strict();
