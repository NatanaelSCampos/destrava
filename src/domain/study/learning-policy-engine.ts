import type { PublicCourse, PublicUnit } from "@/content/public";
import type { LearningPolicy, LearningRequirement } from "@/content/learning-policies";
import type { StudyState } from "./study-state";
import { assessmentActivityIds, resolveAssessment } from "@/content/assessment-references";

export type PolicyStatus =
  "not_required" | "pending" | "satisfied" | "not_met" | "not_assessed" | "unavailable";
export type RequirementResult = {
  id: string;
  label: string;
  kind: LearningRequirement["kind"];
  status: PolicyStatus;
  score: number | null;
  observed: number;
  required: number;
  progress: number;
  activityIds: string[];
  assessmentId?: string;
  minimumScore?: number;
};
export type PolicyResult = {
  status: PolicyStatus;
  percentage: number;
  requirements: RequirementResult[];
};
export type PolicyCourse = Pick<
  PublicCourse,
  "id" | "contentVersion" | "assessments" | "availability"
>;

export function currentAssessmentResult(
  course: PolicyCourse,
  state: StudyState,
  assessmentId: string,
) {
  const definition = resolveAssessment(course.assessments, assessmentId)!;
  const candidates =
    definition.method === "fixed" ? state.assessmentAttempts : state.adaptiveAssessments;
  return candidates
    .filter(
      (item) =>
        item.assessmentId === definition.id &&
        item.courseId === course.id &&
        item.source === "server" &&
        item.contentVersion === course.contentVersion &&
        item.purpose === definition.purpose &&
        item.method === definition.method,
    )
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
}

function aggregate(requirements: RequirementResult[]): PolicyResult {
  if (!requirements.length) return { status: "not_required", percentage: 100, requirements };
  const status = requirements.every((item) => item.status === "satisfied")
    ? "satisfied"
    : (["unavailable", "not_met", "not_assessed", "pending"].find((status) =>
        requirements.some((item) => item.status === status),
      ) as PolicyStatus);
  return {
    status,
    percentage: Math.round(
      (100 * requirements.reduce((sum, item) => sum + item.progress, 0)) / requirements.length,
    ),
    requirements,
  };
}

