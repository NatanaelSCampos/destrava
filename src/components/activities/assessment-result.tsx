"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { currentAssessmentResult } from "@/domain/study/learning-policy-engine";
import { AssessmentFeedback } from "./assessment-feedback";
import { resolveAssessment, assessmentLink } from "@/content/assessment-references";

import { AssessmentHistory, assessmentScoreLabel } from "./assessment-experience";

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

export function AssessmentResult({
  assessmentId,
  onStart,
}: {
  assessmentId: string;
  onStart?: () => void;
}) {
  const { course, state } = useStudy();
  const definition = resolveAssessment(course.assessments, assessmentId)!;
  const candidates =
    definition.method === "fixed"
      ? state.assessmentAttempts.filter((item) => item.assessmentId === definition.id)
      : state.adaptiveAssessments.filter((item) => item.assessmentId === definition.id);
  const result = currentAssessmentResult(course, state, definition.id);
  const currentCandidates = candidates.filter(
    (item) =>
      item.courseId === course.id &&
      item.contentVersion === course.contentVersion &&
      item.source === "server" &&
      item.method === definition.method &&
      item.purpose === definition.purpose,
  );
  const previous = currentCandidates
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
    <section className="assessment-result panel adaptive-report">
      <span className="eyebrow">
        <CheckCircle2 size={14} aria-hidden="true" /> SEU RESULTADO
      </span>
      <div className="assessment-result-head adaptive-report-head">
        <div>
          <h2>
            {definition.method === "fixed" && definition.exam && result
              ? result.passed
                ? "Aprovado! Você atingiu a meta."
                : "Não aprovado nesta tentativa"
              : result?.passed === true
                ? "Um passo a mais no seu caminho"
                : result
                  ? "Veja o que vale retomar"
                  : definition.title}
          </h2>
          <p>
            {!result
              ? "Você ainda não fez esta prática nesta edição."
              : result.objectiveScore == null
                ? "A amostra ainda não permite atribuir uma nota."
                : `${assessmentScoreLabel(result)} nas atividades`}
          </p>
          {result && (
            <p>
              {result.passed == null
                ? "Ainda precisamos de mais respostas para apresentar um resultado."
                : result.passed
                  ? "Você atingiu o objetivo desta prática."
                  : "Revise os pontos abaixo e tente novamente."}
            </p>
          )}
        </div>
        {result && (
          <strong
            aria-label={
              result.objectiveScore == null
                ? "Sem nota atribuída"
                : assessmentScoreLabel(result) + " de acertos"
            }
          >
            {result.objectiveScore == null ? "—" : assessmentScoreLabel(result)}
          </strong>
        )}
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
      <section className="adaptive-report-method">
        <h3>
          <Lightbulb size={18} aria-hidden="true" /> Como ler seu resultado
        </h3>
        <p>
          {definition.method === "fixed" && definition.exam ? (
            `Meta desta prova: ${Math.round(definition.passingPolicy.overall * 100)}% de acertos. Você pode rever as questões e tentar novamente.`
          ) : (
            <>
              Meta nas questões de resposta fechada:{" "}
              {Math.round(definition.passingPolicy.overall * 100)}%. Textos livres ficam salvos como
              prática, sem nota automática.
            </>
          )}{" "}
          Esta nota descreve estas atividades; não comprova, sozinha, o domínio de um nível do
          idioma.
        </p>
      </section>
      <AssessmentFeedback course={course} assessment={definition} result={result} />
      <div className="adaptive-report-actions">
        {onStart ? (
          <button type="button" className="secondary-button" onClick={onStart}>
            {result ? "Refazer avaliação" : "Executar avaliação"} <ArrowRight size={16} />
          </button>
        ) : (
          <Link className="secondary-button" href={assessmentLink(definition.id)}>
            {result ? "Refazer avaliação" : "Executar avaliação"} <ArrowRight size={16} />
          </Link>
        )}
      </div>
      <AssessmentHistory results={previous} />
    </section>
  );
}
