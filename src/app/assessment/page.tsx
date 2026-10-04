"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, RotateCcw } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { ExerciseCard } from "@/components/activities/exercise-card";
import {
  adaptiveAssessmentReport,
  nextAdaptiveItem,
  type AdaptiveAnswer,
} from "@/domain/study/adaptive-assessment";
import type { GradeResult } from "@/domain/activities/grader";
import type { CoursePackage } from "@/content/contracts";

type AssessmentSkill = CoursePackage["assessments"][number]["skillPlan"][number];

const labels: Record<AssessmentSkill, string> = {
  vocabulary: "Vocabulário",
  grammar: "Gramática",
  listening: "Escuta",
  writing: "Frase escrita",
  reading: "Leitura",
  speaking: "Fala",
  pronunciation: "Pronúncia",
  fluency: "Fluência",
  comprehension: "Compreensão",
};
const objectiveTypes = new Set([
  "multiple_choice",
  "true_false",
  "fill_blank",
  "ordering",
  "short_answer",
  "listening",
]);

export default function AssessmentPage() {
  const { course, language, assessments, state, saveAdaptiveAssessment, recordStudyEvent } = useStudy();
  const unit = course.units.find((item) => item.active);
  const assessment = assessments.find((item) => item.unitId === unit?.id);
  const skillPlan = assessment?.skillPlan ?? [];
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AdaptiveAnswer[]>([]);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const activities = new Map(
    course.units.flatMap((item) =>
      item.lessons.flatMap((lesson) =>
        lesson.activities.map(
          (activity) => [activity.id, { activity, lesson, unit: item }] as const,
        ),
      ),
    ),
  );
  const bank = assessment
    ? assessment.bank.filter((item) => {
        const entry = activities.get(item.activityId);
        return entry?.activity.skills.includes(item.skill) && objectiveTypes.has(entry.activity.type);
      })
    : [];
  const questionAnswers = hasAnswered ? answers.slice(0, -1) : answers;
  const next = !finished ? nextAdaptiveItem(bank, questionAnswers, skillPlan) : null;
  const current = next ? activities.get(next.activityId)?.activity : undefined;
  const latest = (state.adaptiveAssessments ?? []).find(
    (item) => item.courseId === course.id && item.unitId === unit?.id,
  );
  const report = adaptiveAssessmentReport(finished ? answers : (latest?.answers ?? []), skillPlan, assessment?.passingPolicy ?? { overall: 1 }, assessment?.skillWeights ?? {});
  const showReport = finished || (!startedAt && latest);

  function begin() {
    recordStudyEvent("diagnostic_started", undefined, { courseId: course.id });
    setStartedAt(new Date().toISOString());
    setAnswers([]);
    setHasAnswered(false);
    setFinished(false);
  }

  function assessed(answer: string, result: GradeResult) {
    if (!next || hasAnswered || !current || !unit || !startedAt) return;
    const updated: AdaptiveAnswer[] = [
      ...answers,
      {
        activityId: current.id,
        skill: next.skill,
        difficulty: next.difficulty,
        ceiling: next.ceiling,
        correct: result.correct,
        answer,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation,
      },
    ];
    setAnswers(updated);
    setHasAnswered(true);
    if (updated.length === skillPlan.length) {
      saveAdaptiveAssessment({ courseId: course.id, unitId: unit.id, startedAt, answers: updated });
      setFinished(true);
    }
  }

  if (!unit || !assessment || bank.length < skillPlan.length)
    return (
      <div className="empty-state">
        O diagnóstico adaptativo ainda não está disponível para este curso.
      </div>
    );

  return (
    <div className="adaptive-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <ChartNoAxesCombined size={14} /> DIAGNÓSTICO ADAPTATIVO
          </span>
          <h1 className="page-title">Descubra o próximo passo.</h1>
          <p className="page-subtitle">
            {skillPlan.length} questões do conteúdo {course.level}. A próxima questão considera sua resposta anterior.
          </p>
        </div>
      </div>
      {!startedAt && !latest && (
        <section className="panel adaptive-intro">
          <h2>Pronto para começar?</h2>
          <p>
            O teste usa {Array.from(new Set(skillPlan)).map((skill) => labels[skill] ?? skill).join(", ")}.
            As questões usam o conteúdo da unidade e o resultado orienta sua prática.
          </p>
          <button type="button" className="primary-button" onClick={begin}>
            {latest ? "Fazer novo diagnóstico" : "Começar diagnóstico"} <ArrowRight size={16} />
          </button>
        </section>
      )}
      {startedAt && !finished && current && next && (
        <section className="panel adaptive-question">
          <div className="adaptive-question-head">
            <span className="eyebrow">
              QUESTÃO {questionAnswers.length + 1} DE {skillPlan.length}
            </span>
            <span className="pill">{labels[next.skill]}</span>
          </div>
          <h2>{current.title}</h2>
          <p>{current.prompt}</p>
          <ExerciseCard
            key={current.id}
            activity={current as Parameters<typeof ExerciseCard>[0]["activity"]}
            onAssessed={assessed}
          />
          {hasAnswered && !finished && (
            <button type="button" className="primary-button" onClick={() => setHasAnswered(false)}>
              Próxima questão <ArrowRight size={16} />
            </button>
          )}
          <p className="helper-note">
            Complexidade da questão:{" "}
            {next.difficulty === 1
              ? "fundamentos"
              : next.difficulty === 2
                ? "aplicação"
                : "contexto"}
            . O nível continua {course.level}.
          </p>
        </section>
      )}
      {showReport && (
        <section className="panel adaptive-report">
          <div className="adaptive-report-head">
            <div>
              <span className="eyebrow">SEU RESULTADO</span>
              <h2>{report.bySkill.some((item) => item.status === "insufficient")
                ? "Mais respostas para avaliar" : report.passed ? "Meta alcançada" : "Revisão recomendada"}</h2>
              <p>Veja o próximo passo e continue praticando.</p>
            </div>
            <strong aria-label={report.bySkill.some((item) => item.status === "insufficient") ? "Amostra insuficiente" : `${report.score}% de acertos`}>
              {report.bySkill.some((item) => item.status === "insufficient") ? "—" : `${report.score}%`}
            </strong>
          </div>
          <h3>Seu próximo passo</h3>
          {report.wrong.length ? (
            <ol className="adaptive-plan">
              {report.wrong.map((item, index) => {
                const entry = activities.get(item.activityId);
                if (!entry) return null;
                return (
                  <li key={item.activityId}>
                    <div>
                      <strong>
                        {labels[item.skill] ?? item.skill}: {entry.activity.title}
                      </strong>
                      <p>Revise a explicação e pratique esta habilidade novamente.</p>
                    </div>
                    <Link
                      className={index === 0 ? "primary-button" : "secondary-button"}
                      href={`/course/${course.slug}/unit/${entry.unit.number}/lesson/${entry.lesson.slug}?activity=${entry.activity.id}`}
                    >
                      Praticar <ArrowRight size={15} />
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>
              Você acertou todas as questões. Continue praticando e revisando para manter o ritmo.
            </p>
          )}
          <h3>Resultado por competência</h3>
          <div className="adaptive-skill-grid">
            {report.bySkill.map((item) => (
              <div key={item.skill}>
                <span>{labels[item.skill] ?? item.skill}</span>
                <strong>{item.status === "not_assessed" ? "Não avaliada"
                  : item.status === "insufficient" ? "Amostra pequena" : `${item.score}%`}</strong>
                <small>
                  {item.correct}/{item.answered} acertos · {item.status === "approved" ? "meta atingida"
                    : item.status === "review" ? "revisar" : item.status === "insufficient" ? "precisa de mais questões" : "sem evidência"}
                </small>
              </div>
            ))}
            {["Fala espontânea", "Pronúncia", "Fluência", "Escrita livre"].map((label) => (
              <div key={label}>
                <span>{label}</span>
                <strong>Não avaliada</strong>
                <small>Este diagnóstico usa apenas respostas objetivas.</small>
              </div>
            ))}
          </div>
          <p className="helper-note">Fala, pronúncia e escrita livre não são medidas neste teste objetivo. Uma competência com menos de duas respostas não recebe classificação.</p>
          <div className="adaptive-report-actions">
            <button type="button" className="secondary-button" onClick={begin}>
              <RotateCcw size={16} /> Refazer diagnóstico
            </button>
            <Link href="/review" className="secondary-button">
              <RotateCcw size={16} /> Revisar cartões
            </Link>
            {language.capabilities.speechRecognition && <Link href="/speaking" className="secondary-button">
              Praticar fala <ArrowRight size={16} />
            </Link>}
          </div>
          <details className="adaptive-report-method">
            <summary>Como este resultado funciona</summary>
            <p>
              A meta deste curso é {Math.round(assessment.passingPolicy.overall * 100)}% geral.
              Cada habilidade precisa de pelo menos duas respostas; o piso por habilidade vem da configuração do curso.
              O resultado orienta os estudos e não substitui a avaliação final da unidade. Cada
              resposta entra no perfil de aprendizado; questões erradas entram na revisão.
            </p>
          </details>
        </section>
      )}
    </div>
  );
}