/** Pure AND evaluator. No host flags, providers, clock, scripts or persisted policy decisions. */
export function evaluateUnitPolicies(unit: PublicUnit, state: StudyState, course?: PolicyCourse) {
  const policy = unit.learningPolicy;
  if (!policy || !course || course.availability?.unavailableUnitIds?.includes(unit.id) || (state.courseId && state.courseId !== course.id)) {
    const unavailable: PolicyResult = { status: "unavailable", percentage: 0, requirements: [] };
    return { completion: unavailable, mastery: unavailable };
  }
  const activities = new Map(
    unit.lessons.flatMap((lesson) =>
      lesson.activities.map((activity) => [activity.id, activity] as const),
    ),
  );
  const available = (id: string) =>
    activities.has(id) && !course.availability?.unavailableActivityIds.includes(id);
  const completed = new Set(state.completedActivityIds);
  function evaluate(group: LearningPolicy, completion?: PolicyResult): PolicyResult {
    return aggregate(
      group.requirements.map<RequirementResult>((rule) => {
        const result: RequirementResult = {
          id: rule.id,
          label: rule.label,
          kind: rule.kind,
          status: "not_assessed",
          score: null,
          observed: 0,
          required: 1,
          progress: 0,
          activityIds: "activityIds" in rule ? rule.activityIds : [],
          minimumScore: "minimumScore" in rule ? rule.minimumScore : undefined,
        };
        const countResult = (observed: number, required: number, capacity: number) => ({
          ...result,
          observed,
          required,
          status:
            observed >= required
              ? ("satisfied" as const)
              : capacity < required
                ? ("unavailable" as const)
                : ("pending" as const),
          progress: Math.min(1, observed / required),
        });
        if (rule.kind === "unit_completed")
          return {
            ...result,
            status:
              completion?.status === "satisfied" || completion?.status === "not_required"
                ? "satisfied"
                : (completion?.status ?? "unavailable"),
            observed:
              completion?.status === "satisfied" || completion?.status === "not_required" ? 1 : 0,
            progress: (completion?.percentage ?? 0) / 100,
          };
        if (rule.kind === "participation")
          return countResult(
            rule.activityIds.filter((id) => available(id) && completed.has(id)).length,
            rule.minimumCount ?? rule.activityIds.length,
            rule.activityIds.filter(available).length,
          );
        if (rule.kind === "submission") {
          const submitted = (id: string) =>
            rule.practice === "writing"
              ? state.writing.some((item) => item.activityId === id && item.text.trim().length > 0)
              : state.speaking.some(
                  (item) =>
                    item.activityId === id &&
                    Boolean(item.transcription.trim() || item.audioUrl || item.audioPath),
                );
          return countResult(
            rule.activityIds.filter((id) => available(id) && submitted(id)).length,
            rule.minimumCount,
            rule.activityIds.filter(available).length,
          );
        }
        if (rule.kind === "assessment") {
          result.assessmentId = rule.assessmentId;
          const definition = resolveAssessment(
            course!.assessments,
            rule.assessmentId,
            rule.purpose,
          )!;
          result.activityIds = assessmentActivityIds(definition);
          // For course-scope assessments, availability is checked by the projection's explicit list.
          if (
            course!.availability?.unavailableAssessmentIds?.includes(definition.id) ||
            result.activityIds.some((id) =>
              course!.availability?.unavailableActivityIds.includes(id),
            )
          )
            return { ...result, status: "unavailable" };
          const attempt = currentAssessmentResult(course!, state, definition.id);
          if (!attempt || attempt.status !== "completed" || attempt.objectiveScore == null)
            return result;
          if (rule.minimumScore === undefined && attempt.passed == null) return result;
          const met =
            rule.minimumScore === undefined
              ? attempt.passed === true
              : attempt.objectiveScore >= rule.minimumScore;
          return {
            ...result,
            status: met ? "satisfied" : "not_met",
            score: attempt.objectiveScore,
            observed: 1,
            progress: met ? 1 : 0,
          };
        }
        if (rule.kind === "objective_score") {
          result.required = rule.minimumSamples;
          const usable = rule.activityIds.filter(available);
          if (usable.length < rule.minimumSamples) return { ...result, status: "unavailable" };
          const answers = usable
            .map(
              (id) =>
                state.attempts
                  .filter((item) => item.activityId === id && item.correct !== null)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
            )
            .filter((item) => item !== undefined);
          result.observed = answers.length;
          if (answers.length < rule.minimumSamples) return result;
          result.score =
            (100 * answers.filter((item) => item.correct === true).length) / answers.length;
        } else {
          result.required = rule.minimumSamples;
          if (course!.availability?.spacedRepetition === false)
            return { ...result, status: "unavailable" };
          const usable = rule.activityIds.filter(available);
          if (usable.length + rule.vocabularyIds.length < rule.minimumSamples)
            return { ...result, status: "unavailable" };
          const schedules = [
            ...rule.vocabularyIds.map((id) => state.vocabulary[id]?.schedule),
            ...usable.map((id) => state.mistakes[id]?.schedule),
          ].filter((item) => item && item.reviewCount >= rule.minimumReviews);
          result.observed = schedules.length;
          if (schedules.length < rule.minimumSamples) return result;
          result.score =
            schedules.reduce((sum, item) => sum + item!.masteryScore, 0) / schedules.length;
        }
        const met = result.score! >= rule.minimumScore;
        return { ...result, status: met ? "satisfied" : "not_met", progress: met ? 1 : 0 };
      }),
    );
  }
  const completion = evaluate(policy.completion);
  return { completion, mastery: evaluate(policy.mastery, completion) };
}

export function outstandingPolicyActivityIds(
  unit: PublicUnit,
  state: StudyState,
  course: PolicyCourse,
) {
  const result = evaluateUnitPolicies(unit, state, course);
  return new Set(
    [...result.completion.requirements, ...result.mastery.requirements]
      .filter(
        (item) =>
          item.status !== "satisfied" &&
          item.status !== "unavailable" &&
          item.kind !== "assessment",
      )
      .flatMap((item) =>
        item.activityIds.filter((id) => {
          if (item.kind === "participation") return !state.completedActivityIds.includes(id);
          if (item.kind === "objective_score") {
            const latest = state.attempts
              .filter((attempt) => attempt.activityId === id && attempt.correct !== null)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            return !latest || latest.correct === false;
          }
          return true;
        }),
      ),
  );
}
