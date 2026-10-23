"use client";

import { BookOpen, Check, Clock3 } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import { featureFlags } from "@/lib/feature-flags";
import { ExerciseCard } from "./exercise-card";
import { WritingEditor } from "./writing-editor";
import { SpeakingRecorder } from "./speaking-recorder";
import { SpeakButton } from "@/components/audio/speak-button";
import type { GradeResult } from "@/domain/activities/grader";
import type { PronunciationFeedback } from "@/domain/activities/pronunciation";
import { resolveLearningVariant } from "@/engine/variants/resolution";
import { variantLabel } from "@/content/language-variant";
import { LearningText } from "@/components/learning/text-presentation";

export function ActivityRenderer({
  activity,
  onAssessed,
  onSpeakingSaved,
  onWritingSaved,
  onSubmitAnswer,
  onSubmitWriting,
  onSubmitSpeaking,
}: {
  activity: PublicActivity;
  onSubmitAnswer?: (answer: string) => Promise<GradeResult>;
  onSubmitWriting?: (text: string) => Promise<void>;
  onSubmitSpeaking?: (transcription: string, audio: Blob) => Promise<void>;
  onAssessed?: (answer: string, result: GradeResult) => void;
  onWritingSaved?: (text: string) => void;
  onSpeakingSaved?: (result?: {
    submissionId: string;
    transcription: string;
    feedback?: PronunciationFeedback;
  }) => void;
}) {
  const { course, language, state, completeActivity } = useStudy();
  const done = state.completedActivityIds.includes(activity.id);
  const variant = resolveLearningVariant(
    language,
    course,
    state.profile.variantId,
    activity.variant,
  );
  if (variant.status === "invalid")
    return (
      <article className="activity-panel panel" role="status">
        <h2>{activity.title}</h2>
        <p>
          Esta atividade exige uma variante que não está selecionada ou possui configuração
          inválida. Confira suas preferências. Nenhuma resposta foi avaliada.
        </p>
      </article>
    );
  if (course.availability?.unavailableActivityIds.includes(activity.id))
    return (
      <article className="activity-panel panel" aria-label={activity.title}>
        <div className="activity-top">
          <div>
            <span className="eyebrow">ATIVIDADE INDISPONÍVEL</span>
            <h2>{activity.title}</h2>
          </div>
        </div>
        <div className="activity-main" role="status">
          <p>
            {course.availability.reasons?.[activity.id]?.[0] ??
              "Esta atividade está temporariamente indisponível."}
          </p>
          <p className="muted">
            A atividade continua no curso. Esta indisponibilidade não conta como erro nem como
            conclusão.
          </p>
        </div>
      </article>
    );
  return (
    <article className="activity-panel panel">
      <div className="activity-top">
        <div>
          <span className="eyebrow">
            <BookOpen size={13} /> ATIVIDADE
          </span>
          <LearningText
            as="h2"
            presentation={activity.presentation}
            field="title"
            textRole="source"
            text={activity.title}
          />
          <LearningText
            as="p"
            presentation={activity.presentation}
            field="prompt"
            textRole="source"
            text={activity.prompt}
          />
          {activity.variant?.requiredVariant && (
            <small>
              Esta atividade usa {variantLabel(language, variant.variantId, course)}. Sua
              preferência geral permanece salva.
            </small>
          )}
          {variant.diagnostics.length > 0 && (
            <p role="status">
              {variant.diagnostics.some((d) => d.code === "PREFERENCE_CONFLICT")
                ? "A variante exigida pela atividade prevalece nesta prática."
                : "Sua preferência não é aceita neste curso. Usando o padrão do curso; revise em Configurações."}
            </p>
          )}
          {language.speech.support.textToSpeech &&
            !(activity.type === "review" && activity.cards.length > 0) && (
              <small className="audio-selection-hint">
                Selecione uma palavra ou frase para ouvir.
              </small>
            )}
        </div>
        <span className="activity-time">
          <Clock3 size={14} /> {activity.minutes} min
        </span>
      </div>
      <div className="activity-main">
        {(activity.type === "lesson_content" ||
          activity.type === "review" ||
          activity.type === "quiz") && (
          <div className="lesson-body">
            {activity.type === "review" && activity.cards.length > 0 ? (
              <div className="review-guide">
                <div className="review-guide-intro">
                  <span className="eyebrow">COMO FAZER</span>
                  <LearningText
                    as="p"
                    presentation={activity.presentation}
                    field="body"
                    textRole="source"
                    text={activity.body}
                  />
                  <ol>
                    {activity.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div className="review-card-grid">
                  {activity.cards.map((card, index) => (
                    <section className="review-card" key={card.label}>
                      <div className="review-card-heading">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <h3>{card.label}</h3>
                      </div>
                      {card.structure && (
                        <LearningText
                          as="p"
                          className="review-card-structure"
                          presentation={activity.presentation}
                          text={card.structure}
                        />
                      )}
                      <div className="review-card-example">
                        <small>
                          {card.examples.length > 1 ? "EXEMPLOS PARA OUVIR" : "EXEMPLO PARA OUVIR"}
                        </small>
                        {card.examples.map((example) => (
                          <div className="text-audio-row" key={example}>
                            <LearningText
                              as="p"
                              presentation={activity.presentation}
                              field="example"
                              text={example}
                            />
                            <SpeakButton
                              variant={activity.variant}
                              text={example}
                              label={`Ouvir exemplo: ${example}`}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="review-card-practice">
                        <strong>Sua vez:</strong> {card.practice}
                      </p>
                    </section>
                  ))}
                </div>
                <p className="review-guide-finish">
                  Conseguiu falar três frases e fazer uma pergunta sem olhar? Marque a revisão como
                  feita e siga para a próxima atividade.
                </p>
              </div>
            ) : (
              activity.body
                .split("\n\n")
                .map((paragraph, index) => (
                  <LearningText
                    as="p"
                    key={index}
                    presentation={activity.presentation}
                    field="body"
                    textRole="source"
                    text={paragraph}
                  />
                ))
            )}
            {activity.type === "lesson_content" && activity.highlights.length > 0 && (
              <div className="phrase-strip">
                {activity.highlights.map((phrase) => (
                  <span className="phrase-audio-item" key={phrase}>
                    <LearningText
                      as="span"
                      presentation={activity.presentation}
                      field="highlights"
                      text={phrase}
                    />
                    <SpeakButton
                      variant={activity.variant}
                      text={phrase}
                      label={`Ouvir ${phrase}`}
                    />
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              className={done ? "secondary-button" : "primary-button"}
              onClick={() => completeActivity(activity.id)}
            >
              <Check size={16} />{" "}
              {done
                ? activity.type === "review"
                  ? "Revisão concluída"
                  : "Conteúdo concluído"
                : activity.type === "review"
                  ? "Concluí a revisão"
                  : "Marcar como estudado"}
            </button>
          </div>
        )}
        {activity.type === "listening" && !featureFlags.LISTENING ? (
          <p className="muted">A atividade de escuta está temporariamente indisponível.</p>
        ) : (
          (
            [
              "multiple_choice",
              "true_false",
              "fill_blank",
              "ordering",
              "short_answer",
              "listening",
            ] as string[]
          ).includes(activity.type) && (
            <ExerciseCard
              key={activity.id}
              activity={activity as Parameters<typeof ExerciseCard>[0]["activity"]}
              onAssessed={onAssessed}
              onSubmitAnswer={onSubmitAnswer}
            />
          )
        )}
        {activity.type === "writing" && (
          <WritingEditor key={activity.id} activity={activity} onSaved={onWritingSaved} onSubmitWriting={onSubmitWriting} />
        )}
        {activity.type === "speaking" &&
          (featureFlags.SPEAKING ? (
            <SpeakingRecorder key={activity.id} activity={activity} onSaved={onSpeakingSaved} onSubmitSpeaking={onSubmitSpeaking} />
          ) : (
            <p className="muted">A prática oral está temporariamente indisponível.</p>
          ))}
        {activity.type === "flashcard" && (
          <div className="lesson-body">
            <div className="phrase-strip">
              <span className="phrase-audio-item">
                <LearningText
                  as="span"
                  presentation={activity.presentation}
                  field="front"
                  text={activity.front}
                />
                <SpeakButton
                  variant={activity.variant}
                  text={activity.front}
                  label={`Ouvir ${activity.front}`}
                />
              </span>
              <LearningText
                as="span"
                presentation={activity.presentation}
                field="back"
                textRole="source"
                text={activity.back}
              />
            </div>
            <div className="text-audio-row">
              <LearningText
                as="p"
                presentation={activity.presentation}
                field="example"
                text={activity.example}
              />
              <SpeakButton
                variant={activity.variant}
                text={activity.example}
                label="Ouvir frase de exemplo"
              />
            </div>
            <button className="primary-button" onClick={() => completeActivity(activity.id)}>
              Concluir flashcard
            </button>
          </div>
        )}
      </div>
      {activity.source && (
        <div className="activity-source">
          Base pedagógica:{" "}
          {activity.source.book === "student" ? "Livro do estudante" : "Livro de exercícios"}, p.{" "}
          {activity.source.pages}. Conteúdo desta atividade é original.
        </div>
      )}
    </article>
  );
}
