import { findActivity, type Course } from "@/content/schema";
import type { LanguagePackage } from "@/content/contracts";
import { requireLearningVariant } from "@/engine/variants/resolution";
import { declaredAnswerCandidates, normalizeAnswer } from "@/domain/activities/grader";

/** Resolve private equivalences locally. This projection sends no answer strings to a provider. */
export function buildLinguisticAIContext(
  course: Course,
  language: LanguagePackage,
  sourceLanguage: string,
  preference: unknown,
  activityId?: string,
  studentText?: string,
) {
  const activity = activityId ? findActivity(course, activityId) : undefined;
  const variant = requireLearningVariant(language, course, preference, activity?.variant);
  let declaredResponse:
    "not_checked" | "authorized" | "other_variant" | "restricted_form" | "not_declared" =
    "not_checked";
  if (activity && studentText !== undefined) {
    const rules = activity.normalization ?? language.normalization;
    const equals = (text: string) =>
      normalizeAnswer(text, rules) === normalizeAnswer(studentText, rules);
    const candidates = declaredAnswerCandidates(activity, variant.variantId!);
    const alternative = activity.answerPolicy?.alternatives?.find((item) => equals(item.text));
    declaredResponse = candidates.some(equals)
      ? "authorized"
      : alternative?.variants && !alternative.variants.includes(variant.variantId!)
        ? "other_variant"
        : activity.answerPolicy?.requiredForms
          ? "restricted_form"
          : "not_declared";
  }
  return {
    sourceLanguage,
    targetLanguage: language.id,
    targetLanguageName: language.identity.nativeName,
    level: course.level,
    courseDefaultVariant: course.defaultVariant ?? language.speech.defaultVariant,
    variantId: variant.variantId!,
    selectedBy: variant.selectedBy,
    diagnostics: variant.diagnostics,
    acceptedCourseVariants: course.acceptedVariants ?? language.variants.map((v) => v.id),
    activity: activity
      ? {
          id: activity.id,
          type: activity.type,
          variant: activity.variant ?? null,
          declaredResponse,
          requiresDeclaredForm: Boolean(activity.answerPolicy?.requiredForms),
          normalization: activity.normalization ?? language.normalization,
          ...(activity.type === "writing"
            ? {
                textRequirement: activity.textRequirement ?? {
                  measure: { strategy: "whitespace_units" },
                  minimum: activity.minWords,
                },
              }
            : {}),
        }
      : null,
  };
}
export type LinguisticAIContext = ReturnType<typeof buildLinguisticAIContext>;
export const linguisticAssessmentInstructions =
  "Use linguisticContext as authoritative context. declaredResponse is computed by the engine, never by the model. authorized must not be flagged solely for differing from the main example. other_variant is a declared alternative outside the current variant; restricted_form indicates an explicit form restriction. not_declared is absence of canonical authorization, not proof of a linguistic error in open writing. Distinguish genuine errors from variant differences and uncertainty. Never invent equivalences or expand canonical answers. If uncertain give a conservative note. Operational locales do not determine pedagogical acceptability. AI feedback never changes objective grades.";
