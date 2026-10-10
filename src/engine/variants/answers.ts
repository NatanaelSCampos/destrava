import type { AnswerPolicy } from "@/content/variant-contracts";

export function declaredAnswers(
  input: {
    answer?: string;
    accepted?: string[];
    fullAnswers?: string[];
    answerPolicy?: AnswerPolicy;
  },
  variantId?: string,
) {
  const alternatives = (input.answerPolicy?.alternatives ?? [])
    .filter((item) => !item.variants || (variantId && item.variants.includes(variantId)))
    .map((item) => item.text);
  const candidates = [
    ...(input.answer === undefined ? [] : [input.answer]),
    ...(input.accepted ?? []),
    ...(input.fullAnswers ?? []),
    ...alternatives,
  ];
  return input.answerPolicy?.requiredForms
    ? candidates.filter((text) => input.answerPolicy!.requiredForms!.includes(text))
    : candidates;
}
