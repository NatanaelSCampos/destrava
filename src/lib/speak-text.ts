import { readVoicePreference } from "@/lib/speech-voice-preference";
import { selectBrowserVoice, type SpeechSelection } from "@/engine/variants/speech";

export type PlaybackHandle = { cancel: () => void; isCurrent: () => boolean; release: () => void };
let currentPlayback: PlaybackHandle | null = null;
/** One browser playback owner, shared by TTS, classroom media and transient audio. */
export function claimAudioPlayback(stop: () => void): PlaybackHandle {
  currentPlayback?.cancel();
  const handle: PlaybackHandle = {
    cancel() {
      if (currentPlayback !== handle) return;
      currentPlayback = null;
      stop();
    },
    isCurrent: () => currentPlayback === handle,
    release() { if (currentPlayback === handle) currentPlayback = null; },
  };
  currentPlayback = handle;
  return handle;
}

export type SpeakTextOptions = {
  fallbackAllowed?: boolean;
  requestedVariant?: string;
  onSelection?: (result: SpeechSelection) => void;
  onHandle?: (handle: PlaybackHandle) => void;
  onEnd?: () => void;
  onCancel?: () => void;
};

/** Boolean API retained for existing consumers. Handles cancel only their own playback. */
export function speakText(
  text: string,
  locale: string,
  onError?: () => void,
  rate = 0.86,
  options: SpeakTextOptions = {},
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined" || !locale.trim()) return false;
  const spokenText = text.trim().replace(/\s*\/\s*/g, ", ");
  if (!spokenText) return false;
  let handle: PlaybackHandle | undefined;
  try {
    const synth = window.speechSynthesis;
    const selection = selectBrowserVoice(
      synth.getVoices(), locale, options.fallbackAllowed ?? true,
      readVoicePreference(locale), options.requestedVariant,
    );
    options.onSelection?.(selection);
    if (selection.status === "unavailable" || !selection.voice) return false;
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = selection.voice.lang;
    utterance.voice = selection.voice;
    utterance.rate = rate;
    handle = claimAudioPlayback(() => {
      try { synth.cancel(); } catch { onError?.(); }
      options.onCancel?.();
    });
    const owner = handle;
    // Also remove browser speech queued outside this helper.
    synth.cancel();
    utterance.onend = () => {
      if (!owner.isCurrent()) return;
      owner.release();
      options.onEnd?.();
    };
    utterance.onerror = (event) => {
      if (!owner.isCurrent()) return;
      owner.release();
      if (event.error === "canceled" || event.error === "interrupted") options.onCancel?.();
      else onError?.();
    };
    options.onHandle?.(owner);
    synth.speak(utterance);
    return true;
  } catch {
    // Failed startup is textual fallback, not a user pause/cancel event.
    if (handle?.isCurrent()) {
      handle.release();
      try { window.speechSynthesis.cancel(); } catch { /* Browser cancellation can also fail. */ }
    }
    onError?.();
    return false;
  }
}
