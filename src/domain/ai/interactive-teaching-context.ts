import { z } from "zod";
import { lessonActionSchema, type InteractiveLessonDefinition, type LessonAction } from "@/content/contracts";
import { TimelineEngine, type LessonRuntimeState } from "@/domain/interactive-lesson/runtime";
import { sameEvidenceScope, type LessonEvidenceScope } from "@/domain/interactive-lesson/evidence";
import type { InteractiveTeachingFeedback } from "./schemas";
import type { SceneIllustrationKind } from "@/content/activity-scene";

const boundedId = z.string().trim().min(1).max(160);
const previousReplySchema = z.object({
  message: z.string().max(650), example: z.string().max(180),
  translation: z.string().max(180), followUp: z.string().max(180),
}).strict();
export const interactiveTeachingInputSchema = z.object({
  courseId: boundedId, lessonId: boundedId, segmentId: boundedId,
  contentVersion: boundedId, definitionHash: z.string().regex(/^[a-f0-9]{64}$/),
  sessionId: z.uuid(), revision: z.number().int().positive().max(2147483645),
  requestId: z.uuid(), positionMs: z.number().int().nonnegative(),
  question: z.string().trim().min(3).max(400),
  previousReply: previousReplySchema.optional(),
}).strict();
export type InteractiveTeachingInput = z.infer<typeof interactiveTeachingInputSchema>;
export class TeachingContextError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}

/** No activity payloads, student mistakes, private answers or client-supplied board enter this DTO. */
export function resolveTeachingMoment(
  input: InteractiveTeachingInput,
  definition: InteractiveLessonDefinition,
  runtime: LessonRuntimeState,
  scope: LessonEvidenceScope,
  revision: number,
) {
  if (input.courseId !== scope.courseId || input.lessonId !== scope.lessonId ||
      input.contentVersion !== scope.contentVersion || input.definitionHash !== scope.definitionHash ||
      input.sessionId !== scope.sessionId || input.revision !== revision ||
      !runtime.evidenceScope || !sameEvidenceScope(runtime.evidenceScope, scope))
    throw new TeachingContextError("TEACHING_SCOPE_CHANGED");
  const segment = definition.segments[runtime.segmentIndex];
  if (!segment || input.segmentId !== segment.id || !segment.presentation || !segment.allowInterruption ||
      !["presenting", "paused", "intervening"].includes(runtime.phase) ||
      ["checkpoint", "speaking", "activity"].includes(segment.type))
    throw new TeachingContextError("TEACHING_MOMENT_UNAVAILABLE", 422);
  const positionMs = runtime.phase === "intervening"
    ? runtime.resumePoint?.playbackPositionMs : runtime.positionMs;
  if (positionMs === undefined || (runtime.phase === "intervening" && runtime.resumePoint?.segmentId !== segment.id) ||
      input.positionMs > segment.presentation.durationMs || positionMs > segment.presentation.durationMs ||
      Math.abs(input.positionMs - positionMs) > 500)
    throw new TeachingContextError("TEACHING_POSITION_CHANGED");
  const timeline = new TimelineEngine();
  timeline.load(segment.cues);
  const board = timeline.getStateAt(positionMs);
  const visible = board.elements.slice(-4).map(element => element.kind === "comparison"
    ? { kind: element.kind, left: element.left.slice(0, 250), right: element.right.slice(0, 250), label: element.label?.slice(0, 80) }
    : { kind: element.kind, text: element.text.slice(0, 650), translation: element.translation?.slice(0, 250), label: element.label?.slice(0, 80) });
  const lines = segment.presentation.transcript.filter(line => line.startMs <= positionMs).slice(-3);
  const current = lines.findLast(line => line.endMs > positionMs) ?? lines.at(-1);
  const illustration = board.elements.findLast(element => element.illustration)?.illustration;
  return {
    segment, positionMs, illustration, transcript: current?.text.slice(0, 650) ?? "",
    teachingContext: {
      positionMs, precedingTranscript: lines.map(line => line.text.slice(0, 350)),
      board: visible, previousExchange: input.previousReply,
    },
  };
}

/** The provider never emits runtime commands. The server constructs this small visual allowlist. */
export function teachingBoardActions(
  reply: InteractiveTeachingFeedback,
  sourceLanguage: string,
  targetLanguage: string,
  illustration?: SceneIllustrationKind,
): LessonAction[] {
  const actions: unknown[] = [
    { type: "board.clear" },
    { type: "board.show", element: {
      kind: "text", id: "teacher-message", label: "Vamos por partes", icon: "quote",
      text: reply.message, ...(reply.messageParts ? { runs: reply.messageParts.map(part => ({
        text: part.text, ...(part.role === "source" || part.role === "target"
          ? { language: part.role === "target" ? targetLanguage : sourceLanguage } : {}),
      })) } : { textPresentation: { language: sourceLanguage } }),
    } },
  ];
  if (reply.example.trim()) actions.push({ type: "board.show", element: {
    kind: reply.translation.trim() ? "example" : "text", id: "teacher-example", label: "Veja em outra situação",
    text: reply.example, ...(reply.translation.trim() ? { translation: reply.translation } : {}),
    textPresentation: { language: targetLanguage }, ...(illustration ? { illustration } : {}),
  } });
  if (reply.followUp.trim()) actions.push({ type: "board.show", element: {
    kind: "text", id: "teacher-followUp", label: "Continue a conversa", icon: "people",
    text: reply.followUp, ...(reply.followUpRole === "source" || reply.followUpRole === "target"
        ? { textPresentation: { language: reply.followUpRole === "target" ? targetLanguage : sourceLanguage } } : {}),
  } });
  return actions.map(action => lessonActionSchema.parse(action));
}
