"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Mic, Square, Sparkles } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { SpeakButton } from "@/components/audio/speak-button";
import { audioToWav } from "@/lib/audio-to-wav";
import type { ImageDescriptionFeedback } from "@/domain/ai/schemas";

export default function DescribePage() {
  const { resources } = useStudy();
  if (!resources.imageScenes.length)
    return <div className="empty-state panel">Este curso ainda não inclui descrição de imagens.</div>;
  return <DescribeContent />;
}

function DescribeContent() {
  const { course, language, resources, state, saveImageDescription } = useStudy();
  const imageDescriptionScenes = resources.imageScenes;
  const [sceneId, setSceneId] = useState(imageDescriptionScenes[0].id);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    transcript: string;
    feedback: ImageDescriptionFeedback;
  } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const scene =
    imageDescriptionScenes.find((item) => item.id === sceneId) ?? imageDescriptionScenes[0];
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const suggested = new URLSearchParams(window.location.search).get("scene");
      if (suggested && imageDescriptionScenes.some((item) => item.id === suggested))
        setSceneId(suggested);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [imageDescriptionScenes]);
  const history = (state.imageDescriptions ?? []).filter(
    (item) => item.courseId === course.id && item.sceneId === sceneId,
  );

  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  function choose(id: string) {
    setSceneId(id);
    setDraft("");
    setAudioBlob(null);
    setAudioUrl(null);
    setResult(null);
    setError("");
  }

  async function start() {
    setResult(null);
    setError("");
    setAudioBlob(null);
    setAudioUrl(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "A gravação não está disponível neste navegador. Você pode digitar sua descrição.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const chunks: BlobPart[] = [];
      const next = new MediaRecorder(media);
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = () => {
        const blob = new Blob(chunks, { type: next.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
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

  async function evaluate(mode: "speech" | "text") {
    if (loading || (mode === "speech" ? !audioBlob : draft.trim().length < 5)) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("courseId", course.id);
      form.append("sceneId", scene.id);
      if (mode === "speech" && audioBlob)
        form.append("audio", await audioToWav(audioBlob), "description.wav");
      else form.append("text", draft.trim());
      const response = await fetch("/api/ai/image-description", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível analisar a descrição.");
      setResult({ transcript: data.transcript, feedback: data.feedback });
      saveImageDescription({
        sceneId: scene.id,
        courseId: course.id,
        transcript: data.transcript,
        inputMode: mode,
        feedback: data.feedback,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível analisar a descrição.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="describe-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <ImageIcon size={14} /> EXPLICAR UMA IMAGEM
          </span>
          <h1 className="page-title">Olhe. Fale. Destrave.</h1>
          <p className="page-subtitle">
            Descreva a cena em {language.identity.nativeName}. Escreva sua resposta e receba dicas para melhorar.
          </p>
        </div>
      </div>
      <div className="describe-scenes" aria-label="Escolha uma cena">
        {imageDescriptionScenes.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`describe-scene-choice ${item.id === sceneId ? "active" : ""}`}
            onClick={() => choose(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="describe-layout">
        <section className="panel describe-main">
          <div className="describe-image">
            <Image src={scene.image} alt={scene.alt} width={1448} height={1086} priority />
          </div>
          <h2>{scene.title}</h2>
          <p>{scene.prompt}</p>
          {language.capabilities.speechRecognition && <div className="describe-actions">
            {recording ? (
              <button type="button" className="secondary-button" onClick={stop}>
                <Square size={16} /> Parar gravação
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                disabled={loading}
                onClick={() => void start()}
              >
                <Mic size={16} /> {audioBlob ? "Gravar novamente" : "Gravar descrição"}
              </button>
            )}
            {audioUrl && !recording && (
              <audio controls src={audioUrl} aria-label="Ouvir sua descrição" />
            )}
            {audioBlob && !recording && (
              <button
                type="button"
                className="secondary-button"
                disabled={loading}
                onClick={() => void evaluate("speech")}
              >
                {loading ? "Analisando…" : "Analisar minha fala"}
              </button>
            )}
          </div>}
          {language.capabilities.speechRecognition && <p className="helper-note">
            Grave até 20 segundos. O áudio é enviado para transcrição, mas apenas o texto e as dicas
            ficam no histórico.
          </p>}
          <div className="field">
            <label htmlFor="describe-draft">Ou escreva sua descrição em {language.identity.nativeName}</label>
            <textarea
              id="describe-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Descreva o que você vê…"
            />
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={loading || draft.trim().length < 5}
            onClick={() => void evaluate("text")}
          >
            {loading ? "Analisando…" : "Analisar texto"}
          </button>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside className="panel describe-feedback" aria-live="polite">
          <span className="eyebrow">
            <Sparkles size={14} /> SUA PRÁTICA
          </span>
          {result ? (
            <>
              <h2>Você descreveu a cena</h2>
              <div className="text-audio-row">
                <p lang={course.languageCode}>{result.transcript}</p>
                <SpeakButton text={result.transcript} label="Ouvir transcrição" />
              </div>
              <h3>O que observou</h3>
              <p>{result.feedback.observed}</p>
              <h3>Um acerto</h3>
              <p>{result.feedback.strength}</p>
              {result.feedback.correction && (
                <>
                  <h3>Um ajuste</h3>
                  <p>{result.feedback.correction}</p>
                </>
              )}
              <h3>Tente mais uma frase</h3>
              <div className="text-audio-row">
                <p lang={course.languageCode}>{result.feedback.nextSentence}</p>
                <SpeakButton text={result.feedback.nextSentence} label="Ouvir frase sugerida" />
              </div>
            </>
          ) : (
            <p>
              Depois da sua descrição, você verá um acerto, um ajuste quando necessário e uma frase
              para continuar.
            </p>
          )}
          <hr className="divider" />
          <strong>Suas tentativas nesta cena: {history.length}</strong>
          {history.slice(0, 3).map((item) => (
            <p key={item.id} className="describe-history" lang={course.languageCode}>
              {item.transcript}
            </p>
          ))}
          <small>Esta é uma prática orientativa, sem nota de pronúncia ou aprovação oficial.</small>
        </aside>
      </div>
    </div>
  );
}
