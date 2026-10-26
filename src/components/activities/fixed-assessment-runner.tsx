"use client";

import { LearningAccessCard } from "./learning-access-card";
import { ExerciseCard } from "./exercise-card";
import { LearningText } from "@/components/learning/text-presentation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { FixedAssessmentDefinition } from "@/content/contracts";
import type { AssessmentResponse } from "@/content/assessment-results";
import { useStudy } from "@/components/study-provider";
import { ActivityRenderer } from "./activity-renderer";
import { AssessmentResult } from "./assessment-result";
import { currentAssessmentResult } from "@/domain/study/learning-policy-engine";
import { AssessmentHeader, AssessmentIntro, AssessmentProgress } from "./assessment-experience";

export function FixedAssessmentRunner({ assessment }: { assessment: FixedAssessmentDefinition }) {
  const { course, state, submitAssessment, learningAccess, refreshLearningAccess } = useStudy();
  const previousResult = currentAssessmentResult(course, state, assessment.id);
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
  if (course.availability?.unavailableAssessmentIds?.includes(assessment.id))
    return (
      <div className="panel" role="status">
        Esta avaliação está temporariamente indisponível. Nenhuma nota será registrada.
      </div>
    );
  if (assessment.activityIds.some((id) => !activities.has(id)))
    return (
      <div className="empty-state">Uma atividade exigida por esta avaliação está indisponível.</div>
    );
  async function begin() {
    if (assessment.exam) {
      const fresh = await refreshLearningAccess();
      if (!fresh?.assessments[assessment.id]?.allowed) return;
    }
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
  if (assessment.exam && !learningAccess?.assessments[assessment.id]?.allowed)
    return (
      <LearningAccessCard
        decision={learningAccess?.assessments[assessment.id]}
        title="Prepare-se para a prova"
      />
    );
  return (
    <div className="adaptive-page lesson-experience assessment-experience">
      <AssessmentHeader assessment={assessment} />
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {!startedAt && !previousResult && (
        <AssessmentIntro
          assessment={assessment}
          skills={[
            ...new Set(assessment.activityIds.flatMap((id) => activities.get(id)?.skills ?? [])),
          ].map(
            (skill) =>
              ({
                vocabulary: "Vocabulário",
                grammar: "Gramática",
                reading: "Leitura",
                listening: "Escuta",
                writing: "Escrita",
                speaking: "Fala",
                pronunciation: "Pronúncia",
                fluency: "Fluência",
                comprehension: "Compreensão",
              })[skill],
          )}
          openWriting={assessment.activityIds.some((id) => activities.get(id)?.type === "writing")}
          onStart={begin}
        />
      )}
      {startedAt && !finished && current && (
        <section className="assessment-fixed-question">
          <AssessmentProgress current={index + 1} total={assessment.activityIds.length} />
          {assessment.exam ? (
            <article className="panel assessment-exam-question">
              <span className="eyebrow">Responda com o que aprendeu</span>
              <LearningText
                as="h2"
                presentation={current.presentation}
                field="title"
                textRole="source"
                text={current.title}
              />
              <LearningText
                as="p"
                className="assessment-exam-instruction"
                presentation={current.presentation}
                field="prompt"
                textRole="source"
                text={current.prompt}
              />
              <ExerciseCard
                key={`${attemptId}:${current.id}`}
                activity={current as Parameters<typeof ExerciseCard>[0]["activity"]}
                onRecordAnswer={assessed}
                answerDraftScope={attemptId}
              />
            </article>
          ) : (
            <ActivityRenderer
              key={`${attemptId}:${current.id}`}
              activity={current}
              onAssessed={assessed}
              onWritingSaved={assessed}
            />
          )}
          <div className="assessment-next">
            {answered &&
              (index + 1 < assessment.activityIds.length ? (
                <button
                  className="primary-button"
                  onClick={() => {
                    setIndex(index + 1);
                    setAnswered(false);
                  }}
                >
                  Próxima atividade <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <button className="primary-button" disabled={saving} onClick={() => void finish()}>
                  {saving ? "Conferindo resultado…" : "Concluir avaliação"}
                </button>
              ))}
          </div>
        </section>
      )}
      {(!startedAt && previousResult) || finished ? (
        <AssessmentResult assessmentId={assessment.id} onStart={begin} />
      ) : null}
    </div>
  );
}
