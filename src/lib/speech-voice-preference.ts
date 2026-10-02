const storagePrefix = "destrava:speech-voice:v1:";

export function normalizedVoiceLocale(locale: string) {
  return locale.replaceAll("_", "-").toLowerCase();
}

export function spanishVoiceId(voice: SpeechSynthesisVoice) {
  return `${normalizedVoiceLocale(voice.lang)}:${voice.voiceURI || voice.name}`;
}

export function readSpanishVoicePreference(locale: string) {
  try {
    return window.localStorage.getItem(`${storagePrefix}${normalizedVoiceLocale(locale)}`) ?? "";
  } catch {
    return "";
  }
}

export function saveSpanishVoicePreference(locale: string, voiceId: string) {
  try {
    const key = `${storagePrefix}${normalizedVoiceLocale(locale)}`;
    if (voiceId) window.localStorage.setItem(key, voiceId);
    else window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
