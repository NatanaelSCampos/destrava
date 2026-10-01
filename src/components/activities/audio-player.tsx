import { Volume2 } from "lucide-react";
import { SpeakButton } from "@/components/audio/speak-button";

export function AudioPlayer({
  text,
  media,
}: {
  text: string;
  media?: { kind: "tts"; language: string } | { kind: "audio"; url: string };
}) {
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
      <SpeakButton text={text} label="Ouvir áudio em espanhol" className="audio-play" />
      <div>
        <strong>Ouça a apresentação</strong>
        <span>Voz do navegador · espanhol</span>
      </div>
    </div>
  );
}
