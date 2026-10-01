export function speakSpanish(text: string, onError?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

  const spokenText = text.trim().replace(/\s*\/\s*/g, ", ");
  if (!spokenText) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = "es-ES";
  utterance.rate = 0.86;
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((item) => item.lang.toLowerCase() === "es-es") ??
    voices.find((item) => item.lang.toLowerCase().startsWith("es"));
  if (voice) utterance.voice = voice;
  utterance.onerror = (event) => {
    if (event.error !== "canceled" && event.error !== "interrupted") onError?.();
  };
  window.speechSynthesis.speak(utterance);
  return true;
}
