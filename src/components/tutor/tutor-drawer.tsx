"use client";

import { useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { nextActivity } from "@/domain/study/study-planner";

type TutorFeedback = { answer: string; example: string; quickCheck: string };

export function TutorDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { course, state } = useStudy();
  const [question, setQuestion] = useState("");
  const [feedback, setFeedback] = useState<TutorFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!open) return null;
  const activity = nextActivity(course, state);
  const unit = course.units.find((item) =>
    item.lessons.some((lesson) => lesson.activities.some((entry) => entry.id === activity?.id)),
  );
  const relevantActivityIds = new Set(
    unit?.lessons.flatMap((lesson) => lesson.activities.map((entry) => entry.id)) ?? [],
  );
  const mistakes = Object.values(state.mistakes)
    .filter((item) => relevantActivityIds.has(item.activityId))
    .slice(0, 3)
    .map((item) => ({
      activityId: item.activityId,
      originalAnswer: item.originalAnswer,
      correctAnswer: item.correctAnswer,
    }));

  async function ask() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError("");
    setFeedback(null);
    try {
      const response = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, activityId: activity?.id, mistakes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível responder agora.");
      setFeedback(data.feedback as TutorFeedback);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível responder agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" onClick={onClose} aria-label="Fechar professor IA" />
      <aside className="tutor-drawer" role="dialog" aria-modal="true" aria-labelledby="tutor-title">
        <div className="tutor-header">
          <span className="tutor-avatar">
            <Sparkles size={21} />
          </span>
          <div>
            <strong id="tutor-title">Professor IA</strong>
            <small>Uma ajuda para seguir em frente</small>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="tutor-body">
          <div className="tutor-intro">
            <span className="eyebrow">CONTEXTO DA SUA AULA</span>
            <h2>Em que posso ajudar?</h2>
            <p>Posso explicar uma regra, dar outro exemplo ou ajudar você a entender um erro.</p>
            <div className="tutor-context">
              {course.title} <span>·</span> {unit?.title ?? "Curso"} <span>·</span>{" "}
              {activity?.title ?? "Revisão"}
            </div>
          </div>
          {feedback && (
            <div className="tutor-answer">
              <span className="eyebrow">
                <Sparkles size={13} /> RESPOSTA
              </span>
              <p>{feedback.answer}</p>
              <div>
                <strong>Exemplo</strong>
                <p>{feedback.example}</p>
              </div>
              <div>
                <strong>Para conferir</strong>
                <p>{feedback.quickCheck}</p>
              </div>
            </div>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="tutor-compose">
          <label htmlFor="tutor-question">Sua pergunta</label>
          <textarea
            id="tutor-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Por que aqui é tengo e não soy?"
            rows={3}
            maxLength={500}
          />
          <button
            className="primary-button"
            disabled={!question.trim() || loading}
            onClick={() => void ask()}
          >
            <Send size={16} /> {loading ? "Pensando…" : "Enviar pergunta"}
          </button>
          <small>O professor usa apenas o contexto desta atividade e erros relevantes.</small>
        </div>
      </aside>
    </div>
  );
}
