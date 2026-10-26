import { z } from "zod";
import { teachingLineSchema } from "./teaching-line";

export const sceneIllustrationSchema = z.enum(["message", "meeting", "clock", "cafe", "menu", "takeaway"]);
export const sceneClockSchema = z.object({
  hour: z.number().int().min(1).max(12), minute: z.number().int().min(0).max(59),
}).strict();
export const sceneItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
  translation: z.string().trim().min(1).max(120).optional(),
  detail: z.string().trim().min(1).max(180).optional(),
  value: z.string().trim().min(1).max(60).optional(),
  icon: z.enum(["cup", "tea", "water", "bread", "clock", "pin", "receipt", "bag", "people", "quote"]),
}).strict();
export const activitySceneSchema = z.object({
  illustration: sceneIllustrationSchema,
  title: z.string().trim().min(1).max(120).optional(),
  context: z.string().trim().min(1).max(500),
  cue: teachingLineSchema.optional(),
  items: z.array(sceneItemSchema).min(1).max(4).optional(),
  clock: sceneClockSchema.optional(),
}).strict().superRefine((scene, ctx) => {
  if (scene.clock && scene.illustration !== "clock")
    ctx.addIssue({code: "custom", message: "Clock data requires the clock illustration."});
});
export type ActivityScene = z.infer<typeof activitySceneSchema>;
export type SceneItem = z.infer<typeof sceneItemSchema>;
export type SceneIllustrationKind = z.infer<typeof sceneIllustrationSchema>;

export function hasExperiencePayload(payload: Record<string, unknown>): boolean {
  const recall = payload.recallScene as {illustration?: unknown; clock?: unknown} | undefined;
  return payload.scene !== undefined || payload.reviewMode !== undefined ||
    (Array.isArray(payload.cards) && payload.cards.some(card => Boolean(card?.audioMediaIds))) ||
    Boolean(recall && (recall.illustration !== "message" || recall.clock !== undefined));
}
export function payloadScene(payload: Record<string, unknown>): ActivityScene | undefined {
  if (payload.scene) return activitySceneSchema.parse(payload.scene);
  const recall = payload.recallScene as {illustration?: unknown; title?: unknown; context?: unknown; clock?: unknown} | undefined;
  return recall ? activitySceneSchema.parse({
    illustration: recall.illustration, title: recall.title, context: recall.context,
    ...(recall.clock ? {clock: recall.clock} : {}),
  }) : undefined;
}
