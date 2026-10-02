"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mic2, Volume2 } from "lucide-react";
import { SpeakingRecorder } from "@/components/activities/speaking-recorder";
import { useStudy } from "@/components/study-provider";
import type { PublicActivity } from "@/content/public";
import { formatDate } from "@/lib/utils";

type Speaking = Extract<PublicActivity, { type: "speaking" }>;
type PracticeMode = "shadowing" | "without-text";
const stages = [
  { title: "1. Imitar", detail: "Ouça, leia e repita." },
  { title: "2. Memória", detail: "Ouça sem ver o texto." },
  { title: "3. Sua voz", detail: "Fale sobre você." },
];

export default function SpeakingPracticePage() {
  const { course, state } = useStudy();
  const activities = useMemo(
    () =>
      course.units.flatMap((unit) =>
        unit.lessons.flatMap((lesson) =>
          lesson.activities.filter(
            (activity): activity is Speaking =>
              activity.type === "speaking" && Boolean(activity.referenceText),
          ),
        ),
      ),
    [course],
  );
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");
  const [mode, setMode] = useState<PracticeMode>("shadowing");
  const [stage, setStage] = useState(0);
  const [completed, setCompleted] = useState([false, false, false]);
  const activity = activities.find((entry) => entry.id === activityId) ?? activities[0];
  const attempts = state.speaking
    .filter((item) => item.activityId === activity?.id && item.feedback)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ownAttempts = state.speaking
    .filter((item) => item.activityId === activity?.id && item.practiceMode === "own")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = attempts[0]?.feedback;
  const weakWords =
    latest?.words.filter(
      (word) => word.errorType !== "None" || (word.accuracy !== null && word.accuracy < 75),
    ) ?? [];
  const practiceMode =
    mode === "shadowing" || stage === 0 ? "shadowing" : stage === 1 ? "memory" : "own";

  return (
    <div className="speaking-practice-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <Mic2 size={13} /> PRÁTICA ORAL
          </span>
          <h1 className="page-title">Ouça. Repita. Fale por você.</h1>
          <p className="page-subtitle">
            Treine uma frase com avaliação de pronúncia e avance até conseguir falar sem ler.
          </p>
        </div>
        <Link href="/history" className="secondary-button">
          Ver meu histórico <ArrowRight size={16} />
        </Link>
      </div>
      {!activity ? (
        <div className="empty-state panel">
          <Mic2 size={28} />
          <strong>Ainda não há frases de fala neste curso.</strong>
          <span>As atividades com frase de referência aparecerão aqui.</span>
        </div>
      ) : (
        <>
          <div className="speaking-practice-options panel">
            <div className="study-option-list" role="tablist" aria-label="Modo de prática oral">
              <button
                role="tab"
                aria-selected={mode === "shadowing"}
                className={mode === "shadowing" ? "active" : ""}
                onClick={() => setMode("shadowing")}
              >
                Shadowing
              </button>
              <button
                role="tab"
                aria-selected={mode === "without-text"}
                className={mode === "without-text" ? "active" : ""}
                onClick={() => setMode("without-text")}
              >
                Fale sem ler
              </button>
            </div>
            {activities.length > 1 && (
              <label>
                Escolha uma frase
                <select
                  value={activity.id}
                  onChange={(event) => {
                    setActivityId(event.target.value);
                    setStage(0);
                    setCompleted([false, false, false]);
                  }}
                >
                  {activities.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {mode === "without-text" && (
            <ol className="speaking-stages">
              {stages.map((item, index) => (
                <li
                  key={item.title}
                  className={index === stage ? "active" : completed[index] ? "done" : ""}
                >
                  <button
                    disabled={index > 0 && !completed[index - 1]}
                    onClick={() => setStage(index)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="speaking-practice-grid">
            <section className="panel speaking-practice-work">
              <span className="eyebrow">
                {mode === "shadowing" ? "SHADOWING" : stages[stage].title.toUpperCase()}
              </span>
              <h2>
                {mode === "shadowing" ? "Repita e compare cada tentativa" : stages[stage].detail}
              </h2>
              <SpeakingRecorder
                key={mode + "-" + stage + "-" + activity.id}
                activity={activity}
                practiceMode={practiceMode}
                showReference={stage === 0 || mode === "shadowing"}
                onSaved={() =>
                  setCompleted((current) =>
                    current.map((value, index) => (index === stage ? true : value)),
                  )
                }
              />
              {mode === "without-text" && stage < 2 && completed[stage] && (
                <button
                  className="primary-button speaking-next-stage"
                  onClick={() => setStage(stage + 1)}
                >
                  Ir para a próxima etapa <ArrowRight size={16} />
                </button>
              )}
              {mode === "without-text" && stage === 2 && completed[2] && (
                <p className="inline-success">
                  Você completou as três etapas. Pode repetir com outra frase quando quiser.
                </p>
              )}
            </section>
            <aside className="panel speaking-practice-history">
              <span className="eyebrow">
                <Volume2 size={13} /> SUA EVOLUÇÃO
              </span>
              <h2>Clareza por tentativa</h2>
              {attempts.length ? (
                <>
                  <ol>
                    {attempts.slice(0, 6).map((attempt) => (
                      <li key={attempt.id}>
                        <time dateTime={attempt.createdAt}>{formatDate(attempt.createdAt)}</time>
                        <span className="speaking-history-mode">
                          {attempt.practiceMode === "memory"
                            ? "Sem texto"
                            : attempt.practiceMode === "shadowing"
                              ? "Com texto"
                              : "Lição"}
                        </span>
                        <span className="progress-track">
                          <i style={{ width: `${Math.round(attempt.feedback!.accuracy)}%` }} />
                        </span>
                        <strong>{Math.round(attempt.feedback!.accuracy)}</strong>
                      </li>
                    ))}
                  </ol>
                  {weakWords.length > 0 && (
                    <div className="speaking-weak-words">
                      <strong>Repita com atenção</strong>
                      <p lang={course.languageCode}>
                        {weakWords.map((word) => word.text).join(" · ")}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p>Grave, avalie e salve uma tentativa para ver a evolução.</p>
              )}
              {ownAttempts.length > 0 && (
                <div className="speaking-own-history">
                  <strong>Produção própria</strong>
                  {ownAttempts.slice(0, 3).map((attempt) => (
                    <p key={attempt.id}>
                      <time dateTime={attempt.createdAt}>{formatDate(attempt.createdAt)}</time>
                      <span lang={course.languageCode}>{attempt.transcription}</span>
                    </p>
                  ))}
                </div>
              )}
              <small>
                As notas mostram indicadores da gravação. A produção própria é salva sem nota
                automática.
              </small>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
