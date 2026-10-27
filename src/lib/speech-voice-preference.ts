import { azureLocale, type AzureVoiceGender } from "./azure-voices";
const storagePrefix = "destrava:azure-voice:v2:";
const preferenceLanguage = (locale: string) => normalizedVoiceLocale(locale).split("-")[0];
export function normalizedVoiceLocale(locale: string) {
  return locale.replaceAll("_", "-").toLowerCase();
}
export function readVoicePreference(locale: string): AzureVoiceGender {
  if (typeof window === "undefined") return "female";
  try {
    return (window.localStorage.getItem(storagePrefix + preferenceLanguage(locale)) ??
      window.localStorage.getItem(storagePrefix + normalizedVoiceLocale(locale))) === "male"
      ? "male"
      : "female";
  } catch {
    return "female";
  }
}
export function saveVoicePreference(locale: string, gender: string) {
  if (!azureLocale(locale) || !["female", "male"].includes(gender)) return false;
  try {
    window.localStorage.setItem(storagePrefix + preferenceLanguage(locale), gender);
    window.dispatchEvent(
      new CustomEvent("destrava:voice-preference", {
        detail: { locale: normalizedVoiceLocale(locale) },
      }),
    );
    return true;
  } catch {
    return false;
  }
}
