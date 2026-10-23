import { z } from "zod";
import { textPresentationSchema } from "@/content/text-presentation";
import { boardElementSchema } from "@/content/contracts";
const id = z.string().min(1).max(300);
export const evidenceScopeSchema = z.object({ userId: z.uuid(), courseId: id, lessonId: id,
  sessionId: z.uuid(), contentVersion: id, definitionHash: z.string().regex(/^[a-f0-9]{64}$/) });
export const segmentEvidenceSchema = evidenceScopeSchema.extend({ segmentId: id, activityId: id,
  attemptId: z.uuid(), sequence: z.number().int().positive().max(2147483646),
  kind: z.enum(["objective_correct", "writing_submitted", "speaking_submitted"]), accepted: z.boolean() });
const boardSchema = z.object({ elements: z.array(boardElementSchema).max(24),
  highlightedIds: z.array(id).max(8), translationVisible: z.boolean(), caption: z.string().max(300),
  captionPresentation: textPresentationSchema.optional(), teacherState: z.enum(["speaking", "paused", "listening"]) });
export const runtimeSchema = z.object({ schemaVersion: z.literal(2), evidenceScope: evidenceScopeSchema.nullable(),
  segmentEvidence: z.record(id, segmentEvidenceSchema),
  segmentAttemptSequences: z.record(id, z.number().int().positive().max(2147483646)),
  segmentFailures: z.record(id, z.number().int().nonnegative().max(200)),
  phase: z.enum(["idle", "presenting", "paused", "intervening", "checkpoint", "speaking", "reinforcement", "completed", "error"]),
  segmentIndex: z.number().int().nonnegative(), positionMs: z.number().int().nonnegative(), board: boardSchema,
  completedSegmentIds: z.array(id).max(256), checkpointPassed: z.boolean(), speakingSaved: z.boolean(),
  checkpointFailures: z.number().int().nonnegative().max(200), slowdownCount: z.number().int().nonnegative().max(100),
  resumePoint: z.object({ segmentId: id, playbackPositionMs: z.number().int().nonnegative(),
    anchorMs: z.number().int().nonnegative(), board: boardSchema, reason: z.string().max(40) }).nullable(),
  runtimePath: z.array(z.object({ id, segmentId: id, kind: z.enum(["canonical", "reinforcement"]), reason: z.string().optional() })).max(257),
  message: z.string().max(1500) });
export const sessionInputSchema = z.object({ courseId: id, lessonId: id, contentVersion: id,
  revision: z.number().int().positive().max(2147483645).nullable(), runtime: runtimeSchema });
export const segmentInputSchema = z.object({ courseId: id, lessonId: id, contentVersion: id,
  sessionId: z.uuid(), revision: z.coerce.number().int().positive().max(2147483645),
  segmentId: id, activityId: id, attemptId: z.uuid(), answer: z.string().max(3000) });
