import type { Activity } from "@/content/schema";
import type { ActivityPresentation } from "@/content/text-presentation";
import { gradePresentation } from "@/content/grade-presentation";
import type { NormalizationRules } from "@/content/contracts";
import { objectiveActivityTypes } from "@/content/activity-data";
import { assertWellFormedText } from "@/engine/text/representation";
import {
  requireLearningVariant,
  type VariantCourse,
  type VariantLanguage,
} from "@/engine/variants/resolution";
import { declaredAnswers } from "@/engine/variants/answers";

export const strictNormalization: NormalizationRules = {
  trimWhitespace: true,
  collapseWhitespace: true,
  caseInsensitive: true,
  ignoreTerminalPunctuation: true,
  ignoreDiacritics: false,
};

export function normalizeAnswer(value: string, rules: NormalizationRules = strictNormalization) {
  assertWellFormedText(value);
  let result = value.normalize("NFC");
  if (rules.trimWhitespace) result = result.trim();
  if (rules.collapseWhitespace) result = result.replace(/\s+/gu, " ");
  if (rules.caseInsensitive) result = result.toLowerCase();
  if (rules.ignoreTerminalPunctuation)
    result = result.replace(/^[¿¡]+/gu, "").replace(/[?!.;,·:]+$/gu, "");
  if (rules.ignoreDiacritics)
    result = result
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .normalize("NFC");
  // Removals can reveal whitespace or punctuation. Clean boundaries in one linear pass.
  if (rules.collapseWhitespace) result = result.replace(/\s+/gu, " ");
  if (rules.ignoreTerminalPunctuation)
    result = rules.trimWhitespace
      ? result.replace(/^[¿¡\s]+/gu, "").replace(/[?!.;,·:\s]+$/gu, "")
      : result.replace(/^[¿¡]+/gu, "").replace(/[?!.;,·:]+$/gu, "");
  return (rules.trimWhitespace ? result.trim() : result).normalize("NFC");
}

export type GradeResult = {
  completionReceipt?: string;
  correct: boolean;
  correctAnswer: string;
  completeAnswer?: string;
  explanation: string;
  presentation?: ActivityPresentation;
  feedback?: {
    summary: string;
    detail?: string;
    alternatives: { answer: string; detail: string }[];
  };
  transcript?: string;
  variantId?: string;
};
export type GradingContext = {
  language: VariantLanguage;
  course: VariantCourse;
  preference?: unknown;
};

export function declaredAnswerCandidates(activity: Activity, variantId?: string) {
  return declaredAnswers(activity, variantId);
}

export function gradeActivity(
  activity: Activity,
  rawAnswer: string,
  languageRules: NormalizationRules = strictNormalization,
  context?: GradingContext,
): GradeResult | null {
  if (!objectiveActivityTypes.some((type) => type === activity.type)) return null;
  if (!context && (activity.variant || activity.answerPolicy))
    throw new Error("Variant-aware grading requires linguistic context");
  const variantId = context
    ? requireLearningVariant(context.language, context.course, context.preference, activity.variant)
        .variantId!
    : undefined;
  const candidates = declaredAnswerCandidates(activity, variantId);
  if (!candidates.length) throw new Error("No declared answer satisfies the required forms");
  const answer = candidates[0];
  const fullAnswers =
    activity.type === "fill_blank"
      ? activity.fullAnswers.filter((text) => candidates.includes(text))
      : [];
  const rules = activity.normalization ?? languageRules;
  const correct = candidates.some(
    (candidate) => normalizeAnswer(candidate, rules) === normalizeAnswer(rawAnswer, rules),
  );
  const detailIndex =
    activity.feedback?.alternatives.findIndex(
      (item) => normalizeAnswer(item.answer, rules) === normalizeAnswer(rawAnswer, rules),
    ) ?? -1;
  return {
    correct,
    ...(activity.presentation
      ? {
          presentation: gradePresentation(activity.presentation, correct, detailIndex, {
            answer,
            ...(activity.type === "listening" ? { transcript: activity.transcript } : {}),
          }),
        }
      : {}),
    ...(variantId ? { variantId } : {}),
    correctAnswer: answer,
    ...(activity.feedback
      ? {
          feedback: {
            summary: correct
              ? activity.feedback.summaryCorrect
              : activity.feedback.summaryIncorrect,
            detail: activity.feedback.alternatives.find(
              (item) => normalizeAnswer(item.answer, rules) === normalizeAnswer(rawAnswer, rules),
            )?.detail,
            alternatives: activity.feedback.alternatives,
          },
        }
      : {}),
    ...(fullAnswers.length ? { completeAnswer: fullAnswers[0] } : {}),
    explanation:
      activity.explanation ??
      (correct ? "Muito bem!" : "Revise a explicação da lição e tente novamente."),
    ...(activity.type === "listening" ? { transcript: activity.transcript } : {}),
  };
}
