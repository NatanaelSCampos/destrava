"use client";

import { useState } from "react";
import { ArrowLeft, Check, MessageCircle, Send, Sparkles } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { SpeakButton } from "@/components/audio/speak-button";
import { conversationScenarios, findConversationScenario } from "@/content/conversation-scenarios";
import {
  startConversation,
  type ConversationCorrection,
  type ConversationMode,
  type ConversationPace,
} from "@/domain/conversation/conversation-session";

const paceOptions: Array<{ id: ConversationPace; label: string; detail: string }> = [
  { id: "beginner", label: "Iniciante", detail: "Frases curtas e mais ajuda" },
  { id: "intermediate", label: "Intermediário", detail: "Conversa moderada" },
  { id: "natural", label: "Natural", detail: "Mais espontânea" },
];
const correctionOptions: Array<{ id: ConversationCorrection; label: string }> = [
  { id: "instant", label: "A cada resposta" },
  { id: "important_only", label: "Só erros importantes" },
  { id: "end_of_conversation", label: "No final" },
  { id: "off", label: "Sem correção" },
];

export default function ConversationPage() {
  const { course, state, saveConversation, addConversationReply, completeConversation } =
    useStudy();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ConversationMode>("mission");
  const [scenarioId, setScenarioId] = useState(conversationScenarios[0].id);
  const [topic, setTopic] = useState("");
  const [pace, setPace] = useState<ConversationPace>("beginner");
  const [correction, setCorrection] = useState<ConversationCorrection>("important_only");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sessions = (state.conversations ?? []).filter((item) => item.courseId === course.id);
  const selected = sessions.find((item) => item.id === selectedId);
  const scenario = findConversationScenario(selected?.scenarioId);
  const turnsUsed = selected?.turns.filter((item) => item.role === "student").length ?? 0;

  function begin() {
    const chosenScenario = mode === "mission" ? findConversationScenario(scenarioId) : undefined;
    if (mode === "free" && topic.trim().length < 3) {
      setError("Escreva um assunto com pelo menos 3 caracteres.");
      return;
    }
    const session = startConversation({
      courseId: course.id,
      mode,
      scenario: chosenScenario,
      topic,
      pace,
      correction,
    });
    saveConversation(session);
    setSelectedId(session.id);
    setDraft("");
    setError("");
  }

  async function send() {
    if (!selected || selected.finishedAt || !draft.trim() || loading || turnsUsed >= 16) return;
    const message = draft.trim();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selected.mode,
          scenarioId: selected.scenarioId,
          topic: selected.topic,
          pace: selected.pace,
          correction: selected.correction,
          history: selected.turns.slice(-16).map(({ role, text }) => ({ role, text })),
          message,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível continuar a conversa.");
      if (!result.reply) throw new Error("A resposta veio vazia. Tente novamente.");
      addConversationReply(selected.id, message, {
        text: result.reply,
        correction: result.correction ?? "",
        completedObjectiveIds: result.completedObjectiveIds ?? [],
      });
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível continuar a conversa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="conversation-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <MessageCircle size={14} /> PRATICAR CONVERSAÇÃO
          </span>
          <h1 className="page-title">Converse para destravar.</h1>
          <p className="page-subtitle">
            Pratique no seu ritmo. As missões mostram objetivos alcançados, sem nota oficial.
          </p>
        </div>
      </div>

      {selected ? (
        <div className="conversation-layout">
          <section className="panel conversation-main">
            <div className="conversation-header">
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setSelectedId(null);
                  setError("");
                }}
              >
                <ArrowLeft size={16} /> Conversas
              </button>
              <div>
                <h2>{scenario?.title ?? `Conversa sobre ${selected.topic}`}</h2>
                <small>
                  {paceOptions.find((item) => item.id === selected.pace)?.label} ·{" "}
                  {correctionOptions.find((item) => item.id === selected.correction)?.label}
                </small>
              </div>
              {!selected.finishedAt && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={loading}
                  onClick={() => completeConversation(selected.id)}
                >
                  Encerrar
                </button>
              )}
            </div>
            <div className="conversation-messages" aria-live="polite">
              {selected.turns.length === 0 && (
                <p className="conversation-empty">
                  Escreva a primeira mensagem em espanhol para começar.
                </p>
              )}
              {selected.turns.map((turn) => (
                <div key={turn.id} className={`conversation-message ${turn.role}`}>
                  <span className="conversation-speaker">
                    {turn.role === "student"
                      ? "Você"
                      : (scenario?.character.split(",")[0] ?? "Professor")}
                  </span>
                  <div className="text-audio-row">
                    <p lang="es">{turn.text}</p>
                    {turn.role === "partner" && (
                      <SpeakButton
                        text={turn.text}
                        label="Ouvir resposta em espanhol"
                        rate={{ beginner: 0.75, intermediate: 0.86, natural: 1 }[selected.pace]}
                      />
                    )}
                  </div>
                  {turn.correction &&
                    selected.correction !== "end_of_conversation" &&
                    selected.correction !== "off" && (
                      <p className="conversation-correction">
                        <strong>Ajuste:</strong> {turn.correction}
                      </p>
                    )}
                </div>
              ))}
              {loading && (
                <p className="conversation-thinking">
                  <Sparkles size={15} /> Preparando resposta…
                </p>
              )}
            </div>
            {selected.finishedAt ? (
              <div className="conversation-finished">
                <strong>Conversa concluída</strong>
                <p>
                  Você praticou {turnsUsed} {turnsUsed === 1 ? "resposta" : "respostas"}. Pode reler
                  as frases e ouvir o áudio.
                </p>
                {selected.correction === "end_of_conversation" &&
                  selected.turns.some((turn) => turn.correction) && (
                    <div>
                      <strong>Ajustes para revisar</strong>
                      <ul>
                        {selected.turns
                          .filter((turn) => turn.correction)
                          .map((turn) => (
                            <li key={turn.id}>{turn.correction}</li>
                          ))}
                      </ul>
                    </div>
                  )}
              </div>
            ) : (
              <div className="conversation-compose">
                <label htmlFor="conversation-draft">Sua resposta em espanhol</label>
                <textarea
                  id="conversation-draft"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={400}
                  rows={3}
                  placeholder="Escreva sua resposta…"
                  disabled={loading || turnsUsed >= 16}
                />
                <div>
                  <small>{turnsUsed}/16 respostas nesta conversa</small>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!draft.trim() || loading || turnsUsed >= 16}
                    onClick={() => void send()}
                  >
                    <Send size={16} /> Enviar
                  </button>
                </div>
                {turnsUsed >= 16 && (
                  <p>Esta conversa chegou ao limite. Encerre para rever o que praticou.</p>
                )}
              </div>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <aside className="conversation-side">
            {scenario && (
              <div className="panel conversation-objectives">
                <span className="eyebrow">SUA MISSÃO</span>
                <p>{scenario.setting}</p>
                <strong>
                  Objetivos indicados: {selected.completedObjectiveIds.length}/
                  {scenario.objectives.length}
                </strong>
                <ul>
                  {scenario.objectives.map((item) => (
                    <li
                      key={item.id}
                      className={selected.completedObjectiveIds.includes(item.id) ? "done" : ""}
                    >
                      {selected.completedObjectiveIds.includes(item.id) ? (
                        <Check size={15} />
                      ) : (
                        <span className="objective-dot" />
                      )}
                      <span>
                        {item.label}
                        <small>{item.hint}</small>
                      </span>
                    </li>
                  ))}
                </ul>
                <small>Os objetivos são identificados pela IA durante a prática.</small>
              </div>
            )}
            {!scenario && (
              <div className="panel conversation-objectives">
                <span className="eyebrow">PRÁTICA LIVRE</span>
                <p>
                  Fale sobre {selected.topic}. Experimente perguntar, responder e pedir uma
                  explicação.
                </p>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="conversation-layout">
          <section className="panel conversation-setup">
            <span className="eyebrow">ESCOLHA COMO PRATICAR</span>
            <div className="conversation-mode-grid">
              <button
                type="button"
                className={mode === "mission" ? "active" : ""}
                onClick={() => setMode("mission")}
              >
                <strong>Missão guiada</strong>
                <span>Uma situação real com objetivos simples.</span>
              </button>
              <button
                type="button"
                className={mode === "free" ? "active" : ""}
                onClick={() => setMode("free")}
              >
                <strong>Conversa livre</strong>
                <span>Escolha o assunto e siga conversando.</span>
              </button>
            </div>
            {mode === "mission" ? (
              <div className="conversation-scenario-grid">
                {conversationScenarios.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={scenarioId === item.id ? "active" : ""}
                    onClick={() => setScenarioId(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.setting}</span>
                    <small>{item.objectives.length} objetivos</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="field">
                <label htmlFor="conversation-topic">Sobre o que quer conversar?</label>
                <input
                  id="conversation-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  maxLength={80}
                  placeholder="Ex.: música, rotina, viagem"
                />
              </div>
            )}
            <div className="settings-form-row">
              <div className="field">
                <label htmlFor="conversation-pace">Ritmo</label>
                <select
                  id="conversation-pace"
                  value={pace}
                  onChange={(event) => setPace(event.target.value as ConversationPace)}
                >
                  {paceOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} — {item.detail}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="conversation-correction">Quando corrigir</label>
                <select
                  id="conversation-correction"
                  value={correction}
                  onChange={(event) => setCorrection(event.target.value as ConversationCorrection)}
                >
                  {correctionOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button type="button" className="primary-button" onClick={begin}>
              <MessageCircle size={16} /> Começar conversa
            </button>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <aside className="conversation-side">
            <div className="panel conversation-history">
              <span className="eyebrow">CONVERSAS RECENTES</span>
              {sessions.length === 0 ? (
                <p>Suas conversas aparecerão aqui.</p>
              ) : (
                sessions.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setError("");
                    }}
                  >
                    <strong>
                      {findConversationScenario(item.scenarioId)?.title ?? item.topic}
                    </strong>
                    <small>
                      {item.finishedAt ? "Concluída" : "Continuar"} ·{" "}
                      {item.turns.filter((turn) => turn.role === "student").length} respostas
                    </small>
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
