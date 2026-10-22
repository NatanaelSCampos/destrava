"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import { featureFlags } from "@/lib/feature-flags";
import { SpeakButton } from "@/components/audio/speak-button";
import { evaluateWritingText, textMeasureLabel } from "@/engine/text/representation";
import { LearningText, LearningTextarea } from "@/components/learning/text-presentation";

type Writing = Extract<PublicActivity, { type: "writing" }>;
type WritingFeedback = {
  correctedText: string;
  errors: Array<{ excerpt: string; correction: string; explanation: string }>;
  naturalness: string[];
  optionalSuggestions: string[];
  score: { grammar: number; vocabulary: number; clarity: number };
};

export function WritingEditor({
  activity,
  onSaved,
}: {
  activity: Writing;
  onSaved?: (text: string) => void;
}) {
  const { course, language, state, saveWriting, runtime } = useStudy();
  const previous = state.writing.find((submission) => submission.activityId === activity.id);
  const [text, setText] = useState(previous?.text ?? "");
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);
  let measurement: ReturnType<typeof evaluateWritingText> | undefined;
  let measureError = "";
  try {
    measurement = evaluateWritingText(text, activity);
  } catch {
    measureError = "A estratégia de medida desta atividade não está disponível neste navegador.";
  }
  const canSubmit = measurement?.accepted === true && !composing;

  function save() {
    if (!canSubmit) return;
    saveWriting(activity.id, text);
    setSaved(true);
    onSaved?.(text);
  }
  async function correct() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, activityId: activity.id, text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível corrigir agora.");
      setFeedback(data.feedback as WritingFeedback);
      saveWriting(activity.id, text, data.feedback);
      setSaved(true);
      onSaved?.(text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível corrigir agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="writing-editor">
      <div className="guidance-box">
        <strong>Para escrever</strong>
        <ul>
          {activity.guidance.map((item) => (
            <LearningText
              as="li"
              key={item}
              presentation={activity.presentation}
              field="guidance"
              textRole="source"
              text={item}
            />
          ))}
        </ul>
      </div>
      <div className="field">
        <label htmlFor={`writing-${activity.id}`}>{activity.title}</label>
        <LearningTextarea
          presentation={activity.presentation}
          onCompositionChange={setComposing}
          id={`writing-${activity.id}`}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSaved(false);
          }}
          placeholder="Escreva seu texto aqui…"
          rows={8}
          maxLength={3000}
        />
      </div>
      {text.trim() && (
        <SpeakButton
          variant={activity.variant}
          text={text}
          label={`Ouvir seu texto em ${language.identity.nativeName}`}
          withLabel
        />
      )}
      <div className="writing-footer">
        <span className={canSubmit ? "word-count-ok" : "muted"} role="status">
          {measurement
            ? `${measurement.count} ${activity.textRequirement ? textMeasureLabel(measurement.requirement.measure) : "palavras"} · mínimo ${measurement.requirement.minimum}${measurement.requirement.maximum === undefined ? "" : ` · máximo ${measurement.requirement.maximum}`}`
            : measureError}
        </span>
        <div>
          <button type="button" className="secondary-button" disabled={!canSubmit} onClick={save}>
            <Check size={16} /> Salvar texto
          </button>
          {featureFlags.AI_WRITING && !runtime && (
            <button
              type="button"
              className="primary-button"
              disabled={!canSubmit || loading}
              onClick={() => void correct()}
            >
              <Sparkles size={16} /> {loading ? "Corrigindo…" : "Corrigir com IA"}
            </button>
          )}
        </div>
      </div>
      {saved && (
        <p className="inline-success" role="status">
          Seu texto foi salvo no histórico.
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {feedback && (
        <div className="writing-feedback">
          <div className="section-head">
            <div>
              <span className="eyebrow">FEEDBACK DE ESCRITA</span>
              <h3 className="section-title">Sua versão revisada</h3>
            </div>
            <span className="pill">Gramática {feedback.score.grammar}/100</span>
          </div>
          <div className="text-audio-row">
            <LearningText
              as="p"
              className="corrected-text"
              presentation={activity.presentation}
              field="answer"
              text={feedback.correctedText}
            />
            <SpeakButton
              variant={activity.variant}
              text={feedback.correctedText}
              label="Ouvir texto revisado"
              withLabel
            />
          </div>
          <div className="feedback-columns">
            <div>
              <h4>Erros reais</h4>
              {feedback.errors.length ? (
                feedback.errors.map((item, index) => (
                  <p key={index}>
                    <strong>
                      <LearningText
                        presentation={activity.presentation}
                        textRole="fragment"
                        text={item.excerpt}
                      />
                      {" → "}
                      <LearningText
                        presentation={activity.presentation}
                        textRole="fragment"
                        text={item.correction}
                      />
                    </strong>
                    <SpeakButton
                      variant={activity.variant}
                      text={item.correction}
                      label="Ouvir correção"
                    />
                    <br />
                    {item.explanation}
                  </p>
                ))
              ) : (
                <p>Nenhum erro gramatical identificado.</p>
              )}
            </div>
            <div>
              <h4>Mais natural</h4>
              {feedback.naturalness.length ? (
                feedback.naturalness.map((item, index) => <p key={index}>{item}</p>)
              ) : (
                <p>Seu texto já soa natural para este nível.</p>
              )}
              <h4>Sugestões opcionais</h4>
              {feedback.optionalSuggestions.map((item, index) => (
                <p key={index}>{item}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
