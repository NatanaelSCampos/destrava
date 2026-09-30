"use client";

import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import type { GradeResult } from "@/domain/activities/grader";
import { useStudy } from "@/components/study-provider";
import { AudioPlayer } from "./audio-player";

type Exercise = Extract<
  PublicActivity,
  {
    type:
      "multiple_choice" | "true_false" | "fill_blank" | "ordering" | "short_answer" | "listening";
  }
>;

export function ExerciseCard({ activity }: { activity: Exercise }) {
  const { submitAttempt } = useStudy();
  const [answer, setAnswer] = useState("");
  const [ordered, setOrdered] = useState<string[]>([]);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedAnswer = activity.type === "ordering" ? ordered.join(" ") : answer;

  async function submit() {
    if (!selectedAnswer.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id, answer: selectedAnswer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível corrigir agora.");
      const feedback = data as GradeResult;
      setResult(feedback);
      submitAttempt(activity, selectedAnswer, feedback);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível corrigir agora.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setAnswer("");
    setOrdered([]);
    setError("");
  }

  return (
    <div className="exercise-content">
      {activity.type === "listening" && (
        <AudioPlayer text={activity.transcript} media={activity.media} />
      )}
      {(activity.type === "multiple_choice" ||
        activity.type === "listening" ||
        activity.type === "true_false") && (
        <div className="option-list" role="radiogroup" aria-label={activity.prompt}>
          {(activity.type === "true_false"
            ? [
                { value: "true", label: "Verdadeiro" },
                { value: "false", label: "Falso" },
              ]
            : activity.options.map((option) => ({ value: option, label: option }))
          ).map(({ value, label }, index) => (
            <button
              type="button"
              key={value}
              className={`option ${answer === value ? "selected" : ""}`}
              role="radio"
              aria-checked={answer === value}
              disabled={!!result}
              onClick={() => setAnswer(value)}
            >
              <span className="option-letter">{String.fromCharCode(65 + index)}</span>
              <span>{label}</span>
              {answer === value && <Check size={17} />}
            </button>
          ))}
        </div>
      )}
      {(activity.type === "fill_blank" || activity.type === "short_answer") && (
        <div className="field answer-field">
          <label htmlFor={`answer-${activity.id}`}>Sua resposta</label>
          <input
            id={`answer-${activity.id}`}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            disabled={!!result}
            placeholder="Escreva em espanhol…"
            autoComplete="off"
          />
        </div>
      )}
      {activity.type === "ordering" && (
        <div className="ordering-workspace">
          <div className="ordering-answer" aria-live="polite">
            {ordered.length ? (
              ordered.map((word, index) => (
                <button
                  key={`${word}-${index}`}
                  type="button"
                  className="word-chip chosen"
                  disabled={!!result}
                  onClick={() => setOrdered((current) => current.filter((_, i) => i !== index))}
                >
                  {word}
                  <X size={12} />
                </button>
              ))
            ) : (
              <span>Toque nas palavras para montar a frase</span>
            )}
          </div>
          <div className="ordering-words">
            {activity.words.map((word, index) => (
              <button
                key={`${word}-${index}`}
                className="word-chip"
                type="button"
                disabled={!!result || ordered.includes(word)}
                onClick={() => setOrdered((current) => [...current, word])}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      )}
      {!result && (
        <button
          type="button"
          className="primary-button exercise-submit"
          onClick={() => void submit()}
          disabled={!selectedAnswer.trim() || loading}
        >
          {loading ? "Corrigindo…" : "Verificar resposta"}
        </button>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className={`feedback-card ${result.correct ? "correct" : "incorrect"}`} role="status">
          <span className="feedback-icon">
            {result.correct ? <Check size={18} /> : <X size={18} />}
          </span>
          <div>
            <strong>
              {result.correct ? "Muito bem! Resposta correta." : "Ainda não. Vamos ajustar."}
            </strong>
            <p>{result.explanation}</p>
            {!result.correct && (
              <p className="correct-answer">
                Resposta esperada: <strong>{result.correctAnswer}</strong>
              </p>
            )}
            {activity.type === "listening" && result.transcript && (
              <div className="transcript">
                <span>TRANSCRIÇÃO</span>
                <p>{result.transcript}</p>
              </div>
            )}
          </div>
        </div>
      )}
      {result && (
        <button type="button" className="ghost-button retry-button" onClick={reset}>
          <RotateCcw size={15} /> Tentar novamente
        </button>
      )}
    </div>
  );
}
