import type { PublicCourse, PublicUnit } from "@/content/public";
import type { StudyState } from "./study-state";
import type { Skill } from "@/content/schema";
import { evaluateUnitPolicies, currentAssessmentResult, type PolicyCourse } from "./learning-policy-engine";
import { assessmentActivityIds, resolveAssessment } from "@/content/assessment-references";

const objectiveTypes = new Set([
  "multiple_choice",
  "true_false",
  "fill_blank",
  "ordering",
  "short_answer",
  "listening",
]);

export function unitProgress(
  unit: PublicUnit,
  state: StudyState,
  vocabularyItems: ReadonlyArray<{ id: string; lessonId: string }> = [],
  course?: PolicyCourse,
) {
  const activities = unit.lessons.flatMap((lesson) => lesson.activities);
  const lessonIds = new Set(unit.lessons.map((lesson) => lesson.id));
  const activityIds = new Set(activities.map((activity) => activity.id));
  const assessment = resolveAssessment(
    course?.assessments ?? [],
    unit.assessmentRefs.final,
    "summative",
  );
  const assessmentIds = new Set(assessment ? assessmentActivityIds(assessment) : []);
  const completed = activities.filter((activity) =>
    state.completedActivityIds.includes(activity.id),
  ).length;
  const objective = activities.filter(
    (activity) => objectiveTypes.has(activity.type) && !assessmentIds.has(activity.id),
  );
  const latest = objective
    .map((activity) => state.attempts.filter((attempt) => attempt.activityId === activity.id && attempt.correct !== null)
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0])
    .filter((attempt) => attempt !== undefined);
  const exerciseScore = latest.length
    ? Math.round((100 * latest.filter((attempt) => attempt.correct).length) / latest.length)
    : null;
  const reviewSchedules = [
    ...vocabularyItems
      .filter((item) => lessonIds.has(item.lessonId))
      .map((item) => state.vocabulary[item.id]?.schedule)
      .filter((item) => item !== undefined && item.reviewCount > 0),
    ...Object.values(state.mistakes)
      .filter((item) => activityIds.has(item.activityId))
      .map((item) => item.schedule).filter(item => item.reviewCount > 0),
  ];
  const reviewScore = reviewSchedules.length
    ? Math.round(
        reviewSchedules.reduce((sum, item) => sum + item.masteryScore, 0) / reviewSchedules.length,
      )
    : null;
  const candidates = !assessment
    ? []
    : assessment.method === "fixed"
      ? state.assessmentAttempts.filter((item) => item.assessmentId === assessment.id)
      : state.adaptiveAssessments.filter((item) => item.assessmentId === assessment.id);
  const result = assessment && course ? currentAssessmentResult(course,state,assessment.id) : undefined;
  const assessmentScore = result?.objectiveScore ?? null;
  const assessmentFinished = Boolean(
    result && result.status === "completed" && assessmentScore !== null,
  );
  const assessmentPassed = assessmentFinished ? (result?.passed ?? null) : null;
  const assessmentStatus = !assessment
    ? ("not_defined" as const)
    : !result
      ? candidates.length
        ? ("historical" as const)
        : ("not_taken" as const)
      : !assessmentFinished
        ? ("insufficient" as const)
        : assessmentPassed
          ? ("passed" as const)
          : ("failed" as const);
  const writingDone = activities.some(
    (activity) =>
      activity.type === "writing" &&
      !assessmentIds.has(activity.id) &&
      state.writing.some((submission) => submission.activityId === activity.id),
  );
  const speakingDone = activities.some(
    (activity) =>
      activity.type === "speaking" &&
      state.speaking.some((submission) => submission.activityId === activity.id),
  );
  const { completion, mastery } = evaluateUnitPolicies(unit,state,course);
  const isCompleted = completion.status === "satisfied" || completion.status === "not_required";
  return {
    completed,
    total: activities.length,
    percentage: completion.percentage,
    participationPercentage: activities.length ? Math.floor((1000 * completed) / activities.length) / 10 : 0,
    completion,
    mastery,
    isCompleted,
    exerciseScore,
    reviewScore,
    assessmentScore,
    assessmentFinished,
    assessmentDefined: Boolean(assessment),
    assessmentPassed,
    assessmentStatus,
    writingDone,
    speakingDone,
    isMastered: mastery.status === "satisfied",
  };
}

export function courseProgress(course: PublicCourse, state: StudyState) {
  const units = course.units.filter((unit) => unit.active);
  return units.length ? Math.round(units.reduce((sum,unit) =>
    sum + unitProgress(unit,state,[],course).percentage,0)/units.length) : 0;
}

/** Content coverage is independent of passing the course's completion policy. */
export function courseStudyProgress(course: PublicCourse, state: StudyState) {
  if (state.courseId && state.courseId !== course.id) return 0;
  const activityIds = new Set(
    course.units.filter((unit) => unit.active).flatMap((unit) =>
      unit.lessons.filter((lesson) => lesson.active).flatMap((lesson) =>
        lesson.activities.map((activity) => activity.id),
      ),
    ),
  );
  if (!activityIds.size) return 0;
  const completed = new Set(state.completedActivityIds.filter((id) => activityIds.has(id)));
  // Keep early progress visible in large courses and never round an unfinished course to 100%.
  return Math.floor((1000 * completed.size) / activityIds.size) / 10;
}

export function currentUnit(course: PublicCourse, state: StudyState) {
  const active = course.units.filter((unit) => unit.active);
  return active.find((unit) => !unitProgress(unit, state, [], course).isCompleted) ?? active.at(-1);
}

export function skillProgress(course: PublicCourse, state: StudyState, skill: Skill) {
  const activities = course.units
    .flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
    .filter((activity) =>
      activity.skills.length ? activity.skills.includes(skill) : activity.skill === skill,
    );
  const attempts = activities
    .map((activity) => state.attempts.filter((attempt) => attempt.activityId === activity.id && attempt.correct !== null)
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0])
    .filter((attempt) => attempt !== undefined);
  const performance = attempts.length
    ? Math.round((100 * attempts.filter((attempt) => attempt.correct).length) / attempts.length)
    : null;
  const completed = activities.filter((activity) =>
    state.completedActivityIds.includes(activity.id),
  ).length;
  const applicable = activities.length > 0 || course.units.some(unit => unit.skills.includes(skill));
  const status = !applicable ? "not_applicable" as const : activities.length === 0
    ? "unavailable" as const : performance === null ? "not_assessed" as const : "assessed" as const;
  return { completed, total: activities.length, performance, applicable,
    unavailable: applicable && activities.length === 0, status };
}
