"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { ConversationVoiceInput } from "@/components/conversation/conversation-voice-input";
import { SpeakButton } from "@/components/audio/speak-button";
import { startConversation } from "@/domain/conversation/conversation-session";

export function FocusedConversation({ scenarioId }: { scenarioId: string }) {
  const { course, resources, state, saveConversation, addConversationReply, completeConversation } = useStudy();
  const scenario = resources.conversationScenarios.find((item) => item.id === scenarioId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "speech">("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const session = state.conversations.find((item) => item.id === sessionId);
  const turns = session?.turns.filter((item) => item.role === "student").length ?? 0;

  if (!scenario) return null;

  function begin() {
    if (!scenario) return;
    const next = startConversation({
      courseId: course.id,
      mode: "mission",
      scenario,
      topic: scenario.title,
      pace: "beginner",
      correction: "important_only",
    });
    saveConversation(next);
    setSessionId(next.id);
  }

  async function send() {
    if (!session || session.finishedAt || !draft.trim() || loading || turns >= 3) return;
    const message = draft.trim();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          mode: session.mode,
          scenarioId: session.scenarioId,
          topic: session.topic,
          pace: session.pace,
          correction: session.correction,
          history: session.turns.slice(-16).map(({ role, text }) => ({ role, text })),
          message,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.reply) throw new Error(result.error ?? "Não foi possível continuar a conversa.");
      addConversationReply(session.id, message, {
        text: result.reply,
        correction: result.correction ?? "",
        correctionCategory: result.correctionCategory ?? "none",
        completedObjectiveIds: result.completedObjectiveIds ?? [],
      }, inputMode);
      if (turns + 1 >= 3) completeConversation(session.id);
      setDraft("");
      setInputMode("text");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível continuar a conversa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel focused-conversation">
      <span className="eyebrow">MISSÃO DE CONVERSA · 3 RESPOSTAS</span>
      <h2>{scenario.title}</h2>
      <p>{scenario.setting}</p>
      <p>Pratique em voz alta. Você também pode escrever se o microfone não estiver disponível. A conversa não recebe nota de pronúncia.</p>
      <ul>{scenario.objectives.slice(0, 3).map((item) => <li key={item.id}>{item.label}</li>)}</ul>
      {!session ? (
        <button className="primary-button" type="button" onClick={begin}>Iniciar conversa</button>
      ) : (
        <>
          <div className="focused-conversation-turns" aria-live="polite">
            {session.turns.map((item) => (
              <div key={item.id} className={item.role}>
                <strong>{item.role === "partner" ? scenario.character.split(",")[0] : "Você"}</strong>
                <span>{item.text}</span>
                {item.role === "partner" && <SpeakButton text={item.text} label="Ouvir resposta" />}
                {item.correction && <small>{item.correction}</small>}
              </div>
            ))}
          </div>
          {session.finishedAt ? <p className="success-message">Conversa concluída. Siga para a próxima etapa.</p> : (
            <div className="focused-conversation-compose">
              <label htmlFor="focused-conversation-draft">Sua resposta {turns + 1} de 3</label>
              <textarea id="focused-conversation-draft" value={draft} onChange={(event) => {
                setDraft(event.target.value);
                setInputMode("text");
              }} rows={2} maxLength={500} />
              <div>
                <ConversationVoiceInput disabled={loading} onTranscript={(text) => {
                  setDraft(text);
                  setInputMode("speech");
                }} />
                <button className="primary-button" type="button" disabled={loading || !draft.trim()} onClick={() => void send()}>
                  <Send size={16} /> {loading ? "Enviando..." : "Responder"}
                </button>
              </div>
              {error && <p className="inline-error" role="alert">{error}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
