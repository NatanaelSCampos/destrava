import type { LanguagePackage } from "./contracts";
import { requireLearningVariant, type VariantCourse } from "@/engine/variants/resolution";
import type { ActivityVariant } from "./variant-contracts";

export function resolveVariant(
  language: LanguagePackage,
  value: unknown,
  course: VariantCourse = {},
  activity?: ActivityVariant,
) {
  return requireLearningVariant(language, course, value, activity).variantId!;
}

export function variantLabel(
  language: LanguagePackage,
  value: unknown,
  course: VariantCourse = {},
  activity?: ActivityVariant,
) {
  const id = resolveVariant(language, value, course, activity);
  return (
    language.variants.find((variant) => variant.id === id)?.name ?? language.identity.nativeName
  );
}

export function speechLocale(
  language: LanguagePackage,
  value: unknown,
  capability: "recognitionLocale" | "assessmentLocale" | "ttsLocale",
  provider = "azure",
  course: VariantCourse = {},
  activity?: ActivityVariant,
) {
  const variant = resolveVariant(language, value, course, activity);
  return language.speech.providers[provider]?.[variant]?.[capability] ?? null;
}

export function textToSpeechLocale(
  language: LanguagePackage,
  value: unknown,
  course: VariantCourse = {},
  activity?: ActivityVariant,
) {
  const variant = resolveVariant(language, value, course, activity);
  return (
    Object.values(language.speech.providers)
      .map((provider) => provider[variant]?.ttsLocale)
      .find(Boolean) ?? null
  );
}
