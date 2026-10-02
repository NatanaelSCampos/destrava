"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { speakSpanish } from "@/lib/speak-spanish";

export function SpeakButton({
  text,
  label,
  className = "speak-button",
  withLabel = false,
  onPlay,
}: {
  text: string;
  label?: string;
  className?: string;
  withLabel?: boolean;
  onPlay?: () => void;
}) {
  const [error, setError] = useState("");
  const description = label ?? `Ouvir em espanhol: ${text.slice(0, 70)}`;

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
          if (!speakSpanish(text, () => setError("Não foi possível reproduzir o áudio.")))
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
