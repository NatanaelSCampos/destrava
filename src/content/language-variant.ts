import type { LanguagePackage } from "./contracts";

export function resolveVariant(language: LanguagePackage, value: unknown) {
  const requested = typeof value === "string" ? value : "";
  return language.variants.find((variant) => variant.id === requested)?.id ?? language.speech.defaultVariant;
}

export function variantLabel(language: LanguagePackage, value: unknown) {
  const id = resolveVariant(language, value);
  return language.variants.find((variant) => variant.id === id)?.name ?? language.identity.nativeName;
}

export function speechLocale(
  language: LanguagePackage,
  value: unknown,
  capability: "recognitionLocale" | "assessmentLocale" | "ttsLocale",
  provider = "azure",
) {
  const variant = resolveVariant(language, value);
  return language.speech.providers[provider]?.[variant]?.[capability] ?? null;
}

export function textToSpeechLocale(language: LanguagePackage, value: unknown) {
  const variant = resolveVariant(language, value);
  return Object.values(language.speech.providers).map((provider) => provider[variant]?.ttsLocale).find(Boolean) ?? null;
}
