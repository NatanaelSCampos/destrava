"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import type { PublicLesson } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import type { Skill } from "@/content/schema";

const labels: Array<{ id: Skill; label: string }> = [
  { id: "vocabulary", label: "Vocabulário" },
  { id: "grammar", label: "Gramática" },
  { id: "reading", label: "Leitura" },
  { id: "listening", label: "Listening" },
  { id: "writing", label: "Writing" },
  { id: "speaking", label: "Speaking" },
];

export function AssessmentResult({ lesson, unitId }: { lesson: PublicLesson; unitId: string }) {
  const { state } = useStudy();
  const result = state.assessmentAttempts?.find((attempt) => attempt.unitId === unitId);
  if (!result) return null;
  const objective = lesson.activities.filter((activity) =>
    [
      "multiple_choice",
      "true_false",
      "fill_blank",
      "ordering",
      "short_answer",
      "listening",
    ].includes(activity.type),
  );
  const rows = labels.map(({ id, label }) => {
    const activities = objective.filter((activity) => activity.skill === id);
    const attempts = activities
      .map((activity) => state.attempts.find((attempt) => attempt.activityId === activity.id))
      .filter((attempt) => attempt !== undefined);
    return {
      id,
      label,
      score: activities.length
        ? Math.round(
            (100 * attempts.filter((attempt) => attempt.correct).length) / activities.length,
          )
        : null,
    };
  });
  const strengths = rows
    .filter((row) => row.score !== null && row.score >= 75)
    .map((row) => row.label);
  const needsReview = rows
    .filter((row) => row.score !== null && row.score < 75)
    .map((row) => row.label);
  return (
    <section className="assessment-result panel">
      <span className="eyebrow">
        <CheckCircle2 size={14} /> RESULTADO DA AVALIAÇÃO
      </span>
      <div className="assessment-result-head">
        <div>
          <h2>{result.objectiveScore}% nas questões objetivas</h2>
          <p>
            {result.objectiveScore >= 75
              ? "Você alcançou a meta inicial do teste."
              : "Revise os pontos abaixo e tente novamente quando quiser."}
          </p>
        </div>
        <span className={`pill ${result.objectiveScore >= 75 ? "" : "amber"}`}>
          {result.objectiveScore >= 75 ? "Meta alcançada" : "Em revisão"}
        </span>
      </div>
      <div className="assessment-result-grid">
        {rows.map((row) => (
          <div key={row.id}>
            <span>{row.label}</span>
            <strong>
              {row.score === null
                ? row.id === "writing"
                  ? "Texto entregue"
                  : "Sem avaliação"
                : `${row.score}%`}
            </strong>
          </div>
        ))}
      </div>
      <div className="assessment-result-notes">
        <p>
          <strong>Pontos fortes:</strong>{" "}
          {strengths.length
            ? strengths.join(", ")
            : "Continue praticando para descobrir seus pontos fortes."}
        </p>
        <p>
          <strong>Para revisar:</strong>{" "}
          {needsReview.length
            ? needsReview.join(", ")
            : "Nenhum ponto abaixo da meta nas questões avaliadas."}
        </p>
      </div>
      <Link href="/review" className="secondary-button">
        <RotateCcw size={16} /> Revisar pontos fracos <ArrowRight size={16} />
      </Link>
    </section>
  );
}
