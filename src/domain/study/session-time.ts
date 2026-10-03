import type { StudySession } from "./study-state";

export const MAX_STUDY_SESSION_SECONDS = 4 * 60 * 60;
export const STUDY_IDLE_LIMIT_MS = 5 * 60 * 1000;

export function boundedStudySeconds(seconds: number) {
  return Number.isFinite(seconds)
    ? Math.max(0, Math.min(MAX_STUDY_SESSION_SECONDS, Math.floor(seconds)))
    : 0;
}

export function sessionTimeNeedsCorrection(session: StudySession) {
  return Boolean(session.finishedAt) &&
    (!Number.isFinite(session.durationSeconds) ||
      session.durationSeconds < 0 ||
      session.durationSeconds > MAX_STUDY_SESSION_SECONDS);
}

export function countedStudySeconds(session: StudySession) {
  if (!session.finishedAt || sessionTimeNeedsCorrection(session)) return 0;
  return boundedStudySeconds(session.durationSeconds);
}

export function advanceActiveStudySeconds(
  seconds: number,
  previousTickMs: number,
  nowMs: number,
  lastInteractionMs: number,
  visible: boolean,
) {
  if (!visible || !Number.isFinite(nowMs) || !Number.isFinite(previousTickMs)) return seconds;
  const activeUntil = Math.min(nowMs, lastInteractionMs + STUDY_IDLE_LIMIT_MS);
  const increment = Math.max(0, Math.min(2000, activeUntil - previousTickMs)) / 1000;
  return Math.min(MAX_STUDY_SESSION_SECONDS, Math.max(0, seconds) + increment);
}
