import { readVoicePreference } from "@/lib/speech-voice-preference";
import { selectBrowserVoice, type SpeechSelection } from "@/engine/variants/speech";

export function speakText(
  text: string,
  locale: string,
  onError?: () => void,
  rate = 0.86,
  options: {
    fallbackAllowed?: boolean;
    requestedVariant?: string;
    onSelection?: (result: SpeechSelection) => void;
  } = {},
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

  const spokenText = text.trim().replace(/\s*\/\s*/g, ", ");
  if (!spokenText) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = locale;
  utterance.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const preferredId = readVoicePreference(locale);
  const selection = selectBrowserVoice(
    voices,
    locale,
    options.fallbackAllowed ?? true,
    preferredId,
    options.requestedVariant,
  );
  options.onSelection?.(selection);
  if (selection.status === "unavailable") return false;
  const voice = selection.voice;
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
