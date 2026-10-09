"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, Lightbulb, MessageCircle, Mic2, Pause, Play, RotateCcw, Send, Sparkles, Volume2 } from "lucide-react";
import type { InteractiveLessonDefinition, LessonAction } from "@/content/contracts";
import { lessonActionSchema } from "@/content/contracts";
import { ActivityRenderer } from "@/components/activities/activity-renderer";
import { SpeakButton } from "@/components/audio/speak-button";
import { useStudy } from "@/components/study-provider";
import { applyBoardAction, initialRuntime, reduceRuntime, resumeAnchor, TimelineEngine, type LessonRuntimeState } from "@/domain/interactive-lesson/runtime";
import { HtmlMediaPresentationController } from "@/domain/interactive-lesson/presentation-controller";
import type { CuratedExample } from "@/content/interactive-examples";

type Media = Record<string, { src: string; type: string }>;
type TeachingReply = { message: string; example: string; translation: string; followUp: string; actions: LessonAction[] };
const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function InteractiveClassroom({ definition, courseId, contentVersion, media, curatedExamples }: {
  definition: InteractiveLessonDefinition; courseId: string; contentVersion: string; media: Media;
  curatedExamples: CuratedExample[];
}) {
  const { course, language, submitAttempt } = useStudy();
  const lesson = course.units.flatMap((unit) => unit.lessons).find((item) => item.id === definition.lessonId);
  const [state, dispatch] = useReducer((current: LessonRuntimeState, event: Parameters<typeof reduceRuntime>[2]) =>
    reduceRuntime(definition, current, event), definition, initialRuntime);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [completionSaved, setCompletionSaved] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [question, setQuestion] = useState("");
  const [teaching, setTeaching] = useState<TeachingReply | null>(null);
  const [teachingBusy, setTeachingBusy] = useState(false);
  const [supportMode, setSupportMode] = useState<"explain" | "example" | "practice" | "ask">("explain");
  const [practiceActivityRef, setPracticeActivityRef] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [lastAssessment, setLastAssessment] = useState<"correct" | "incorrect" | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const engine = useRef(new TimelineEngine());
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const stateRef = useRef(state);
  const revisionRef = useRef<number | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const lastQueued = useRef("");
  const lastClock = useRef(0);
  const requestId = useRef(0);
  const readyRef = useRef(false);
  useEffect(() => { stateRef.current = state; }, [state]);
  const segment = definition.segments[state.segmentIndex];
  const currentMedia = segment.presentation?.mediaId ? media[segment.presentation.mediaId] : undefined;
  const activity = segment.activityRef && lesson?.activities.find((item) => item.id === segment.activityRef);
  const progress = Math.round((state.completedSegmentIds.length / definition.segments.length) * 100);
  const activeCaption = segment.presentation?.transcript.find((line) =>
    state.positionMs >= line.startMs && state.positionMs < line.endMs)?.text ?? "";
  const alternative = curatedExamples.find((item) => segment.concepts.includes(item.conceptId)) ?? curatedExamples[0];
  const nextActivity = definition.segments.slice(state.segmentIndex).find((item) => item.activityRef)?.activityRef;
  const upcomingActivity = lesson?.activities.find((item) => item.id === nextActivity);
  const supportActivity = lesson?.activities.find((item) => item.id === (practiceActivityRef ?? nextActivity));

  const handleTransient = useCallback((effects: LessonAction[], positionMs: number) => {
    for (const action of effects) {
      if (action.type === "audio.play") {
        const asset = media[action.mediaId];
        if (asset?.type === "audio") void new Audio(asset.src).play().catch(() => undefined);
      } else if (action.type === "activity.open" || action.type === "speech.request") {
        setPracticeActivityRef(action.activityRef);
        setSupportMode("practice");
        dispatch({ type: "INTERVENE", reason: "practice", anchorMs: resumeAnchor(segment.resumeAnchorsMs, positionMs) });
      }
    }
  }, [media, segment, setPracticeActivityRef, setSupportMode, dispatch]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/interactive-lessons/session?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(definition.lessonId)}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Não foi possível abrir a aula.");
        if (cancelled) return;
        if (body.session) {
          revisionRef.current = body.session.revision;
          const restored = body.session.runtime_state as LessonRuntimeState;
          if (body.session.content_version === contentVersion && restored &&
              Number.isInteger(restored.segmentIndex) && restored.segmentIndex >= 0 &&
              restored.segmentIndex < definition.segments.length &&
              Array.isArray(restored.completedSegmentIds) && restored.board) {
            dispatch({ type: "RESTORE", state: restored });
            if (restored.phase === "completed") setCompletionSaved(true);
          } else {
            dispatch({ type: "RESTORE", state: initialRuntime(definition) });
          }
        }
        readyRef.current = true;
        setLoading(false);
      } catch (error) {
        if (!cancelled) { setLoadError(error instanceof Error ? error.message : "Erro ao abrir a aula."); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [courseId, contentVersion, definition]);

  const persist = useCallback((snapshot: LessonRuntimeState) => {
    if (!readyRef.current || snapshot.phase === "idle" || saveError) return;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastQueued.current) return;
    lastQueued.current = serialized;
    saveQueue.current = saveQueue.current.then(async () => {
      const response = await fetch("/api/interactive-lessons/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId: definition.lessonId, revision: revisionRef.current, runtime: snapshot }),
        keepalive: true,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar a aula.");
      revisionRef.current = body.revision;
      if (snapshot.phase === "completed") setCompletionSaved(true);
    }).catch((error) => {
      lastQueued.current = "";
      setSaveError(error instanceof Error ? error.message : "Falha ao salvar a aula.");
    });
  }, [courseId, definition.lessonId, saveError, setSaveError, setCompletionSaved]);
  useEffect(() => () => { persist(stateRef.current); }, [persist]);

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
    const onHide = () => { if (document.visibilityState === "hidden") persist(stateRef.current); };
    document.addEventListener("visibilitychange", onHide);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onHide); };
  }, [loading, persist]);

  useEffect(() => {
    engine.current.load(segment.cues);
    engine.current.seek(stateRef.current.positionMs);
    requestId.current += 1;
  }, [segment.id, segment.cues]);
  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;
    const player = new HtmlMediaPresentationController(element);
    player.setPlaybackRate(speed);
    if (Math.abs(player.currentTimeMs - state.positionMs) > 1000) player.seek(state.positionMs);
    if (state.phase === "presenting") void player.play().catch(() => dispatch({ type: "PAUSE" }));
    else player.pause();
  }, [state.phase, state.segmentIndex, state.positionMs, speed, currentMedia?.src]);
  useEffect(() => {
    if (state.phase !== "presenting" || !segment.presentation ||
      (segment.presentation.mode !== "slides" && !mediaError)) return;
    lastClock.current = performance.now();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") { lastClock.current = performance.now(); return; }
      const now = performance.now();
      const elapsed = Math.min(500, now - lastClock.current);
      lastClock.current = now;
      const next = Math.min(segment.presentation!.durationMs, stateRef.current.positionMs + Math.round(elapsed * speed));
      const result = engine.current.tick(next);
      handleTransient(result.effects, next);
      dispatch({ type: "TICK", positionMs: next, board: result.board });
      if (next >= segment.presentation!.durationMs) dispatch({ type: "PAUSE" });
    }, 200);
    return () => window.clearInterval(timer);
  }, [state.phase, segment, speed, handleTransient, mediaError]);

  function seek(positionMs: number) {
    const board = engine.current.seek(positionMs);
    if (mediaRef.current) new HtmlMediaPresentationController(mediaRef.current).seek(positionMs);
    dispatch({ type: "SEEK", positionMs, board });
  }
  function next() {
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
    setSupportMode(mode);
    setPracticeActivityRef(nextActivity ?? null);
    setTeaching(null);
    dispatch({ type: "INTERVENE", reason: mode, anchorMs: resumeAnchor(segment.resumeAnchorsMs, state.positionMs) });
  }
  function resume() {
    if (!state.resumePoint) return;
    const board = engine.current.seek(state.resumePoint.anchorMs);
    if (mediaRef.current) new HtmlMediaPresentationController(mediaRef.current).seek(state.resumePoint.anchorMs);
    dispatch({ type: "RESUME", board });
    setTeaching(null);
  }
  function toggleSpeed() {
    if (speed === 1) dispatch({ type: "SLOWER_REQUESTED" });
    setSpeed((current) => current === 1 ? 0.75 : 1);
  }
  function onMediaPosition(ms: number) {
    const duration = segment.presentation?.durationMs ?? 0;
    const next = Math.min(ms, duration);
    const result = engine.current.tick(next);
    handleTransient(result.effects, next);
    dispatch({ type: "TICK", positionMs: next, board: result.board });
    if (next >= duration) dispatch({ type: "PAUSE" });
  }
  async function askTeacher(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 3 || teachingBusy) return;
    const ownRequest = ++requestId.current;
    if (["presenting", "paused"].includes(state.phase)) intervene("ask");
    setSupportMode("ask");
    setTeachingBusy(true);
    setQuestion("");
    try {
      const response = await fetch("/api/ai/interactive-lesson", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId: definition.lessonId, segmentId: segment.id,
          positionMs: state.positionMs, question: trimmed }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "A professora não conseguiu responder agora.");
      if (ownRequest !== requestId.current) return;
      setTeaching({ message: body.message, example: body.example, translation: body.translation,
        followUp: body.followUp, actions: (body.actions ?? []).flatMap((action: unknown) => {
          const parsed = lessonActionSchema.safeParse(action);
          return parsed.success && parsed.data.type === "board.show" ? [parsed.data] : [];
        }) });
    } catch (error) {
      if (ownRequest === requestId.current) setTeaching({
        message: `${segment.explanation ?? "Revise o exemplo no quadro e tente novamente."} ${error instanceof Error ? error.message : ""}`,
        example: alternative?.text ?? "", translation: alternative?.translation ?? "", followUp: "", actions: [],
      });
    } finally { if (ownRequest === requestId.current) setTeachingBusy(false); }
  }

  const supportBoard = useMemo(() => teaching?.actions.reduce((board, action) => applyBoardAction(board, action), state.board), [teaching, state.board]);
  if (loading) return <div className="page-loading">Preparando sua aula particular…</div>;
  if (loadError || !lesson) return <div className="live-empty panel" role="alert">
    <h1>Não foi possível abrir esta aula</h1><p>{loadError || "Lição não encontrada no curso ativo."}</p>
    <button className="primary-button" onClick={() => window.location.reload()}>Tentar novamente</button>
  </div>;
  if (state.phase === "completed") return <div className="live-complete panel">
    <span className="live-complete-icon"><Check size={30} /></span>
    <span className="eyebrow">AULA CONCLUÍDA</span>
    <h1>Você destravou mais uma estrutura.</h1>
    <p>Você acompanhou a explicação, respondeu ao exercício e praticou a fala. {completionSaved ? "Sua conclusão foi salva." : "Salvando sua conclusão…"}</p>
    {saveError && <p role="alert">{saveError} Recarregue para verificar o estado da aula.</p>}
    <div className="live-complete-actions">
      {completionSaved ? <Link className="primary-button" href={`/course/${course.slug}`}>Voltar ao curso <ArrowRight size={17} /></Link>
        : <button className="primary-button" disabled>Salvando aula…</button>}
      <button className="secondary-button" onClick={() => { setCompletionSaved(false); dispatch({ type: "RESTORE", state: initialRuntime(definition) }); }}><RotateCcw size={16} /> Refazer aula</button>
    </div>
  </div>;

  const canContinue = (segment.type !== "checkpoint" || !segment.required || state.checkpointPassed) &&
    (segment.type !== "speaking" || !segment.required || state.speakingSaved) &&
    (!segment.presentation || state.positionMs >= segment.presentation.durationMs);
  const canStart = state.phase === "idle";
  const isPresenting = state.phase === "presenting" || state.phase === "paused" || state.phase === "intervening";
  const displayedBoard = state.phase === "intervening" ? supportBoard ?? state.board : state.board;
  return <div className="live-page">
    <div className="live-heading">
      <div>
        <Link className="live-back" href={`/course/${course.slug}`}><ArrowLeft size={15} /> Voltar ao curso</Link>
        <span className="eyebrow"><Sparkles size={13} /> AULA PARTICULAR · {language.identity.nativeName.toUpperCase()}</span>
        <h1>{definition.title}</h1>
        <p>{definition.objectives[0]}</p>
      </div>
      <div className="live-time"><Clock3 size={15} /> {definition.estimatedMinutes} min <span>·</span> {progress}% concluído</div>
    </div>
    {saveError && <div className="live-alert" role="alert">{saveError} <button onClick={() => window.location.reload()}>Recarregar aula</button></div>}
    <div className="live-grid">
      <div className="live-primary">
        <div className="live-stage">
          <div className="live-teacher-visual">
            {currentMedia && (segment.presentation?.mode === "video" || segment.presentation?.mode === "audio") && !mediaError ? (
              segment.presentation.mode === "video" ? <video ref={(node) => { mediaRef.current = node; }} src={currentMedia.src}
                playsInline preload="metadata" onError={() => setMediaError(true)}
                onEnded={() => onMediaPosition(segment.presentation!.durationMs)}
                onTimeUpdate={(event) => onMediaPosition(Math.round(event.currentTarget.currentTime * 1000))} />
                : <audio ref={(node) => { mediaRef.current = node; }} src={currentMedia.src} preload="metadata"
                  onError={() => setMediaError(true)} onEnded={() => onMediaPosition(segment.presentation!.durationMs)}
                  onTimeUpdate={(event) => onMediaPosition(Math.round(event.currentTarget.currentTime * 1000))} />
            ) : null}
            <Image src="/images/professora-sofia.jpg" alt="Ilustração da professora da aula" width={1200} height={1200} priority />
            <div className="live-teacher-overlay">
              <span className="live-mode-badge">{segment.presentation?.mode === "slides" || mediaError ? "Apresentação em slides" : currentMedia ? "Aula com mídia" : "Aula guiada"}</span>
              <strong>Professora Sofia</strong>
              <p>{activeCaption || segment.explanation || "Vamos estudar juntos, um passo de cada vez."}</p>
              {activeCaption && <SpeakButton text={activeCaption} label="Ouvir esta fala" withLabel />}
            </div>
          </div>
          <div className="live-board">
            <div className="live-board-top"><span>QUADRO INTERATIVO</span><button type="button" onClick={() => setShowTranslation((value) => !value)}>{showTranslation ? "Ocultar tradução" : "Ver tradução"}</button></div>
            <div className="live-board-elements">
              {displayedBoard.elements.length ? displayedBoard.elements.map((element) => <div key={element.id}
                className={`live-board-element ${displayedBoard.highlightedIds.includes(element.id) ? "highlight" : ""}`}>
                {element.kind === "comparison" ? <><span>{element.left}</span><strong>{element.right}</strong></> :
                  <><div className="live-board-text" lang={course.languageCode}>{element.text}
                    <SpeakButton text={element.text} label={`Ouvir ${element.text}`} /></div>
                    {(showTranslation || displayedBoard.translationVisible) && element.translation && <small>{element.translation}</small>}</>}
              </div>) : <p className="live-board-placeholder">O quadro acompanha a explicação. Inicie a aula para ver os exemplos.</p>}
              {displayedBoard.caption && <p className="live-board-caption">{displayedBoard.caption}</p>}
            </div>
          </div>
        </div>

        {isPresenting && <div className="live-player panel">
          <button type="button" className="live-play" onClick={() => state.phase === "presenting" ? dispatch({ type: "PAUSE" }) : state.phase === "paused" ? dispatch({ type: "PLAY" }) : undefined}
            disabled={state.phase === "intervening"} aria-label={state.phase === "presenting" ? "Pausar aula" : "Reproduzir aula"}>
            {state.phase === "presenting" ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span>{seconds(state.positionMs)}</span>
          <input aria-label="Posição da apresentação" type="range" min={0} max={segment.presentation?.durationMs ?? 1}
            value={state.positionMs} disabled={state.phase === "intervening" || !segment.presentation}
            onChange={(event) => seek(Number(event.target.value))} />
          <span>{seconds(segment.presentation?.durationMs ?? 0)}</span>
          <button type="button" className="live-speed" aria-label="Velocidade" onClick={toggleSpeed}>{speed}×</button>
        </div>}

        {canStart && <div className="live-start panel">
          <span className="eyebrow">SEU PLANO DE AULA</span>
          <h2>Pronto para começar?</h2>
          <p>Você verá uma explicação com exemplos no quadro, responderá a um exercício e praticará a fala. Pode pausar e retomar depois.</p>
          <button type="button" className="primary-button" onClick={() => dispatch({ type: "START" })}><Play size={17} /> Iniciar aula</button>
        </div>}

        {(state.phase === "checkpoint" || state.phase === "speaking") && activity && <div className="live-activity" id="live-activity">
          <div className="live-activity-intro"><span className="eyebrow">{segment.type === "speaking" ? "SUA VEZ DE FALAR" : "CONFIRA O QUE APRENDEU"}</span>
            <p>{segment.type === "speaking" ? "Grave sua resposta. A correção usa a prática de fala do curso." : "Responda antes de avançar. Se precisar, você pode tentar de novo."}</p></div>
          <ActivityRenderer key={segment.id} activity={activity} onAssessed={(answer, result) => {
            submitAttempt(activity, answer, result);
            dispatch({ type: "CHECKPOINT_RESULT", correct: result.correct });
            setLastAssessment(result.correct ? "correct" : "incorrect");
          }} onSpeakingSaved={(result) => { if (result?.submissionId) dispatch({ type: "SPEAKING_SAVED" }); }} />
          {lastAssessment === "incorrect" && <p className="live-feedback">Ainda não. Veja a explicação e tente novamente.</p>}
          {lastAssessment === "correct" && <p className="live-feedback success"><Check size={16} /> Boa! Você pode continuar.</p>}
        </div>}
        {state.phase === "checkpoint" && !state.checkpointPassed && state.checkpointFailures >= 2 &&
          !state.runtimePath.some((node) => node.kind === "reinforcement") && <button className="secondary-button" onClick={() => dispatch({ type: "REINFORCE" })}>
            <Lightbulb size={16} /> Rever de outro jeito
          </button>}
        {state.phase === "reinforcement" && <div className="live-support panel">
          <span className="eyebrow">MAIS UMA EXPLICAÇÃO</span><h2>Vamos tentar por outro caminho.</h2>
          <p>{segment.explanation ?? "Leia o exemplo e tente responder novamente."}</p>
          {alternative && <div className="live-support-example" lang={course.languageCode}>{alternative.text}<SpeakButton text={alternative.text} label="Ouvir exemplo alternativo" />
            <small>{alternative.translation}</small></div>}
          <button className="primary-button" onClick={() => dispatch({ type: "REINFORCEMENT_DONE" })}>Voltar ao exercício <ArrowRight size={16} /></button>
        </div>}
        {state.phase === "intervening" && <div className="live-support panel">
          <span className="eyebrow"><Sparkles size={13} /> APOIO DA PROFESSORA</span>
          <h2>{supportMode === "example" ? "Outro exemplo" : supportMode === "practice" ? "Prepare sua resposta" : supportMode === "ask" ? "Sua dúvida" : "Vamos explicar de outro jeito"}</h2>
          {teachingBusy ? <p>Preparando uma resposta para você…</p> : <p>{teaching?.message ?? (supportMode === "practice" ? `Depois da explicação, você vai praticar: ${upcomingActivity?.title ?? "o conteúdo da aula"}.` : segment.explanation ?? "Observe o exemplo e veja como a estrutura funciona.")}</p>}
          {(teaching?.example || alternative?.text) && <div className="live-support-example"><span lang={course.languageCode}>{teaching?.example || alternative?.text}</span>
            <SpeakButton text={teaching?.example || alternative?.text || ""} label="Ouvir exemplo" /><small>{teaching?.translation || alternative?.translation}</small></div>}
          {supportMode === "practice" && supportActivity && <div className="live-practice">
            <ActivityRenderer key={`practice:${supportActivity.id}`} activity={supportActivity}
              onAssessed={(answer, result) => submitAttempt(supportActivity, answer, result)} />
          </div>}
          {teaching?.followUp && <p className="live-follow-up">{teaching.followUp}</p>}
          <button type="button" className="primary-button" disabled={teachingBusy} onClick={resume}>Retomar explicação <ArrowRight size={16} /></button>
          <small>A aula volta ao início da última parte da explicação.</small>
        </div>}
        {segment.type === "summary" && state.phase !== "idle" && <div className="live-support panel"><span className="eyebrow">RESUMO</span>
          <h2>O que você aprendeu</h2><p>{segment.explanation}</p></div>}
        {state.phase !== "idle" && state.phase !== "intervening" && state.phase !== "reinforcement" && <div className="live-next">
          <span>{segment.type === "checkpoint" && !state.checkpointPassed ? "Acerte o exercício para continuar." :
            segment.type === "speaking" && !state.speakingSaved ? "Salve uma tentativa de fala para continuar." :
            state.phase === "presenting" ? "A explicação está em andamento." : "Continue quando estiver pronto."}</span>
          <button type="button" className="primary-button" onClick={next} disabled={!canContinue || state.phase === "presenting"}>
            {state.segmentIndex === definition.segments.length - 1 ? "Concluir aula" : "Próxima etapa"} <ArrowRight size={17} />
          </button>
        </div>}
      </div>

      <aside className="live-side">
        <div className="live-teacher-card panel">
          <div className="live-profile"><Image src="/images/professora-sofia.jpg" alt="" width={48} height={48} /><div><span>SUA PROFESSORA</span><strong>Sofia</strong></div></div>
          <p>Interrompa quando precisar. Sua aula ficará pausada enquanto você esclarece a dúvida.</p>
          <div className="live-quick">
            <button disabled={!isPresenting || state.phase === "intervening"} onClick={() => intervene("explain")}><CircleHelp size={17} /> Não entendi</button>
            <button disabled={!isPresenting || state.phase === "intervening"} onClick={() => intervene("example")}><Lightbulb size={17} /> Outro exemplo</button>
            <button disabled={!isPresenting || state.phase === "intervening"} onClick={toggleSpeed}><Volume2 size={17} /> {speed === 1 ? "Mais devagar" : "Velocidade normal"}</button>
            <button disabled={!isPresenting || state.phase === "intervening"} onClick={() => intervene("practice")}><Mic2 size={17} /> Praticar</button>
          </div>
          <form className="live-ask" onSubmit={(event) => { event.preventDefault(); void askTeacher(question); }}>
            <label htmlFor="live-question"><MessageCircle size={16} /> Pergunte à professora</label>
            <textarea id="live-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={3}
              maxLength={400} placeholder="Qual é sua dúvida nesta etapa?" />
            <button type="submit" disabled={question.trim().length < 3 || teachingBusy}>Perguntar <Send size={15} /></button>
          </form>
          {teaching && state.phase !== "intervening" && <p className="live-side-answer" role="status">{teaching.message}</p>}
        </div>
        <div className="live-timeline panel">
          <span className="eyebrow">ROTEIRO DA AULA</span>
          <ol>{state.runtimePath.map((node) => {
            const item = definition.segments.find((candidate) => candidate.id === node.segmentId);
            if (!item) return null;
            const index = definition.segments.indexOf(item);
            const isReinforcement = node.kind === "reinforcement";
            const done = !isReinforcement && state.completedSegmentIds.includes(item.id);
            const active = isReinforcement ? state.phase === "reinforcement" :
              index === state.segmentIndex && state.phase !== "reinforcement";
            return <li key={node.id} className={active ? "active" : done ? "done" : ""}>
              <span className="live-step-dot">{done ? <Check size={12} /> : isReinforcement ? <Lightbulb size={12} /> : index + 1}</span>
              <div><strong>{isReinforcement ? "Reforço extra" : item.title}</strong>
                <small>{isReinforcement ? "Explicação adaptada" : item.type === "checkpoint" ? "Exercício" : item.type === "speaking" ? "Prática de fala" : item.presentation ? seconds(item.presentation.durationMs) : "Resumo"}</small></div>
            </li>;
          })}</ol>
        </div>
      </aside>
    </div>
  </div>;
}
