"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudy } from "@/components/study-provider";
import {
  selectAssessment,
  assessmentLink,
  assessmentPurposeLabels,
} from "@/content/assessment-references";
import { AdaptiveAssessmentRunner } from "@/components/activities/adaptive-assessment-runner";
import { FixedAssessmentRunner } from "@/components/activities/fixed-assessment-runner";

function AssessmentSelection() {
  const { course, state } = useStudy();
  const params = useSearchParams();
  const router = useRouter();
  let assessment;
  let error = "";
  try {
    assessment = selectAssessment(course, params.get("assessmentId"));
  } catch {
    error = "A avaliação solicitada não pertence ao curso atual.";
  }
  const historical = [...state.assessmentAttempts, ...state.adaptiveAssessments].filter(
    (item) => item.source !== "server" || item.contentVersion !== course.contentVersion,
  );
  return (
    <>
      {course.assessments.length > 0 && (
        <label className="panel" style={{ display: "block", marginBottom: 16 }}>
          Escolha a avaliação
          <select
            aria-label="Avaliação"
            value={assessment?.id ?? ""}
            onChange={(event) => {
              if (event.target.value) router.replace(assessmentLink(event.target.value));
            }}
          >
            <option value="">Selecione uma avaliação</option>
            {course.assessments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · {assessmentPurposeLabels[item.purpose]}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {!assessment ? (
        <div className="empty-state">
          {error
            ? "Selecione uma referência válida do curso."
            : course.assessments.length
              ? "Escolha uma avaliação. Este curso não declarou um diagnóstico inicial."
              : "Este curso não possui avaliações declaradas."}
        </div>
      ) : course.availability?.unavailableAssessmentIds?.includes(assessment.id) ? (
        <div className="panel" role="status"><h2>Avaliação temporariamente indisponível</h2><p>Uma capacidade necessária à avaliação não está disponível. Isso não representa uma reprovação e nenhuma nota será registrada.</p></div>
      ) : assessment.method === "adaptive" ? (
        <AdaptiveAssessmentRunner key={assessment.id} assessment={assessment} />
      ) : (
        <FixedAssessmentRunner key={assessment.id} assessment={assessment} />
      )}
      {historical.length > 0 && (
        <details className="panel">
          <summary>Histórico anterior ({historical.length})</summary>
          <ul>
            {historical.map((item) => (
              <li key={item.id}>
                {new Date(item.finishedAt).toLocaleDateString("pt-BR")} ·{" "}
                {item.assessmentId ?? "sem referência registrada"} ·{" "}
                {item.objectiveScore == null ? "sem nota registrada" : `${item.objectiveScore}%`} ·
                não reclassificado
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<div className="page-loading">Carregando avaliações…</div>}>
      <AssessmentSelection />
    </Suspense>
  );
}
