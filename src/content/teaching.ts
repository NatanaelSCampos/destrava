import { z } from "zod";
import { teachingLineSchema } from "./teaching-line";
import { sceneIllustrationSchema, sceneClockSchema, activitySceneSchema } from "./activity-scene";
export { teachingLineSchema } from "./teaching-line";

// CoursePackage 1.6: explicit data, no markup/DSL or executable URLs.
const id = z.string().trim().min(1);
const shortText = z.string().trim().min(1).max(500);
export const teachingSchema = z.object({
  kind: z.enum(["concept", "dialogue"]),
  lines: z.array(teachingLineSchema).min(1).max(8),
  support: z.string().trim().min(1).max(1200).optional(),
  diagram: z.object({
    nodes: z.array(z.object({ id, label: shortText, kind: z.enum(["person", "place"]) }).strict()).min(2).max(8),
    links: z.array(z.object({ from: id, to: id, label: shortText }).strict()).min(1).max(8),
  }).strict().optional(),
}).strict().superRefine((data, ctx) => {
  if (data.kind === "dialogue" && data.lines.some(line => !line.speaker))
    ctx.addIssue({ code: "custom", message: "Dialogue lines require a speaker." });
  if (data.diagram) {
    const ids = new Set(data.diagram.nodes.map(node => node.id));
    if (ids.size !== data.diagram.nodes.length || data.diagram.links.some(link =>
      !ids.has(link.from) || !ids.has(link.to) || link.from === link.to))
      ctx.addIssue({ code: "custom", message: "Diagram references must identify distinct declared nodes." });
  }
});
const recallModel = (data: {model: z.infer<typeof teachingSchema>}, ctx: z.RefinementCtx) => {
  if (data.model.kind !== "dialogue" || data.model.lines.length < 2 || data.model.diagram || data.model.support)
    ctx.addIssue({code: "custom", message: "Recall model requires a dialogue with at least two turns; support belongs to the referenced lesson."});
};
const recallShape = {title: shortText, context: shortText, action: shortText, model: teachingSchema};
export const legacyRecallSceneSchema = z.object({...recallShape, illustration: z.literal("message")}).strict().superRefine(recallModel);
export const recallSceneSchema = z.object({
  ...recallShape, illustration: sceneIllustrationSchema, clock: sceneClockSchema.optional(),
}).strict().superRefine((data, ctx) => {
  recallModel(data, ctx);
  if (data.clock && data.illustration !== "clock") ctx.addIssue({code: "custom", message: "Clock data requires the clock illustration."});
});
export const recordedBackSchema = z.object({
  audioMediaId: id, translation: shortText.optional(),
}).strict();
export const authoredFeedbackSchema = z.object({
  summaryCorrect: shortText,
  summaryIncorrect: shortText,
  alternatives: z.array(z.object({ answer: id, detail: shortText }).strict()).min(2).max(12),
}).strict();
export function deferredRecoverySchema<T extends z.ZodType>(activity: T) {
  return z.object({
    delayActivities: z.number().int().min(2).max(4),
    maxPerConcept: z.literal(1),
    rules: z.array(z.object({
      sourceActivityIds: z.array(id).min(1).max(10),
      conceptId: id,
      activity,
    }).strict()).min(1).max(8),
  }).strict();
}
export type Teaching = z.infer<typeof teachingSchema>;
export type AuthoredFeedback = z.infer<typeof authoredFeedbackSchema>;

export function teachingAudioReferences(payload: Record<string, unknown>): string[] {
  const teaching = teachingSchema.safeParse(payload.teaching);
  const back = recordedBackSchema.safeParse(payload.recordedBack);
  const recall = recallSceneSchema.safeParse(payload.recallScene);
  const scene = activitySceneSchema.safeParse(payload.scene);
  return [...new Set([
    ...(teaching.success ? teaching.data.lines.flatMap(line => line.audioMediaId ? [line.audioMediaId] : []) : []),
    ...(back.success ? [back.data.audioMediaId] : []),
    ...((Array.isArray(payload.cards) ? payload.cards : []) as {audioMediaIds?:string[]}[]).flatMap(card => card.audioMediaIds ?? []),
    ...(scene.success && scene.data.cue?.audioMediaId ? [scene.data.cue.audioMediaId] : []),
    ...(recall.success ? recall.data.model.lines.flatMap(line => line.audioMediaId ? [line.audioMediaId] : []) : []),
  ])];
}
export function hasTeachingPayload(payload: Record<string, unknown>): boolean {
  return ["teaching", "recordedBack", "feedback", "supportActivityIds"].some(key => payload[key] !== undefined);
}
