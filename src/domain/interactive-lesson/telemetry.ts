import type { InteractiveLessonDefinition } from "@/content/contracts";
import type { LessonRuntimeState } from "./runtime";

export type OperationalEvent = { type: string; segmentId: string; activityId?: string };

// Operational signals only. Learning evidence stays with the existing activity/speech flows.
export function deriveLessonEvents(previous: LessonRuntimeState | null, current: LessonRuntimeState,
  lesson: InteractiveLessonDefinition): OperationalEvent[] {
  const events: OperationalEvent[] = [];
  const segment = lesson.segments[current.segmentIndex];
  const before = previous ? lesson.segments[previous.segmentIndex] : undefined;
  if (!segment) return events;
  const add = (type: string, target = segment) => events.push({ type, segmentId: target.id,
    ...(target.activityRef ? { activityId: target.activityRef } : {}) });
  if (!previous || previous.phase === "idle") {
    if (current.phase !== "idle") { add("lesson.started"); add("lesson.segment.started"); }
    return events;
  }
  if (previous.segmentIndex !== current.segmentIndex) {
    if (before) add("lesson.segment.completed", before);
    add("lesson.segment.started");
  }
  if (previous.phase !== "intervening" && current.phase === "intervening") {
    add("lesson.interrupted");
    if (current.resumePoint?.reason === "explain") add("lesson.did_not_understand");
    if (current.resumePoint?.reason === "example") add("lesson.example_requested");
  }
  if (previous.phase === "intervening" && current.phase !== "intervening") add("lesson.resumed");
  if (current.slowdownCount > previous.slowdownCount) add("lesson.slower_requested");
  if (current.checkpointFailures > previous.checkpointFailures) add("lesson.checkpoint.failed", before?.type === "checkpoint" ? before : segment);
  if (!previous.checkpointPassed && current.checkpointPassed) add(current.segmentEvidence[segment.id]?.kind === "writing_submitted" ? "lesson.checkpoint.submitted" : "lesson.checkpoint.passed", before?.type === "checkpoint" ? before : segment);
  if (!previous.speakingSaved && current.speakingSaved) add("lesson.speaking.attempted", before?.type === "speaking" ? before : segment);
  if (!previous.runtimePath.some((node) => node.kind === "reinforcement") &&
      current.runtimePath.some((node) => node.kind === "reinforcement")) add("lesson.reinforcement.inserted");
  if (previous.phase !== "completed" && current.phase === "completed") {
    add("lesson.segment.completed"); add("lesson.completed");
  }
  return events;
}
