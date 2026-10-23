"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { speakText, type PlaybackHandle } from "@/lib/speak-text";
import { textToSpeechLocale } from "@/content/language-variant";
import { useStudy } from "@/components/study-provider";
import type { ActivityVariant } from "@/content/variant-contracts";
import { resolveLearningVariant } from "@/engine/variants/resolution";
import { normalizedVoiceLocale } from "@/lib/speech-voice-preference";
import { interfacePresentation } from "@/engine/presentation/text";

/** Classroom ownership also covers buttons rendered by nested activities. */
export const SpeechPlaybackScope = createContext<((handle: PlaybackHandle) => void) | null>(null);

export function SpeakButton({
  text,
  label,
  className = "speak-button",
  withLabel = false,
  onPlay,
  locale,
  rate,
  variant,
}: {
  text: string;
  label?: string;
  className?: string;
  withLabel?: boolean;
  onPlay?: () => void;
  locale?: string;
  rate?: number;
  variant?: ActivityVariant;
}) {
  const { state, language, course, authUserId } = useStudy();
  const registerPlayback = useContext(SpeechPlaybackScope);
  const [error, setError] = useState("");
  const playback = useRef<PlaybackHandle | null>(null);
  const description = label ?? `Ouvir em ${language.identity.nativeName}: ${text.slice(0, 70)}`;
  const resolution = resolveLearningVariant(language, course, state.profile.variantId, variant);
  const declaredLocale =
    resolution.status === "resolved"
      ? textToSpeechLocale(language, resolution.variantId, course, variant)
      : null;
  const selectedLocale =
    variant?.requiredVariant &&
    locale &&
    declaredLocale &&
    normalizedVoiceLocale(locale) !== normalizedVoiceLocale(declaredLocale)
      ? null
      : resolution.status === "resolved"
        ? (locale ?? declaredLocale)
        : null;
  useEffect(() => () => { playback.current?.cancel(); }, [course.id, authUserId, selectedLocale, text, state.profile.variantId]);
  if (!language.speech.support.textToSpeech || !selectedLocale) return null;

  return (
    <>
      <button
        lang={interfacePresentation.language}
        dir={interfacePresentation.direction}
        type="button"
        className={className}
        aria-label={description}
        title={description}
        disabled={!text.trim()}
        onClick={(event) => {
          event.stopPropagation();
          setError("");
          if (
            !speakText(
              text,
              selectedLocale,
              () => setError("Não foi possível reproduzir o áudio."),
              rate,
              {
                onHandle: (handle) => { playback.current = handle; registerPlayback?.(handle); },
                fallbackAllowed: resolution.speechFallback === "same_language",
                requestedVariant: resolution.variantId ?? undefined,
                onSelection: (selection) =>
                  setError(
                    selection.fallback
                      ? `Áudio em ${selection.operationalLocale}: outra variante; use apenas como apoio.`
                      : selection.status === "unavailable"
                        ? "Não há voz compatível instalada para esta variante."
                        : "",
                  ),
              },
            )
          )
            setError("Não há voz compatível disponível neste navegador.");
          else onPlay?.();
        }}
      >
        <Volume2 size={17} aria-hidden="true" />
        {withLabel && <span>Ouvir</span>}
      </button>
      {error && (
        <span className="speak-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
