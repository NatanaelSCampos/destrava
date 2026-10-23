"use client";

import { useTextPresentation } from "@/components/learning/text-presentation";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  Lightbulb,
  MessageCircle,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
} from "lucide-react";
import type { GradeResult } from "@/domain/activities/grader";
import type { InteractiveLessonDefinition, LessonAction } from "@/content/contracts";
import { lessonActionSchema } from "@/content/contracts";
import { ActivityRenderer } from "@/components/activities/activity-renderer";
import { SpeechPlaybackScope } from "@/components/audio/speak-button";
import { claimAudioPlayback, speakText, type PlaybackHandle } from "@/lib/speak-text";
import { textToSpeechLocale } from "@/content/language-variant";
import { resolveLearningVariant } from "@/engine/variants/resolution";
import {
  NarrationController, narrationLine, transcriptNarration, teachingNarration,
  type NarrationLine, type NarrationSnapshot, type TeachingNarration,
} from "@/domain/interactive-lesson/narration-controller";
import { useStudy } from "@/components/study-provider";
import {
  applyBoardAction,
  initialRuntime,
  reduceRuntime,
  resumeAnchor,
  TimelineEngine,
  type LessonRuntimeState,
} from "@/domain/interactive-lesson/runtime";
import { HtmlMediaPresentationController } from "@/domain/interactive-lesson/presentation-controller";
import type { CuratedExample } from "@/content/interactive-examples";
import { LearningBoard } from "./learning-board";
import { LearningText, LearningTextarea } from "@/components/learning/text-presentation";

