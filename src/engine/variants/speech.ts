import type { LanguagePackage } from "@/content/contracts";
import { requireLearningVariant, type VariantCourse } from "./resolution";
import type { ActivityVariant } from "@/content/variant-contracts";

export type SpeechSelection = {
  status: "selected" | "unavailable";
  requestedVariant: string;
  requestedLocale: string | null;
  operationalLocale: string | null;
  compatibility: "declared_mapping" | "different_locale" | "unavailable";
  fallback: boolean;
  fallbackAllowed: boolean;
  reason?: string;
};
export function resolveSpeechOperation(
  language: LanguagePackage,
  course: VariantCourse,
  preference: unknown,
  capability: "ttsLocale" | "recognitionLocale" | "assessmentLocale",
  activity?: ActivityVariant,
  provider = "azure",
): SpeechSelection {
  const resolution = requireLearningVariant(language, course, preference, activity);
  const requestedVariant = resolution.variantId!;
  const locale = language.speech.providers[provider]?.[requestedVariant]?.[capability] ?? null;
  const supported =
    language.speech.support[
      capability === "ttsLocale"
        ? "textToSpeech"
        : capability === "recognitionLocale"
          ? "speechRecognition"
          : "pronunciationAssessment"
    ];
  return {
    status: locale && supported ? "selected" : "unavailable",
    requestedVariant,
    requestedLocale: locale,
    operationalLocale: locale && supported ? locale : null,
    compatibility: locale && supported ? "declared_mapping" : "unavailable",
    fallback: false,
    fallbackAllowed:
      resolution.speechFallback === "same_language" && capability !== "assessmentLocale",
    ...(!locale || !supported
      ? {
          reason:
            "No declared service mapping for the pedagogical variant; no evaluation occurred.",
        }
      : {}),
  };
}

export type VoiceDescriptor = { lang: string; voiceURI: string; name: string };
const localeKey = (value: string) => value.replaceAll("_", "-").toLowerCase();
export const descriptorId = (voice: VoiceDescriptor) =>
  `${localeKey(voice.lang)}:${voice.voiceURI || voice.name}`;
/** Exact operational locale match is only a declared mapping, not acoustic validation. */
export function selectBrowserVoice<T extends VoiceDescriptor>(
  voices: T[],
  requestedLocale: string,
  fallbackAllowed: boolean,
  preferredId = "",
  requestedVariant = "",
): SpeechSelection & { voice: T | null } {
  const exact = voices.filter((voice) => localeKey(voice.lang) === localeKey(requestedLocale));
  const voice =
    exact.find((voice) => descriptorId(voice) === preferredId) ??
    exact[0] ??
    (fallbackAllowed
      ? voices.find(
          (voice) =>
            localeKey(voice.lang).split("-")[0] === localeKey(requestedLocale).split("-")[0],
        )
      : undefined);
  const fallback = Boolean(voice && !exact.includes(voice));
  return {
    status: voice ? "selected" : "unavailable",
    requestedVariant,
    requestedLocale,
    operationalLocale: voice?.lang ?? null,
    compatibility: !voice ? "unavailable" : fallback ? "different_locale" : "declared_mapping",
    fallback,
    fallbackAllowed,
    voice: voice ?? null,
    ...(!voice
      ? { reason: "No compatible installed voice; variant fidelity is not available." }
      : {}),
  };
}
