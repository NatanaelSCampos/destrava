import type { PronunciationFeedback } from "@/domain/activities/pronunciation";

export type NumberMode = "dictation" | "speaking" | "repetition";
export type NumberCategory = string;

export type NumberPrompt = {
  id: string;
  category: NumberCategory;
  display: string;
  spoken: string;
  example: string;
  exampleTranslation: string;
  accepted?: string[];
};

function digits(value: string) {
  if (!/^[\d\s.,:/ºª€$-]+$/u.test(value.trim())) return "";
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function gradeNumberDictation(prompt: NumberPrompt, answer: string) {
  const actual = digits(answer);
  return (
    Boolean(actual) &&
    [prompt.display, ...(prompt.accepted ?? [])].some((value) => digits(value) === actual)
  );
}

export function numberSpeechScore(feedback: PronunciationFeedback) {
  const score = Math.round((feedback.accuracy + feedback.completeness) / 2);
  return { score, correct: feedback.accuracy >= 75 && feedback.completeness >= 75 };
}

export function numberPracticeLink(promptId?: string) {
  return promptId ? `/numbers?prompt=${encodeURIComponent(promptId)}` : "/numbers";
}
