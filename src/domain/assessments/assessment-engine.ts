import type { Course } from "@/content/schema";
import type { AssessmentDefinition, NormalizationRules } from "@/content/contracts";
import type { AssessedAnswer, AssessmentResponse } from "@/content/assessment-results";
import { resolveAssessment } from "@/content/assessment-references";
import { gradeActivity } from "@/domain/activities/grader";
import {
  adaptiveAssessmentReport,
  nextAdaptiveItem,
  type AdaptiveAnswer,
} from "@/domain/study/adaptive-assessment";

export class AssessmentExecutionError extends Error {}

export function evaluateAssessment(
  course: Course,
  assessmentId: string,
  responses: AssessmentResponse[],
  normalization: NormalizationRules,
) {
  const definition = resolveAssessment(course.assessments, assessmentId)!;
  const activities = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) => lesson.activities.map((item) => [item.id, item] as const)),
    ),
  );
  if (new Set(responses.map((item) => item.activityId)).size !== responses.length)
    throw new AssessmentExecutionError("Há respostas duplicadas nesta avaliação.");
  const grade = (response: AssessmentResponse, skill?: AssessedAnswer["skill"]): AssessedAnswer => {
    const activity = activities.get(response.activityId);
    if (!activity) throw new AssessmentExecutionError("Atividade da avaliação não encontrada.");
    if (activity.type === "writing") {
      const words = response.answer.trim() ? response.answer.trim().split(/\s+/).length : 0;
      if (words < activity.minWords)
        throw new AssessmentExecutionError(
          "O texto ainda não atende à entrega exigida pela atividade.",
        );
      return {
        ...response,
        skill: "writing",
        correct: null,
        explanation: "Texto entregue; não integra a nota objetiva.",
      };
    }
    const result = gradeActivity(activity, response.answer, normalization);
    if (!result)
      throw new AssessmentExecutionError("Esta atividade não admite a correção declarada.");
    return { ...response, ...result, skill: skill ?? activity.skill };
  };

  if (definition.method === "adaptive") {
    if (responses.length !== definition.skillPlan.length)
      throw new AssessmentExecutionError("Complete a sequência de questões da avaliação.");
    const answers: AdaptiveAnswer[] = [];
    for (const response of responses) {
      const next = nextAdaptiveItem(definition.bank, answers, definition.skillPlan);
      if (!next || next.activityId !== response.activityId)
        throw new AssessmentExecutionError(
          "A sequência de respostas não corresponde à avaliação adaptativa.",
        );
      const result = grade(response, next.skill);
      if (result.correct === null)
        throw new AssessmentExecutionError("O método adaptativo exige respostas objetivas.");
      answers.push({ ...result, correct: result.correct, difficulty: next.difficulty });
    }
    const report = adaptiveAssessmentReport(
      answers,
      definition.skillPlan,
      definition.passingPolicy,
      definition.skillWeights,
    );
    const insufficient = report.bySkill.some(
      (item) => item.status === "insufficient" || item.status === "not_assessed",
    );
    return {
      definition,
      answers,
      status: insufficient ? ("insufficient" as const) : ("completed" as const),
      objectiveScore: insufficient ? null : report.score,
      passed: insufficient ? null : report.passed,
      responseKey: JSON.stringify(responses),
    };
  }

  if (
    responses.length !== definition.activityIds.length ||
    responses.some((item) => !definition.activityIds.includes(item.activityId))
  )
    throw new AssessmentExecutionError(
      "Envie as respostas das atividades declaradas nesta avaliação.",
    );
  const byId = new Map(responses.map((item) => [item.activityId, item]));
  const answers = definition.activityIds.map((id) => grade(byId.get(id)!));
  const objective = answers.filter((item) => item.correct !== null);
  if (!objective.length)
    throw new AssessmentExecutionError("Não há respostas objetivas para calcular este resultado.");
  const objectiveScore = Math.round(
    (100 * objective.filter((item) => item.correct).length) / objective.length,
  );
  const minimumsMet = Object.entries(definition.passingPolicy.minimumBySkill ?? {}).every(
    ([skill, minimum]) => {
      const items = objective.filter((item) =>
        activities.get(item.activityId)!.skills.includes(skill as AssessedAnswer["skill"]),
      );
      return (
        items.length > 0 &&
        (100 * items.filter((item) => item.correct).length) / items.length >= minimum * 100
      );
    },
  );
  return {
    definition,
    answers,
    status: "completed" as const,
    objectiveScore,
    passed: objectiveScore >= definition.passingPolicy.overall * 100 && minimumsMet,
    responseKey: JSON.stringify(definition.activityIds.map((id) => byId.get(id))),
  };
}

export function assessmentSummary(definition: AssessmentDefinition) {
  return {
    purpose: definition.purpose,
    method: definition.method,
    unitId: definition.unitId,
    lessonId: definition.lessonId,
  };
}
