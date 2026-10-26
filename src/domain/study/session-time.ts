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


/** Local engagement only; never changes a persisted manual pause. */
export class StudyActivityClock {
  private previousTickMs: number;
  private lastInteractionMs: number;
  private visible: boolean;
  constructor(nowMs: number, visible: boolean) {
    this.previousTickMs = nowMs;
    this.lastInteractionMs = nowMs;
    this.visible = visible;
  }
  setVisible(visible: boolean, nowMs: number) {
    this.visible = visible;
    this.previousTickMs = nowMs;
    if (visible) this.lastInteractionMs = nowMs;
  }
  interact(nowMs: number) {
    if (!this.visible) return;
    if (!this.isActive(nowMs)) this.previousTickMs = nowMs;
    this.lastInteractionMs = nowMs;
  }
  resetTick(nowMs: number) { this.previousTickMs = nowMs; }
  isActive(nowMs: number) {
    return this.visible && Number.isFinite(nowMs) && nowMs >= this.lastInteractionMs &&
      nowMs - this.lastInteractionMs < STUDY_IDLE_LIMIT_MS;
  }
  takeElapsedMs(nowMs: number, maximumMs = 2000) {
    const elapsed = advanceActiveStudySeconds(
      0, this.previousTickMs, nowMs, this.lastInteractionMs, this.visible,
    ) * 1000;
    this.previousTickMs = nowMs;
    return Math.max(0, Math.min(maximumMs, elapsed));
  }
}
