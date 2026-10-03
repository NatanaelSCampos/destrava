"use client";

import { BookOpen, Check, Clock3 } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import { featureFlags } from "@/lib/feature-flags";
import { ExerciseCard } from "./exercise-card";
import { WritingEditor } from "./writing-editor";
import { SpeakingRecorder } from "./speaking-recorder";
import { SpeakButton } from "@/components/audio/speak-button";

export function ActivityRenderer({ activity }: { activity: PublicActivity }) {
  const { course, language, state, completeActivity } = useStudy();
  const done = state.completedActivityIds.includes(activity.id);
  return (
    <article className="activity-panel panel">
      <div className="activity-top">
        <div>
          <span className="eyebrow">
            <BookOpen size={13} /> ATIVIDADE
          </span>
          <h2>{activity.title}</h2>
          <p>{activity.prompt}</p>
          {language.capabilities.textToSpeech && !(activity.type === "review" && activity.cards.length > 0) && (
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
                  <p>{activity.body}</p>
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
                      {card.structure && <p className="review-card-structure">{card.structure}</p>}
                      <div className="review-card-example">
                        <small>
                          {card.examples.length > 1 ? "EXEMPLOS PARA OUVIR" : "EXEMPLO PARA OUVIR"}
                        </small>
                        {card.examples.map((example) => (
                          <div className="text-audio-row" key={example}>
                            <p lang={course.languageCode}>{example}</p>
                            <SpeakButton text={example} label={`Ouvir exemplo: ${example}`} />
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
              activity.body.split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)
            )}
            {activity.type === "lesson_content" && activity.highlights.length > 0 && (
              <div className="phrase-strip">
                {activity.highlights.map((phrase) => (
                  <span className="phrase-audio-item" key={phrase}>
                    <span lang={course.languageCode}>{phrase}</span>
                    <SpeakButton text={phrase} label={`Ouvir ${phrase}`} />
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
            />
          )
        )}
        {activity.type === "writing" && <WritingEditor key={activity.id} activity={activity} />}
        {activity.type === "speaking" &&
          (featureFlags.SPEAKING && language.capabilities.speechRecognition ? (
            <SpeakingRecorder key={activity.id} activity={activity} />
          ) : (
            <p className="muted">A prática oral está temporariamente indisponível.</p>
          ))}
        {activity.type === "flashcard" && (
          <div className="lesson-body">
            <div className="phrase-strip">
              <span className="phrase-audio-item">
                <span lang={course.languageCode}>{activity.front}</span>
                <SpeakButton text={activity.front} label={`Ouvir ${activity.front}`} />
              </span>
              <span>{activity.back}</span>
            </div>
            <div className="text-audio-row">
              <p lang={course.languageCode}>{activity.example}</p>
              <SpeakButton text={activity.example} label="Ouvir frase de exemplo" />
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
