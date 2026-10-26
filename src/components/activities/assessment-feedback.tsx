"use client";

import { CheckCircle2, MessageCircle } from "lucide-react";
import { LessonSupport } from "./lesson-support";
import { LearningText } from "@/components/learning/text-presentation";
import type { AssessmentDefinition } from "@/content/contracts";
import type { AssessedAnswer } from "@/content/assessment-results";
import type { PublicCourse } from "@/content/public";
import { assessmentActivityIds } from "@/content/assessment-references";

type FeedbackResult = {
  id: string;
  courseId?: string;
  assessmentId?: string;
  contentVersion?: string;
  source?: string;
  purpose?: string;
  method?: string;
  status?: string;
  finishedAt: string;
  answers?: readonly AssessedAnswer[];
};

export function assessmentFeedbackEntries(
  course: PublicCourse,
  assessment: AssessmentDefinition,
  result: FeedbackResult | undefined,
) {
  if (
    !result ||
    result.source !== "server" ||
    result.courseId !== course.id ||
    result.assessmentId !== assessment.id ||
    result.contentVersion !== course.contentVersion ||
    result.purpose !== assessment.purpose ||
    result.method !== assessment.method ||
    !["completed", "insufficient"].includes(result.status ?? "") ||
    !Number.isFinite(Date.parse(result.finishedAt)) ||
    !result.answers?.length
  )
    return [];
  const allowed = new Set(assessmentActivityIds(assessment));
  const activities = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) =>
        lesson.activities.map((activity) => [activity.id, activity] as const),
      ),
    ),
  );
  if (
    result.answers.some(
      (answer) =>
        !allowed.has(answer.activityId) || !activities.has(answer.activityId),
    )
  )
    return [];
  return result.answers.map((answer) => ({
    answer,
    activity: activities.get(answer.activityId)!,
  }));
}

export function AssessmentFeedback({
  course,
  assessment,
  result,
}: {
  course: PublicCourse;
  assessment: AssessmentDefinition;
  result: FeedbackResult | undefined;
}) {
  const entries = assessmentFeedbackEntries(course, assessment, result);
  if (!entries.length) return null;
  return (
    <section
      className="assessment-feedback mt-5 min-w-0"
      aria-label="Respostas e explicações da avaliação"
    >
      <h3>Aprenda com suas respostas</h3>
      <p>
        Compare sua resposta com a referência e consulte a explicação desta
        tentativa concluída.
      </p>
      {entries.map(({ answer, activity }, index) => {
        const lesson = course.units.flatMap(unit => unit.lessons).find(lesson => lesson.activities.some(item => item.id === activity.id));
        const delivery = activity.type === "writing" || answer.correct === null;
        return (
          <article
            className="assessment-answer-card mt-3 min-w-0 rounded-xl border border-[var(--border)] [overflow-wrap:anywhere]"
            key={answer.activityId}
          >
            <h4 className="assessment-answer-heading">
              {delivery ? <MessageCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}<span>
              {index + 1}. {activity.title} ·{" "}
              {delivery
                ? "Entrega sem nota"
                : answer.correct
                  ? "Resposta correta"
                  : "Compare as respostas"}
            </span></h4>
            <div className="min-w-0 border-t border-[var(--border)] p-4 [overflow-wrap:anywhere]">
              <LearningText as="p" className="assessment-answer-prompt mb-3 whitespace-pre-wrap" presentation={activity.presentation} field="prompt" textRole="source" text={activity.prompt} />
              <dl>
                <div className="assessment-answer-pair"><dt className="font-semibold">Sua resposta</dt>
                <dd className="mb-3 whitespace-pre-wrap">
                  {answer.answer ? <LearningText as="span" presentation={answer.presentation ? {...answer.presentation, annotations: undefined} : activity.presentation} field="answer" textRole="user" text={answer.answer} /> : "Sem resposta registrada."}
                </dd></div>
                {!delivery && answer.correctAnswer?.trim() && (
                  <div className="assessment-answer-pair">
                    <dt className="font-semibold">Resposta esperada</dt>
                    <dd className="mb-3 whitespace-pre-wrap">
                      <LearningText as="strong" presentation={answer.presentation} field="answer" textRole={answer.presentation?.fields?.answer?.language === course.sourceLanguage ? "source" : "target"} text={answer.correctAnswer} />
                    </dd>
                  </div>
                )}
              </dl>
              {delivery && (
                <p className="mb-3">
                  Texto recebido como entrega. A qualidade linguística não foi
                  avaliada e esta resposta não compõe a nota objetiva.
                </p>
              )}
              <LearningText as="p" className="whitespace-pre-wrap" presentation={answer.presentation} field="explanation" textRole="source" text={answer.explanation?.trim() || "A explicação desta resposta não está disponível neste resultado."} />
              {lesson && activity.supportActivityIds?.length ? <LessonSupport lesson={lesson} activity={activity} unavailableActivityIds={course.availability?.unavailableActivityIds} /> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
