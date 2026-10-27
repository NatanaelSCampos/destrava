"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  History,
  MessageCircle,
  Mic,
  MicOff,
  Pause,
  Play,
  Send,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { LearningText } from "@/components/learning/text-presentation";
import { MessageIllustration } from "@/components/activities/lesson-illustrations";
import { readVoicePreference } from "@/lib/speech-voice-preference";
import {
  browserLiveEnvironment,
  initialLiveSnapshot,
  LiveConversationClient,
  liveErrorMessage,
  loadLiveHistory,
  loadLiveTopics,
  prepareLiveReport,
  type LiveCorrection,
  type LiveHistory,
  type LiveLevel,
  type LiveReport,
  type LiveSnapshot,
  type LiveTopic,
  type LiveTurn,
} from "@/domain/conversation/live-client";
import { LiveFreeSetup } from "./live-free-setup";
import { LiveTopicPicker } from "./live-topic-picker";
import "./live-conversation.css";

const levels: Array<{ id: LiveLevel; label: string; detail: string }> = [
  { id: "beginner", label: "Iniciante", detail: "Mais apoio e frases curtas" },
  { id: "intermediate", label: "Intermediário", detail: "Mais espaço para desenvolver" },
  { id: "advanced", label: "Avançado", detail: "Conversa mais espontânea" },
];

const phases = {
  idle: "Vamos conversar?",
  connecting: "Preparando o áudio",
  listening: "Pode falar",
  speaking: "Ouça a resposta",
  paused: "Conversa pausada",
  ending: "Preparando seu resumo",
  completed: "Conversa encerrada",
  error: "Vamos tentar de novo?",
};
const minutes = (seconds: number) =>
  Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
const dateLabel = (date: string) =>
  Number.isFinite(Date.parse(date))
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(date))
    : "Conversa anterior";

