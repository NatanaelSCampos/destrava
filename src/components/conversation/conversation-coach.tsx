"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  AudioLines,
  Brain,
  CheckCircle2,
  Coins,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { ConversationMemoryProfile } from "@/domain/conversation/conversation-memory";
import type { LiveHistory } from "@/domain/conversation/live-client";
import { LearningText } from "@/components/learning/text-presentation";
import "./conversation-coach.css";
const base = "/api/ai/live-conversation";
async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await r.json();
  if (!r.ok)
    throw Error(typeof data.error === "string" ? data.error : "Não foi possível carregar agora.");
  return data;
}
const states = {
  observed: "Em observação",
  practising: "Para praticar",
  improving: "Ganhando segurança",
  consolidated: "Uso consistente",
};
const kinds = { word: "Palavra", phrase: "Frase", concept: "Construção" };
const date = (v: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(new Date(v));
export function ConversationProgress({
  courseId,
  history,
}: {
  courseId: string;
  history: LiveHistory[];
}) {
  const [profile, setProfile] = useState<ConversationMemoryProfile | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void request<{ profile: ConversationMemoryProfile }>(
      "/memory?courseId=" + encodeURIComponent(courseId),
      undefined,
      abort.signal,
    )
      .then((r) => setProfile(r.profile))
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [courseId, reload]);
  async function analyse(id: string) {
    if (busy) return;
    setBusy(id);
    setError("");
    try {
      const r = await request<{ profile: ConversationMemoryProfile }>("/memory", {
        courseId,
        sessionId: id,
      });
      setProfile(r.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar.");
    } finally {
      setBusy("");
    }
  }
  const analysed = new Set(profile?.trajectory.map((s) => s.sessionId));
  const pending = history.filter((s) => s.endedAt && !analysed.has(s.id));
  return (
    <section className="conversation-coach" aria-label="Minha evolução" data-report-private>
      <header className="coach-section-heading">
        <span className="live-voice-kicker">
          <Brain size={16} /> SUA VOZ GANHA HISTÓRIA
        </span>
        <h2>Cada conversa ajuda a próxima</h2>
        <p>Palavras, frases e construções que você está aprendendo a usar com mais autonomia.</p>
      </header>
      {error && (
        <div className="coach-error" role="alert">
          <p>{error}</p>
          <button className="live-voice-secondary" onClick={() => setReload((v) => v + 1)}>
            Tentar novamente
          </button>
        </div>
      )}
      {!profile && !error ? (
        <p role="status">Reunindo suas conversas…</p>
      ) : (
        profile && (
          <>
            <div className="coach-overview">
              <article className="coach-score-card">
                <div
                  className="coach-gauge"
                  style={{ "--score": `${profile.index.score ?? 0}%` } as React.CSSProperties}
                >
                  <div>
                    <strong>{profile.index.score ?? "—"}</strong>
                    <span>{profile.index.score === null ? "Ainda em formação" : "de 100"}</span>
                  </div>
                </div>
                <div>
                  <span className="coach-label">
                    ÍNDICE DE CONVERSAÇÃO <small>Experimental</small>
                    <span className={"coach-score-confidence " + profile.confidence.label}>
                      Confiança: {profile.confidence.displayLabel}
                    </span>
                  </span>
                  <h3>
                    {profile.index.score === null
                      ? "Vamos construir sua primeira referência"
                      : "Uma referência para acompanhar sua evolução"}
                  </h3>
                  <p>
                    Considera o que você consegue expressar nas conversas. Mais evidências recentes
                    têm mais peso.
                  </p>
                </div>
              </article>
              <article className={"coach-confidence " + profile.confidence.label}>
                <ShieldCheck size={25} />
                <span className="coach-label">CONFIANÇA NA ESTIMATIVA</span>
                <h3>{profile.confidence.displayLabel}</h3>
                <div
                  role="meter"
                  aria-label="Força das evidências"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={profile.confidence.score}
                  className="coach-confidence-meter"
                >
                  <i style={{ width: profile.confidence.score + "%" }} />
                </div>
                <p>
                  {profile.evidenceStats.sessions} conversas analisadas ·{" "}
                  {profile.evidenceStats.days} dias de prática
                </p>
                <small>
                  Depende da fala observada, da variedade e da consistência. Tempo de chamada
                  sozinho não aumenta a confiança.
                </small>
              </article>
            </div>
            {profile.trajectory.some((s) => s.score !== null) && (
              <section className="coach-trend">
                <h3>
                  <TrendingUp size={20} /> Seu caminho até aqui
                </h3>
                <div className="coach-trend-bars" aria-label="Evolução por conversa">
                  {profile.trajectory.slice(-12).map((s) => (
                    <div key={s.sessionId}>
                      <span>{s.score ?? "—"}</span>
                      <i style={{ height: Math.max(3, s.score ?? 0) + "%" }} />
                      <small>{date(s.endedAt)}</small>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="coach-memory-grid">
              {[
                {
                  title: "Leve para a próxima conversa",
                  icon: Brain,
                  items: profile.priorities,
                  empty:
                    "As dificuldades observadas aparecerão aqui. Uma tentativa incerta não vira erro.",
                },
                {
                  title: "O que está ficando mais fácil",
                  icon: CheckCircle2,
                  items: profile.progress,
                  empty:
                    "Usos independentes em novas conversas ajudam a mostrar o que você consolidou.",
                },
              ].map(({ title, icon: Icon, items, empty }) => (
                <section key={title}>
                  <h3>
                    <Icon size={21} />
                    {title}
                  </h3>
                  {items.length ? (
                    <div className="coach-memory-list">
                      {items.slice(0, 6).map((item) => (
                        <article key={item.key}>
                          <span className="coach-label">
                            {kinds[item.kind]} · {states[item.state]}
                          </span>
                          <LearningText
                            as="strong"
                            textRole={item.kind === "concept" ? "interface" : "target"}
                            text={item.label}
                          />
                          {item.examples.at(-1) && (
                            <>
                              <LearningText
                                as="p"
                                textRole="target"
                                text={item.examples.at(-1)!.quote}
                              />
                              <small>
                                {item.examples.at(-1)!.inputMode === "text"
                                  ? "Resposta digitada · "
                                  : ""}
                                {item.examples.at(-1)!.note}
                              </small>
                            </>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="coach-empty-note">{empty}</p>
                  )}
                </section>
              ))}
            </div>
            <p className="coach-footnote">
              O índice usa as palavras transcritas da sua fala. Não mede pronúncia nem certifica
              nível. A memória ajuda o professor a adaptar exemplos; seu nível e sua preferência de
              correção continuam valendo.
            </p>
          </>
        )
      )}
      {pending.length > 0 && (
        <section className="coach-pending">
          <div>
            <MessageCircle size={24} />
            <h3>Inclua suas conversas anteriores</h3>
            <p>
              Escolha uma conversa para recuperar evidências e atualizar sua memória. O texto será
              analisado pela IA; o áudio não é necessário para este índice.
            </p>
          </div>
          <div>
            {pending.slice(0, 6).map((s) => (
              <button
                className="coach-pending-item"
                disabled={Boolean(busy)}
                key={s.id}
                onClick={() => void analyse(s.id)}
              >
                <span>
                  <strong>{s.title}</strong>
                  <small>{date(s.startedAt)}</small>
                </span>
                <span>
                  {busy === s.id ? "Analisando…" : "Incluir"} <ArrowRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
type OralSession = {
  id: string;
  title: string;
  startedAt: string;
  seconds: number;
  audioReady: boolean;
  audioReason: string;
};
type OralData = {
  balance: number;
  sessions: OralSession[];
  baseline: { credits: number };
  purchaseAvailable: false;
  executionAvailable: false;
};
type Quote = {
  quoteId: string;
  credits: number;
  seconds: number;
  audioReady: boolean;
  previewOnly: boolean;
  access: { balance: number; missing: number; allowed: false };
};
export function ConversationOral({ courseId }: { courseId: string }) {
  const [data, setData] = useState<OralData | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [quote, setQuote] = useState<Quote | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const a = new AbortController();
    void request<OralData>("/oral?courseId=" + encodeURIComponent(courseId), undefined, a.signal)
      .then(setData)
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [courseId, reload]);
  const [deleteTarget, setDeleteTarget] = useState("");
  async function removeAudio(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(base + "/audio?id=" + encodeURIComponent(id), {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!r.ok) throw Error("Não foi possível excluir a gravação.");
      setQuote(null);
      setDeleteTarget("");
      setData((v) =>
        v
          ? {
              ...v,
              sessions: v.sessions.map((s) =>
                s.id === id ? { ...s, audioReady: false, audioReason: "Gravação excluída" } : s,
              ),
            }
          : v,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setBusy(false);
    }
  }
  async function estimate() {
    if (busy || !selected.length) return;
    setBusy(true);
    setError("");
    try {
      setQuote(await request<Quote>("/oral", { action: "quote", courseId, sessionIds: selected }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível estimar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="conversation-coach coach-oral"
      aria-label="Análise oral"
      data-report-private
    >
      <header className="coach-oral-hero">
        <div>
          <span className="live-voice-kicker">
            <AudioLines size={16} /> UM OLHAR MAIS PROFUNDO
          </span>
          <h2>Além das palavras</h2>
          <p>
            Uma análise da sua gravação para observar clareza, ritmo e aspectos da pronúncia, com
            exemplos para praticar.
          </p>
          <span className="coach-premium">
            <LockKeyhole size={14} /> Recurso por créditos · Em preparação
          </span>
        </div>
        <div className="coach-wave" aria-hidden="true">
          {[20, 45, 70, 95, 65, 38, 80, 110, 70, 45, 20].map((h, i) => (
            <i key={i} style={{ height: h }} />
          ))}
        </div>
      </header>
      <div className="coach-oral-features">
        <article>
          <AudioLines />
          <strong>Ouvir sua fala</strong>
          <p>Trabalhar com o áudio real, além da transcrição.</p>
        </article>
        <article>
          <Activity />
          <strong>Encontrar próximos passos</strong>
          <p>Organizar observações de clareza e ritmo com limites explícitos.</p>
        </article>
        <article>
          <Brain />
          <strong>Comparar sessões</strong>
          <p>Reunir conversas do mesmo idioma para revisar sua prática.</p>
        </article>
      </div>
      {error && (
        <div className="coach-error" role="alert">
          <p>{error}</p>
          <button className="live-voice-secondary" onClick={() => setReload((v) => v + 1)}>
            Tentar novamente
          </button>
        </div>
      )}
      {!data && !error ? (
        <p role="status">Consultando suas conversas e créditos…</p>
      ) : (
        data && (
          <div className="coach-oral-workspace">
            <section>
              <h3>Escolha as conversas</h3>
              <p className="coach-muted">
                Selecione até 10. Conversas sem áudio permitem apenas uma simulação pela duração.
              </p>
              {data.sessions.length ? (
                <div className="coach-audio-list">
                  {data.sessions.map((s) => (
                    <div key={s.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.includes(s.id)}
                          disabled={
                            busy ||
                            (!selected.includes(s.id) && selected.length >= 10) ||
                            s.seconds <= 0
                          }
                          onChange={() => {
                            setQuote(null);
                            setSelected((v) =>
                              v.includes(s.id) ? v.filter((id) => id !== s.id) : [...v, s.id],
                            );
                          }}
                        />
                        <span>
                          <strong>{s.title}</strong>
                          <small>
                            {date(s.startedAt)} · {Math.ceil(s.seconds / 60)} min
                          </small>
                          <small className={s.audioReady ? "coach-ready" : ""}>
                            {s.audioReason}
                          </small>
                        </span>
                        <AudioLines size={19} />
                      </label>
                      {s.audioReady && (
                        <div className="coach-audio-delete">
                          {deleteTarget === s.id ? (
                            <>
                              <span>Excluir esta gravação?</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void removeAudio(s.id)}
                              >
                                Sim, excluir
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setDeleteTarget("")}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setDeleteTarget(s.id)}
                            >
                              Excluir áudio
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="coach-empty-note">
                  <MessageCircle />
                  <p>
                    Suas conversas encerradas aparecerão aqui. A gravação precisa ser autorizada
                    antes de começar.
                  </p>
                </div>
              )}
              <button
                type="button"
                className="live-voice-primary"
                disabled={!selected.length || busy}
                onClick={() => void estimate()}
              >
                {busy ? "Calculando…" : "Calcular créditos"} <ArrowRight size={17} />
              </button>
            </section>
            <aside className="coach-wallet">
              <Coins size={27} />
              <span className="coach-label">SEU SALDO</span>
              <strong className="coach-balance">
                {data.balance} <small>créditos</small>
              </strong>
              {quote ? (
                <div className="coach-quote" role="status">
                  <span>
                    {quote.previewOnly ? "Simulação de consumo" : "Estimativa da seleção"}
                  </span>
                  <strong>{quote.credits} créditos</strong>
                  <small>{Math.ceil(quote.seconds / 60)} min selecionados</small>
                  {!quote.audioReady && (
                    <p>
                      Esta seleção não tem todas as gravações. A simulação não permite avaliar
                      pronúncia.
                    </p>
                  )}
                  <p>
                    {quote.access.missing > 0
                      ? `Faltam ${quote.access.missing} créditos para essa seleção.`
                      : "A execução será liberada após a ativação do recurso."}
                  </p>
                  <button className="live-voice-primary" disabled>
                    <LockKeyhole size={16} /> Analisar gravações
                  </button>
                </div>
              ) : (
                <p>Selecione conversas para conferir a estimativa antes de usar créditos.</p>
              )}
              <div className="coach-credit-baseline">
                <strong>Como o consumo será calculado</strong>
                <p>
                  Referência inicial: cerca de {data.baseline.credits} créditos para 10 minutos em
                  uma gravação. O número de sessões também influencia o processamento.
                </p>
                <small>
                  Estimativa de engenharia, ainda sujeita a calibração. Não é um preço em reais.
                </small>
              </div>
              <button className="live-voice-secondary" disabled>
                Compra de créditos em breve
              </button>
              <p className="coach-muted">Nenhum crédito é cobrado nesta versão.</p>
            </aside>
          </div>
        )
      )}
    </section>
  );
}
