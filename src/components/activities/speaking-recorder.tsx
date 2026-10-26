"use client";

import { PracticeConversation } from "./practice-conversation";
import { useTextPresentation } from "@/components/learning/text-presentation";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpeakingDraft, type SpeakingDraftScope } from "@/lib/speaking-draft-store";
import { Mic, Square, Check } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import { SpeakButton } from "@/components/audio/speak-button";
import { audioToWav } from "@/lib/audio-to-wav";
import type { PronunciationFeedback } from "@/domain/activities/pronunciation";
import type { SpeakingSubmission } from "@/domain/study/study-state";
import { resolveSpeechOperation } from "@/engine/variants/speech";
import { resolveLearningVariant } from "@/engine/variants/resolution";
import { LearningText, LearningTextarea } from "@/components/learning/text-presentation";

type Speaking = Extract<PublicActivity, { type: "speaking" }>;

export function SpeakingRecorder({
  activity,
  conversation = false,
  suspended = false,
  practiceMode = "lesson",
  showReference = true,
  showReferenceAudio = true,
  referenceHint,
  numberPromptId,
  onNumberAssessed,
  onSaved,
  onSubmitSpeaking,
}: {
  activity: Speaking;
  conversation?: boolean;
  suspended?: boolean;
  onSubmitSpeaking?: (transcription: string, audio: Blob) => Promise<void>;
  practiceMode?: NonNullable<SpeakingSubmission["practiceMode"]>;
  showReference?: boolean;
  showReferenceAudio?: boolean;
  referenceHint?: string;
  numberPromptId?: string;
  onNumberAssessed?: (feedback: PronunciationFeedback) => void;
  onSaved?: (result?: {
    submissionId: string;
    transcription: string;
    feedback?: PronunciationFeedback;
  }) => void;
}) {
  const textAttrs = useTextPresentation(activity.presentation);
  const { authUserId, course, language, runtime, state, saveSpeaking } = useStudy();
  const draftScope = useMemo<SpeakingDraftScope>(() => ({
    ownerId: authUserId ?? null, courseId: course.id, contentVersion: course.contentVersion,
    source: runtime ? "installed" : "compiled",
    installationId: runtime?.reference.installationId, artifactHash: runtime?.reference.artifactHash,
    versionSessionId: runtime?.versionSessionId, activityId: activity.id, practiceMode, numberPromptId,
  }), [authUserId, course.id, course.contentVersion, runtime, activity.id, practiceMode, numberPromptId]);
  const { draft, loaded: draftLoaded, update: updateDraft, clearSaved, pending: draftPending, reloadSafe } = useSpeakingDraft(draftScope);
  const draftLoading = Boolean(authUserId) && !draftLoaded;
  const previous = numberPromptId
    ? undefined
    : state.speaking.find(
        (item) =>
          item.activityId === activity.id && (item.practiceMode ?? "lesson") === practiceMode,
      );
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const captureRequest = useRef(0);
  const suspendedRef = useRef(suspended);
  const pageInactive = useRef(false);
  const [pageSuspended, setPageSuspended] = useState(false);
  const [recording, setRecording] = useState(false);
  const audioBlob = draft?.blob ?? null;
  const transcription = draft?.transcription ?? "";
  const [playback, setPlayback] = useState<{ blob: Blob; url: string | null } | null>(null);
  const audioUrl = playback?.blob === audioBlob ? playback?.url ?? null : null;
  useEffect(() => {
    if (!audioBlob) return;
    let active = true;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (active) setPlayback({ blob: audioBlob, url: typeof reader.result === "string" ? reader.result : null });
    };
    reader.readAsDataURL(audioBlob);
    return () => { active = false; };
  }, [audioBlob]);
  const [feedback, setFeedback] = useState<PronunciationFeedback | null>(
    previous?.feedback ?? null,
  );
  const [hasNewAttempt, setHasNewAttempt] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const shownFeedback = hasNewAttempt ? feedback : (feedback ?? previous?.feedback ?? null);
  const ownWords = practiceMode === "own";
  const requireAssessment =
    Boolean(numberPromptId) || practiceMode === "shadowing" || practiceMode === "memory";
  const variant = resolveLearningVariant(
    language,
    course,
    state.profile.variantId,
    activity.variant,
  );
  const pronunciationAvailable =
    variant.status === "resolved" &&
    resolveSpeechOperation(
      language,
      course,
      variant.variantId,
      "assessmentLocale",
      activity.variant,
    ).status === "selected";

  const captureBlocked = useCallback(() =>
    draftLoading || suspendedRef.current || pageInactive.current || document.visibilityState === "hidden", [draftLoading]);
  const stop = useCallback(() => {
    captureRequest.current += 1;
    try {
      if (recorder.current?.state === "recording") recorder.current.stop();
    } finally {
      stream.current?.getTracks().forEach((track) => track.stop());
    }
  }, []);
  useEffect(() => {
    suspendedRef.current = suspended;
    if (suspended) stop();
  }, [suspended, stop]);
  useEffect(() => {
    const hide = () => {
      pageInactive.current = true;
      stop();
      setPageSuspended(true);
    };
    const show = () => {
      if (document.visibilityState === "hidden") return hide();
      pageInactive.current = false;
      setPageSuspended(false);
    };
    const visibility = () => document.visibilityState === "hidden" ? hide() : show();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      stop();
    };
  }, [stop, draftScope]);

  async function start() {
    if (captureBlocked()) return;
    const request = ++captureRequest.current;
    let media: MediaStream | null = null;
    let next: MediaRecorder | null = null;
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("A gravação não está disponível neste navegador.");
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (captureBlocked() || request !== captureRequest.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      const capturedMedia = media;
      const chunks: BlobPart[] = [];
      next = new MediaRecorder(media);
      const capturedRecorder = next;
      let started = false;
      let timer: number | undefined = undefined;
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      next.onstop = () => {
        if (timer !== undefined) window.clearTimeout(timer);
        capturedMedia.getTracks().forEach((track) => track.stop());
        if (!started) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: capturedRecorder.mimeType || "audio/webm" });
        updateDraft({ blob });
      };
      next.start();
      started = true;
      recorder.current = next;
      stream.current = media;
      setHasNewAttempt(true);
      setSaved(false);
      setFeedback(null);
      updateDraft({ blob: null, transcription: "" });
      setRecording(true);
      timer = window.setTimeout(() => {
        if (recorder.current === capturedRecorder) stop();
      }, 20_000);
    } catch (caught) {
      try {
        if (next?.state === "recording") next.stop();
      } finally {
        media?.getTracks().forEach((track) => track.stop());
        if (stream.current === media) stream.current = null;
        if (recorder.current === next) recorder.current = null;
      }
      if (request === captureRequest.current && !captureBlocked())
        setError(caught instanceof Error ? caught.message : "Não foi possível acessar o microfone.");
    }
  }

  async function save() {
    if (captureBlocked()) return;
    const request = captureRequest.current;
    if (onSubmitSpeaking) {
      if (!audioBlob || !transcription.trim() || assessing) return;
      setAssessing(true);
      setError("");
      try {
        const wav = await audioToWav(audioBlob);
        if (captureBlocked() || request !== captureRequest.current) return;
        await onSubmitSpeaking(transcription.trim(), wav);
        if (draft && await clearSaved(draft.revision)) setSaved(true);
        onSaved?.();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível salvar a fala.");
      } finally { setAssessing(false); }
      return;
    }
    if (numberPromptId) {
      if (!feedback || !onNumberAssessed) return;
      onNumberAssessed(feedback);
      setSaved(true);
      onSaved?.();
      return;
    }
    if (!audioUrl || !transcription.trim()) return;
    const submissionId = saveSpeaking(
      activity.id,
      transcription.trim(),
      audioUrl,
      ownWords ? undefined : (feedback ?? undefined),
      practiceMode,
    );
    setSaved(true);
    onSaved?.({
      submissionId,
      transcription: transcription.trim(),
      feedback: ownWords ? undefined : (feedback ?? undefined),
    });
  }

  async function assess() {
    if (captureBlocked() || !audioBlob || !activity.referenceText || assessing || ownWords || !pronunciationAvailable)
      return;
    const request = captureRequest.current;
    setAssessing(true);
    setError("");
    try {
      const wav = await audioToWav(audioBlob);
      if (captureBlocked() || request !== captureRequest.current) return;
      const form = new FormData();
      form.append("courseId", course.id);
      form.append(numberPromptId ? "numberPromptId" : "activityId", numberPromptId ?? activity.id);
      form.append("audio", wav, "pronunciation.wav");
      const response = await fetch("/api/pronunciation", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível avaliar a gravação.");
      const result = data.feedback as PronunciationFeedback;
      setFeedback(result);
      updateDraft({ transcription: result.recognizedText });
      setSaved(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível avaliar a gravação.");
    } finally {
      setAssessing(false);
    }
  }

  const content = (
    <div className="speaking-recorder">
      <div className={conversation ? "conversation-voice-steps" : "guidance-box"}>
        {!conversation && <strong>Sua tarefa</strong>}
        <ul>
          {activity.guidance.map((item, index) => (
            <LearningText
              as="li"
              key={item}
              presentation={activity.presentation}
              field="guidance"
              itemIndex={index}
              textRole="source"
              text={item}
            />
          ))}
        </ul>
        {practiceMode === "own" && (
          <p>Agora diga a mesma ideia com seus próprios dados. Use seu nome, cidade ou rotina.</p>
        )}
        {!conversation && activity.referenceText && !ownWords && (
          <div className="text-audio-row">
            {showReference ? (
              <LearningText
                as="p"
                presentation={activity.presentation}
                field="referenceText"
                text={activity.referenceText}
              />
            ) : (
              <p>{referenceHint ?? "Escute a frase sem ler e tente reproduzi-la de memória."}</p>
            )}
            {showReferenceAudio && (
              <SpeakButton
                variant={activity.variant}
                text={activity.referenceText}
                label="Ouvir a frase para repetir"
                withLabel
              />
            )}
          </div>
        )}
      </div>
      {draftLoading && <p className="helper-note" role="status">Carregando rascunho...</p>}
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
            disabled={draftLoading || suspended || pageSuspended || assessing}
          >
            <Mic size={16} /> {audioUrl ? "Gravar novamente" : "Gravar resposta"}
          </button>
        )}
        {audioUrl && !recording && (
          <audio controls src={audioUrl} aria-label="Ouvir sua gravação" />
        )}
      </div>
      {activity.referenceText && !ownWords && audioBlob && !recording && (pronunciationAvailable || requireAssessment) && (
        <button
          type="button"
          className="secondary-button"
          disabled={draftLoading || suspended || pageSuspended || assessing || !pronunciationAvailable}
          onClick={() => void assess()}
        >
          {assessing ? "Avaliando áudio…" : "Avaliar pronúncia"}
        </button>
      )}
      {activity.referenceText && !ownWords && !pronunciationAvailable && (
        <p role="status">
          Esta prática é para experimentar sua voz, sem nota.
        </p>
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
            <div className="pronunciation-words" {...textAttrs()}>
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
                  <LearningText
                    presentation={activity.presentation}
                    textRole="fragment"
                    text={word.text}
                  />
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
      {!numberPromptId && (!conversation || audioUrl || transcription) && (
        <div className="field">
          <label htmlFor={`transcription-${activity.id}`}>
            {ownWords
              ? "Transcreva sua frase própria"
              : activity.referenceText
                ? "Revise ou digite o que você disse"
                : "Digite o que você disse"}
          </label>
          <LearningTextarea
            presentation={activity.presentation}
            id={`transcription-${activity.id}`}
            value={transcription}
            disabled={draftLoading}
            onChange={(event) => {
              if (draftLoading) return;
              updateDraft({ transcription: event.target.value });
              setSaved(false);
            }}
            placeholder="Digite aqui a frase que você disse…"
            rows={3}
          />
        </div>
      )}
      {!numberPromptId && transcription.trim() && (
        <SpeakButton
          variant={activity.variant}
          text={transcription}
          label="Ouvir a transcrição"
          withLabel
        />
      )}
      {(!conversation || recording) && <p className="helper-note">Pare a gravação e aguarde o rascunho ser guardado antes de sair.</p>}
      {draft && !saved && (
        <p className="helper-note" role="status">
          {recording
            ? "Gravação em andamento; o áudio ainda não terminou de ser guardado."
            : draftPending
            ? "Guardando rascunho neste navegador. Aguarde antes de recarregar."
            : reloadSafe
              ? "Rascunho guardado neste navegador; ainda não foi enviado."
              : "Não foi possível guardar o rascunho neste navegador. Mantenha esta aba aberta para não perdê-lo."}
        </p>
      )}
      {!conversation && <p className="helper-note">
        {!pronunciationAvailable
          ? requireAssessment
            ? "Este modo exige avaliação de pronúncia, que não está disponível agora. Você pode consultar o apoio; a tentativa não pode ser registrada neste modo."
            : "Ouça sua gravação e compare com o exemplo. Esta prática não recebe nota."
          : numberPromptId
          ? "A avaliação compara a gravação com o número esperado. A tentativa fica no seu histórico sem guardar o áudio."
          : ownWords
            ? "Sua produção livre fica no histórico sem nota automática; a avaliação automática se aplica apenas às etapas com frase de referência."
            : activity.referenceText
              ? "A avaliação usa a gravação e a frase de referência da atividade. A transcrição pode ser corrigida antes de salvar."
              : "Nesta atividade livre, você digita a transcrição. A avaliação automática é oferecida na atividade de repetição."}
      </p>}
      {(!conversation || audioUrl) && <button
        type="button"
        className="primary-button"
        disabled={
          draftLoading || suspended || pageSuspended ||
          !audioUrl ||
          (!numberPromptId && !transcription.trim()) ||
          assessing ||
          saved ||
          (requireAssessment && !feedback)
        }
        onClick={() => void save()}
      >
        <Check size={16} /> {numberPromptId ? "Registrar tentativa" : "Salvar prática oral"}
      </button>}
      {saved && (
        <p className="inline-success" role="status">
          {numberPromptId ? "Tentativa registrada." : "Prática oral salva."}
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
  return conversation ? <PracticeConversation activity={activity}>{content}</PracticeConversation> : content;
}
