import type { Activity } from "@/content/schema";

export function normalizeAnswer(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[¿?¡!.,;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type GradeResult = {
  correct: boolean;
  correctAnswer: string;
  completeAnswer?: string;
  explanation: string;
  transcript?: string;
};

export function gradeActivity(activity: Activity, rawAnswer: string): GradeResult | null {
  if (
    ![
      "multiple_choice",
      "true_false",
      "fill_blank",
      "ordering",
      "short_answer",
      "listening",
    ].includes(activity.type)
  )
    return null;
  const answer = "answer" in activity ? activity.answer : "";
  const accepted = "accepted" in activity ? activity.accepted : [];
  const fullAnswers = activity.type === "fill_blank" ? activity.fullAnswers : [];
  const correct = [answer, ...accepted, ...fullAnswers].some(
    (candidate) => normalizeAnswer(candidate) === normalizeAnswer(rawAnswer),
  );
  return {
    correct,
    correctAnswer: answer,
    ...(fullAnswers.length ? { completeAnswer: fullAnswers[0] } : {}),
    explanation:
      activity.explanation ??
      (correct ? "Muito bem!" : "Revise a explicação da lição e tente novamente."),
    ...(activity.type === "listening" ? { transcript: activity.transcript } : {}),
  };
}
