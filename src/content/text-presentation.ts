import { z } from "zod";

export const textDirectionSchema = z.enum(["ltr", "rtl", "auto"]);
export const textPresentationSchema = z
  .object({
    language: z.string().trim().min(2).max(80).optional(),
    direction: textDirectionSchema.optional(),
  })
  .strict();
export const presentationFieldSchema = z.enum([
  "title",
  "prompt",
  "body",
  "guidance",
  "example",
  "options",
  "tokens",
  "answer",
  "transcript",
  "referenceText",
  "feedback",
  "input",
  "front",
  "back",
  "highlights",
]);
export const activityPresentationSchema = z
  .object({
    content: textPresentationSchema.optional(),
    fields: z.partialRecord(presentationFieldSchema, textPresentationSchema).optional(),
  })
  .strict();
export type TextPresentation = z.infer<typeof textPresentationSchema>;
export type ActivityPresentation = z.infer<typeof activityPresentationSchema>;
export type PresentationField = z.infer<typeof presentationFieldSchema>;
