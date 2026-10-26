"use client";

import { RecordedPhrase } from "./teaching-card";
import { Volume2 } from "lucide-react";
import { SpeakButton } from "@/components/audio/speak-button";
import { useStudy } from "@/components/study-provider";
import type { ActivityVariant } from "@/content/variant-contracts";

export function AudioPlayer({
  text,
  media,
  variant,
}: {
  text: string;
  variant?: ActivityVariant;
  media?: { kind: "tts"; language: string } | { kind: "audio"; url: string };
}) {
  const { language, course } = useStudy();
  const asset = media?.kind === "audio" ? course.teachingMedia?.find(item => item.src === media.url) : undefined;
  if (asset) return <RecordedPhrase mediaId={asset.id} label="Ouvir a mensagem desta atividade" />;
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
      <SpeakButton
        variant={variant}
        text={text}
        label={`Ouvir áudio em ${language.identity.nativeName}`}
        className="audio-play"
      />
      <div>
        <strong>Ouça a apresentação</strong>
        <span>Voz do navegador · {language.identity.nativeName}</span>
      </div>
    </div>
  );
}
