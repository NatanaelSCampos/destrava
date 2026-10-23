"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import {
  resolveAssessment,
  assessmentLink,
  assessmentPurposeLabels,
} from "@/content/assessment-references";

const labels: Record<string, string> = {
  vocabulary: "Vocabulário",
  grammar: "Gramática",
  reading: "Leitura",
  listening: "Escuta",
  writing: "Escrita",
  speaking: "Fala",
  pronunciation: "Pronúncia",
  fluency: "Fluência",
  comprehension: "Compreensão",
};

export function AssessmentResult({ assessmentId }: { assessmentId: string }) {
  const { course, state } = useStudy();
  const definition = resolveAssessment(course.assessments, assessmentId)!;
  const candidates =
    definition.method === "fixed"
      ? state.assessmentAttempts.filter((item) => item.assessmentId === definition.id)
      : state.adaptiveAssessments.filter((item) => item.assessmentId === definition.id);
  const result = candidates
    .filter(
      (item) =>
        item.source === "server" &&
        item.contentVersion === course.contentVersion &&
        item.purpose === definition.purpose &&
        item.method === definition.method,
    )
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
  const previous = candidates
    .filter((item) => item.id !== result?.id)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  const answers = result?.answers ?? [];
  const rows = [...new Set(answers.map((item) => item.skill))].map((skill) => {
    const items = answers.filter((item) => item.skill === skill && item.correct !== null);
    return {
      skill,
      score: items.length
        ? Math.round((100 * items.filter((item) => item.correct).length) / items.length)
        : null,
    };
  });
  return (
    <section className="assessment-result panel">
      <span className="eyebrow">
        <CheckCircle2 size={14} /> RESULTADO ·{" "}
        {assessmentPurposeLabels[definition.purpose].toUpperCase()}
      </span>
      <div className="assessment-result-head">
        <div>
          <h2>{definition.title}</h2>
          <p>
            {!result
              ? "Esta avaliação ainda não tem um resultado atual confirmado."
              : result.objectiveScore == null
                ? "A amostra ainda não permite atribuir uma nota."
                : `${result.objectiveScore}% nas questões objetivas`}
          </p>
          {result && (
            <p>
              {result.passed == null
                ? "Sem classificação suficiente."
                : result.passed
                  ? "Meta declarada alcançada."
                  : "Revise os pontos abaixo e tente novamente."}
            </p>
          )}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="assessment-result-grid">
          {rows.map((row) => (
            <div key={row.skill}>
              <span>{labels[row.skill] ?? row.skill}</span>
              <strong>{row.score === null ? "Entrega sem nota" : `${row.score}%`}</strong>
            </div>
          ))}
        </div>
      )}
      <p className="helper-note">
        Critério objetivo: {Math.round(definition.passingPolicy.overall * 100)}%. Escrita aberta é
        uma entrega, sem nota automática neste método.
      </p>
      <Link className="secondary-button" href={assessmentLink(definition.id)}>
        {result ? "Refazer avaliação" : "Executar avaliação"} <ArrowRight size={16} />
      </Link>
      {previous.length > 0 && (
        <details>
          <summary>Resultados anteriores ({previous.length})</summary>
          <ul>
            {previous.map((item) => (
              <li key={item.id}>
                {new Date(item.finishedAt).toLocaleDateString("pt-BR")} ·{" "}
                {item.objectiveScore == null ? "Sem nota" : `${item.objectiveScore}%`} · histórico,
                sem reclassificação automática
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
