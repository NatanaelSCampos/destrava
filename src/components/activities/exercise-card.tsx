"use client";

import { presentationLanguage } from "@/engine/presentation/language";
import { PracticeConversation } from "./practice-conversation";
import { useState } from "react";
import { useResponseDraft } from "./use-response-draft";
import { Check, ListChecks, RotateCcw, X } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import type { GradeResult } from "@/domain/activities/grader";
import { useStudy } from "@/components/study-provider";
import { AudioPlayer } from "./audio-player";
import { SpeakButton } from "@/components/audio/speak-button";
import { orderingTokens, selectedTokens, orderingAnswer } from "@/engine/text/representation";
import {
  LearningText,
  LearningInput,
  useTextPresentation,
} from "@/components/learning/text-presentation";

type Exercise = Extract<
  PublicActivity,
  {
    type:
      "multiple_choice" | "true_false" | "fill_blank" | "ordering" | "short_answer" | "listening";
  }
>;

export function ExerciseCard({
  activity,
  onAssessed,
  conversation = false,
  onSubmitAnswer,
  onRecordAnswer,
  answerDraftScope,
}: {
  activity: Exercise;
  answerDraftScope?: string;
  onRecordAnswer?: (answer: string) => void;
  conversation?: boolean;
  onSubmitAnswer?: (answer: string) => Promise<GradeResult>;
  onAssessed?: (answer: string, result: GradeResult) => void;
}) {
  const { language, assessActivity } = useStudy();
  const {
    value: draft,
    update: updateDraft,
    reloadSafe,
  } = useResponseDraft(activity.id + (answerDraftScope ? ":attempt:" + answerDraftScope : ""));
  const answer = draft.answer ?? "";
  const ordered = draft.ordered ?? [];
  const setAnswer = (text: string) => updateDraft({ answer: text });
  const setOrdered = (next: string[] | ((current: string[]) => string[])) =>
    updateDraft((current) => ({
      ordered: typeof next === "function" ? next(current.ordered ?? []) : next,
    }));
  const [recorded, setRecorded] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);
  const textAttributes = useTextPresentation(activity.presentation);
  const optionsLanguage = textAttributes("options").lang.split("-")[0].toLowerCase();
  const targetLanguage = presentationLanguage(language).split("-")[0].toLowerCase();
  const targetOptions = optionsLanguage === targetLanguage;
  const tokens = activity.type === "ordering" ? orderingTokens(activity.id, activity.words) : [];
  const selected = selectedTokens(tokens, ordered);
  const selectedAnswer =
    activity.type === "ordering"
      ? orderingAnswer(tokens, ordered, activity.reconstruction)
      : answer;

  async function submit() {
    if (!selectedAnswer.trim() || loading || composing) return;
    if (onRecordAnswer) {
      onRecordAnswer(selectedAnswer);
      setRecorded(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const feedback = onSubmitAnswer
        ? await onSubmitAnswer(selectedAnswer)
        : await assessActivity(activity, selectedAnswer, onAssessed);
      if (onSubmitAnswer) onAssessed?.(selectedAnswer, feedback);
      setResult(feedback);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível corrigir agora.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setRecorded(false);
    setResult(null);
    setAnswer("");
    setOrdered([]);
    setError("");
  }

  const content = (
    <div className="exercise-content">
      {!reloadSafe && (
        <p role="status">
          O navegador bloqueou o rascunho local. Mantenha esta página aberta até enviar sua
          resposta.
        </p>
      )}
      {activity.type === "listening" && (
        <AudioPlayer variant={activity.variant} text={activity.transcript} media={activity.media} />
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
            <div className="option-row" key={value}>
              <button
                type="button"
                className={`option ${answer === value ? "selected" : ""}`}
                role="radio"
                aria-checked={answer === value}
                disabled={!!result || recorded}
                onClick={() => setAnswer(value)}
              >
                <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                <LearningText
                  as="span"
                  presentation={activity.presentation}
                  field="options"
                  itemIndex={index}
                  textRole={
                    activity.type === "true_false"
                      ? "interface"
                      : targetOptions
                        ? "target"
                        : "source"
                  }
                  text={label}
                />
                {answer === value && <Check size={17} />}
              </button>
              {!onRecordAnswer && activity.type !== "true_false" && targetOptions && (
                <SpeakButton variant={activity.variant} text={label} label={`Ouvir ${label}`} />
              )}
            </div>
          ))}
        </div>
      )}
      {(activity.type === "fill_blank" || activity.type === "short_answer") && (
        <div className="field answer-field">
          <label htmlFor={`answer-${activity.id}`}>
            {activity.type === "fill_blank" ? "Complete a lacuna" : "Sua resposta"}
          </label>
          <LearningInput
            presentation={activity.presentation}
            onCompositionChange={setComposing}
            id={`answer-${activity.id}`}
            aria-describedby={
              activity.type === "fill_blank" ? `answer-help-${activity.id}` : undefined
            }
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            disabled={!!result || recorded}
            placeholder={
              activity.type === "fill_blank"
                ? "Digite o trecho que falta…"
                : `Escreva a resposta em ${language.identity.nativeName}…`
            }
            autoComplete="off"
          />
          {activity.type === "fill_blank" && (
            <small className="answer-guidance" id={`answer-help-${activity.id}`}>
              Digite só o trecho que falta. Se a lacuna estiver em uma frase, você também pode
              escrever a frase completa.
            </small>
          )}
        </div>
      )}
      {activity.type === "ordering" && (
        <div className="ordering-workspace">
          <div className="ordering-answer" {...textAttributes("answer")} aria-live="polite">
            {ordered.length ? (
              selected.map((token) => (
                <button
                  key={token.id}
                  data-token-id={token.id}
                  type="button"
                  className="word-chip chosen"
                  disabled={!!result || recorded}
                  onClick={() => setOrdered((current) => current.filter((id) => id !== token.id))}
                >
                  <LearningText
                    presentation={activity.presentation}
                    field="tokens"
                    itemIndex={token.position}
                    textRole="fragment"
                    text={token.text}
                  />
                  <X size={12} />
                </button>
              ))
            ) : (
              <span lang="pt-BR" dir="ltr">
                Toque nas palavras para montar a frase
              </span>
            )}
          </div>
          {!onRecordAnswer && ordered.length > 0 && (
            <SpeakButton
              variant={activity.variant}
              text={selectedAnswer}
              label="Ouvir frase montada"
              withLabel
            />
          )}
          <div className="ordering-words" {...textAttributes("tokens")}>
            {tokens.map((token) => (
              <span className="ordering-word-audio" key={token.id}>
                <button
                  className="word-chip"
                  type="button"
                  data-token-id={token.id}
                  disabled={!!result || recorded || ordered.includes(token.id)}
                  onClick={() => setOrdered((current) => [...current, token.id])}
                >
                  <LearningText
                    presentation={activity.presentation}
                    field="tokens"
                    itemIndex={token.position}
                    textRole="fragment"
                    text={token.text}
                  />
                </button>
                {!onRecordAnswer && (
                  <SpeakButton
                    variant={activity.variant}
                    text={token.text}
                    label={`Ouvir ${token.text}`}
                  />
                )}
              </span>
            ))}
          </div>
        </div>
      )}
      {!result && !recorded && (
        <button
          type="button"
          className="primary-button exercise-submit"
          onClick={() => void submit()}
          disabled={!selectedAnswer.trim() || loading || composing}
        >
          {loading ? "Corrigindo…" : onRecordAnswer ? "Confirmar resposta" : "Verificar resposta"}
        </button>
      )}
      {recorded && (
        <div className="assessment-answer-recorded" role="status">
          <Check size={18} /> Resposta pronta. O resultado aparece ao terminar a prova.
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {result && (!onAssessed || onSubmitAnswer) && (
        <div className={`feedback-card ${result.correct ? "correct" : "incorrect"}`} role="status">
          <span className="feedback-icon">
            {result.correct ? <Check size={18} /> : <X size={18} />}
          </span>
          <div>
            <strong>
              <LearningText
                as="span"
                presentation={result.presentation ?? activity.presentation}
                field="feedbackSummary"
                textRole="source"
                text={
                  result.feedback?.summary ??
                  (result.correct ? "Muito bem! Resposta correta." : "Ainda não. Vamos ajustar.")
                }
              />
            </strong>
            <LearningText
              as="p"
              presentation={result.presentation ?? activity.presentation}
              field={
                result.presentation
                  ? result.feedback?.detail
                    ? "feedback"
                    : "explanation"
                  : "feedback"
              }
              textRole="source"
              text={result.feedback?.detail ?? result.explanation}
            />
            {result.feedback && result.feedback.alternatives.length > 0 && (
              <section className="feedback-comparison" aria-label="Comparação das alternativas">
                <h3>
                  <ListChecks size={18} aria-hidden="true" /> Compare as alternativas
                </h3>
                <ul className="feedback-alternative-list">
                  {result.feedback.alternatives.map((item, index) => {
                    const optionIndex =
                      "options" in activity ? activity.options.indexOf(item.answer) : index;
                    const chosen = item.answer === selectedAnswer;
                    return (
                      <li
                        key={item.answer}
                        className={"feedback-alternative" + (chosen ? " chosen" : "")}
                      >
                        <div className="feedback-alternative-heading">
                          <span className="feedback-alternative-letter" aria-hidden="true">
                            {optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) : index + 1}
                          </span>
                          <LearningText
                            as="strong"
                            presentation={activity.presentation}
                            field="options"
                            itemIndex={optionIndex}
                            text={item.answer}
                          />
                        </div>
                        {chosen && <span className="feedback-choice-label">Sua escolha</span>}
                        <LearningText
                          as="p"
                          presentation={result.presentation ?? activity.presentation}
                          field="feedbackAlternative"
                          itemIndex={index}
                          textRole="source"
                          text={item.detail}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {!result.correct && (
              <>
                <p className="correct-answer">
                  {activity.type === "fill_blank" ? "Trecho esperado: " : "Resposta esperada: "}
                  <LearningText
                    as="strong"
                    presentation={result.presentation ?? activity.presentation}
                    field="answer"
                    text={result.correctAnswer}
                  />
                  {targetOptions && (
                    <SpeakButton
                      variant={activity.variant}
                      text={result.correctAnswer}
                      label="Ouvir resposta esperada"
                    />
                  )}
                </p>
                {activity.type === "fill_blank" && result.completeAnswer && (
                  <p className="correct-answer">
                    Frase completa:{" "}
                    <LearningText
                      as="strong"
                      presentation={
                        result.presentation
                          ? { ...result.presentation, annotations: undefined }
                          : activity.presentation
                      }
                      field="answer"
                      text={result.completeAnswer}
                    />
                    <SpeakButton
                      variant={activity.variant}
                      text={result.completeAnswer}
                      label="Ouvir frase completa"
                    />
                  </p>
                )}
              </>
            )}
            {activity.type === "listening" && result.transcript && (
              <div className="transcript">
                <span>TRANSCRIÇÃO</span>
                <div className="text-audio-row">
                  <LearningText
                    as="p"
                    presentation={result.presentation ?? activity.presentation}
                    field="transcript"
                    text={result.transcript}
                  />
                  <SpeakButton
                    variant={activity.variant}
                    text={result.transcript}
                    label="Ouvir transcrição"
                  />
                </div>
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
  return conversation || activity.scene ? (
    <PracticeConversation activity={activity}>{content}</PracticeConversation>
  ) : (
    content
  );
}
