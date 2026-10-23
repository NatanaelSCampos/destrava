import { boundedStudySeconds } from "./session-time";
import type { StudyState } from "./study-state";

/** Session controls record navigation and active time, never learning evidence. */
export function checkpointSession(state: StudyState, sessionId: string, input: {
  seconds?: number; cursor?: number; paused?: boolean;
}): StudyState {
  if (state.activeSessionId !== sessionId) return state;
  const sessions = state.sessions.map(session => {
    if (session.id !== sessionId || session.finishedAt) return session;
    const durationSeconds = input.seconds === undefined ? session.durationSeconds
      : Math.max(session.durationSeconds, boundedStudySeconds(input.seconds));
    const cursor = input.cursor === undefined ? (session.cursor ?? 0)
      : Math.max(0, Math.min(session.plan.length, Math.floor(input.cursor)));
    if (!Number.isFinite(cursor)) return session;
    const paused = input.paused ?? session.paused ?? false;
    if (durationSeconds === session.durationSeconds && cursor === session.cursor && paused === session.paused) return session;
    return { ...session, durationSeconds, cursor, paused };
  });
  return sessions.every((session, i) => session === state.sessions[i]) ? state : { ...state, sessions };
}