function Transcript({ turns }: { turns: LiveTurn[] }) {
  return (
    <details className="live-voice-transcript" data-report-private>
      <summary>
        <BookOpen size={17} aria-hidden="true" /> Ver conversa em texto <span>Opcional</span>
      </summary>
      <div className="live-voice-transcript-body">
        {turns.length ? (
          turns.map((turn) => (
            <div key={turn.id} className={"live-voice-turn " + turn.role}>
              <strong>{turn.role === "student" ? "Você" : "Parceiro de conversa"}</strong>
              <p>{turn.text}</p>
              {turn.interrupted && <small>Trecho interrompido</small>}
            </div>
          ))
        ) : (
          <p className="live-voice-muted">O texto aparece aqui conforme a conversa acontece.</p>
        )}
      </div>
    </details>
  );
}
function Report({ report }: { report: LiveReport }) {
  return (
    <div className="live-voice-report" data-report-private>
      <section className="live-voice-report-intro">
        <span className="live-voice-kicker">
          <Sparkles size={15} aria-hidden="true" /> SEU PRÓXIMO PASSO
        </span>
        <h2>O que você leva desta conversa</h2>
        <p>{report.summary}</p>
      </section>
      {report.strengths.length > 0 && (
        <section>
          <h3>
            <CheckCircle2 size={18} aria-hidden="true" /> O que funcionou bem
          </h3>
          <ul className="live-voice-strengths">
            {report.strengths.map((text, index) => (
              <li key={index}>
                <Check size={16} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {report.improvements.length > 0 && (
        <section>
          <h3>
            <MessageCircle size={18} aria-hidden="true" /> Para experimentar de outro jeito
          </h3>
          <div className="live-voice-improvements">
            {report.improvements.map((item, index) => (
              <article key={index}>
                <span>Na conversa</span>
                <p>{item.heard}</p>
                <span>Uma sugestão</span>
                <LearningText
                  as="p"
                  textRole="target"
                  className="live-voice-suggestion"
                  text={item.suggestion}
                />
                <small>{item.explanation}</small>
              </article>
            ))}
          </div>
        </section>
      )}
      {report.nextPractice.length > 0 && (
        <section>
          <h3>
            <ArrowRight size={18} aria-hidden="true" /> Na próxima prática
          </h3>
          <ul>
            {report.nextPractice.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </section>
      )}
      <p className="live-voice-report-limits">{report.limits}</p>
      <p className="live-voice-muted">Orientação para praticar, sem nota formal.</p>
    </div>
  );
}
function VoiceOrb({
  phase,
  orbRef,
}: {
  phase: LiveSnapshot["phase"];
  orbRef: React.RefObject<HTMLDivElement | null>;
}) {
  const gradient = useId();
  return (
    <div ref={orbRef} className={"live-voice-orb is-" + phase} aria-hidden="true">
      <div className="live-voice-orbit orbit-one" />
      <div className="live-voice-orbit orbit-two" />
      <div className="live-voice-orbit orbit-three" />
      <svg className="live-voice-sphere" viewBox="0 0 200 200" fill="none">
        <defs>
          <radialGradient id={gradient} cx=".3" cy=".25" r=".95">
            <stop stopColor="#f4c2af" />
            <stop offset=".4" stopColor="#c75b6c" />
            <stop offset="1" stopColor="#6d2037" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="87" fill={"url(#" + gradient + ")"} />
        <ellipse cx="73" cy="59" rx="39" ry="23" fill="#fff7ee" opacity=".12" />
        <g className="live-voice-wave" stroke="#fff7ee" strokeWidth="3.5" strokeLinecap="round">
          <path d="M67 95v10M80 85v30M93 75v50M106 83v34M119 91v18M132 96v8" />
        </g>
      </svg>
      <span className="live-voice-orb-icon">
        {phase === "paused" ? <MicOff size={21} /> : <AudioLines size={21} />}
      </span>
    </div>
  );
}

export function LiveConversation() {
  const { course, language, authUserId, runtime, ready } = useStudy();
  const scope = JSON.stringify([
    authUserId,
    course.id,
    course.contentVersion,
    runtime?.versionSessionId,
    runtime?.selectionRevision,
    ready,
  ]);
  if (!ready)
    return (
      <div className="live-voice-page">
        <p className="live-voice-loading" role="status">
          Preparando suas conversas…
        </p>
      </div>
    );
  return (
    <LiveConversationPanel
      key={scope}
      courseId={course.id}
      locale={language.identity.iso639_1 ?? language.identity.iso639_3 ?? language.id}
      languageName={language.identity.nativeName ?? course.title}
      enabled={Boolean(ready && authUserId)}
    />
  );
}

function LiveConversationPanel({
  courseId,
  locale,
  languageName,
  enabled,
}: {
  courseId: string;
  locale: string;
  languageName: string;
  enabled: boolean;
}) {
  const page = useRef<HTMLDivElement>(null);
  const scrollTransitions = useRef<{
    completed: string | null;
    history: string | null;
    hasReport: boolean;
  }>({ completed: null, history: null, hasReport: false });
  const audio = useRef<HTMLAudioElement>(null),
    orb = useRef<HTMLDivElement>(null),
    client = useRef<LiveConversationClient | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot>({ ...initialLiveSnapshot });
  const [topics, setTopics] = useState<LiveTopic[]>([]),
    [topicError, setTopicError] = useState(""),
    [topicsLoading, setTopicsLoading] = useState(true);
  const preferences = useRef<HTMLElement>(null),
    preferencesHeading = useRef<HTMLHeadingElement>(null);
  const preferencesHeadingId = useId();
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"free" | "studied">("free");
  const [openingTopic, setOpeningTopic] = useState("");
  const [languageLabel, setLanguageLabel] = useState(languageName);
  const [level, setLevel] = useState<LiveLevel>("beginner"),
    [correction, setCorrection] = useState<LiveCorrection>("immediate");
  const correctionChosen = useRef(false);
  const [voice, setVoice] = useState<"preference" | "female" | "male">("preference");
  const [tab, setTab] = useState<"setup" | "history">("setup"),
    [view, setView] = useState<"setup" | "call">("setup");
  const [history, setHistory] = useState<LiveHistory[]>([]),
    [historyError, setHistoryError] = useState(""),
    [historyLoading, setHistoryLoading] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState<LiveHistory | null>(null);
  const reportAbort = useRef<AbortController | null>(null),
    reportGeneration = useRef(0);
  const [reportBusy, setReportBusy] = useState(false),
    [reportError, setReportError] = useState("");
  const [historyReload, setHistoryReload] = useState(0);
  const [reload, setReload] = useState(0),
    [draft, setDraft] = useState(""),
    [composing, setComposing] = useState(false);
  const questionId = useId();
  useEffect(() => {
    if (!audio.current) return;
    const current = new LiveConversationClient(
      browserLiveEnvironment(audio.current),
      setSnapshot,
      (energy) => orb.current?.style.setProperty("--voice-energy", String(energy)),
    );
    client.current = current;
    const exit = () => {
      ++reportGeneration.current;
      reportAbort.current?.abort();
      reportAbort.current = null;
      current.dispose();
    };
    window.addEventListener("pagehide", exit);
    return () => {
      window.removeEventListener("pagehide", exit);
      exit();
      if (client.current === current) client.current = null;
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    if (mode === "free") return;
    void loadLiveTopics(courseId, abort.signal)
      .then((result) => {
        if (abort.signal.aborted) return;
        if (!Array.isArray(result.topics)) throw new Error();
        setTopics(result.topics);
        setLanguageLabel(result.languageLabel);
        setTopicError("");
        setTopicsLoading(false);
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setTopicError(
            liveErrorMessage(error, "Não foi possível carregar seus assuntos. Tente novamente."),
          );
          setTopicsLoading(false);
        }
      });
    return () => abort.abort();
  }, [courseId, enabled, reload, mode]);
  const historyRevision = snapshot.phase === "completed" ? snapshot.session?.id : "";
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    void loadLiveHistory(courseId, abort.signal)
      .then((result) => {
        if (abort.signal.aborted) return;
        if (!Array.isArray(result.sessions)) throw new Error();
        setHistory(result.sessions);
        setHistoryError("");
        setHistoryLoading(false);
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setHistoryError(
            liveErrorMessage(error, "Não foi possível carregar suas conversas anteriores."),
          );
          setHistoryLoading(false);
        }
      });
    return () => abort.abort();
  }, [courseId, enabled, reload, historyRevision, historyReload]);
  const selectedTopics = topics.filter((item) => selectedTopicIds.includes(item.id));
  const selectionTitle =
    selectedTopics.length === 1
      ? selectedTopics[0].title
      : selectedTopics.length + " etapas para conversar";
  const active = ["connecting", "listening", "speaking", "paused", "ending"].includes(
    snapshot.phase,
  );
  const connected = ["listening", "speaking", "paused"].includes(snapshot.phase);
  const showingCall = view === "call" && (active || snapshot.session || snapshot.phase === "error");

  const completedScrollId =
    showingCall && snapshot.phase === "completed" ? (snapshot.session?.id ?? null) : null;
  const historyScrollId = !showingCall && tab === "history" ? (selectedHistory?.id ?? null) : null;
  const historyHasReport = historyScrollId !== null && Boolean(selectedHistory?.report);
  useEffect(() => {
    const previous = scrollTransitions.current;
    const completed = completedScrollId !== null && previous.completed !== completedScrollId;
    const history =
      historyScrollId !== null &&
      (previous.history !== historyScrollId || (!previous.hasReport && historyHasReport));
    scrollTransitions.current = {
      completed: completedScrollId,
      history: historyScrollId,
      hasReport: historyHasReport,
    };
    if (!completed && !history) return;
    const frame = window.requestAnimationFrame(() => {
      page.current
        ?.querySelector<HTMLElement>(completed ? ".live-voice-call" : ".live-voice-history")
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [completedScrollId, historyScrollId, historyHasReport]);

  function selectHistory(item: LiveHistory | null) {
    ++reportGeneration.current;
    reportAbort.current?.abort();
    reportAbort.current = null;
    setReportBusy(false);
    setReportError("");
    setSelectedHistory(item);
  }
  async function retryHistoryReport() {
    if (!selectedHistory || reportAbort.current) return;
    const id = selectedHistory.id,
      abort = new AbortController(),
      own = ++reportGeneration.current;
    reportAbort.current = abort;
    setReportBusy(true);
    setReportError("");
    try {
      const result = await prepareLiveReport(id, abort.signal);
      if (abort.signal.aborted || own !== reportGeneration.current) return;
      const updated = {
        ...selectedHistory,
        status: result.status,
        report: result.report,
        transcript: result.transcript,
      };
      setSelectedHistory((previous) => (previous?.id === id ? updated : previous));
      setHistory((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                status: result.status,
                report: result.report,
                transcript: result.transcript,
              }
            : item,
        ),
      );
      if (!result.report)
        setReportError(
          result.reportError ||
            "O resumo ainda não está disponível. Você pode tentar novamente mais tarde.",
        );
      setHistoryReload((value) => value + 1);
    } catch (error) {
      if (!abort.signal.aborted && own === reportGeneration.current)
        setReportError(
          liveErrorMessage(error, "Não foi possível preparar o resumo agora. Tente novamente."),
        );
    } finally {
      if (!abort.signal.aborted && own === reportGeneration.current) {
        reportAbort.current = null;
        setReportBusy(false);
      }
    }
  }

  function goToPreferences() {
    window.requestAnimationFrame(() => {
      preferences.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      preferencesHeading.current?.focus({ preventScroll: true });
    });
  }

  function refresh() {
    setTopicError("");
    setHistoryError("");
    setTopicsLoading(true);
    setHistoryLoading(true);
    setReload((value) => value + 1);
  }
  function begin() {
    if (!enabled || (mode === "studied" && !selectedTopics.length) || !client.current || active)
      return;
    setView("call");
    selectHistory(null);
    setDraft("");
    void client.current.start({
      courseId,
      ...(mode === "free"
        ? { mode, ...(openingTopic.trim() ? { openingTopic: openingTopic.trim() } : {}) }
        : { mode, topicIds: selectedTopics.map((topic) => topic.id) }),
      level,
      correction,
      voice: voice === "preference" ? readVoicePreference(locale) : voice,
    });
  }
  function chooseLevel(value: LiveLevel) {
    setLevel(value);
    if (!correctionChosen.current) setCorrection(value === "advanced" ? "end" : "immediate");
  }
  async function sendQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || composing || !client.current) return;
    if (await client.current.message(draft)) setDraft("");
  }
  function back() {
    setView("setup");
    selectHistory(null);
    setTab("setup");
    setReload((value) => value + 1);
  }
  return (
    <div ref={page} className="live-voice-page">
      <audio ref={audio} autoPlay aria-hidden="true" />
      <header className="live-voice-heading">
        <div>
          <span className="live-voice-kicker">
            <AudioLines size={15} aria-hidden="true" /> CONVERSA AO VIVO
          </span>
          <h1>
            Uma conversa.
            <br className="live-voice-mobile-break" /> A sua voz.
          </h1>
          <p>Ganhe espaço para conversar em {languageLabel}, do seu jeito e no seu ritmo.</p>
        </div>
        {!active && (
          <div className="live-voice-heading-art">
            <MessageIllustration />
          </div>
        )}
      </header>
      {!showingCall && (
        <nav className="live-voice-tabs" aria-label="Conversas">
          <button
            type="button"
            aria-pressed={tab === "setup"}
            onClick={() => {
              setTab("setup");
              selectHistory(null);
            }}
          >
            <Mic size={17} aria-hidden="true" /> Nova conversa
          </button>
          <button
            type="button"
            aria-pressed={tab === "history"}
            onClick={() => {
              setTab("history");
              selectHistory(null);
            }}
          >
            <History size={17} aria-hidden="true" /> Minhas conversas
            {history.length > 0 && <span>{history.length}</span>}
          </button>
        </nav>
      )}
      {!showingCall && snapshot.phase === "error" && (
        <div className="live-voice-error" role="alert">
          {snapshot.message}
          {snapshot.session && (
            <button
              type="button"
              className="live-voice-secondary"
              onClick={() => {
                setView("call");
                void client.current?.finish();
              }}
            >
              Confirmar encerramento
            </button>
          )}
        </div>
      )}
      {!enabled ? (
        <section className="live-voice-empty">
          <MicOff size={28} aria-hidden="true" />
          <h2>Entre para conversar</h2>
          <p>Selecione seu curso e entre na sua conta para retomar os assuntos estudados.</p>
        </section>
      ) : showingCall ? (
        <section className="live-voice-call">
          <div className="live-voice-call-heading" data-report-private>
            <div>
              <span className="live-voice-kicker">
                {snapshot.session?.languageLabel ?? languageLabel}
              </span>
              <h2>
                {snapshot.session?.topic.title ??
                  (mode === "free"
                    ? "Conversa livre"
                    : selectedTopics.length
                      ? selectionTitle
                      : "Sua conversa")}
              </h2>
            </div>
            {active && (
              <span
                className={"live-voice-time " + (snapshot.remaining <= 45 ? "is-ending" : "")}
                aria-label={minutes(snapshot.remaining) + " restantes"}
              >
                <Clock3 size={16} aria-hidden="true" />
                {minutes(snapshot.remaining)}
              </span>
            )}
          </div>
          {active ? (
            <>
              <VoiceOrb phase={snapshot.phase} orbRef={orb} />
              <div className="live-voice-call-status">
                <h3 role="status">{phases[snapshot.phase]}</h3>
                <p>
                  {snapshot.phase === "paused"
                    ? "Seu microfone e a reprodução estão desligados."
                    : snapshot.phase === "connecting"
                      ? "Autorize o microfone quando o navegador pedir."
                      : snapshot.phase === "ending"
                        ? "O microfone já foi desligado. Aguarde a confirmação do resumo."
                        : "Ouça e responda no seu ritmo. Você pode entrar na conversa com a sua voz."}
                </p>
              </div>
              {snapshot.remaining <= 45 && connected && (
                <p className="live-voice-time-notice" role="status">
                  Faltam menos de um minuto. Conclua sua ideia para fechar a conversa.
                </p>
              )}
              <div className="live-voice-controls">
                {connected && (
                  <>
                    <button
                      type="button"
                      className="live-voice-control"
                      disabled={snapshot.pending}
                      onClick={() => void client.current?.pause(snapshot.phase !== "paused")}
                    >
                      {snapshot.phase === "paused" ? <Play size={21} /> : <Pause size={21} />}
                      <span>{snapshot.phase === "paused" ? "Retomar" : "Pausar"}</span>
                    </button>
                    <button
                      type="button"
                      className="live-voice-control"
                      disabled={snapshot.pending || snapshot.phase === "paused"}
                      onClick={() =>
                        void client.current?.message("Pare um instante. Quero fazer uma pergunta.")
                      }
                    >
                      <MessageCircle size={21} />
                      <span>Um instante</span>
                    </button>
                  </>
                )}
                {snapshot.phase !== "ending" && (
                  <button
                    type="button"
                    className="live-voice-control live-voice-stop"
                    onClick={() =>
                      void client.current?.finish(
                        snapshot.phase === "connecting" ? "Conexão cancelada." : "",
                      )
                    }
                  >
                    <Square size={19} />
                    <span>{snapshot.phase === "connecting" ? "Cancelar" : "Encerrar"}</span>
                  </button>
                )}
              </div>
              {connected && (
                <form className="live-voice-question" onSubmit={sendQuestion}>
                  <label htmlFor={questionId}>Quer pedir ajuda por escrito?</label>
                  <div>
                    <input
                      id={questionId}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onCompositionStart={() => setComposing(true)}
                      onCompositionEnd={() => setComposing(false)}
                      maxLength={800}
                      disabled={snapshot.pending || snapshot.phase === "paused"}
                      placeholder="Escreva uma dúvida ou um pedido…"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      aria-label="Enviar pedido"
                      disabled={
                        !draft.trim() ||
                        snapshot.pending ||
                        snapshot.phase === "paused" ||
                        composing
                      }
                    >
                      <Send size={18} aria-hidden="true" />
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              <div
                className={
                  "live-voice-ended " +
                  (snapshot.resultStatus === "failed" || snapshot.phase === "error"
                    ? "is-interrupted"
                    : "")
                }
              >
                {snapshot.resultStatus === "failed" || snapshot.phase === "error" ? (
                  <MicOff size={29} aria-hidden="true" />
                ) : snapshot.resultStatus === "expired" ? (
                  <Clock3 size={29} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={29} aria-hidden="true" />
                )}
                <h2>
                  {snapshot.resultStatus === "failed"
                    ? "Conversa interrompida"
                    : snapshot.resultStatus === "expired"
                      ? "Tempo encerrado"
                      : snapshot.phase === "completed"
                        ? "Conversa encerrada"
                        : "O áudio foi encerrado"}
                </h2>
              </div>
              {snapshot.report ? (
                <Report report={snapshot.report} />
              ) : (
                <div className="live-voice-empty">
                  <h3>
                    {snapshot.phase === "completed"
                      ? "Resumo ainda indisponível"
                      : "Falta confirmar o encerramento"}
                  </h3>
                  <p>{snapshot.reportError || "Você pode consultar esta conversa no histórico."}</p>
                </div>
              )}
              <div className="live-voice-end-actions">
                {snapshot.phase === "error" && snapshot.session && (
                  <button
                    type="button"
                    className="live-voice-primary"
                    onClick={() => void client.current?.finish()}
                  >
                    Tentar concluir novamente
                  </button>
                )}
                <button type="button" className="live-voice-secondary" onClick={back}>
                  <ArrowLeft size={17} /> Preparar outra conversa
                </button>
                <button
                  type="button"
                  className="live-voice-secondary"
                  onClick={() => {
                    back();
                    setTab("history");
                  }}
                >
                  Ver histórico
                </button>
              </div>
            </>
          )}
          {snapshot.message && (
            <p
              className={snapshot.phase === "error" ? "live-voice-error" : "live-voice-notice"}
              role={snapshot.phase === "error" ? "alert" : "status"}
            >
              {snapshot.message}
            </p>
          )}
          <Transcript turns={snapshot.turns} />
        </section>
      ) : tab === "history" ? (
        <section className="live-voice-history" data-report-private>
          {selectedHistory ? (
            <>
              <button type="button" className="live-voice-back" onClick={() => selectHistory(null)}>
                <ArrowLeft size={17} /> Todas as conversas
              </button>
              <div className="live-voice-section-heading">
                <div>
                  <span className="live-voice-kicker">{dateLabel(selectedHistory.startedAt)}</span>
                  <h2>{selectedHistory.title}</h2>
                </div>
              </div>
              {selectedHistory.report ? (
                <Report report={selectedHistory.report} />
              ) : (
                <div className="live-voice-empty">
                  <h3>Resumo indisponível</h3>
                  <p>O texto disponível aparece abaixo. O resumo ainda não foi confirmado.</p>
                  <button
                    type="button"
                    className="live-voice-primary"
                    disabled={reportBusy}
                    aria-busy={reportBusy}
                    onClick={() => void retryHistoryReport()}
                  >
                    <Sparkles size={17} aria-hidden="true" />
                    {reportBusy ? "Preparando resumo…" : "Preparar resumo novamente"}
                  </button>
                  {reportBusy && (
                    <p role="status">
                      Estamos organizando seu resumo. Isso pode levar alguns instantes.
                    </p>
                  )}
                  {reportError && (
                    <p className="live-voice-error" role="alert">
                      {reportError}
                    </p>
                  )}
                </div>
              )}
              <Transcript turns={selectedHistory.transcript} />
            </>
          ) : (
            <>
              <div className="live-voice-section-heading">
                <div>
                  <h2>Seu caminho em voz alta</h2>
                  <p>Volte às suas conversas e consulte o que pode praticar depois.</p>
                </div>
                <History size={23} aria-hidden="true" />
              </div>
              {historyLoading ? (
                <p role="status" className="live-voice-loading">
                  Buscando suas conversas…
                </p>
              ) : historyError ? (
                <div className="live-voice-empty">
                  <p className="live-voice-error" role="alert">
                    {historyError}
                  </p>
                  <button type="button" className="live-voice-secondary" onClick={refresh}>
                    Tentar novamente
                  </button>
                </div>
              ) : history.length ? (
                <div className="live-voice-history-list">
                  {history.map((item) => (
                    <button type="button" key={item.id} onClick={() => selectHistory(item)}>
                      <span className="live-voice-history-icon">
                        <MessageCircle size={21} />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {dateLabel(item.startedAt)} ·{" "}
                          {levels.find((option) => option.id === item.level)?.label ?? "Conversa"}
                        </small>
                        <small>
                          {item.report
                            ? "Resumo disponível"
                            : item.status === "completed"
                              ? "Sem resumo confirmado"
                              : "Conversa interrompida"}
                        </small>
                      </span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="live-voice-empty">
                  <MessageIllustration />
                  <h3>A primeira conversa abre o caminho</h3>
                  <p>Escolha um assunto estudado para começar.</p>
                  <button
                    type="button"
                    className="live-voice-primary"
                    onClick={() => setTab("setup")}
                  >
                    Escolher assunto <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <div className="live-voice-setup">
          <section className="live-voice-topics">
            <div className="live-voice-path-picker" role="group" aria-label="Caminho da conversa">
              <button type="button" aria-pressed={mode === "free"} onClick={() => setMode("free")}>
                <Sparkles size={20} aria-hidden="true" />
                <span>
                  <strong>Conversa livre</strong>
                  <small>Qualquer assunto, no seu ritmo</small>
                </span>
                <span className="live-voice-radio">{mode === "free" && <span />}</span>
              </button>
              <button
                type="button"
                aria-pressed={mode === "studied"}
                onClick={() => {
                  if (!topics.length) setTopicsLoading(true);
                  setMode("studied");
                }}
              >
                <BookOpen size={20} aria-hidden="true" />
                <span>
                  <strong>Revisar o curso</strong>
                  <small>Escolha unidades e etapas</small>
                </span>
                <span className="live-voice-radio">{mode === "studied" && <span />}</span>
              </button>
            </div>
            {mode === "free" ? (
              <LiveFreeSetup
                topic={openingTopic}
                onChange={setOpeningTopic}
                onContinue={goToPreferences}
              />
            ) : (
              <>
                <div className="live-voice-section-heading">
                  <div>
                    <span className="live-voice-kicker">1 · ASSUNTOS QUE SE CONECTAM</span>
                    <h2>Sobre o que vamos conversar?</h2>
                    <p>
                      Combine etapas e unidades do que você já estudou. Você escolhe o caminho da
                      conversa.
                    </p>
                  </div>
                  <BookOpen size={22} aria-hidden="true" />
                </div>
                {topicsLoading ? (
                  <p role="status" className="live-voice-loading">
                    Encontrando seus assuntos…
                  </p>
                ) : topicError ? (
                  <div className="live-voice-empty">
                    <p className="live-voice-error" role="alert">
                      {topicError}
                    </p>
                    <button type="button" className="live-voice-secondary" onClick={refresh}>
                      Tentar novamente
                    </button>
                  </div>
                ) : topics.length ? (
                  <LiveTopicPicker
                    topics={topics}
                    selectedIds={selectedTopicIds}
                    onChange={setSelectedTopicIds}
                    onContinue={goToPreferences}
                  />
                ) : (
                  <div className="live-voice-empty">
                    <BookOpen size={30} aria-hidden="true" />
                    <h3>Estude um pouco e volte para conversar</h3>
                    <p>Seus assuntos aparecem aqui conforme você pratica as atividades do curso.</p>
                  </div>
                )}
              </>
            )}
          </section>
          <aside
            ref={preferences}
            className="live-voice-preferences"
            aria-labelledby={preferencesHeadingId}
          >
            <span className="live-voice-kicker">2 · DO SEU JEITO</span>
            <h2 id={preferencesHeadingId} ref={preferencesHeading} tabIndex={-1}>
              Encontre seu ritmo
            </h2>
            {mode === "free" ? (
              <div className="live-voice-selected-topic" data-report-private>
                <span>CONVERSA LIVRE</span>
                <strong>{openingTopic.trim() || "Vamos descobrir um assunto juntos"}</strong>
                <small>Você pode mudar o rumo do papo a qualquer momento.</small>
              </div>
            ) : (
              selectedTopics.length > 0 && (
                <div className="live-voice-selected-topic" aria-live="polite" aria-atomic="true">
                  <span>SUA SELEÇÃO</span>
                  <strong>{selectionTitle}</strong>
                  <ul>
                    {selectedTopics.slice(0, 3).map((topic) => (
                      <li key={topic.id}>{topic.title}</li>
                    ))}
                  </ul>
                  {selectedTopics.length > 3 && (
                    <small>+ {selectedTopics.length - 3} etapas selecionadas</small>
                  )}
                </div>
              )
            )}

            <fieldset>
              <legend>Nível da conversa</legend>
              <div className="live-voice-levels">
                {levels.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={level === option.id}
                    onClick={() => chooseLevel(option.id)}
                  >
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.detail}</small>
                    </span>
                    <span className="live-voice-radio">{level === option.id && <span />}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Quando receber correções?</legend>
              <div className="live-voice-corrections">
                {(
                  [
                    { id: "immediate", label: "Na hora" },
                    { id: "end", label: "No final" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={correction === option.id}
                    onClick={() => {
                      correctionChosen.current = true;
                      setCorrection(option.id);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="live-voice-select-label">
              <span>
                <Volume2 size={16} aria-hidden="true" /> Voz da conversa
              </span>
              <select
                value={voice}
                onChange={(event) => setVoice(event.target.value as typeof voice)}
              >
                <option value="preference">Minha preferência dos ajustes</option>
                <option value="female">Feminina nesta conversa</option>
                <option value="male">Masculina nesta conversa</option>
              </select>
            </label>
            <div className="live-voice-start-note">
              <Clock3 size={16} aria-hidden="true" />
              <p>Até 8 minutos para conversar. Use fones e encontre um lugar tranquilo.</p>
            </div>
            <button
              type="button"
              className="live-voice-primary live-voice-begin"
              disabled={
                (mode === "studied" && !selectedTopics.length) ||
                !enabled ||
                active ||
                (snapshot.phase === "error" && Boolean(snapshot.session))
              }
              onClick={begin}
            >
              <Mic size={19} aria-hidden="true" /> Começar conversa{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            {mode === "studied" && !selectedTopics.length && topics.length > 0 && (
              <p className="live-voice-select-hint">Escolha uma ou mais etapas para começar.</p>
            )}
            <p className="live-voice-ai-note">Você conversa com uma IA, não com uma pessoa.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
