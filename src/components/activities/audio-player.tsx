"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";

export function AudioPlayer({
  text,
  media,
}: {
  text: string;
  media?: { kind: "tts"; language: string } | { kind: "audio"; url: string };
}) {
  const [error, setError] = useState("");
  const play = () => {
    if (!("speechSynthesis" in window)) {
      setError("Seu navegador não oferece reprodução por voz.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = media?.kind === "tts" ? media.language : "es-ES";
    utterance.rate = 0.86;
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => item.lang.toLowerCase().startsWith("es"));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };
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
      <button
        type="button"
        className="audio-play"
        onClick={play}
        aria-label="Ouvir áudio em espanhol"
      >
        <Volume2 size={21} />
      </button>
      <div>
        <strong>Ouça a apresentação</strong>
        <span>Voz do navegador · espanhol</span>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
