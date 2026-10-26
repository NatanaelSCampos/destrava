"use client";

import { useTextPresentation } from "@/components/learning/text-presentation";
import { presentationLanguage } from "@/engine/presentation/language";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  BookOpen,
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
import { LessonSupport } from "@/components/activities/lesson-support";
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
import { featureFlags } from "@/lib/feature-flags";
import { StudyActivityClock } from "@/domain/study/session-time";
import {
  applyBoardAction,
  initialRuntime,
  reduceRuntime,
  TimelineEngine,
  type LessonRuntimeState,
} from "@/domain/interactive-lesson/runtime";
import { HtmlMediaPresentationController } from "@/domain/interactive-lesson/presentation-controller";
import type { CuratedExample } from "@/content/interactive-examples";
import { LearningBoard, LearningRuns, type BoardTextRun } from "./learning-board";
import { GuidedStudyActivity } from "./guided-study-activity";
import { LearningText, LearningTextarea } from "@/components/learning/text-presentation";

type Media = Record<string, { src: string; type: string; synthetic?: boolean }>;
type TeachingReply = TeachingNarration & {
  actions: LessonAction[];
  messageParts?: { text: string; role: "source" | "target" | "unknown" }[];
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

type ClassroomProps = {
  definition: InteractiveLessonDefinition;
  courseId: string;
  contentVersion: string;
  media: Media;
  curatedExamples: CuratedExample[];
  unitHref?: string;
};

export function InteractiveClassroom(props: ClassroomProps) {
  const { authUserId, progressLoadStatus, course } = useStudy();
  // A new account or lesson definition owns fresh local state and pending operations.
  const identity = useMemo(() => JSON.stringify([
    authUserId, props.courseId, props.contentVersion, props.definition,
  ]), [authUserId, props.courseId, props.contentVersion, props.definition]);
  if (progressLoadStatus === "loading")
    return <div className="page-loading" role="status">Preparando sua aula…</div>;
  if (!authUserId || !["loaded", "absent"].includes(progressLoadStatus))
    return <div className="live-empty panel" role="alert">
      <h1>{authUserId ? "Não foi possível abrir sua aula" : "Entre para abrir sua aula"}</h1>
      <p>{authUserId ? "Volte ao curso e tente novamente." : "Acesse sua conta para continuar estudando."}</p>
      <Link className="secondary-button" href={authUserId ? (props.unitHref ?? `/course/${course.slug}`) : "/login"}>
        {authUserId ? (props.unitHref ? "Voltar à unidade" : "Voltar ao curso") : "Entrar na conta"}
      </Link>
    </div>;
  return <ClassroomSession key={identity} {...props} />;
}

function ClassroomSession({
  definition,
  courseId,
  contentVersion,
  media,
  curatedExamples,
  unitHref,
}: ClassroomProps) {
  const textAttrs = useTextPresentation();
  const returnLabel = unitHref ? "Voltar à unidade" : "Voltar ao curso";
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
  const runtimeIdentity = JSON.stringify([authUserId, courseId, contentVersion, definition.lessonId]);
  const requestIdentity = JSON.stringify([runtimeIdentity, state.segmentIndex, studyState.profile.variantId]);
  const [loading, setLoading] = useState(true);
  const [segmentBusy, setSegmentBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [completionSaved, setCompletionSaved] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [question, setQuestion] = useState("");
  const [questionComposing, setQuestionComposing] = useState(false);
  const [teachingEntry, setTeachingEntry] = useState<{ identity: string; reply: TeachingReply | null } | null>(null);
  const teaching = teachingEntry?.identity === requestIdentity ? teachingEntry.reply : null;
  const setTeaching = useCallback((reply: TeachingReply | null) => {
    setTeachingEntry({ identity: requestIdentity, reply });
  }, [requestIdentity]);
  const [teachingBusy, setTeachingBusy] = useState(false);
  const [teachingFailure, setTeachingFailure] = useState<{ identity: string; message: string } | null>(null);
  const teachingError = teachingFailure?.identity === requestIdentity ? teachingFailure.message : "";
  const setTeachingError = useCallback((message: string) => {
    setTeachingFailure({ identity: requestIdentity, message });
  }, [requestIdentity]);
  const [openTranscriptFor, setOpenTranscriptFor] = useState<string | null>(null);
  const transcriptOpen = openTranscriptFor === requestIdentity;
  const [supportMode, setSupportMode] = useState<"explain" | "example" | "practice" | "ask">(
    "explain",
  );
  const [practiceActivityRef, setPracticeActivityRef] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [lastAssessment, setLastAssessment] = useState<"correct" | "incorrect" | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [activitySuspended, setActivitySuspended] = useState(false);
  const [automaticallyStoppedMedia, setAutomaticallyStoppedMedia] = useState<string | null>(null);
  const [narration, setNarration] = useState<NarrationSnapshot>({ status: "idle", line: null, message: "" });
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const transientRef = useRef<HTMLAudioElement | null>(null);
  const nativePlaybackRef = useRef<{ element: HTMLMediaElement; owner: PlaybackHandle } | null>(null);
  const engine = useRef(new TimelineEngine());
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const answerRef = useRef<HTMLDivElement | null>(null);
  const questionToolsRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  const revisionRef = useRef<number | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const lastQueued = useRef("");
  const activityClock = useRef(new StudyActivityClock(0, false));
  const automaticAudioStop = useRef(false);
  const requestId = useRef(0);
  const teachingPending = useRef(false);
  const teachingAbort = useRef<AbortController | null>(null);
  const autoAdvanceArmed = useRef(false);
  const runtimeIdentityRef = useRef(runtimeIdentity);
  runtimeIdentityRef.current = runtimeIdentity;
  const requestIdentityRef = useRef(requestIdentity);
  requestIdentityRef.current = requestIdentity;
  const updateRuntime = useCallback((event: Parameters<typeof reduceRuntime>[2]) => {
    stateRef.current = reduceRuntime(definition, stateRef.current, event);
    dispatch(event);
  }, [definition]);
  const invalidateTeaching = useCallback(() => {
    requestId.current += 1;
    teachingAbort.current?.abort();
    teachingAbort.current = null;
    teachingPending.current = false;
    setTeachingBusy(false);
  }, []);
  const readyRef = useRef(false);
  const submittingRef = useRef(false);
  const saveFailureRef = useRef("");
  const pendingAttemptRef = useRef<{ key: string; input: Record<string, string | number>; audio?: Blob } | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const segment = definition.segments[state.segmentIndex];
  const mediaStopped = automaticallyStoppedMedia === segment.id;
  const variantResolution = resolveLearningVariant(language, course, studyState.profile.variantId);
  const targetLocale = variantResolution.status === "resolved" && language.speech.support.textToSpeech
    ? textToSpeechLocale(language, variantResolution.variantId, course) : null;
  const narrationContext = {
    sourceLanguage: course.sourceLanguage ?? "", targetLanguage: presentationLanguage(language),
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
            message: "Uma voz de apoio está lendo esta frase." });
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
    updateRuntime({ type: "SEEK", positionMs: anchorMs, board });
  }, [narration.status, narration.line, updateRuntime]);
  useEffect(() => () => {
    narrator.cancel();
    playbackRef.current?.cancel();
    transientRef.current?.pause();
    invalidateTeaching();
  }, [narrator, invalidateTeaching]);
  useEffect(() => {
    autoAdvanceArmed.current = false;
  }, [runtimeIdentity, studyState.profile.variantId, targetLocale]);
  const pausePlayback = useCallback(() => {
    autoAdvanceArmed.current = false;
    narrator.pause();
    mediaRef.current?.pause();
    transientRef.current?.pause();
    playbackRef.current?.cancel();
    const current = stateRef.current;
    const currentSegment = definition.segments[current.segmentIndex];
    if (!["presenting", "paused"].includes(current.phase) || !currentSegment.presentation) return;
    const mediaPosition = mediaRef.current?.currentTime;
    const positionMs = !mediaError && currentSegment.presentation.mode !== "slides" &&
      mediaPosition !== undefined && Number.isFinite(mediaPosition)
      ? Math.round(mediaPosition * 1000) : current.positionMs;
    const exact = Math.max(0, Math.min(positionMs, currentSegment.presentation.durationMs));
    updateRuntime({ type: "PAUSE" });
    updateRuntime({ type: "SEEK", positionMs: exact, board: engine.current.seek(exact) });
  }, [narrator, definition, mediaError, updateRuntime]);
  const suspendPlayback = useCallback(() => {
    autoAdvanceArmed.current = false;
    setActivitySuspended(true);
    if (mediaRef.current && stateRef.current.phase === "presenting") setAutomaticallyStoppedMedia(segment.id);
    automaticAudioStop.current = true;
    try {
      narrator.pause();
      playbackRef.current?.cancel();
      mediaRef.current?.pause();
      transientRef.current?.pause();
    } finally { automaticAudioStop.current = false; }
  }, [narrator, segment.id]);
  useEffect(() => {
    const clock = activityClock.current;
    const visibilityChanged = () => {
      const visible = document.visibilityState === "visible";
      clock.setVisible(visible, performance.now());
      if (!visible) suspendPlayback();
      else setActivitySuspended(false);
    };
    const markActivity = () => {
      if (document.visibilityState !== "visible") return;
      clock.interact(performance.now());
      setActivitySuspended(false);
    };
    const pageHidden = () => {
      clock.setVisible(false, performance.now());
      suspendPlayback();
    };
    visibilityChanged();
    const timer = window.setInterval(() => {
      if (!clock.isActive(performance.now())) suspendPlayback();
    }, 1000);
    document.addEventListener("visibilitychange", visibilityChanged);
    document.addEventListener("pointerdown", markActivity);
    document.addEventListener("keydown", markActivity);
    document.addEventListener("wheel", markActivity, { passive: true });
    window.addEventListener("pagehide", pageHidden);
    window.addEventListener("pageshow", visibilityChanged);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
      document.removeEventListener("pointerdown", markActivity);
      document.removeEventListener("keydown", markActivity);
      document.removeEventListener("wheel", markActivity);
      window.removeEventListener("pagehide", pageHidden);
      window.removeEventListener("pageshow", visibilityChanged);
    };
  }, [suspendPlayback]);
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
            updateRuntime({ type: "PAUSE" });
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
          updateRuntime({
            type: "INTERVENE",
            reason: "practice",
            anchorMs: positionMs,
          });
        }
      }
    },
    [media, narrator, setPracticeActivityRef, setSupportMode, updateRuntime],
  );

  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    revisionRef.current = null;
    lastQueued.current = "";
    saveFailureRef.current = "";
    pendingAttemptRef.current = null;
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
            updateRuntime({ type: "RESTORE", state: restored });
            if (restored.phase === "completed") setCompletionSaved(true);
          } else {
            updateRuntime({ type: "RESTORE", state: initialRuntime(definition) });
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
  }, [authUserId, courseId, contentVersion, definition, updateRuntime]);

  const persist = useCallback(
    (snapshot: LessonRuntimeState, force = false) => {
      if (!readyRef.current || snapshot.phase === "idle" || saveFailureRef.current ||
        ((submittingRef.current || teachingPending.current) && !force)) return;
      const serialized = JSON.stringify(snapshot);
      if (!force && serialized === lastQueued.current) return;
      lastQueued.current = serialized;
      saveQueue.current = saveQueue.current.then(async () => {
        if (saveFailureRef.current || runtimeIdentityRef.current !== runtimeIdentity) return;
        const current = stateRef.current;
        const response = await fetch("/api/interactive-lessons/session", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, contentVersion, lessonId: definition.lessonId,
            revision: revisionRef.current, runtime: current }), keepalive: true,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(lessonUiError(body.error ?? "Não foi possível salvar a aula."));
        if (runtimeIdentityRef.current !== runtimeIdentity) return;
        revisionRef.current = body.revision;
        if (!stateRef.current.evidenceScope) {
          const scoped = { ...stateRef.current, evidenceScope: body.runtime.evidenceScope };
          stateRef.current = scoped;
          updateRuntime({ type: "RESTORE", state: scoped });
        }
        if (current.phase === "completed") setCompletionSaved(true);
      }).catch((error) => {
        if (runtimeIdentityRef.current !== runtimeIdentity) return;
        lastQueued.current = "";
        saveFailureRef.current = error instanceof Error ? error.message : "Falha ao salvar a aula.";
        setSaveError(saveFailureRef.current);
      });
    }, [courseId, contentVersion, definition.lessonId, runtimeIdentity, updateRuntime, setCompletionSaved, setSaveError],
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
        updateRuntime({ type: "RESTORE", state: result.runtime });
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
    const onPageHide = () => persist(stateRef.current);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [loading, persist]);

  useEffect(() => {
    engine.current.load(segment.cues);
    engine.current.seek(stateRef.current.positionMs);
  }, [segment.id, segment.cues]);
  useEffect(() => {
    const element = mediaRef.current;
    const player = element ? new HtmlMediaPresentationController(element) : null;
    player?.setPlaybackRate(speed);
    if (!readyRef.current || state.phase !== "presenting" || mediaStopped) { player?.pause(); return; }
    if (!activityClock.current.isActive(performance.now())) {
      player?.pause();
      return;
    }
    const owner = claimAudioPlayback(() => {
      player?.pause();
      const current = stateRef.current;
      if (runtimeIdentityRef.current === runtimeIdentity &&
        definition.segments[current.segmentIndex]?.id === segment.id &&
        current.phase === "presenting" && !automaticAudioStop.current) {
        autoAdvanceArmed.current = false;
        updateRuntime({ type: "PAUSE" });
        const positionMs = element && Number.isFinite(element.currentTime)
          ? Math.max(0, Math.min(Math.round(element.currentTime * 1000), segment.presentation?.durationMs ?? 0))
          : current.positionMs;
        updateRuntime({ type: "SEEK", positionMs, board: engine.current.seek(positionMs) });
      }
    });
    playbackRef.current = owner;
    player?.seek(stateRef.current.positionMs);
    if (player) void player.play().catch(() => {
      if (owner.isCurrent()) { owner.cancel(); updateRuntime({ type: "PAUSE" }); }
    });
    return () => { owner.release(); player?.pause(); };
  }, [state.phase, state.segmentIndex, speed, currentMedia?.src, mediaStopped, activitySuspended, updateRuntime, runtimeIdentity, definition, segment.id, segment.presentation?.durationMs]);
  useEffect(() => {
    if (
      state.phase !== "presenting" ||
      !segment.presentation ||
      (segment.presentation.mode !== "slides" && !mediaError)
    )
      return;
    activityClock.current.resetTick(performance.now());
    const timer = window.setInterval(() => {
      if (stateRef.current.phase !== "presenting") return;
      const now = performance.now();
      const elapsed = activityClock.current.takeElapsedMs(now, 500);
      if (!elapsed) return;
      const next = Math.min(
        segment.presentation!.durationMs,
        stateRef.current.positionMs + Math.round(elapsed * speed),
      );
      const result = engine.current.tick(next);
      updateRuntime({ type: "TICK", positionMs: next, board: result.board });
      handleTransient(result.effects, next);
      if (next >= segment.presentation!.durationMs) {
        autoAdvanceArmed.current = false;
        updateRuntime({ type: "PAUSE" });
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [state.phase, segment, speed, handleTransient, mediaError, updateRuntime]);

  function seek(positionMs: number) {
    if (teachingPending.current || stateRef.current.phase === "intervening") return;
    cancelPlayback();
    const exact = Math.max(0, Math.min(positionMs, segment.presentation?.durationMs ?? 0));
    const board = engine.current.seek(exact);
    if (mediaRef.current) new HtmlMediaPresentationController(mediaRef.current).seek(exact);
    updateRuntime({ type: "SEEK", positionMs: exact, board });
  }
  function next() {
    if (teachingPending.current || submittingRef.current || saveFailureRef.current) return;
    cancelPlayback();
    invalidateTeaching();
    const upcoming = definition.segments[stateRef.current.segmentIndex + 1];
    const nextEngine = new TimelineEngine();
    nextEngine.load(upcoming?.cues ?? []);
    setTeaching(null);
    setTeachingError("");
    setMediaError(false);
    setLastAssessment(null);
    setPracticeActivityRef(null);
    updateRuntime({ type: "NEXT", nextBoard: nextEngine.getStateAt(0) });
    if ((definition as InteractiveLessonDefinition & { autoAdvancePresentations?: boolean }).autoAdvancePresentations &&
      upcoming?.presentation && !["activity", "checkpoint", "speaking"].includes(upcoming.type)) {
      autoAdvanceArmed.current = true;
      updateRuntime({ type: "PLAY" });
    }
  }
  function canInterrupt() {
    const current = stateRef.current;
    const currentSegment = definition.segments[current.segmentIndex];
    return readyRef.current && !saveFailureRef.current && !submittingRef.current &&
      Boolean(currentSegment.presentation && currentSegment.allowInterruption) &&
      !["activity", "checkpoint", "speaking"].includes(currentSegment.type) &&
      ["presenting", "paused", "intervening"].includes(current.phase);
  }
  function openIntervention(mode: typeof supportMode) {
    if (!canInterrupt()) return false;
    cancelPlayback();
    setSupportMode(mode);
    setPracticeActivityRef(nextActivity ?? null);
    setTeaching(null);
    setTeachingError("");
    const current = stateRef.current;
    if (current.phase !== "intervening") updateRuntime({
      type: "INTERVENE", reason: mode, anchorMs: current.positionMs,
    });
    return stateRef.current.phase === "intervening";
  }
  function intervene(mode: typeof supportMode) {
    if (questionComposing || teachingPending.current) return;
    if (featureFlags.AI_TUTOR && mode !== "practice") {
      void askTeacher(mode === "example"
        ? "Pode mostrar outro exemplo do que está sendo explicado neste momento?"
        : "Não entendi esta parte. Pode explicar de um jeito mais simples?", mode);
      return;
    }
    if (!openIntervention(mode)) return;
    if (mode !== "practice") setTeaching({
      unannotatedMessage: true,
      message: segment.explanation ?? "Observe o exemplo no quadro e sua tradução.",
      example: alternative?.text ?? "", translation: alternative?.translation ?? "", followUp: "", actions: [],
    });
  }
  function resume() {
    const point = stateRef.current.resumePoint;
    if (!point || teachingPending.current || saveFailureRef.current) return;
    cancelPlayback();
    invalidateTeaching();
    const board = engine.current.seek(point.anchorMs);
    if (mediaRef.current) new HtmlMediaPresentationController(mediaRef.current).seek(point.anchorMs);
    updateRuntime({ type: "RESUME", board });
    setTeaching(null);
    setTeachingError("");
    setAutomaticallyStoppedMedia(null);
    autoAdvanceArmed.current = true;
    updateRuntime({ type: "PLAY" });
  }
  function toggleSpeed() {
    if (speed === 1) updateRuntime({ type: "SLOWER_REQUESTED" });
    setSpeed((current) => (current === 1 ? 0.75 : 1));
  }
  function onMediaPosition(ms: number, ended = false) {
    if (!readyRef.current || stateRef.current.phase !== "presenting" || !playbackRef.current?.isCurrent() ||
      !activityClock.current.isActive(performance.now())) return;
    const duration = segment.presentation?.durationMs ?? 0;
    const positionMs = Math.min(ms, duration);
    const result = engine.current.tick(positionMs);
    updateRuntime({ type: "TICK", positionMs, board: result.board });
    handleTransient(result.effects, positionMs);
    if (positionMs < duration || !ended) return;
    // Only a genuine end of canonical media may advance the presentation sequence.
    const automatic = ended && autoAdvanceArmed.current && !mediaError &&
      (definition as InteractiveLessonDefinition & { autoAdvancePresentations?: boolean }).autoAdvancePresentations &&
      !["activity", "checkpoint", "speaking"].includes(segment.type) &&
      stateRef.current.phase === "presenting" && !teachingPending.current && !saveFailureRef.current;
    updateRuntime({ type: "PAUSE" });
    if (!automatic) return;
    const upcoming = definition.segments[stateRef.current.segmentIndex + 1];
    if (!upcoming) return;
    const nextEngine = new TimelineEngine();
    nextEngine.load(upcoming.cues);
    updateRuntime({ type: "NEXT", nextBoard: nextEngine.getStateAt(0) });
    setMediaError(false);
    setLastAssessment(null);
    setPracticeActivityRef(null);
    // Enter activities through NEXT, preserving the reducer's evidence gates.
    // Only another explanation starts playback; a checkpoint waits for the learner.
    if (upcoming.presentation && !["activity", "checkpoint", "speaking"].includes(upcoming.type))
      updateRuntime({ type: "PLAY" });
    else autoAdvanceArmed.current = false;
  }
  async function askTeacher(value: string, mode: typeof supportMode = "ask") {
    if (!featureFlags.AI_TUTOR || questionComposing || teachingPending.current || !canInterrupt()) return;
    const trimmed = value.trim();
    if (trimmed.length < 3 || trimmed.length > 400) return;
    const previousReply = teaching ? { message: teaching.message, example: teaching.example,
      translation: teaching.translation, followUp: teaching.followUp } : undefined;
    if (!openIntervention(mode)) return;
    // Pause/INTERVENE precedes request ownership; cancellation cannot invalidate its own request.
    const ownRequest = ++requestId.current;
    const identity = requestIdentityRef.current;
    const abort = new AbortController();
    teachingAbort.current = abort;
    teachingPending.current = true;
    const timeout = window.setTimeout(() => abort.abort(), 35000);
    setTeachingBusy(true);
    let owner: ReturnType<typeof captureInteractiveLessonOwner> | null = null;
    const isCurrent = () => {
      if (abort.signal.aborted || ownRequest !== requestId.current || identity !== requestIdentityRef.current) return false;
      try {
        const active = captureInteractiveLessonOwner();
        return Boolean(owner && active.generation === owner.generation && active.userId === owner.userId);
      } catch { return false; }
    };
    try {
      owner = captureInteractiveLessonOwner();
      persist(stateRef.current, true);
      await saveQueue.current;
      if (!isCurrent()) {
        if (ownRequest === requestId.current && identity === requestIdentityRef.current)
          setTeachingError(abort.signal.aborted
            ? "A resposta demorou mais que o esperado. Sua aula continua pausada. Você pode tentar de novo."
            : "Sua sessão foi atualizada. Retome a aula ou envie a pergunta novamente.");
        return;
      }
      if (saveFailureRef.current) throw new Error("Sua pausa não foi salva. Recarregue a aula antes de perguntar novamente.");
      const snapshot = stateRef.current;
      const scope = snapshot.evidenceScope;
      if (!scope || revisionRef.current === null || scope.userId !== owner.userId ||
        scope.courseId !== courseId || scope.lessonId !== definition.lessonId || scope.contentVersion !== contentVersion)
        throw new Error("Não foi possível confirmar a sessão. Recarregue a aula antes de perguntar novamente.");
      const context = {
        courseId, lessonId: definition.lessonId, segmentId: segment.id,
        positionMs: snapshot.positionMs, contentVersion, sessionId: scope.sessionId,
        revision: revisionRef.current, definitionHash: scope.definitionHash, requestId: crypto.randomUUID(),
      };
      const response = await fetch("/api/ai/interactive-lesson", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
        body: JSON.stringify({ ...context, question: trimmed, ...(previousReply ? { previousReply } : {}) }),
      });
      const body = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) throw new Error(response.status === 429
        ? "O limite de perguntas foi atingido. Sua aula continua pausada; você pode retomá-la."
        : "O professor não conseguiu responder agora. Você pode tentar de novo ou retomar a aula.");
      if (!body.context || Object.entries(context).some(([key, item]) => body.context[key] !== item) ||
        ["message", "example", "translation", "followUp"].some((key) => typeof body[key] !== "string") ||
        body.message.trim().length < 10 || body.message.trim().length > 650 ||
        !Array.isArray(body.actions)) throw new Error("A resposta não corresponde a esta pausa. Faça a pergunta novamente.");
      let messageParts: TeachingReply["messageParts"];
      if (body.messageParts !== undefined) {
        const parts: unknown = body.messageParts;
        if (!Array.isArray(parts) || parts.length < 1 || parts.length > 12 || parts.some((part) =>
          !part || typeof part !== "object" || Array.isArray(part) || typeof part.text !== "string" ||
          part.text.length < 1 || part.text.length > 650 ||
          !Object.keys(part).every((key) => key === "text" || key === "role") ||
          !["source", "target", "unknown"].includes(part.role)) ||
          parts.reduce((length, part) => length + part.text.length, 0) > 650 ||
          parts.map((part) => part.text).join("") !== body.message)
          throw new Error("Não foi possível exibir os idiomas da resposta. Faça a pergunta novamente.");
        messageParts = parts.map((part) => ({ text: part.text, role: part.role }));
      }
      const actions: LessonAction[] = [];
      for (const action of body.actions) {
        const parsed = lessonActionSchema.safeParse(action);
        if (!parsed.success || !["board.show", "board.clear"].includes(parsed.data.type))
          throw new Error("Não foi possível exibir a resposta. Faça a pergunta novamente.");
        actions.push(parsed.data);
      }
      const reply: TeachingReply = {
        message: body.message, example: body.example, translation: body.translation,
        followUp: body.followUp, actions, ...(messageParts ? { messageParts } : {}),
        ...(body.followUpSpeech && ["source", "target"].includes(body.followUpSpeech.role) &&
          typeof body.followUpSpeech.language === "string" ? { followUpSpeech: body.followUpSpeech } : {}),
      };
      setTeaching(reply);
      setQuestion("");
      // Each field uses its declared language; an unavailable voice leaves the answer readable.
      startNarration(teachingNarration(reply, narrationContext).filter((line) => line.role !== null));
      window.requestAnimationFrame(() => {
        if (!isCurrent()) return;
        const active = document.activeElement;
        // Reveal the answer after its DOM update; preserve a deliberate focus move elsewhere.
        if (active && active !== document.body && !questionToolsRef.current?.contains(active)) return;
        answerRef.current?.focus({ preventScroll: true });
        answerRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      });
    } catch (error) {
      if (ownRequest === requestId.current && identity === requestIdentityRef.current)
        setTeachingError(abort.signal.aborted ? "A resposta demorou mais que o esperado. Sua aula continua pausada. Você pode tentar de novo."
          : error instanceof Error ? error.message : "Não foi possível responder. Sua aula continua pausada.");
    } finally {
      window.clearTimeout(timeout);
      if (ownRequest === requestId.current) {
        teachingPending.current = false;
        teachingAbort.current = null;
        setTeachingBusy(false);
      }
    }
  }

  const previewBoard = useMemo(() => {
    const preview = new TimelineEngine();
    preview.load(segment.cues);
    // getStateAt renders stateful cues without consuming effects or advancing the runtime.
    return preview.getStateAt(0);
  }, [segment.cues]);
  const supportBoard = useMemo(
    () => state.phase === "intervening" ? teaching?.actions.reduce((board, action) => applyBoardAction(board, action), state.board) : undefined,
    [teaching, state.board, state.phase],
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
        <span className="eyebrow">ROTEIRO CONCLUÍDO</span>
        <h1>Você concluiu este roteiro de prática.</h1>
        <p>
          Você percorreu as etapas da aula. A participação e as entregas não comprovam domínio do conteúdo.{" "}
          {completionSaved ? "Sua conclusão foi salva." : "Salvando sua conclusão…"}
        </p>
        {saveError && <p role="alert">{saveError} Recarregue para verificar o estado da aula.</p>}
        <div className="live-complete-actions">
          {completionSaved ? (
            <Link className="primary-button" href={unitHref ?? `/course/${course.slug}`}>
              {returnLabel} <ArrowRight size={17} />
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
              updateRuntime({ type: "RESTORE", state: { ...initialRuntime(definition, state.evidenceScope),
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
  const phaseAllowsInterruption = Boolean(!saveError && !segmentBusy && segment.presentation &&
    segment.allowInterruption && !["activity", "checkpoint", "speaking"].includes(segment.type) &&
    ["presenting", "paused", "intervening"].includes(state.phase));
  const interruptionAllowed = phaseAllowsInterruption && !teachingBusy && !questionComposing;
  const isPresenting =
    state.phase === "presenting" || state.phase === "paused" || state.phase === "intervening";
  const displayedBoard = state.phase === "idle" ? previewBoard
    : state.phase === "intervening" ? (supportBoard ?? state.board) : state.board;
  if (course.availability?.unavailableInteractiveLessonIds?.includes(definition.id))
    return (
      <div className="live-empty panel" role="status">
        <h1>Aula temporariamente indisponível</h1>
        <p>
          Este dispositivo não oferece uma capacidade necessária à aula. A indisponibilidade não
          representa erro ou conclusão.
        </p>
        <Link className="secondary-button" href={unitHref ?? `/course/${course.slug}`}>
          {returnLabel}
        </Link>
      </div>
    );
  return (
    <SpeechPlaybackScope.Provider value={(owner) => { playbackRef.current = owner; }}>
    <div className="live-page lesson-experience" onPlayCapture={(event) => {
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
          <Link className="live-back" href={unitHref ?? `/course/${course.slug}`}>
            <ArrowLeft size={15} /> {returnLabel}
          </Link>
          <span className="eyebrow">
            <Sparkles size={13} /> {featureFlags.AI_TUTOR ? "AULA PARTICULAR" : "AULA GUIADA"} · {language.identity.nativeName.toUpperCase()}
          </span>
          <h1>{definition.title}</h1>
          <p>{lesson?.description}</p>
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
          <section className="live-stage" aria-label="Sua sala de aula">
            <div className="live-teacher-visual">
              {currentMedia && (segment.presentation?.mode === "video" || segment.presentation?.mode === "audio") && !mediaError && (
                segment.presentation.mode === "video" ? (
                  <video key={segment.id} ref={(node) => { mediaRef.current = node; }}
                    src={currentMedia.src} playsInline preload="metadata"
                    onPlay={(event) => { if (!playbackRef.current?.isCurrent() || stateRef.current.phase !== "presenting") event.currentTarget.pause(); }}
                    onError={() => { pausePlayback(); setMediaError(true); }}
                    onEnded={() => onMediaPosition(segment.presentation!.durationMs, true)}
                    onTimeUpdate={(event) => onMediaPosition(Math.round(event.currentTarget.currentTime * 1000))} />
                ) : (
                  <audio key={segment.id} ref={(node) => { mediaRef.current = node; }}
                    src={currentMedia.src} preload="metadata"
                    onPlay={(event) => { if (!playbackRef.current?.isCurrent() || stateRef.current.phase !== "presenting") event.currentTarget.pause(); }}
                    onError={() => { pausePlayback(); setMediaError(true); }}
                    onEnded={() => onMediaPosition(segment.presentation!.durationMs, true)}
                    onTimeUpdate={(event) => onMediaPosition(Math.round(event.currentTarget.currentTime * 1000))} />
                )
              )}
              <div className="live-profile">
                <span className="live-guide-icon">{featureFlags.AI_TUTOR ? <Sparkles size={21} aria-hidden="true" /> : <BookOpen size={21} aria-hidden="true" />}</span>
                <div><strong>{featureFlags.AI_TUTOR ? "Professor com IA" : "Sua aula guiada"}</strong>
                  <span className="live-teacher-status" role="status">
                    <i aria-hidden="true" className={state.phase === "presenting" && !mediaStopped ? "speaking" : ""} />
                    {teachingBusy ? "Preparando sua resposta" : narration.status === "speaking" ? "Lendo com você"
                      : state.phase === "presenting" && !mediaStopped ? "Explicando no quadro"
                        : state.phase === "intervening" ? "Aula pausada para sua dúvida" : canStart ? "Pronto para começar" : "Aula pausada"}
                  </span>
                </div>
              </div>
              <div className="live-teacher-meta">
                {currentMedia?.synthetic === true && segment.presentation?.mode === "audio" && <span className="live-voice-origin"><Volume2 size={12} aria-hidden="true" /> Voz gerada por IA</span>}
                <span className="live-segment-count">Parte {state.segmentIndex + 1} de {definition.segments.length}</span>
              </div>
            </div>
            <div ref={answerRef} tabIndex={-1} role="region" className="live-board"
              aria-label={state.phase === "intervening" ? (featureFlags.AI_TUTOR ? "Quadro com a resposta do professor" : "Quadro com apoio preparado") : "Quadro da aula"}
              aria-busy={state.phase === "intervening" && teachingBusy}>
              <div className="live-board-top">
                <div><span>NO QUADRO</span><h2>{segment.title}</h2></div>
                <button type="button" aria-pressed={showTranslation} onClick={() => setShowTranslation((value) => !value)}>
                  {showTranslation ? "Ocultar tradução" : "Ver tradução"}
                </button>
              </div>
              {canStart && <div className="live-start">
                <p>Ouça a explicação e acompanhe os exemplos. Pause ou pergunte quando precisar.</p>
                <button type="button" className="primary-button" onClick={() => {
                  autoAdvanceArmed.current = true;
                  updateRuntime({ type: "START" });
                }}><Play size={18} aria-hidden="true" /> Iniciar aula</button>
              </div>}
              <LearningBoard board={displayedBoard} showTranslation={showTranslation} narrationContext={narrationContext}
                activeNarrationText={narration.status === "speaking" ? narration.line?.text : undefined}
                onNarrate={(element) => {
                  if (element.kind === "comparison") {
                    startNarration([
                      narrationLine(`board:${element.id}:left`, element.left, element.leftPresentation?.language, narrationContext),
                      narrationLine(`board:${element.id}:right`, element.right, element.rightPresentation?.language, narrationContext),
                    ]);
                    return;
                  }
                  const runs = (element as typeof element & { runs?: BoardTextRun[] }).runs;
                  if (runs) {
                    startNarration(runs.map((run, index) => narrationLine(
                      `board:${element.id}:${index}`, run.text, run.language, narrationContext,
                    )).filter((line) => line.role !== null));
                    return;
                  }
                  startNarration([narrationLine(`board:${element.id}`, element.text, element.textPresentation?.language, narrationContext)]);
                }} />
              {state.phase === "intervening" && (
                <section className="live-answer" aria-label={featureFlags.AI_TUTOR ? "Resposta do professor" : "Apoio preparado"} aria-busy={teachingBusy}>
                  <span className="eyebrow"><Sparkles size={14} aria-hidden="true" />
                    {supportMode === "practice" ? "PREPARE SUA RESPOSTA" : featureFlags.AI_TUTOR ? "SUA DÚVIDA, NO QUADRO" : "APOIO PREPARADO"}
                  </span>
                  {teachingBusy && <p className="live-answer-loading" role="status"><span aria-hidden="true" /> O professor está preparando uma resposta para esta parte da aula…</p>}
                  {teachingError && <div className="live-answer-error" role="alert"><strong>A resposta não chegou.</strong><p>{teachingError}</p><small>A explicação permanece pausada em {seconds(state.positionMs)}.</small></div>}
                  {teaching && (<>
                    {(["message", "example", "translation", "followUp"] as const).map((field) => {
                      const text = teaching[field];
                      if (!text || displayedBoard.elements.some((element) => element.kind === "comparison"
                        ? element.left === text || element.right === text
                        : element.text === text || ((showTranslation || displayedBoard.translationVisible) && element.translation === text))) return null;
                      const lines = teachingNarration(teaching, narrationContext).filter((item) =>
                        item.id === field || (field === "message" && item.id.startsWith("message:")));
                      const line = lines[0];
                      const reading = narration.status === "speaking" && lines.some((item) => item.id === narration.line?.id);
                      return <div key={field} className={`live-answer-line live-answer-${field} ${reading ? "is-speaking" : ""}`}>
                        {field === "message" && teaching.messageParts ? <p><LearningRuns context={narrationContext}
                          runs={teaching.messageParts.map((part) => ({ text: part.text,
                            ...(part.role === "source" ? { language: narrationContext.sourceLanguage }
                              : part.role === "target" ? { language: narrationContext.targetLanguage } : {}),
                          }))} /></p> : <LearningText as="p" textRole={field === "example" || line?.role === "target" ? "target" : "source"}
                          presentation={line?.language ? { content: { language: line.language } } : undefined} text={text} />}
                        {lines.some((item) => item.role !== null) && <button type="button" className="speak-button" onClick={() => startNarration(lines.filter((item) => item.role !== null))}
                          aria-label={`Ouvir ${{ message: "explicação", example: "exemplo", translation: "tradução", followUp: "pergunta" }[field]}`}><Volume2 size={17} aria-hidden="true" /></button>}
                      </div>;
                    })}
                    <div className="live-answer-audio">
                      <button type="button" className="secondary-button" onClick={() => {
                        if (narration.status === "speaking") narrator.pause();
                        else startNarration(teachingNarration(teaching, narrationContext).filter((line) => line.role !== null));
                      }}>{narration.status === "speaking" ? <Pause size={17} /> : <Volume2 size={17} />}
                        {narration.status === "speaking" ? "Pausar resposta" : teaching.unannotatedMessage ? "Ouvir exemplo e tradução" : "Ouvir resposta"}</button>
                      {narration.status === "text" && <small role="status">Esta parte está disponível em texto. A voz compatível não está disponível agora.</small>}
                    </div>
                  </>)}
                  {supportMode === "practice" && supportActivity && <div className="live-practice">
                    <ActivityRenderer key={`practice:${supportActivity.id}`} activity={supportActivity}
                      onAssessed={(answer, result) => submitAttempt(supportActivity, answer, result)} />
                  </div>}
                  <div className="live-answer-resume"><small>Vamos voltar a {seconds(state.resumePoint?.anchorMs ?? state.positionMs)}, onde você parou.</small>
                    <button type="button" className="primary-button" disabled={teachingBusy || Boolean(saveError)} onClick={resume}>
                      <Play size={17} aria-hidden="true" /> Retomar explicação</button>
                  </div>
                </section>
              )}
              {activeCaption && state.phase !== "intervening" && <div className="live-caption" aria-label="Legenda atual">
                <LearningText as="p" presentation={{ content: captionLine?.textPresentation }} text={activeCaption} />
              </div>}
              {!activeCaption && !displayedBoard.elements.length && state.phase !== "intervening" && !canStart && segment.explanation &&
                <div className="live-caption"><LearningText as="p" textRole="source" text={segment.explanation} /></div>}
              {mediaError && <p className="live-media-notice" role="status">O áudio da aula não está disponível agora. Você pode acompanhar o quadro e abrir o texto abaixo.</p>}
              {isPresenting && <div className="live-player" aria-label="Controles da aula">
                <button type="button" className="live-play" disabled={state.phase === "intervening"}
                  aria-label={state.phase === "presenting" && !mediaStopped ? "Pausar aula" : "Reproduzir aula"}
                  onClick={() => {
                    if (stateRef.current.phase === "presenting" && !mediaStopped) { cancelPlayback(); return; }
                    cancelPlayback();
                    setAutomaticallyStoppedMedia(null);
                    autoAdvanceArmed.current = true;
                    updateRuntime({ type: "PLAY" });
                  }}>{state.phase === "presenting" && !mediaStopped ? <Pause size={19} /> : <Play size={19} />}</button>
                <button type="button" className="live-rewind" disabled={state.phase === "intervening"}
                  onClick={() => seek(Math.max(0, stateRef.current.positionMs - 10000))} aria-label="Voltar dez segundos">
                  <RotateCcw size={17} aria-hidden="true" /><span>10s</span></button>
                <div className="live-player-position"><input aria-label="Posição da apresentação" type="range" min={0}
                  max={segment.presentation?.durationMs ?? 1} value={state.positionMs}
                  disabled={state.phase === "intervening" || !segment.presentation} onChange={(event) => seek(Number(event.target.value))} />
                  <span>{seconds(state.positionMs)} <span aria-hidden="true">/</span> {seconds(segment.presentation?.durationMs ?? 0)}</span>
                </div>
                <button type="button" className="live-speed" aria-label={`Velocidade ${speed} vezes. Alterar velocidade`}
                  disabled={state.phase === "intervening"} onClick={toggleSpeed}>{speed}×</button>
              </div>}
              <div ref={questionToolsRef} className="live-board-tools">
                <div className="live-quick">
                  <button type="button" disabled={!interruptionAllowed} onClick={() => intervene("explain")}><CircleHelp size={17} /> Não entendi</button>
                  <button type="button" disabled={!interruptionAllowed} onClick={() => intervene("example")}><Lightbulb size={17} /> Outro exemplo</button>
                  <button type="button" disabled={!interruptionAllowed} onClick={() => intervene("practice")}><Mic2 size={17} /> Praticar</button>
                </div>
                {featureFlags.AI_TUTOR ? <form className="live-ask" onSubmit={(event) => {
                  event.preventDefault();
                  void askTeacher(question);
                }}>
                  <label htmlFor="live-question"><MessageCircle size={16} aria-hidden="true" /> Sua pergunta sobre esta explicação</label>
                  <div className="live-question-row"><LearningTextarea textRole="source" onCompositionChange={setQuestionComposing}
                    id="live-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} maxLength={400}
                    disabled={!phaseAllowsInterruption || teachingBusy} placeholder="O que você quer entender melhor?" />
                    <button type="submit" disabled={question.trim().length < 3 || !interruptionAllowed}>
                      <Send size={17} aria-hidden="true" /> Perguntar</button></div>
                </form> : <p className="live-prepared-notice">Apoio preparado: as explicações e os exemplos já fazem parte desta aula.</p>}
              </div>
            </div>
          </section>
          {state.phase !== "idle" && transcriptLines.length > 0 && <section className="live-transcript panel">
            <button type="button" className="live-transcript-toggle" aria-expanded={transcriptOpen} aria-controls="live-transcript-text"
              onClick={() => setOpenTranscriptFor((owner) => owner === requestIdentity ? null : requestIdentity)}><BookOpen size={18} aria-hidden="true" />
              <span>Texto da explicação<small>Leia no seu ritmo ou ouça uma frase</small></span><span>{transcriptOpen ? "Fechar" : "Abrir"}</span></button>
            {transcriptOpen && <div id="live-transcript-text" className="live-transcript-lines">
              <div className="live-transcript-audio"><button type="button" className="secondary-button"
                onClick={() => startNarration(transcriptLines)}><Volume2 size={17} /> Ouvir texto</button>
                {narration.status === "speaking" && <button type="button" className="secondary-button" onClick={() => narrator.pause()}><Pause size={17} /> Pausar leitura</button>}
                {narration.status === "paused" && <button type="button" className="secondary-button" onClick={() => { pausePlayback(); narrator.resume(); }}><Play size={17} /> Retomar frase</button>}
              </div>
              {transcriptLines.map((line) => <div key={line.id} className={`live-transcript-line ${narration.status === "speaking" && narration.line?.id === line.id ? "is-speaking" : ""}`}>
                <LearningText as="p" presentation={line.language ? { content: { language: line.language } } : undefined} text={line.text} />
                <button type="button" className="speak-button" onClick={() => startNarration([line])} aria-label={`Ouvir frase em ${seconds(line.anchorMs)}`}><Volume2 size={18} /></button>
              </div>)}
              {narration.status === "text" && <p role="status">A leitura em voz alta não está disponível para esta frase. O texto está completo acima.</p>}
            </div>}
          </section>}

          <div className="live-independent-practice"><GuidedStudyActivity activity={activity || undefined} phase={state.phase} lesson={lesson} unavailableActivityIds={course.availability?.unavailableActivityIds} /></div>
          {(state.phase === "checkpoint" || state.phase === "speaking") && activity && (
            <div className="live-activity" id="live-activity">
              <div className="live-activity-intro">
                <span className="eyebrow">
                  {segment.type === "speaking" ? "SUA VEZ DE FALAR" : "CONFIRA O QUE APRENDEU"}
                </span>
                <p>
                  {segment.type === "speaking"
                    ? "Grave, ouça e salve sua tentativa. A entrega não recebe nota. A disponibilidade de avaliação aparece na própria atividade."
                    : "Responda antes de avançar. Se precisar, você pode tentar de novo."}
                </p>
              </div>
              <ActivityRenderer
                key={segment.id}
                activity={activity}
                suspended={activitySuspended}
                onSubmitAnswer={async (answer) => {
                  const result = await submitSegment(answer);
                  if (typeof result.grade?.correct !== "boolean") throw new Error("Correção inválida.");
                  return result.grade as GradeResult;
                }}
                onAssessed={(_answer, result) => setLastAssessment(result.correct ? "correct" : "incorrect")}
                onSubmitWriting={async (text) => { await submitSegment(text); }}
                onSubmitSpeaking={async (transcription, audio) => { await submitSegment(transcription, audio); }}
              />
              {lesson && <LessonSupport lesson={lesson} activity={activity} unavailableActivityIds={course.availability?.unavailableActivityIds} />}
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
              <button className="secondary-button" onClick={() => updateRuntime({ type: "REINFORCE" })}>
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
                onClick={() => updateRuntime({ type: "REINFORCEMENT_DONE" })}
              >
                Voltar ao exercício <ArrowRight size={16} />
              </button>
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
