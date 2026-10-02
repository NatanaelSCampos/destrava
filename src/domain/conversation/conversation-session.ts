import type { ConversationScenario } from "@/content/conversation-scenarios";

export type ConversationMode = "free" | "mission";
export type ConversationPace = "beginner" | "intermediate" | "natural";
export type ConversationCorrection = "instant" | "important_only" | "end_of_conversation" | "off";
export type ConversationCorrectionCategory =
  "none" | "grammar" | "vocabulary" | "clarity" | "other";
export type ConversationTurn = {
  id: string;
  role: "student" | "partner";
  text: string;
  createdAt: string;
  correction?: string;
  inputMode?: "text" | "speech";
  correctionCategory?: ConversationCorrectionCategory;
  completedObjectiveIds?: string[];
};
export type ConversationSession = {
  id: string;
  courseId: string;
  mode: ConversationMode;
  scenarioId: string | null;
  topic: string;
  pace: ConversationPace;
  correction: ConversationCorrection;
  turns: ConversationTurn[];
  completedObjectiveIds: string[];
  startedAt: string;
  finishedAt: string | null;
};

export function startConversation(input: {
  courseId: string;
  mode: ConversationMode;
  scenario?: ConversationScenario;
  topic: string;
  pace: ConversationPace;
  correction: ConversationCorrection;
}): ConversationSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    courseId: input.courseId,
    mode: input.mode,
    scenarioId: input.scenario?.id ?? null,
    topic: input.topic.trim().slice(0, 80),
    pace: input.pace,
    correction: input.correction,
    turns: input.scenario
      ? [{ id: crypto.randomUUID(), role: "partner", text: input.scenario.opening, createdAt: now }]
      : [],
    completedObjectiveIds: [],
    startedAt: now,
    finishedAt: null,
  };
}

export function appendConversationReply(
  session: ConversationSession,
  studentText: string,
  reply: {
    text: string;
    correction: string;
    correctionCategory: ConversationCorrectionCategory;
    completedObjectiveIds: string[];
  },
  objectiveIds: string[],
  inputMode: "text" | "speech" = "text",
): ConversationSession {
  if (session.finishedAt || session.turns.filter((turn) => turn.role === "student").length >= 16)
    return session;
  const now = new Date().toISOString();
  const allowed = new Set(objectiveIds);
  return {
    ...session,
    turns: [
      ...session.turns,
      {
        id: crypto.randomUUID(),
        role: "student",
        text: studentText.trim(),
        inputMode,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        role: "partner",
        text: reply.text.trim(),
        correction: reply.correction.trim(),
        correctionCategory: reply.correction.trim() ? reply.correctionCategory : "none",
        completedObjectiveIds: reply.completedObjectiveIds.filter((id) => allowed.has(id)),
        createdAt: now,
      },
    ],
    completedObjectiveIds: [
      ...new Set([
        ...session.completedObjectiveIds,
        ...reply.completedObjectiveIds.filter((id) => allowed.has(id)),
      ]),
    ],
  };
}

export function finishConversation(session: ConversationSession): ConversationSession {
  return session.finishedAt ? session : { ...session, finishedAt: new Date().toISOString() };
}
