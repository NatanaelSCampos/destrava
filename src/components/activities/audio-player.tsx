"use client";

import { Volume2 } from "lucide-react";
import { SpeakButton } from "@/components/audio/speak-button";
import { useStudy } from "@/components/study-provider";

export function AudioPlayer({
  text,
  media,
}: {
  text: string;
  media?: { kind: "tts"; language: string } | { kind: "audio"; url: string };
}) {
  const { language } = useStudy();
  if (media?.kind === "audio")
    return (
      <div className="audio-player">
        <span className="audio-play">
          <Volume2 size={21} />
        </span>
        <div>
          <strong>Ouça a apresentação</strong>
          <audio controls src={media.url} aria-label="Áudio da atividade" />
        </div>
      </div>
    );
  return (
    <div className="audio-player">
      <SpeakButton text={text} label={`Ouvir áudio em ${language.identity.nativeName}`} className="audio-play" />
      <div>
        <strong>Ouça a apresentação</strong>
        <span>Voz do navegador · {language.identity.nativeName}</span>
      </div>
    </div>
  );
}
