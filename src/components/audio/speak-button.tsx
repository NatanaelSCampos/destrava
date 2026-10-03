"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { speakText } from "@/lib/speak-text";
import { textToSpeechLocale } from "@/content/language-variant";
import { useStudy } from "@/components/study-provider";

export function SpeakButton({
  text,
  label,
  className = "speak-button",
  withLabel = false,
  onPlay,
  locale,
  rate,
}: {
  text: string;
  label?: string;
  className?: string;
  withLabel?: boolean;
  onPlay?: () => void;
  locale?: string;
  rate?: number;
}) {
  const { state, language } = useStudy();
  const [error, setError] = useState("");
  const description = label ?? `Ouvir em ${language.identity.nativeName}: ${text.slice(0, 70)}`;
  const selectedLocale = locale ?? textToSpeechLocale(language, state.profile.variantId);
  if (!language.capabilities.textToSpeech || !selectedLocale) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={description}
        title={description}
        disabled={!text.trim()}
        onClick={(event) => {
          event.stopPropagation();
          setError("");
          if (
            !speakText(text, selectedLocale, () => setError("Não foi possível reproduzir o áudio."), rate)
          )
            setError("Seu navegador não oferece reprodução por voz.");
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
