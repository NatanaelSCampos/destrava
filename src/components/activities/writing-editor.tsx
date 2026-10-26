"use client";

import { useState } from "react";
import { useResponseDraft } from "./use-response-draft";
import { PracticeConversation } from "./practice-conversation";
import { Check, Sparkles, PenLine, Lightbulb, MessageSquareText } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import { featureFlags } from "@/lib/feature-flags";
import { SpeakButton } from "@/components/audio/speak-button";
import { evaluateWritingText } from "@/engine/text/representation";
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
  onSubmitWriting,
  draft,
}: {
  activity: Writing;
  draft?: { text: string; onChange: (text: string) => void };
  onSubmitWriting?: (text: string) => Promise<void>;
  onSaved?: (text: string) => void;
}) {
  const { course, language, state, saveWriting, runtime } = useStudy();
  const previous = state.writing.find((submission) => submission.activityId === activity.id);
  const { value: responseDraft, update: updateResponseDraft, reloadSafe } = useResponseDraft(activity.id);
  const text = responseDraft.writing ?? draft?.text ?? previous?.text ?? "";
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

  async function save() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      if (onSubmitWriting) await onSubmitWriting(text);
      else saveWriting(activity.id, text);
      setSaved(true);
      onSaved?.(text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o texto.");
    } finally { setLoading(false); }
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
      if (onSubmitWriting) await onSubmitWriting(text);
      else saveWriting(activity.id, text, data.feedback);
      setSaved(true);
      onSaved?.(text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível corrigir agora.");
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <div className="writing-editor">
      {!reloadSafe && <p role="status">O navegador bloqueou o rascunho local. Mantenha esta página aberta até salvar seu texto.</p>}
      <div className={"writing-workspace" + (activity.guidance.length ? " has-guidance" : "")}>
        <div className="writing-compose">
          <div className="field">
            <label htmlFor={`writing-${activity.id}`}>
              <MessageSquareText size={18} aria-hidden="true" />
              {activity.scene ? "Sua mensagem" : activity.title}
            </label>
            <LearningTextarea
              presentation={activity.presentation}
              onCompositionChange={setComposing}
              id={`writing-${activity.id}`}
              value={text}
              onChange={(event) => {
                updateResponseDraft({ writing: event.target.value });
                draft?.onChange(event.target.value);
                setSaved(false);
              }}
              placeholder="Escreva sua mensagem aqui…"
              rows={6}
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
                ? `${measurement.count} ${activity.textRequirement ? (["graphemes", "code_points"].includes(measurement.requirement.measure.strategy) ? "caracteres" : "palavras") : "palavras"} · mínimo ${measurement.requirement.minimum}${measurement.requirement.maximum === undefined ? "" : ` · máximo ${measurement.requirement.maximum}`}`
                : measureError}
            </span>
            <div>
              <button type="button" className={activity.scene ? "primary-button" : "secondary-button"} disabled={!canSubmit || loading} onClick={() => void save()}>
                <Check size={16} aria-hidden="true" /> Salvar texto
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
        </div>
        {activity.guidance.length > 0 && (
          <aside className="writing-guidance" aria-label="Orientações para escrever">
            <div className="writing-guidance-heading">
              <span><Lightbulb size={19} aria-hidden="true" /></span>
              <strong>Para ajudar</strong>
            </div>
            <ul>
              {activity.guidance.map((item, index) => (
                <li key={item}>
                  <span className="writing-guidance-marker" aria-hidden="true"><PenLine size={14} /></span>
                  <LearningText
                    className="writing-guidance-copy"
                    presentation={activity.presentation}
                    field="guidance"
                    itemIndex={index}
                    textRole="source"
                    text={item}
                  />
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      {saved && (
        <p className="inline-success" role="status">
          Seu texto foi salvo no histórico.{!feedback && " Esta entrega não recebe nota de qualidade linguística."}
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
  return activity.scene ? <PracticeConversation activity={activity}>{content}</PracticeConversation> : content;
}
