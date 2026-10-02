import type { StudyState } from "./study-state";

export type LearningMemory = {
  recentTopics: string[];
  correctionPatterns: Array<{ category: string; count: number; example: string }>;
  unfinishedMissionIds: string[];
  voiceTurns: number;
  imageCorrections: number;
  repeatedAudioPhrases: number;
};

const categoryLabels: Record<string, string> = {
  grammar: "gramática",
  vocabulary: "vocabulário",
  clarity: "clareza",
  other: "outro ajuste",
};

export function buildLearningMemory(state: StudyState, courseId: string): LearningMemory {
  const conversations = (state.conversations ?? [])
    .filter((session) => session.courseId === courseId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 16);
  const corrections = new Map<string, { count: number; example: string }>();
  let voiceTurns = 0;
  for (const session of conversations) {
    for (const turn of session.turns) {
      if (turn.role === "student" && turn.inputMode === "speech") voiceTurns += 1;
      if (turn.role !== "partner" || !turn.correction?.trim()) continue;
      const category =
        turn.correctionCategory && turn.correctionCategory !== "none"
          ? turn.correctionCategory
          : "other";
      const previous = corrections.get(category);
      corrections.set(category, {
        count: (previous?.count ?? 0) + 1,
        example: previous?.example ?? turn.correction.trim().slice(0, 160),
      });
    }
  }
  const images = (state.imageDescriptions ?? [])
    .filter((attempt) => attempt.courseId === courseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);
  const replayCounts = new Map<string, number>();
  for (const event of state.events ?? [])
    if (
      event.type === "conversation_partner_audio" &&
      event.metadata?.courseId === courseId &&
      event.itemId
    )
      replayCounts.set(event.itemId, (replayCounts.get(event.itemId) ?? 0) + 1);
  return {
    recentTopics: [
      ...new Set(
        conversations.map((session) => session.topic || session.scenarioId || "").filter(Boolean),
      ),
    ].slice(0, 3),
    correctionPatterns: [...corrections.entries()]
      .map(([category, value]) => ({ category: categoryLabels[category] ?? category, ...value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    unfinishedMissionIds: conversations
      .filter(
        (session) =>
          session.mode === "mission" &&
          !session.finishedAt &&
          session.turns.some((turn) => turn.role === "student"),
      )
      .map((session) => session.scenarioId)
      .filter((id): id is string => Boolean(id))
      .slice(0, 3),
    voiceTurns,
    imageCorrections: images.filter((attempt) => attempt.feedback.correction.trim()).length,
    repeatedAudioPhrases: [...replayCounts.values()].filter((count) => count >= 3).length,
  };
}
