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

function numericAnswer(value: string, category: string) {
  const trimmed = value.trim();
  if (category === "money") {
    const plain = trimmed.replace(/[€$\s]/g, "");
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(plain)) return "";
    const [whole, cents = ""] = plain.split(/[,.]/);
    return `${Number(whole)}.${cents.padEnd(2, "0")}`;
  }
  const ordinal = category === "ordinal" ? trimmed.replace(/(?:st|nd|rd|th)$/i, "") : trimmed;
  if (!/^[\d\s.,:/ºª-]+$/u.test(ordinal)) return "";
  return ordinal.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function gradeNumberDictation(prompt: NumberPrompt, answer: string) {
  const actual = numericAnswer(answer, prompt.category);
  return (
    Boolean(actual) &&
    [prompt.display, ...(prompt.accepted ?? [])].some((value) => numericAnswer(value, prompt.category) === actual)
  );
}

export function numberSpeechScore(feedback: PronunciationFeedback) {
  const score = Math.round((feedback.accuracy + feedback.completeness) / 2);
  return { score, correct: feedback.accuracy >= 75 && feedback.completeness >= 75 };
}

export function numberPracticeLink(promptId?: string) {
  return promptId ? `/numbers?prompt=${encodeURIComponent(promptId)}` : "/numbers";
}
