import type { PublicLesson } from "@/content/public";
import type { StudyState } from "./study-state";

const learningEvents = new Set(["lesson_completed", "exercise_answered", "writing_submitted", "speaking_submitted"]);
/** A finite within-lesson retrieval cue, derived from persisted evidence. This is not an SRS or a grade. */
export function deferredRecoveryStatus(lesson: PublicLesson, state: Pick<StudyState, "attempts" | "events">) {
  const policy = lesson.deferredRecovery;
  if (!policy) return [];
  const normalIds = new Set(lesson.activities.map(activity => activity.id));
  return policy.rules.flatMap(rule => {
    // Any genuine attempt consumes the single authored recovery; reload/replay never creates a loop.
    if (state.attempts.some(attempt => attempt.activityId === rule.activity.id)) return [];
    const source = state.attempts.filter(attempt =>
      rule.sourceActivityIds.includes(attempt.activityId) && attempt.correct === false &&
      Number.isFinite(Date.parse(attempt.createdAt)))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))[0];
    if (!source) return [];
    const intervening = new Set(state.events.filter(event =>
      event.activityId && normalIds.has(event.activityId) && !rule.sourceActivityIds.includes(event.activityId) &&
      learningEvents.has(event.type) && Date.parse(event.createdAt) > Date.parse(source.createdAt))
      .map(event => event.activityId!));
    if (intervening.size < policy.delayActivities) return [];
    return [{ activity: rule.activity, conceptId: rule.conceptId,
      initialAttemptId: source.id, interveningActivities: intervening.size }];
  });
}
