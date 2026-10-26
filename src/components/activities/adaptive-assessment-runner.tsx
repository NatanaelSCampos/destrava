"use client";
import { LearningText } from "@/components/learning/text-presentation";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lightbulb, RotateCcw } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { ExerciseCard } from "@/components/activities/exercise-card";
import { AssessmentFeedback } from "./assessment-feedback";
import {
  adaptiveAssessmentReport,
  nextAdaptiveItem,
  type AdaptiveAnswer,
} from "@/domain/study/adaptive-assessment";
import type { GradeResult } from "@/domain/activities/grader";
import type { AdaptiveAssessmentDefinition } from "@/content/contracts";
import { AssessmentHeader, AssessmentIntro, AssessmentProgress } from "./assessment-experience";

type AssessmentSkill = AdaptiveAssessmentDefinition["skillPlan"][number];

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

export function AdaptiveAssessmentRunner({
  assessment,
}: {
  assessment: AdaptiveAssessmentDefinition;
}) {
  const { course, language, state, submitAssessment, recordStudyEvent, runtime, confirmAdaptiveProgress } = useStudy();
  const resumed = runtime ? (state.adaptiveProgress ?? []).find(value => value.assessmentId === assessment.id &&
    !state.adaptiveAssessments.some(result => result.id === value.attemptId && result.source === "server")) : undefined;
  const busy = useRef(false);
  const [pendingPrefix, setPendingPrefix] = useState<import("@/domain/assessments/adaptive-progress").AdaptiveProgress | null>(null);
  const skillPlan = assessment?.skillPlan ?? [];
  const [startedAt, setStartedAt] = useState<string | null>(resumed?.startedAt ?? null);
  const [answers, setAnswers] = useState<AdaptiveAnswer[]>(resumed?.answers ?? []);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attemptId, setAttemptId] = useState(() => resumed?.attemptId ?? crypto.randomUUID());
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
        return (
          entry?.activity.skills.includes(item.skill) && objectiveTypes.has(entry.activity.type)
        );
      })
    : [];
  const questionAnswers = hasAnswered ? answers.slice(0, -1) : answers;
  const next = !finished ? nextAdaptiveItem(bank, questionAnswers, skillPlan) : null;
  const current = next ? activities.get(next.activityId)?.activity : undefined;
  const latest = (state.adaptiveAssessments ?? [])
    .filter(
      (item) =>
        item.courseId === course.id &&
        item.assessmentId === assessment.id &&
        item.source === "server" &&
        item.contentVersion === course.contentVersion &&
        item.purpose === assessment.purpose &&
        item.method === assessment.method,
    )
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
  const report = adaptiveAssessmentReport(
    finished ? answers : (latest?.answers ?? []),
    skillPlan,
    assessment?.passingPolicy ?? { overall: 1 },
    assessment?.skillWeights ?? {},
  );
  const showReport = finished || (!startedAt && latest);

  async function begin() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    // A start is local until the first answer is actually submitted.
    const attempt = { id: crypto.randomUUID(), startedAt: new Date().toISOString() };
    try {
      recordStudyEvent("assessment_started", assessment.id, { courseId: course.id, purpose: assessment.purpose });
      setAttemptId(attempt.id);
      setStartedAt(attempt.startedAt);
      setAnswers([]);
      setHasAnswered(false);
      setFinished(false);
      setPendingPrefix(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível iniciar a avaliação."); }
    finally { busy.current = false; setSaving(false); }
  }

  async function finish(updated: AdaptiveAnswer[]) {
    if (!startedAt || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await submitAssessment({
        assessmentId: assessment.id,
        attemptId,
        startedAt,
        responses: updated.map((item) => ({ activityId: item.activityId, answer: item.answer })),
      });
      setAnswers(
        result.answers.map((item) => ({
          ...item,
          correct: item.correct === true,
          difficulty: item.difficulty!,
        })),
      );
      setFinished(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível registrar a avaliação.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function confirmPrefix(prefix: import("@/domain/assessments/adaptive-progress").AdaptiveProgress) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    setPendingPrefix(prefix);
    try {
      const confirmed = await confirmAdaptiveProgress(prefix);
      setAttemptId(confirmed.attemptId);
      setStartedAt(confirmed.startedAt);
      setAnswers(confirmed.answers ?? []);
      setHasAnswered(false);
      setPendingPrefix(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível confirmar sua resposta."); }
    finally { busy.current = false; setSaving(false); }
  }

  function assessed(answer: string, result: GradeResult) {
    if (!next || hasAnswered || !current || !startedAt || busy.current) return;
    if (runtime) {
      void confirmPrefix({ attemptId, assessmentId: assessment.id, startedAt,
        responses: [...answers.map(item => ({ activityId: item.activityId, answer: item.answer })),
          { activityId: current.id, answer }] });
      return;
    }
    const updated: AdaptiveAnswer[] = [...answers, { activityId: current.id, skill: next.skill,
      difficulty: next.difficulty, ceiling: next.ceiling, correct: result.correct, answer,
      correctAnswer: result.correctAnswer, explanation: result.explanation }];
    setAnswers(updated);
    setHasAnswered(true);
    if (updated.length === skillPlan.length) void finish(updated);
  }

  if (bank.length < skillPlan.length)
    return (
      <div className="empty-state">
        Esta avaliação ainda não está disponível para este curso.
      </div>
    );

  if (course.availability?.unavailableAssessmentIds?.includes(assessment.id))
    return (
      <div className="panel" role="status">
        Esta avaliação está temporariamente indisponível. Nenhuma nota será registrada.
      </div>
    );

  return (
    <div className="adaptive-page lesson-experience assessment-experience">
      <AssessmentHeader assessment={assessment} />
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {saving && <p role="status">Registrando suas respostas…</p>}
      {pendingPrefix && error && <button className="primary-button" disabled={saving} onClick={() => void confirmPrefix(pendingPrefix)}>Tentar confirmar resposta novamente</button>}
      {startedAt && answers.length === skillPlan.length && !finished && (
        <button className="primary-button" disabled={saving || !!pendingPrefix} onClick={() => void finish(answers)}>
          Confirmar resultado
        </button>
      )}
      {!startedAt && !latest && (
        <AssessmentIntro assessment={assessment} skills={Array.from(new Set(skillPlan)).map(skill => labels[skill])} disabled={saving || !!pendingPrefix} onStart={() => void begin()} />
      )}
      {startedAt && !finished && current && next && !saving && !pendingPrefix && (
        <section className="panel adaptive-question">
          <AssessmentProgress current={questionAnswers.length + 1} total={skillPlan.length} skill={labels[next.skill]} />
          <LearningText
            as="h2"
            presentation={current.presentation}
            field="title"
            textRole="source"
            text={current.title}
          />
          {!current.scene && <LearningText
            as="p"
            presentation={current.presentation}
            field="prompt"
            textRole="source"
            text={current.prompt}
          />}
          <ExerciseCard
            key={current.id}
            activity={current as Parameters<typeof ExerciseCard>[0]["activity"]}
            onAssessed={assessed}
          />
          {hasAnswered && !finished && answers.length < skillPlan.length && (
            <div className="assessment-next"><button type="button" className="primary-button" onClick={() => setHasAnswered(false)}>
              Próxima questão <ArrowRight size={16} />
            </button></div>
          )}

        </section>
      )}
      {showReport && (
        <section className="panel adaptive-report">
          <div className="adaptive-report-head">
            <div>
              <span className="eyebrow">SEU RESULTADO</span>
              <h2>
                {report.bySkill.some((item) => item.status === "insufficient" || item.status === "not_assessed")
                  ? "Mais respostas para avaliar"
                  : report.passed
                    ? "Meta alcançada"
                    : "Revisão recomendada"}
              </h2>
              <p>Veja o próximo passo e continue praticando.</p>
            </div>
            <strong
              aria-label={
                report.bySkill.some((item) => item.status === "insufficient" || item.status === "not_assessed")
                  ? "Amostra insuficiente"
                  : `${report.score}% de acertos`
              }
            >
              {report.bySkill.some((item) => item.status === "insufficient" || item.status === "not_assessed")
                ? "—"
                : `${report.score}%`}
            </strong>
          </div>
          <AssessmentFeedback
            course={course}
            assessment={assessment}
            result={finished ? (latest?.id === attemptId ? latest : undefined) : (!startedAt ? latest : undefined)}
          />
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
              {report.bySkill.some(item => item.status === "insufficient" || item.status === "not_assessed")
                ? "Continue praticando. Ainda precisamos de mais respostas para observar algumas habilidades."
                : "Você acertou as questões desta tentativa. Continue praticando e revisando para manter o ritmo."}
            </p>
          )}
          <h3>O que suas respostas mostram</h3>
          <div className="adaptive-skill-grid">
            {report.bySkill.map((item) => (
              <div key={item.skill}>
                <span>{labels[item.skill] ?? item.skill}</span>
                <strong>
                  {item.status === "not_assessed"
                    ? "Não avaliada"
                    : item.status === "insufficient"
                      ? "Mais prática para observar"
                      : `${item.score}%`}
                </strong>
                <small>
                  {item.correct}/{item.answered} acertos ·{" "}
                  {item.status === "approved"
                    ? "meta atingida"
                    : item.status === "review"
                      ? "revisar"
                      : item.status === "insufficient"
                        ? "precisa de mais questões"
                        : "ainda não observada"}
                </small>
              </div>
            ))}
            {["Fala espontânea", "Pronúncia", "Fluência", "Escrita livre"].map((label) => (
              <div key={label}>
                <span>{label}</span>
                <strong>Não avaliada</strong>
                <small>Esta avaliação usa apenas respostas objetivas.</small>
              </div>
            ))}
          </div>
          <p className="helper-note">
            Fala, pronúncia e escrita livre não são medidas neste teste objetivo. Uma competência
            com menos de duas respostas não recebe classificação.
          </p>
          <div className="adaptive-report-actions">
            <button type="button" className="secondary-button" onClick={begin}>
              <RotateCcw size={16} /> Refazer avaliação
            </button>
            <Link href="/review" className="secondary-button">
              <RotateCcw size={16} /> Revisar cartões
            </Link>
            {language.speech.support.speechRecognition && (
              <Link href="/speaking" className="secondary-button">
                Praticar fala <ArrowRight size={16} />
              </Link>
            )}
          </div>
          <section className="adaptive-report-method" aria-label="Como ler seu resultado">
            <h3><Lightbulb size={18} aria-hidden="true" /> Como ler seu resultado</h3>
            <p>
              A meta desta prática é {Math.round(assessment.passingPolicy.overall * 100)}% de acertos.
              Precisamos de pelo menos duas respostas para comentar cada habilidade.
              Fala, pronúncia e escrita livre precisam de outras formas de avaliação; esta nota não mede essas habilidades.
            </p>
          </section>
        </section>
      )}
    </div>
  );
}
