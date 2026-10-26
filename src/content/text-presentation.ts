import { z } from "zod";

export const textDirectionSchema = z.enum(["ltr", "rtl", "auto"]);
export const textPresentationSchema = z.object({
  language: z.string().trim().min(2).max(80).optional(),
  direction: textDirectionSchema.optional(),
}).strict();
export const legacyPresentationFieldSchema = z.enum([
  "title", "prompt", "body", "guidance", "example", "options", "tokens", "answer",
  "transcript", "referenceText", "feedback", "input", "front", "back", "highlights",
]);
export const presentationFieldSchema = z.enum([
  ...legacyPresentationFieldSchema.options, "support", "explanation", "feedbackSummary", "feedbackAlternative",
]);
export const inlineAnnotationSchema = z.object({
  text: z.string().min(1).max(500),
  occurrence: z.number().int().min(1).max(100).default(1),
  item: z.number().int().min(0).max(100).default(0),
  role: z.enum(["target", "source"]),
}).strict();
export const legacyActivityPresentationSchema = z.object({
  content: textPresentationSchema.optional(),
  fields: z.partialRecord(legacyPresentationFieldSchema, textPresentationSchema).optional(),
}).strict();
export const activityPresentationSchema = z.object({
  content: textPresentationSchema.optional(),
  fields: z.partialRecord(presentationFieldSchema, textPresentationSchema).optional(),
  annotations: z.partialRecord(presentationFieldSchema, z.array(inlineAnnotationSchema).min(1).max(100)).optional(),
}).strict();
export type TextPresentation = z.infer<typeof textPresentationSchema>;
export type ActivityPresentation = z.infer<typeof activityPresentationSchema>;
export type PresentationField = z.infer<typeof presentationFieldSchema>;
export type InlineAnnotation = z.infer<typeof inlineAnnotationSchema>;

// Exact authored spans; never language detection, markup or executable content.
export function annotatedParts(text: string, annotations: InlineAnnotation[] = [], item = 0) {
  const spans = annotations.filter(a => a.item === item).map(a => {
    let start = -1;
    for (let n = 0; n < a.occurrence; n++) {
      start = text.indexOf(a.text, start + 1);
      if (start < 0) throw new Error("Inline annotation does not match its authored text.");
    }
    return { start, end: start + a.text.length, role: a.role };
  }).sort((a, b) => a.start - b.start);
  const parts: { text: string; role?: "target" | "source" }[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) throw new Error("Inline annotations overlap.");
    if (span.start > cursor) parts.push({ text: text.slice(cursor, span.start) });
    parts.push({ text: text.slice(span.start, span.end), role: span.role });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
export const privatePresentationFields = new Set<PresentationField>([
  "answer", "explanation", "feedback", "feedbackSummary", "feedbackAlternative",
]);
export function publicPresentation(presentation: ActivityPresentation | undefined, hideTranscript = false): ActivityPresentation | undefined {
  if (!presentation) return undefined;
  const allowed = (key: string) => !privatePresentationFields.has(key as PresentationField) && !(hideTranscript && key === "transcript");
  return {
    ...presentation,
    ...(presentation.fields ? { fields: Object.fromEntries(Object.entries(presentation.fields).filter(([key]) => allowed(key))) } : {}),
    ...(presentation.annotations ? { annotations: Object.fromEntries(Object.entries(presentation.annotations).filter(([key]) => allowed(key))) } : {}),
  };
}
