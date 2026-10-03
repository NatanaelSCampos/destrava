import type { Activity } from "@/content/schema";
import type { NormalizationRules } from "@/content/contracts";

export const strictNormalization: NormalizationRules = {
  trimWhitespace: true,
  collapseWhitespace: true,
  caseInsensitive: true,
  ignoreTerminalPunctuation: true,
  ignoreDiacritics: false,
};

export function normalizeAnswer(value: string, rules: NormalizationRules = strictNormalization) {
  let result = value.normalize("NFC");
  if (rules.trimWhitespace) result = result.trim();
  if (rules.collapseWhitespace) result = result.replace(/\s+/gu, " ");
  if (rules.caseInsensitive) result = result.toLowerCase();
  if (rules.ignoreTerminalPunctuation)
    result = result.replace(/^[¿¡]+/gu, "").replace(/[?!.;,·:]+$/gu, "");
  if (rules.ignoreDiacritics)
    result = result.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").normalize("NFC");
  return rules.trimWhitespace ? result.trim() : result;
}

export type GradeResult = {
  correct: boolean;
  correctAnswer: string;
  completeAnswer?: string;
  explanation: string;
  transcript?: string;
};

export function gradeActivity(
  activity: Activity,
  rawAnswer: string,
  languageRules: NormalizationRules = strictNormalization,
): GradeResult | null {
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
  const rules = activity.normalization ?? languageRules;
  const correct = [answer, ...accepted, ...fullAnswers].some(
    (candidate) => normalizeAnswer(candidate, rules) === normalizeAnswer(rawAnswer, rules),
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
