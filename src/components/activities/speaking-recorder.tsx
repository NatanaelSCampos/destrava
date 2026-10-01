"use client";

import { useRef, useState } from "react";
import { Mic, Square, Check } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import { SpeakButton } from "@/components/audio/speak-button";

type Speaking = Extract<PublicActivity, { type: "speaking" }>;

export function SpeakingRecorder({ activity }: { activity: Speaking }) {
  const { saveSpeaking } = useStudy();
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setError("");
    setSaved(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("A gravação não está disponível neste navegador.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const chunks: BlobPart[] = [];
      const next = new MediaRecorder(media);
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      next.onstop = () => {
        const blob = new Blob(chunks, { type: next.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () =>
          setAudioUrl(typeof reader.result === "string" ? reader.result : null);
        reader.readAsDataURL(blob);
        media.getTracks().forEach((track) => track.stop());
      };
      recorder.current = next;
      next.start();
      setRecording(true);
      window.setTimeout(() => {
        if (next.state === "recording") {
          next.stop();
          setRecording(false);
        }
      }, 20_000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível acessar o microfone.");
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
  }
  function save() {
    if (!audioUrl || !transcription.trim()) return;
    saveSpeaking(activity.id, transcription.trim(), audioUrl);
    setSaved(true);
  }

  return (
    <div className="speaking-recorder">
      <div className="guidance-box">
        <strong>Sua tarefa</strong>
        <ul>
          {activity.guidance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="recording-panel">
        <span className={`mic-orb ${recording ? "recording" : ""}`}>
          <Mic size={27} />
        </span>
        <strong>
          {recording ? "Gravando…" : audioUrl ? "Gravação pronta" : "Pronto para falar?"}
        </strong>
        <p>Grave até 20 segundos. Você pode ouvir antes de salvar.</p>
        {recording ? (
          <button type="button" className="secondary-button" onClick={stop}>
            <Square size={15} /> Parar gravação
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={() => void start()}>
            <Mic size={16} /> {audioUrl ? "Gravar novamente" : "Gravar resposta"}
          </button>
        )}
        {audioUrl && !recording && (
          <audio controls src={audioUrl} aria-label="Ouvir sua gravação" />
        )}
      </div>
      <div className="field">
        <label htmlFor={`transcription-${activity.id}`}>Digite o que você disse</label>
        <textarea
          id={`transcription-${activity.id}`}
          value={transcription}
          onChange={(event) => {
            setTranscription(event.target.value);
            setSaved(false);
          }}
          placeholder="Me llamo… Soy de…"
          rows={3}
        />
      </div>
      {transcription.trim() && (
        <SpeakButton text={transcription} label="Ouvir a transcrição em espanhol" withLabel />
      )}
      <p className="helper-note">
        Nesta versão, a transcrição é digitada por você. A nota de pronúncia só aparecerá quando
        houver uma avaliação real de áudio.
      </p>
      <button
        type="button"
        className="primary-button"
        disabled={!audioUrl || !transcription.trim()}
        onClick={save}
      >
        <Check size={16} /> Salvar prática oral
      </button>
      {saved && (
        <p className="inline-success" role="status">
          Prática oral salva.
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
