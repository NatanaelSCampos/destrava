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
  const { state, completeActivity } = useStudy();
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
          <small className="audio-selection-hint">Selecione uma palavra ou frase para ouvir.</small>
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
            {activity.body.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {activity.type === "lesson_content" && activity.highlights.length > 0 && (
              <div className="phrase-strip">
                {activity.highlights.map((phrase) => (
                  <span className="phrase-audio-item" key={phrase}>
                    <span lang="es">{phrase}</span>
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
              <Check size={16} /> {done ? "Conteúdo concluído" : "Marcar como estudado"}
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
          (featureFlags.SPEAKING ? (
            <SpeakingRecorder key={activity.id} activity={activity} />
          ) : (
            <p className="muted">A prática oral está temporariamente indisponível.</p>
          ))}
        {activity.type === "flashcard" && (
          <div className="lesson-body">
            <div className="phrase-strip">
              <span className="phrase-audio-item">
                <span lang="es">{activity.front}</span>
                <SpeakButton text={activity.front} label={`Ouvir ${activity.front}`} />
              </span>
              <span>{activity.back}</span>
            </div>
            <div className="text-audio-row">
              <p lang="es">{activity.example}</p>
              <SpeakButton text={activity.example} label="Ouvir frase de exemplo" />
            </div>
            <button className="primary-button" onClick={() => completeActivity(activity.id)}>
              Concluir flashcard
            </button>
          </div>
        )}
        {activity.type === "matching" && (
          <p className="muted">Esta atividade ficará disponível na próxima atualização.</p>
        )}
      </div>
      {activity.source && (
        <div className="activity-source">
          Base pedagógica:{" "}
          {activity.source.book === "student" ? "Libro del estudiante" : "Libro de ejercicios"}, p.{" "}
          {activity.source.pages}. Conteúdo desta atividade é original.
        </div>
      )}
    </article>
  );
}
