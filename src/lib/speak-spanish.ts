import {
  normalizedVoiceLocale,
  readSpanishVoicePreference,
  spanishVoiceId,
} from "@/lib/speech-voice-preference";

export function speakSpanish(text: string, onError?: () => void, locale = "es-ES", rate = 0.86) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

  const spokenText = text.trim().replace(/\s*\/\s*/g, ", ");
  if (!spokenText) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = locale;
  utterance.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const preferredId = readSpanishVoicePreference(locale);
  const voice =
    voices.find(
      (item) =>
        preferredId === spanishVoiceId(item) &&
        normalizedVoiceLocale(item.lang) === normalizedVoiceLocale(locale),
    ) ??
    voices.find((item) => normalizedVoiceLocale(item.lang) === normalizedVoiceLocale(locale)) ??
    voices.find((item) => normalizedVoiceLocale(item.lang).startsWith("es-"));
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.onerror = (event) => {
    if (event.error !== "canceled" && event.error !== "interrupted") onError?.();
  };
  window.speechSynthesis.speak(utterance);
  return true;
}
