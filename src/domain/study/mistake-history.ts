import type { StudyState } from "./study-state";

export type MistakeHistoryEntry = {
  id: string;
  at: string;
  source: "exercise" | "writing" | "speaking" | "review";
  answer: string;
  correct: boolean | null;
};

export function mistakeHistory(
  state: StudyState,
  activityId: string,
  limit = 5,
): MistakeHistoryEntry[] {
  const scheduleId = state.mistakes[activityId]?.schedule.id;
  return [
    ...state.attempts
      .filter((item) => item.activityId === activityId)
      .map((item) => ({
        id: item.id,
        at: item.createdAt,
        source: "exercise" as const,
        answer: item.answer,
        correct: item.correct,
      })),
    ...state.writing
      .filter((item) => item.activityId === activityId)
      .map((item) => ({
        id: item.id,
        at: item.createdAt,
        source: "writing" as const,
        answer: item.text,
        correct: null,
      })),
    ...state.speaking
      .filter((item) => item.activityId === activityId)
      .map((item) => ({
        id: item.id,
        at: item.createdAt,
        source: "speaking" as const,
        answer: item.transcription,
        correct: null,
      })),
    ...state.reviews
      .filter((item) => item.scheduleId === scheduleId)
      .map((item) => ({
        id: item.id,
        at: item.reviewedAt,
        source: "review" as const,
        answer: item.correct ? "Lembrei" : "Ainda difícil",
        correct: item.correct,
      })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
