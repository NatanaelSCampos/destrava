"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { audioToWav } from "@/lib/audio-to-wav";
import { useStudy } from "@/components/study-provider";

export function ConversationVoiceInput({
  disabled,
  onTranscript,
}: {
  disabled: boolean;
  onTranscript: (text: string) => void;
}) {
  const { course, language } = useStudy();
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("O microfone não está disponível neste navegador.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const chunks: BlobPart[] = [];
      const next = new MediaRecorder(media);
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        setRecording(false);
        void transcribe(new Blob(chunks, { type: next.mimeType || "audio/webm" }));
      };
      recorder.current = next;
      next.start();
      setRecording(true);
      window.setTimeout(() => {
        if (next.state === "recording") next.stop();
      }, 20_000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível acessar o microfone.");
    }
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("courseId", course.id);
      form.append("audio", await audioToWav(blob), "conversation.wav");
      const response = await fetch("/api/ai/conversation/transcribe", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não consegui transcrever sua fala.");
      onTranscript(result.transcript);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não consegui transcrever sua fala.");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className="conversation-voice-input">
      <button
        type="button"
        className="secondary-button"
        disabled={!recording && (disabled || transcribing || !language.capabilities.speechRecognition)}
        onClick={() => (recording ? recorder.current?.stop() : void start())}
      >
        {recording ? <Square size={16} /> : <Mic size={16} />}
        {recording ? "Parar" : transcribing ? "Transcrevendo…" : "Falar"}
      </button>
      {recording && <small>Gravando até 20 segundos…</small>}
      {error && (
        <small className="inline-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
