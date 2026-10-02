"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Check } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import { SpeakButton } from "@/components/audio/speak-button";
import { audioToWav } from "@/lib/audio-to-wav";
import type { PronunciationFeedback } from "@/domain/activities/pronunciation";
import type { SpeakingSubmission } from "@/domain/study/study-state";

type Speaking = Extract<PublicActivity, { type: "speaking" }>;

export function SpeakingRecorder({
  activity,
  practiceMode = "lesson",
  showReference = true,
  onSaved,
}: {
  activity: Speaking;
  practiceMode?: NonNullable<SpeakingSubmission["practiceMode"]>;
  showReference?: boolean;
  onSaved?: () => void;
}) {
  const { course, state, saveSpeaking } = useStudy();
  const previous = state.speaking.find(
    (item) => item.activityId === activity.id && (item.practiceMode ?? "lesson") === practiceMode,
  );
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState("");
  const [feedback, setFeedback] = useState<PronunciationFeedback | null>(
    previous?.feedback ?? null,
  );
  const [hasNewAttempt, setHasNewAttempt] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const shownFeedback = hasNewAttempt ? feedback : (feedback ?? previous?.feedback ?? null);
  const ownWords = practiceMode === "own";
  const requireAssessment = practiceMode === "shadowing" || practiceMode === "memory";

  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    setHasNewAttempt(true);
    setError("");
    setSaved(false);
    setFeedback(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscription("");
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
        setAudioBlob(blob);
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
    saveSpeaking(
      activity.id,
      transcription.trim(),
      audioUrl,
      ownWords ? undefined : (feedback ?? undefined),
      practiceMode,
    );
    setSaved(true);
    onSaved?.();
  }

  async function assess() {
    if (!audioBlob || !activity.referenceText || assessing || ownWords) return;
    setAssessing(true);
    setError("");
    try {
      const wav = await audioToWav(audioBlob);
      const form = new FormData();
      form.append("activityId", activity.id);
      form.append("audio", wav, "pronunciation.wav");
      const response = await fetch("/api/pronunciation", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível avaliar a gravação.");
      const result = data.feedback as PronunciationFeedback;
      setFeedback(result);
      setTranscription(result.recognizedText);
      setSaved(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível avaliar a gravação.");
    } finally {
      setAssessing(false);
    }
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
        {practiceMode === "own" && (
          <p>Agora diga a mesma ideia com seus próprios dados. Use seu nome, cidade ou rotina.</p>
        )}
        {activity.referenceText && !ownWords && (
          <div className="text-audio-row">
            {showReference ? (
              <p lang={course.languageCode}>{activity.referenceText}</p>
            ) : (
              <p>Escute a frase sem ler e tente reproduzi-la de memória.</p>
            )}
            <SpeakButton
              text={activity.referenceText}
              label="Ouvir a frase para repetir"
              withLabel
            />
          </div>
        )}
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
          <button
            type="button"
            className="primary-button"
            onClick={() => void start()}
            disabled={assessing}
          >
            <Mic size={16} /> {audioUrl ? "Gravar novamente" : "Gravar resposta"}
          </button>
        )}
        {audioUrl && !recording && (
          <audio controls src={audioUrl} aria-label="Ouvir sua gravação" />
        )}
      </div>
      {activity.referenceText && !ownWords && audioBlob && !recording && (
        <button
          type="button"
          className="secondary-button"
          disabled={assessing}
          onClick={() => void assess()}
        >
          {assessing ? "Avaliando áudio…" : "Avaliar pronúncia"}
        </button>
      )}
      {shownFeedback && activity.referenceText && !ownWords && (
        <div className="pronunciation-result" role="status">
          <strong>Indicadores da gravação</strong>
          <p>
            Clareza {Math.round(shownFeedback.accuracy)}/100 · Fluência{" "}
            {Math.round(shownFeedback.fluency)}
            /100 · Frase completa {Math.round(shownFeedback.completeness)}/100
          </p>
          {shownFeedback.words.length > 0 && (
            <div className="pronunciation-words" lang={course.languageCode}>
              {shownFeedback.words.map((word, index) => (
                <span
                  key={`${index}-${word.text}`}
                  className={
                    word.errorType !== "None" || (word.accuracy !== null && word.accuracy < 75)
                      ? "weak"
                      : ""
                  }
                  title={`Clareza: ${word.accuracy === null ? "sem nota" : `${Math.round(word.accuracy)}/100`}`}
                >
                  {word.text}
                  {word.errorType !== "None" || (word.accuracy !== null && word.accuracy < 75)
                    ? " ↻"
                    : ""}
                </span>
              ))}
            </div>
          )}
          <small>
            Indicadores para praticar; não são uma aprovação definitiva. ↻ indica uma palavra para
            repetir.
          </small>
        </div>
      )}
      <div className="field">
        <label htmlFor={`transcription-${activity.id}`}>
          {ownWords
            ? "Transcreva sua frase própria"
            : activity.referenceText
              ? "Revise ou digite o que você disse"
              : "Digite o que você disse"}
        </label>
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
        <SpeakButton text={transcription} label="Ouvir a transcrição" withLabel />
      )}
      <p className="helper-note">
        {ownWords
          ? "Sua produção livre fica no histórico sem nota automática; o Azure avalia apenas as etapas com frase de referência."
          : activity.referenceText
            ? "A avaliação usa a gravação e a frase de referência da atividade. A transcrição pode ser corrigida antes de salvar."
            : "Nesta atividade livre, você digita a transcrição. A avaliação automática é oferecida na atividade de repetição."}
      </p>
      <button
        type="button"
        className="primary-button"
        disabled={
          !audioUrl ||
          !transcription.trim() ||
          assessing ||
          saved ||
          (requireAssessment && !feedback)
        }
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
