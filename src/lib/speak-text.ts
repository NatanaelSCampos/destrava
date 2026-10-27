import recordings from "@/content/azure-recordings.json";
import { readVoicePreference } from "./speech-voice-preference";
import { azureLocale, azureAudioPath, canonicalSpeechText } from "./azure-voices";
import type { SpeechSelection } from "@/engine/variants/speech";

export type PlaybackHandle = {
  cancel: () => void;
  isCurrent: () => boolean;
  release: () => void;
  pause?: () => void;
  resume?: () => void;
  seek?: (positionMs: number) => void;
  getPositionMs?: () => number;
};
let currentPlayback: PlaybackHandle | null = null;
let currentIdentity: object | null = null;
export function claimAudioPlayback(stop: () => void, identity?: object): PlaybackHandle {
  if (identity && currentIdentity === identity && currentPlayback) return currentPlayback;
  currentPlayback?.cancel();
  const handle: PlaybackHandle = {
    cancel() {
      if (currentPlayback !== handle) return;
      currentPlayback = null;
      currentIdentity = null;
      stop();
    },
    isCurrent: () => currentPlayback === handle,
    release() {
      if (currentPlayback === handle) { currentPlayback = null; currentIdentity = null; }
    },
  };
  currentPlayback = handle;
  currentIdentity = identity ?? null;
  return handle;
}
export type SpeakTextOptions = {
  fallbackAllowed?: boolean;
  requestedVariant?: string;
  onSelection?: (result: SpeechSelection) => void;
  onHandle?: (handle: PlaybackHandle) => void;
  onEnd?: () => void;
  onCancel?: () => void;
  onProgress?: (positionMs: number, durationMs: number) => void;
  courseId?: string;
};
/** Recorded Azure playback. A pending request belongs to the same cancellable audio owner. */
export function speakText(
  text: string,
  locale: string,
  onError?: () => void,
  rate = 1,
  options: SpeakTextOptions = {},
) {
  const exactLocale = azureLocale(locale),
    spokenText = canonicalSpeechText(text);
  if (
    typeof window === "undefined" ||
    typeof Audio === "undefined" ||
    !exactLocale ||
    !spokenText ||
    spokenText.length > 4000
  )
    return false;
  const gender = readVoicePreference(exactLocale);
  const element = new Audio();
  element.preload = "auto";
  element.playbackRate = Math.max(0.5, Math.min(1.25, rate));
  element.preservesPitch = true;
  const abort = new AbortController();
  let objectUrl: string | null = null,
    paused = false,
    pendingSeek = 0,
    finished = false;
  const clean = () => {
    abort.abort();
    element.pause();
    element.removeAttribute("src");
    element.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };
  const owner = claimAudioPlayback(() => {
    finished = true;
    clean();
    options.onCancel?.();
  });
  owner.pause = () => {
    if (!owner.isCurrent()) return;
    paused = true;
    element.pause();
  };
  owner.resume = () => {
    if (!owner.isCurrent()) return;
    paused = false;
    if (element.src) void element.play().catch(fail);
  };
  owner.seek = (positionMs) => {
    if (!owner.isCurrent() || !Number.isFinite(positionMs)) return;
    pendingSeek = Math.max(0, positionMs / 1000);
    if (Number.isFinite(element.duration))
      element.currentTime = Math.min(pendingSeek, element.duration);
  };
  owner.getPositionMs = () =>
    Math.round(
      (Number.isFinite(element.duration) && Number.isFinite(element.currentTime)
        ? element.currentTime
        : pendingSeek) * 1000,
    );
  function fail() {
    if (!owner.isCurrent() || finished) return;
    finished = true;
    owner.release();
    clean();
    onError?.();
  }
  element.onloadedmetadata = () => {
    if (!owner.isCurrent()) return;
    if (pendingSeek > 0)
      element.currentTime = Math.min(pendingSeek, element.duration || pendingSeek);
    if (Number.isFinite(element.duration) && element.duration > 0)
      options.onProgress?.(
        Math.round(element.currentTime * 1000),
        Math.round(element.duration * 1000),
      );
  };
  element.ontimeupdate = () => {
    if (owner.isCurrent() && Number.isFinite(element.duration) && element.duration > 0)
      options.onProgress?.(
        Math.round(element.currentTime * 1000),
        Math.round(element.duration * 1000),
      );
  };
  element.onended = () => {
    if (!owner.isCurrent() || finished) return;
    finished = true;
    owner.release();
    clean();
    options.onEnd?.();
  };
  element.onerror = fail;
  options.onSelection?.({
    status: "selected",
    requestedVariant: options.requestedVariant ?? exactLocale,
    requestedLocale: exactLocale,
    operationalLocale: exactLocale,
    compatibility: "declared_mapping",
    fallback: false,
    fallbackAllowed: false,
  });
  options.onHandle?.(owner);
  void (async () => {
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(spokenText));
      const hash = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join(
        "",
      );
      const path = azureAudioPath(exactLocale, gender, hash)!;
      const indexed =
        (recordings.textHashes as Record<string, string[]>)[exactLocale]?.includes(hash) ?? false;
      let response: Response;
      if (indexed) response = await fetch(path, { signal: abort.signal });
      else {
        response = await fetch("/api/speech", {
          method: "POST",
          signal: abort.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: spokenText,
            locale: exactLocale,
            voice: gender,
            courseId: options.courseId,
          }),
        });
      }
      if (!owner.isCurrent() || finished) return;
      if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("audio/")) {
        fail();
        return;
      }
      const blob = await response.blob();
      if (!owner.isCurrent() || finished) return;
      if (!blob.size || blob.size > 8_000_000) {
        fail();
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      element.src = objectUrl;
      if (!paused) await element.play();
    } catch {
      if (!abort.signal.aborted) fail();
    }
  })();
  return true;
}
