"use client";

import { useState } from "react";
import type { FixedAssessmentDefinition } from "@/content/contracts";
import type { AssessmentResponse } from "@/content/assessment-results";
import { useStudy } from "@/components/study-provider";
import { ActivityRenderer } from "./activity-renderer";
import { AssessmentResult } from "./assessment-result";
import { assessmentPurposeLabels } from "@/content/assessment-references";

export function FixedAssessmentRunner({ assessment }: { assessment: FixedAssessmentDefinition }) {
  const { course, submitAssessment } = useStudy();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID());
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<AssessmentResponse[]>([]);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activities = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) =>
        lesson.activities.map((activity) => [activity.id, activity] as const),
      ),
    ),
  );
  const current = activities.get(assessment.activityIds[index]);
  if (assessment.activityIds.some((id) => !activities.has(id)))
    return (
      <div className="empty-state">Uma atividade exigida por esta avaliação está indisponível.</div>
    );
  function begin() {
    setStartedAt(new Date().toISOString());
    setAttemptId(crypto.randomUUID());
    setResponses([]);
    setIndex(0);
    setAnswered(false);
    setFinished(false);
    setError("");
  }
  function assessed(answer: string) {
    if (!current || answered) return;
    setResponses((items) => [
      ...items.filter((item) => item.activityId !== current.id),
      { activityId: current.id, answer },
    ]);
    setAnswered(true);
  }
  async function finish() {
    if (!startedAt || saving) return;
    setSaving(true);
    setError("");
    try {
      await submitAssessment({ assessmentId: assessment.id, attemptId, startedAt, responses });
      setFinished(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível registrar a avaliação.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="adaptive-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {assessmentPurposeLabels[assessment.purpose].toUpperCase()} · SEQUÊNCIA FIXA
          </span>
          <h1 className="page-title">{assessment.title}</h1>
          <p>
            {assessment.activityIds.length} atividades · meta objetiva de{" "}
            {Math.round(assessment.passingPolicy.overall * 100)}%.
          </p>
        </div>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {!startedAt && (
        <section className="panel">
          <p>
            Responda às atividades na sequência. Questões objetivas compõem a nota; textos abertos
            contam como entrega.
          </p>
          <button className="primary-button" onClick={begin}>
            Começar avaliação
          </button>
        </section>
      )}
      {startedAt && !finished && current && (
        <>
          <p className="eyebrow">
            ATIVIDADE {index + 1} DE {assessment.activityIds.length}
          </p>
          <ActivityRenderer
            key={`${attemptId}:${current.id}`}
            activity={current}
            onAssessed={assessed}
            onWritingSaved={assessed}
          />
          {answered &&
            (index + 1 < assessment.activityIds.length ? (
              <button
                className="primary-button"
                onClick={() => {
                  setIndex(index + 1);
                  setAnswered(false);
                }}
              >
                Próxima atividade
              </button>
            ) : (
              <button className="primary-button" disabled={saving} onClick={() => void finish()}>
                {saving ? "Conferindo resultado…" : "Concluir avaliação"}
              </button>
            ))}
        </>
      )}
      {!startedAt || finished ? <AssessmentResult assessmentId={assessment.id} /> : null}
      {finished && (
        <button className="secondary-button" onClick={begin}>
          Refazer avaliação
        </button>
      )}
    </div>
  );
}