type Media = Record<string, { src: string; type: string }>;
type TeachingReply = TeachingNarration & {
  actions: LessonAction[];
};
const lessonUiError = (code: string) => {
  if (/VERSION|SESSION|REVISION|CONFLICT/.test(code)) return "A aula mudou em outra aba ou versão. Recarregue para continuar.";
  if (code === "LESSON_INVALID_AUDIO") return "A gravação é inválida. Grave novamente antes de salvar.";
  if (code === "LESSON_WRITING_INCOMPLETE") return "O texto ainda não atende à entrega exigida.";
  if (code.startsWith("LESSON_") || code === "EVIDENCE_MISMATCH") return "Não foi possível confirmar a etapa. Recarregue a aula e tente novamente.";
  return code;
};
const seconds = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function InteractiveClassroom({
  definition,
  courseId,
  contentVersion,
  media,
  curatedExamples,
}: {
  definition: InteractiveLessonDefinition;
  courseId: string;
  contentVersion: string;
  media: Media;
  curatedExamples: CuratedExample[];
}) {
  const textAttrs = useTextPresentation();
  const { course, language, authUserId, state: studyState, submitAttempt, captureInteractiveLessonOwner, applyInteractiveLessonReceipt } = useStudy();
  const lesson = course.units
    .flatMap((unit) => unit.lessons)
    .find((item) => item.id === definition.lessonId);
  const [state, dispatch] = useReducer(
    (current: LessonRuntimeState, event: Parameters<typeof reduceRuntime>[2]) =>
      reduceRuntime(definition, current, event),
    definition,
    initialRuntime,
  );
  const [loading, setLoading] = useState(true);
  const [segmentBusy, setSegmentBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [completionSaved, setCompletionSaved] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [question, setQuestion] = useState("");
  const [questionComposing, setQuestionComposing] = useState(false);
  const [teaching, setTeaching] = useState<TeachingReply | null>(null);
  const [teachingBusy, setTeachingBusy] = useState(false);
  const [supportMode, setSupportMode] = useState<"explain" | "example" | "practice" | "ask">(
    "explain",
  );
  const [practiceActivityRef, setPracticeActivityRef] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [lastAssessment, setLastAssessment] = useState<"correct" | "incorrect" | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [narration, setNarration] = useState<NarrationSnapshot>({ status: "idle", line: null, message: "" });
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const transientRef = useRef<HTMLAudioElement | null>(null);
  const nativePlaybackRef = useRef<{ element: HTMLMediaElement; owner: PlaybackHandle } | null>(null);
  const engine = useRef(new TimelineEngine());
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const stateRef = useRef(state);
  const revisionRef = useRef<number | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const lastQueued = useRef("");
  const lastClock = useRef(0);
  const requestId = useRef(0);
  const readyRef = useRef(false);
  const submittingRef = useRef(false);
  const saveFailureRef = useRef("");
  const pendingAttemptRef = useRef<{ key: string; input: Record<string, string | number>; audio?: Blob } | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const segment = definition.segments[state.segmentIndex];
  const variantResolution = resolveLearningVariant(language, course, studyState.profile.variantId);
  const targetLocale = variantResolution.status === "resolved" && language.speech.support.textToSpeech
    ? textToSpeechLocale(language, variantResolution.variantId, course) : null;
  const narrationContext = {
    sourceLanguage: course.sourceLanguage ?? "", targetLanguage: course.languageCode,
    targetLocale, targetFallbackAllowed: variantResolution.speechFallback === "same_language",
  };
  const transcriptLines = transcriptNarration(segment.presentation?.transcript ?? [], narrationContext);
  const narrator = useMemo(() => {
    // The identity invalidates callbacks on account/course/version/segment/variant changes.
    void [authUserId, courseId, contentVersion, definition.lessonId, segment.id, targetLocale, studyState.profile.variantId];
    return new NarrationController((line, callbacks) => {
      let handle: PlaybackHandle | null = null;
      const started = speakText(line.text, line.locale!, callbacks.error, undefined, {
        fallbackAllowed: line.fallbackAllowed,
        onHandle: (owner) => { handle = owner; },
        onEnd: callbacks.end, onCancel: callbacks.cancel,
        onSelection: (selection) => {
          if (selection.fallback) setNarration({ status: "speaking", line,
            message: `Áudio em ${selection.operationalLocale}: outra variante; use apenas como apoio.` });
        },
      });
      return started ? handle : null;
    }, setNarration);
  }, [authUserId, courseId, contentVersion, definition.lessonId, segment.id, targetLocale, studyState.profile.variantId]);
  useEffect(() => {
    if (narration.status !== "speaking" || !narration.line?.id.startsWith("transcript:")) return;
    const anchorMs = narration.line.anchorMs;
    const board = engine.current.seek(anchorMs);
    if (mediaRef.current) new HtmlMediaPresentationController(mediaRef.current).seek(anchorMs);
    dispatch({ type: "SEEK", positionMs: anchorMs, board });
  }, [narration.status, narration.line, dispatch]);
  useEffect(() => () => {
    narrator.cancel();
    playbackRef.current?.cancel();
    transientRef.current?.pause();
    requestId.current += 1;
  }, [narrator]);
  const pausePlayback = useCallback(() => {
    narrator.pause();
    playbackRef.current?.cancel();
    mediaRef.current?.pause();
    transientRef.current?.pause();
    if (stateRef.current.phase === "presenting") {
      stateRef.current = { ...stateRef.current, phase: "paused" };
      dispatch({ type: "PAUSE" });
    }
  }, [narrator, dispatch]);
  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") pausePlayback(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", pausePlayback);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", pausePlayback);
    };
  }, [pausePlayback]);
  function startNarration(lines: NarrationLine[]) {
    pausePlayback();
    narrator.start(lines);
  }
  function cancelPlayback() { pausePlayback(); narrator.cancel(); }
  const currentMedia = segment.presentation?.mediaId
    ? media[segment.presentation.mediaId]
    : undefined;
  const activity =
    segment.activityRef && lesson?.activities.find((item) => item.id === segment.activityRef);
  const progress = Math.round(
    (state.completedSegmentIds.length / definition.segments.length) * 100,
  );
  const captionLine = segment.presentation?.transcript.find(
    (line) => state.positionMs >= line.startMs && state.positionMs < line.endMs,
  );
  const activeCaption = captionLine?.text ?? "";
  const alternative =
    curatedExamples.find((item) => segment.concepts.includes(item.conceptId)) ?? curatedExamples[0];
  const nextActivity = definition.segments
    .slice(state.segmentIndex)
    .find((item) => item.activityRef)?.activityRef;
  const upcomingActivity = lesson?.activities.find((item) => item.id === nextActivity);
  const supportActivity = lesson?.activities.find(
    (item) => item.id === (practiceActivityRef ?? nextActivity),
  );

  const handleTransient = useCallback(
    (effects: LessonAction[], positionMs: number) => {
      for (const action of effects) {
        if (action.type === "audio.play") {
          const asset = media[action.mediaId];
          if (asset?.type === "audio") {
            const audio = new Audio(asset.src);
            transientRef.current = audio;
            const owner = claimAudioPlayback(() => { audio.pause(); });
            playbackRef.current = owner;
            dispatch({ type: "PAUSE" });
            stateRef.current = { ...stateRef.current, phase: "paused" };
            audio.onplaying = () => { if (!owner.isCurrent()) audio.pause(); };
            audio.onended = () => { if (owner.isCurrent()) owner.release(); };
            audio.onerror = () => { if (owner.isCurrent()) owner.release(); };
            void audio.play().catch(() => owner.release());
          }
        } else if (action.type === "activity.open" || action.type === "speech.request") {
          narrator.cancel();
          playbackRef.current?.cancel();
          mediaRef.current?.pause();
          transientRef.current?.pause();
          setPracticeActivityRef(action.activityRef);
          setSupportMode("practice");
          dispatch({
            type: "INTERVENE",
            reason: "practice",
            anchorMs: resumeAnchor(segment.resumeAnchorsMs, positionMs),
          });
        }
      }
    },
    [media, segment, narrator, setPracticeActivityRef, setSupportMode, dispatch],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/interactive-lessons/session?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(definition.lessonId)}`,
          { cache: "no-store" },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(lessonUiError(body.error ?? "Não foi possível abrir a aula."));
        if (cancelled) return;
        if (body.session) {
          revisionRef.current = body.session.revision;
          const restored = body.session.runtime_state as LessonRuntimeState;
          if (
            body.session.content_version === contentVersion &&
            restored &&
            Number.isInteger(restored.segmentIndex) &&
            restored.segmentIndex >= 0 &&
            restored.segmentIndex < definition.segments.length &&
            Array.isArray(restored.completedSegmentIds) &&
            restored.board
          ) {
            dispatch({ type: "RESTORE", state: restored });
            if (restored.phase === "completed") setCompletionSaved(true);
          } else {
            dispatch({ type: "RESTORE", state: initialRuntime(definition) });
          }
        }
        readyRef.current = true;
        setLoading(false);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Erro ao abrir a aula.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, contentVersion, definition]);

  const persist = useCallback(
    (snapshot: LessonRuntimeState, force = false) => {
      if (!readyRef.current || snapshot.phase === "idle" || saveFailureRef.current || (submittingRef.current && !force)) return;
      const serialized = JSON.stringify(snapshot);
      if (!force && serialized === lastQueued.current) return;
      lastQueued.current = serialized;
      saveQueue.current = saveQueue.current.then(async () => {
        if (saveFailureRef.current) return;
        const current = stateRef.current;
        const response = await fetch("/api/interactive-lessons/session", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, contentVersion, lessonId: definition.lessonId,
            revision: revisionRef.current, runtime: current }), keepalive: true,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(lessonUiError(body.error ?? "Não foi possível salvar a aula."));
        revisionRef.current = body.revision;
        if (!stateRef.current.evidenceScope) {
          const scoped = { ...stateRef.current, evidenceScope: body.runtime.evidenceScope };
          stateRef.current = scoped;
          dispatch({ type: "RESTORE", state: scoped });
        }
        if (current.phase === "completed") setCompletionSaved(true);
      }).catch((error) => {
        lastQueued.current = "";
        saveFailureRef.current = error instanceof Error ? error.message : "Falha ao salvar a aula.";
        setSaveError(saveFailureRef.current);
      });
    }, [courseId, contentVersion, definition.lessonId, dispatch, setCompletionSaved, setSaveError],
  );
  async function submitSegment(answer: string, audio?: Blob) {
    if (submittingRef.current || saveFailureRef.current) throw new Error("Aguarde a gravação da etapa ou recarregue a aula.");
    const owner = captureInteractiveLessonOwner();
    submittingRef.current = true;
    setSegmentBusy(true);
    try {
      const audioHash = audio ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await audio.arrayBuffer())))
        .map((byte) => byte.toString(16).padStart(2, "0")).join("") : "";
      const key = JSON.stringify([segment.id, answer, audioHash]);
      if (pendingAttemptRef.current?.key !== key) {
        persist(stateRef.current, true);
        await saveQueue.current;
        if (saveFailureRef.current) throw new Error(saveFailureRef.current);
        const scope = stateRef.current.evidenceScope;
        if (!scope || revisionRef.current === null || !activity) throw new Error("A etapa ainda não foi salva.");
        pendingAttemptRef.current = { key, audio, input: { courseId, lessonId: definition.lessonId,
          contentVersion, sessionId: scope.sessionId, revision: revisionRef.current,
          segmentId: segment.id, activityId: activity.id, attemptId: crypto.randomUUID(), answer } };
      }
      const pending = pendingAttemptRef.current;
      const operation = saveQueue.current.then(async () => {
        let body: string | FormData;
        if (pending.audio) {
          body = new FormData();
          for (const [name, value] of Object.entries(pending.input)) body.append(name, String(value));
          body.append("audio", pending.audio, "attempt.wav");
        } else body = JSON.stringify(pending.input);
        const response = await fetch("/api/interactive-lessons/segment", { method: "POST",
          ...(pending.audio ? {} : { headers: { "Content-Type": "application/json" } }), body });
        const result = await response.json();
        if (!response.ok) {
          if (response.status < 500) pendingAttemptRef.current = null;
          if (response.status === 409) {
            saveFailureRef.current = "A aula mudou em outra aba ou versão. Recarregue para continuar.";
            setSaveError(saveFailureRef.current);
          }
          throw new Error(lessonUiError(result.error ?? "Não foi possível registrar a etapa."));
        }
        if (result.sessionId !== stateRef.current.evidenceScope?.sessionId || !result.runtime?.evidenceScope ||
          result.runtime.evidenceScope.definitionHash !== stateRef.current.evidenceScope?.definitionHash)
          throw new Error("A resposta não corresponde à sessão da aula.");
        applyInteractiveLessonReceipt(result.progressReceipt, owner);
        revisionRef.current = result.revision;
        stateRef.current = result.runtime;
        lastQueued.current = JSON.stringify(result.runtime);
        dispatch({ type: "RESTORE", state: result.runtime });
        pendingAttemptRef.current = null;
        return result;
      });
      saveQueue.current = operation.then(() => undefined, () => undefined);
      return await operation;
    } finally { submittingRef.current = false; setSegmentBusy(false); }
  }
  useEffect(
    () => () => {
      persist(stateRef.current);
    },
    [persist],
  );

  // Save transitions immediately; save playback position periodically without writing every frame.
  const transitionKey = `${state.phase}:${state.segmentIndex}:${state.checkpointPassed}:${state.speakingSaved}:${state.checkpointFailures}:${state.slowdownCount}:${state.resumePoint?.reason ?? ""}`;
  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => persist(stateRef.current), 300);
    return () => window.clearTimeout(timer);
  }, [loading, persist, transitionKey]);
  useEffect(() => {
    if (loading) return;
    const timer = window.setInterval(() => persist(stateRef.current), 8000);
    const onHide = () => {
      if (document.visibilityState === "hidden") persist(stateRef.current);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [loading, persist]);

  useEffect(() => {
    engine.current.load(segment.cues);
    engine.current.seek(stateRef.current.positionMs);
    requestId.current += 1;
  }, [segment.id, segment.cues]);
  useEffect(() => {
    const element = mediaRef.current;
    const player = element ? new HtmlMediaPresentationController(element) : null;
    player?.setPlaybackRate(speed);
    if (state.phase !== "presenting") { player?.pause(); return; }
    const owner = claimAudioPlayback(() => {
      player?.pause();
      if (stateRef.current.phase === "presenting") {
        stateRef.current = { ...stateRef.current, phase: "paused" };
        dispatch({ type: "PAUSE" });
      }
    });
    playbackRef.current = owner;
    player?.seek(stateRef.current.positionMs);
    if (player) void player.play().catch(() => {
      if (owner.isCurrent()) { owner.cancel(); dispatch({ type: "PAUSE" }); }
    });
    return () => { owner.release(); player?.pause(); };
  }, [state.phase, state.segmentIndex, speed, currentMedia?.src]);
  useEffect(() => {
    if (
      state.phase !== "presenting" ||
      !segment.presentation ||
      (segment.presentation.mode !== "slides" && !mediaError)
    )
      return;
    lastClock.current = performance.now();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        lastClock.current = performance.now();
        return;
      }
      if (stateRef.current.phase !== "presenting") return;
      const now = performance.now();
      const elapsed = Math.min(500, now - lastClock.current);
      lastClock.current = now;
      const next = Math.min(
        segment.presentation!.durationMs,
        stateRef.current.positionMs + Math.round(elapsed * speed),
      );
      const result = engine.current.tick(next);
      handleTransient(result.effects, next);
      dispatch({ type: "TICK", positionMs: next, board: result.board });
      if (next >= segment.presentation!.durationMs) dispatch({ type: "PAUSE" });
    }, 200);
    return () => window.clearInterval(timer);
  }, [state.phase, segment, speed, handleTransient, mediaError]);

  function seek(positionMs: number) {
    cancelPlayback();
    const board = engine.current.seek(positionMs);
    if (mediaRef.current) new HtmlMediaPresentationController(mediaRef.current).seek(positionMs);
    dispatch({ type: "SEEK", positionMs, board });
  }
  function next() {
    cancelPlayback();
    const upcoming = definition.segments[state.segmentIndex + 1];
    const nextEngine = new TimelineEngine();
    nextEngine.load(upcoming?.cues ?? []);
    setTeaching(null);
    setMediaError(false);
    setLastAssessment(null);
    setPracticeActivityRef(null);
    dispatch({ type: "NEXT", nextBoard: nextEngine.getStateAt(0) });
  }
  function intervene(mode: typeof supportMode) {
    if (!segment.allowInterruption || !["presenting", "paused"].includes(state.phase)) return;
    cancelPlayback();
    setSupportMode(mode);
    setPracticeActivityRef(nextActivity ?? null);
    setTeaching(null);
    dispatch({
      type: "INTERVENE",
      reason: mode,
      anchorMs: resumeAnchor(segment.resumeAnchorsMs, state.positionMs),
    });
  }
  function resume() {
    if (!state.resumePoint) return;
    cancelPlayback();
    const board = engine.current.seek(state.resumePoint.anchorMs);
    if (mediaRef.current)
      new HtmlMediaPresentationController(mediaRef.current).seek(state.resumePoint.anchorMs);
    dispatch({ type: "RESUME", board });
    setTeaching(null);
  }
  function toggleSpeed() {
    if (speed === 1) dispatch({ type: "SLOWER_REQUESTED" });
    setSpeed((current) => (current === 1 ? 0.75 : 1));
  }
  function onMediaPosition(ms: number) {
    if (stateRef.current.phase !== "presenting" || !playbackRef.current?.isCurrent()) return;
    const duration = segment.presentation?.durationMs ?? 0;
    const next = Math.min(ms, duration);
    const result = engine.current.tick(next);
    handleTransient(result.effects, next);
    dispatch({ type: "TICK", positionMs: next, board: result.board });
    if (next >= duration) dispatch({ type: "PAUSE" });
  }
  async function askTeacher(value: string) {
    if (questionComposing) return;
    const trimmed = value.trim();
    if (trimmed.length < 3 || teachingBusy) return;
    const ownRequest = ++requestId.current;
    if (["presenting", "paused"].includes(state.phase)) intervene("ask");
    setSupportMode("ask");
    setTeachingBusy(true);
    setQuestion("");
    try {
      const response = await fetch("/api/ai/interactive-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId: definition.lessonId,
          segmentId: segment.id,
          positionMs: state.positionMs,
          question: trimmed,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "A professora não conseguiu responder agora.");
      if (ownRequest !== requestId.current) return;
      setTeaching({
        message: body.message,
        example: body.example,
        translation: body.translation,
        followUp: body.followUp,
        actions: (body.actions ?? []).flatMap((action: unknown) => {
          const parsed = lessonActionSchema.safeParse(action);
          return parsed.success && parsed.data.type === "board.show" ? [parsed.data] : [];
        }),
      });
    } catch (error) {
      if (ownRequest === requestId.current)
        setTeaching({
          unannotatedMessage: true,
          message: `${segment.explanation ?? "Revise o exemplo no quadro e tente novamente."} ${error instanceof Error ? error.message : ""}`,
          example: alternative?.text ?? "",
          translation: alternative?.translation ?? "",
          followUp: "",
          actions: [],
        });
    } finally {
      if (ownRequest === requestId.current) setTeachingBusy(false);
    }
  }

  const supportBoard = useMemo(
    () => teaching?.actions.reduce((board, action) => applyBoardAction(board, action), state.board),
    [teaching, state.board],
  );
  if (loading) return <div className="page-loading">Preparando sua aula particular…</div>;
  if (loadError || !lesson)
    return (
      <div className="live-empty panel" role="alert">
        <h1>Não foi possível abrir esta aula</h1>
        <p>{loadError || "Lição não encontrada no curso ativo."}</p>
        <button className="primary-button" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </div>
    );
  if (state.phase === "completed")
    return (
      <div className="live-complete panel">
        <span className="live-complete-icon">
          <Check size={30} />
        </span>
        <span className="eyebrow">AULA CONCLUÍDA</span>
        <h1>Você destravou mais uma estrutura.</h1>
        <p>
          Você acompanhou a explicação, respondeu ao exercício e praticou a fala.{" "}
          {completionSaved ? "Sua conclusão foi salva." : "Salvando sua conclusão…"}
        </p>
        {saveError && <p role="alert">{saveError} Recarregue para verificar o estado da aula.</p>}
        <div className="live-complete-actions">
          {completionSaved ? (
            <Link className="primary-button" href={`/course/${course.slug}`}>
              Voltar ao curso <ArrowRight size={17} />
            </Link>
          ) : (
            <button className="primary-button" disabled>
              Salvando aula…
            </button>
          )}
          <button
            className="secondary-button"
            onClick={() => {
              setCompletionSaved(false);
              dispatch({ type: "RESTORE", state: { ...initialRuntime(definition, state.evidenceScope),
                segmentEvidence: state.segmentEvidence, segmentFailures: state.segmentFailures,
                segmentAttemptSequences: state.segmentAttemptSequences,
                message: "Esta revisão mantém suas entregas anteriores. Você pode enviar novas tentativas em cada etapa." } });
            }}
          >
            <RotateCcw size={16} /> Rever aula
          </button>
        </div>
      </div>
    );

  const canContinue =
    !saveError && !segmentBusy &&
    (segment.type !== "checkpoint" || !segment.required || state.checkpointPassed) &&
    (segment.type !== "speaking" || !segment.required || state.speakingSaved) &&
    (!segment.presentation || state.positionMs >= segment.presentation.durationMs);
  const canStart = state.phase === "idle";
  const isPresenting =
    state.phase === "presenting" || state.phase === "paused" || state.phase === "intervening";
  const displayedBoard =
    state.phase === "intervening" ? (supportBoard ?? state.board) : state.board;
  if (course.availability?.unavailableInteractiveLessonIds?.includes(definition.id))
    return (
      <div className="live-empty panel" role="status">
        <h1>Aula temporariamente indisponível</h1>
        <p>
          Este dispositivo não oferece uma capacidade necessária à aula. A indisponibilidade não
          representa erro ou conclusão.
        </p>
        <Link className="secondary-button" href={`/course/${course.slug}`}>
          Voltar ao curso
        </Link>
      </div>
    );
  return (
    <SpeechPlaybackScope.Provider value={(owner) => { playbackRef.current = owner; }}>
    <div className="live-page" onPlayCapture={(event) => {
      const element = event.target;
      if (!(element instanceof HTMLMediaElement)) return;
      if (element === mediaRef.current) {
        if (!playbackRef.current?.isCurrent() || stateRef.current.phase !== "presenting") element.pause();
        return;
      }
      if (nativePlaybackRef.current?.element === element && nativePlaybackRef.current.owner.isCurrent()) return;
      pausePlayback();
      const owner = claimAudioPlayback(() => element.pause());
      nativePlaybackRef.current = { element, owner };
      playbackRef.current = owner;
    }}>
      <div className="live-heading">
        <div>
          <Link className="live-back" href={`/course/${course.slug}`}>
            <ArrowLeft size={15} /> Voltar ao curso
          </Link>
          <span className="eyebrow">
            <Sparkles size={13} /> AULA PARTICULAR · {language.identity.nativeName.toUpperCase()}
          </span>
          <h1>{definition.title}</h1>
          <p>{definition.objectives[0]}</p>
        </div>
        <div className="live-time">
          <Clock3 size={15} /> {definition.estimatedMinutes} min <span>·</span> {progress}%
          concluído
        </div>
      </div>
      {saveError && (
        <div className="live-alert" role="alert">
          {saveError} <button onClick={() => window.location.reload()}>Recarregar aula</button>
        </div>
      )}
      {state.message && state.phase !== "intervening" && <p className="live-alert" role="status">{state.message}</p>}
      <div className="live-grid">
        <div className="live-primary">
          <div className="live-stage">
            <div className="live-teacher-visual">
              {currentMedia &&
              (segment.presentation?.mode === "video" || segment.presentation?.mode === "audio") &&
              !mediaError ? (
                segment.presentation.mode === "video" ? (
                  <video
                    key={segment.id}
                    onPlay={(event) => { if (!playbackRef.current?.isCurrent() || stateRef.current.phase !== "presenting") event.currentTarget.pause(); }}
                    ref={(node) => {
                      mediaRef.current = node;
                    }}
                    src={currentMedia.src}
                    playsInline
                    preload="metadata"
                    onError={() => setMediaError(true)}
                    onEnded={() => onMediaPosition(segment.presentation!.durationMs)}
                    onTimeUpdate={(event) =>
                      onMediaPosition(Math.round(event.currentTarget.currentTime * 1000))
                    }
                  />
                ) : (
                  <audio
                    key={segment.id}
                    onPlay={(event) => { if (!playbackRef.current?.isCurrent() || stateRef.current.phase !== "presenting") event.currentTarget.pause(); }}
                    ref={(node) => {
                      mediaRef.current = node;
                    }}
                    src={currentMedia.src}
                    preload="metadata"
                    onError={() => setMediaError(true)}
                    onEnded={() => onMediaPosition(segment.presentation!.durationMs)}
                    onTimeUpdate={(event) =>
                      onMediaPosition(Math.round(event.currentTarget.currentTime * 1000))
                    }
                  />
                )
              ) : null}
              <Image
                src="/images/professora-sofia.jpg"
                alt="Ilustração da professora da aula"
                width={1200}
                height={1200}
                priority
              />
              <div className="live-teacher-overlay">
                <span className="live-mode-badge">
                  {segment.presentation?.mode === "slides" || mediaError
                    ? "Apresentação em slides"
                    : currentMedia
                      ? "Aula com mídia"
                      : "Aula guiada"}
                </span>
                <strong>Professora Sofia</strong>
                <LearningText
                  as="p"
                  presentation={
                    activeCaption ? { content: captionLine?.textPresentation } : undefined
                  }
                  textRole={activeCaption ? "target" : "source"}
                  text={
                    activeCaption ||
                    segment.explanation ||
                    "Vamos estudar juntos, um passo de cada vez."
                  }
                />
                {activeCaption && (
                  <button type="button" className="speak-button" onClick={() => startNarration(
                    transcriptLines.filter((line) => line.anchorMs === captionLine?.startMs),
                  )}><Volume2 size={17} aria-hidden="true" /> Ouvir esta fala</button>
                )}
              </div>
            </div>
            <div className="live-board">
              <div className="live-board-top">
                <span>QUADRO INTERATIVO</span>
                <button type="button" onClick={() => setShowTranslation((value) => !value)}>
                  {showTranslation ? "Ocultar tradução" : "Ver tradução"}
                </button>
              </div>
              <LearningBoard board={displayedBoard} showTranslation={showTranslation} onNarrate={(element) => {
                if (element.kind === "comparison") return;
                startNarration([narrationLine(`board:${element.id}`, element.text, element.textPresentation?.language, narrationContext)]);
              }} />
            </div>
          </div>

          {isPresenting && (
            <div className="live-player panel">
              <button
                type="button"
                className="live-play"
                onClick={() => {
                  cancelPlayback();
                  if (state.phase === "paused") dispatch({ type: "PLAY" });
                }}
                disabled={state.phase === "intervening"}
                aria-label={state.phase === "presenting" ? "Pausar aula" : "Reproduzir aula"}
              >
                {state.phase === "presenting" ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <span>{seconds(state.positionMs)}</span>
              <input
                aria-label="Posição da apresentação"
                type="range"
                min={0}
                max={segment.presentation?.durationMs ?? 1}
                value={state.positionMs}
                disabled={state.phase === "intervening" || !segment.presentation}
                onChange={(event) => seek(Number(event.target.value))}
              />
              <span>{seconds(segment.presentation?.durationMs ?? 0)}</span>
              <button
                type="button"
                className="live-speed"
                aria-label="Velocidade"
                onClick={toggleSpeed}
              >
                {speed}×
              </button>
            </div>
          )}

          {state.phase !== "idle" && (
            <div className="live-support panel" aria-label="Narração da aula">
              <p>A narração começa ao clicar em Ouvir. A retomada repete o início da frase; a apresentação fica pausada.</p>
              {transcriptLines.length > 0 && <button type="button" className="secondary-button"
                onClick={() => startNarration(transcriptLines)}><Volume2 size={17} aria-hidden="true" /> Ouvir apresentação</button>}
              <button type="button" className="secondary-button" disabled={narration.status !== "speaking"}
                onClick={() => { narrator.pause(); }}>Pausar narração</button>
              <button type="button" className="secondary-button" disabled={!["paused", "text"].includes(narration.status)}
                onClick={() => { pausePlayback(); narrator.resume(); }}>Retomar frase</button>
              <button type="button" className="secondary-button" disabled={narration.status === "idle"}
                onClick={() => narrator.cancel()}>Cancelar narração</button>
              {narration.message && <p role="status">{narration.message}</p>}
              {narration.line && <p lang={narration.line.language ?? undefined}>{narration.line.text}</p>}
              {transcriptLines.length > 0 && <details><summary>Texto da apresentação</summary>
                {transcriptLines.map((line) => <p key={line.id} lang={line.language ?? undefined}>
                  {line.text}{" "}
                  {line.locale ? <button type="button" onClick={() => startNarration([line])} aria-label={`Ouvir fala ${line.id.split(":")[1]}`}>Ouvir fala</button>
                    : <small>Somente texto: idioma ou locale de voz não declarado com segurança.</small>}
                </p>)}
              </details>}
            </div>
          )}

          {canStart && (
            <div className="live-start panel">
              <span className="eyebrow">SEU PLANO DE AULA</span>
              <h2>Pronto para começar?</h2>
              <p>
                Você verá uma explicação com exemplos no quadro, responderá a um exercício e
                praticará a fala. Pode pausar e retomar depois.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => dispatch({ type: "START" })}
              >
                <Play size={17} /> Iniciar aula
              </button>
            </div>
          )}

          {(state.phase === "checkpoint" || state.phase === "speaking") && activity && (
            <div className="live-activity" id="live-activity">
              <div className="live-activity-intro">
                <span className="eyebrow">
                  {segment.type === "speaking" ? "SUA VEZ DE FALAR" : "CONFIRA O QUE APRENDEU"}
                </span>
                <p>
                  {segment.type === "speaking"
                    ? "Grave e salve sua tentativa. A entrega não recebe nota; a avaliação de pronúncia é opcional."
                    : "Responda antes de avançar. Se precisar, você pode tentar de novo."}
                </p>
              </div>
              <ActivityRenderer
                key={segment.id}
                activity={activity}
                onSubmitAnswer={async (answer) => {
                  const result = await submitSegment(answer);
                  if (typeof result.grade?.correct !== "boolean") throw new Error("Correção inválida.");
                  return result.grade as GradeResult;
                }}
                onAssessed={(_answer, result) => setLastAssessment(result.correct ? "correct" : "incorrect")}
                onSubmitWriting={async (text) => { await submitSegment(text); }}
                onSubmitSpeaking={async (transcription, audio) => { await submitSegment(transcription, audio); }}
              />
              {lastAssessment === "incorrect" && (
                <p className="live-feedback">Ainda não. Veja a explicação e tente novamente.</p>
              )}
              {lastAssessment === "correct" && (
                <p className="live-feedback success">
                  <Check size={16} /> Boa! Você pode continuar.
                </p>
              )}
            </div>
          )}
          {state.phase === "checkpoint" &&
            !state.checkpointPassed &&
            state.checkpointFailures >= 2 &&
            !state.runtimePath.some((node) => node.kind === "reinforcement") && (
              <button className="secondary-button" onClick={() => dispatch({ type: "REINFORCE" })}>
                <Lightbulb size={16} /> Rever de outro jeito
              </button>
            )}
          {state.phase === "reinforcement" && (
            <div className="live-support panel">
              <span className="eyebrow">MAIS UMA EXPLICAÇÃO</span>
              <h2>Vamos tentar por outro caminho.</h2>
              <p>{segment.explanation ?? "Leia o exemplo e tente responder novamente."}</p>
              {alternative && (
                <div className="live-support-example" {...textAttrs()}>
                  {alternative.text}
                  <button type="button" className="speak-button" aria-label="Ouvir exemplo alternativo"
                    onClick={() => startNarration(teachingNarration({ message: "", example: alternative.text, translation: "", followUp: "" }, narrationContext))}>
                    <Volume2 size={17} aria-hidden="true" /> Ouvir exemplo
                  </button>
                  <small>
                    <LearningText textRole="source" text={alternative.translation} />
                  </small>
                </div>
              )}
              <button
                className="primary-button"
                onClick={() => dispatch({ type: "REINFORCEMENT_DONE" })}
              >
                Voltar ao exercício <ArrowRight size={16} />
              </button>
            </div>
          )}
          {state.phase === "intervening" && (
            <div className="live-support panel">
              <span className="eyebrow">
                <Sparkles size={13} /> APOIO DA PROFESSORA
              </span>
              <h2>
                {supportMode === "example"
                  ? "Outro exemplo"
                  : supportMode === "practice"
                    ? "Prepare sua resposta"
                    : supportMode === "ask"
                      ? "Sua dúvida"
                      : "Vamos explicar de outro jeito"}
              </h2>
              {teachingBusy ? (
                <p>Preparando uma resposta para você…</p>
              ) : (
                <p>
                  {teaching?.message ??
                    (supportMode === "practice"
                      ? `Depois da explicação, você vai praticar: ${upcomingActivity?.title ?? "o conteúdo da aula"}.`
                      : (segment.explanation ??
                        "Observe o exemplo e veja como a estrutura funciona."))}
                </p>
              )}
              {(teaching?.example || alternative?.text) && (
                <div className="live-support-example">
                  <span {...textAttrs()}>{teaching?.example || alternative?.text}</span>
                  <button type="button" className="speak-button" aria-label="Ouvir exemplo"
                    onClick={() => startNarration(teachingNarration({ message: "", example: teaching?.example || alternative?.text || "", translation: "", followUp: "" }, narrationContext))}>
                    <Volume2 size={17} aria-hidden="true" /> Ouvir exemplo
                  </button>
                  <small>
                    <LearningText
                      textRole="source"
                      text={teaching?.translation || alternative?.translation || ""}
                    />
                  </small>
                </div>
              )}
              {supportMode === "practice" && supportActivity && (
                <div className="live-practice">
                  <ActivityRenderer
                    key={`practice:${supportActivity.id}`}
                    activity={supportActivity}
                    onAssessed={(answer, result) => submitAttempt(supportActivity, answer, result)}
                  />
                </div>
              )}
              {teaching && <button type="button" className="secondary-button"
                onClick={() => startNarration(teachingNarration(teaching, narrationContext))}>Ouvir resposta da professora</button>}
              {alternative?.translation && <button type="button" className="secondary-button"
                onClick={() => startNarration(teachingNarration({ message: "", example: "", translation: teaching?.translation || alternative.translation, followUp: "" }, narrationContext))}>Ouvir tradução</button>}
              {teaching?.followUp && <p className="live-follow-up">{teaching.followUp}<small> Pergunta de acompanhamento disponível em texto.</small></p>}
              <button
                type="button"
                className="primary-button"
                disabled={teachingBusy}
                onClick={resume}
              >
                Retomar explicação <ArrowRight size={16} />
              </button>
              <small>A aula volta ao início da última parte da explicação.</small>
            </div>
          )}
          {segment.type === "summary" && state.phase !== "idle" && (
            <div className="live-support panel">
              <span className="eyebrow">RESUMO</span>
              <h2>O que você aprendeu</h2>
              <p>{segment.explanation}</p>
            </div>
          )}
          {state.phase !== "idle" &&
            state.phase !== "intervening" &&
            state.phase !== "reinforcement" && (
              <div className="live-next">
                <span>
                  {segment.type === "checkpoint" && !state.checkpointPassed
                    ? activity && activity.type === "writing" ? "Salve seu texto para continuar." : "Acerte o exercício para continuar."
                    : segment.type === "speaking" && !state.speakingSaved
                      ? "Salve uma tentativa de fala para continuar."
                      : state.phase === "presenting"
                        ? "A explicação está em andamento."
                        : "Continue quando estiver pronto."}
                </span>
                <button
                  type="button"
                  className="primary-button"
                  onClick={next}
                  disabled={!canContinue || state.phase === "presenting"}
                >
                  {state.segmentIndex === definition.segments.length - 1
                    ? "Concluir aula"
                    : "Próxima etapa"}{" "}
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
        </div>

        <aside className="live-side">
          <div className="live-teacher-card panel">
            <div className="live-profile">
              <Image src="/images/professora-sofia.jpg" alt="" width={48} height={48} />
              <div>
                <span>SUA PROFESSORA</span>
                <strong>Sofia</strong>
              </div>
            </div>
            <p>
              Interrompa quando precisar. Sua aula ficará pausada enquanto você esclarece a dúvida.
            </p>
            <div className="live-quick">
              <button
                disabled={!isPresenting || state.phase === "intervening"}
                onClick={() => intervene("explain")}
              >
                <CircleHelp size={17} /> Não entendi
              </button>
              <button
                disabled={!isPresenting || state.phase === "intervening"}
                onClick={() => intervene("example")}
              >
                <Lightbulb size={17} /> Outro exemplo
              </button>
              <button
                disabled={!isPresenting || state.phase === "intervening"}
                onClick={toggleSpeed}
              >
                <Volume2 size={17} /> {speed === 1 ? "Mais devagar" : "Velocidade normal"}
              </button>
              <button
                disabled={!isPresenting || state.phase === "intervening"}
                onClick={() => intervene("practice")}
              >
                <Mic2 size={17} /> Praticar
              </button>
            </div>
            <form
              className="live-ask"
              onSubmit={(event) => {
                event.preventDefault();
                void askTeacher(question);
              }}
            >
              <label htmlFor="live-question">
                <MessageCircle size={16} /> Pergunte à professora
              </label>
              <LearningTextarea
                textRole="source"
                onCompositionChange={setQuestionComposing}
                id="live-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                maxLength={400}
                placeholder="Qual é sua dúvida nesta etapa?"
              />
              <button
                type="submit"
                disabled={question.trim().length < 3 || teachingBusy || questionComposing}
              >
                Perguntar <Send size={15} />
              </button>
            </form>
            {teaching && state.phase !== "intervening" && (
              <p className="live-side-answer" role="status">
                {teaching.message}
              </p>
            )}
          </div>
          <div className="live-timeline panel">
            <span className="eyebrow">ROTEIRO DA AULA</span>
            <ol>
              {state.runtimePath.map((node) => {
                const item = definition.segments.find(
                  (candidate) => candidate.id === node.segmentId,
                );
                if (!item) return null;
                const index = definition.segments.indexOf(item);
                const isReinforcement = node.kind === "reinforcement";
                const done = !isReinforcement && state.completedSegmentIds.includes(item.id);
                const active = isReinforcement
                  ? state.phase === "reinforcement"
                  : index === state.segmentIndex && state.phase !== "reinforcement";
                return (
                  <li key={node.id} className={active ? "active" : done ? "done" : ""}>
                    <span className="live-step-dot">
                      {done ? (
                        <Check size={12} />
                      ) : isReinforcement ? (
                        <Lightbulb size={12} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div>
                      <strong>{isReinforcement ? "Reforço extra" : item.title}</strong>
                      <small>
                        {isReinforcement
                          ? "Explicação adaptada"
                          : item.type === "checkpoint"
                            ? "Exercício"
                            : item.type === "speaking"
                              ? "Prática de fala"
                              : item.presentation
                                ? seconds(item.presentation.durationMs)
                                : "Resumo"}
                      </small>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
    </SpeechPlaybackScope.Provider>
  );
}
