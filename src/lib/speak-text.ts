import {
  normalizedVoiceLocale,
  readVoicePreference,
  voiceId,
} from "@/lib/speech-voice-preference";

export function speakText(text: string, locale: string, onError?: () => void, rate = 0.86) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

  const spokenText = text.trim().replace(/\s*\/\s*/g, ", ");
  if (!spokenText) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = locale;
  utterance.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const preferredId = readVoicePreference(locale);
  const voice =
    voices.find(
      (item) =>
        preferredId === voiceId(item) &&
        normalizedVoiceLocale(item.lang) === normalizedVoiceLocale(locale),
    ) ??
    voices.find((item) => normalizedVoiceLocale(item.lang) === normalizedVoiceLocale(locale)) ??
    voices.find((item) => normalizedVoiceLocale(item.lang).startsWith(`${normalizedVoiceLocale(locale).split("-")[0]}-`));
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
