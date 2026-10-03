import type { PublicCourse, PublicUnit } from "@/content/public";
import type { StudyState } from "./study-state";
import type { Skill } from "@/content/schema";
import { featureFlags } from "@/lib/feature-flags";

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
) {
  const activities = unit.lessons.flatMap((lesson) => lesson.activities);
  const lessonIds = new Set(unit.lessons.map((lesson) => lesson.id));
  const activityIds = new Set(activities.map((activity) => activity.id));
  const assessmentLesson = unit.lessons.find((lesson) =>
    lesson.activities.some((activity) => activity.type === "quiz"),
  );
  const assessmentIds = new Set(assessmentLesson?.activities.map((activity) => activity.id) ?? []);
  const completed = activities.filter((activity) =>
    state.completedActivityIds.includes(activity.id),
  ).length;
  const objective = activities.filter(
    (activity) => objectiveTypes.has(activity.type) && !assessmentIds.has(activity.id),
  );
  const latest = objective
    .map((activity) => state.attempts.find((attempt) => attempt.activityId === activity.id))
    .filter((attempt) => attempt !== undefined);
  const exerciseScore = latest.length
    ? Math.round((100 * latest.filter((attempt) => attempt.correct).length) / latest.length)
    : 0;
  const reviewSchedules = [
    ...vocabularyItems
      .filter((item) => lessonIds.has(item.lessonId))
      .map((item) => state.vocabulary[item.id]?.schedule)
      .filter((item) => item !== undefined),
    ...Object.values(state.mistakes)
      .filter((item) => activityIds.has(item.activityId))
      .map((item) => item.schedule),
  ];
  const reviewScore = reviewSchedules.length
    ? Math.round(
        reviewSchedules.reduce((sum, item) => sum + item.masteryScore, 0) / reviewSchedules.length,
      )
    : 0;
  const assessment =
    assessmentLesson?.activities.filter((activity) => objectiveTypes.has(activity.type)) ?? [];
  const assessmentWriting =
    assessmentLesson?.activities.filter((activity) => activity.type === "writing") ?? [];
  const assessmentAttempts = assessment
    .map((activity) => state.attempts.find((attempt) => attempt.activityId === activity.id))
    .filter((attempt) => attempt !== undefined);
  const assessmentScore = assessmentAttempts.length
    ? Math.round(
        (100 * assessmentAttempts.filter((attempt) => attempt.correct).length) /
          assessmentAttempts.length,
      )
    : 0;
  const assessmentFinished =
    Boolean(assessmentLesson) &&
    assessmentAttempts.length === assessment.length &&
    assessmentWriting.every((activity) =>
      state.writing.some((submission) => submission.activityId === activity.id),
    );
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
  const isCompleted = completed === activities.length;
  return {
    completed,
    total: activities.length,
    percentage: activities.length ? Math.round((100 * completed) / activities.length) : 0,
    isCompleted,
    exerciseScore,
    reviewScore,
    assessmentScore,
    assessmentFinished,
    writingDone,
    speakingDone,
    isMastered:
      isCompleted &&
      exerciseScore >= 80 &&
      (!featureFlags.SPACED_REPETITION || reviewScore >= 80) &&
      writingDone &&
      (!featureFlags.SPEAKING || speakingDone) &&
      assessmentFinished &&
      assessmentScore >= 75,
  };
}

export function courseProgress(course: PublicCourse, state: StudyState) {
  const units = course.units.filter((unit) => unit.active);
  const total = units.reduce(
    (sum, unit) => sum + unit.lessons.flatMap((lesson) => lesson.activities).length,
    0,
  );
  const completed = units.reduce((sum, unit) => sum + unitProgress(unit, state).completed, 0);
  return total ? Math.round((100 * completed) / total) : 0;
}

export function currentUnit(course: PublicCourse, state: StudyState) {
  const active = course.units.filter((unit) => unit.active);
  return active.find((unit) => !unitProgress(unit, state).isCompleted) ?? active.at(-1);
}

export function skillProgress(course: PublicCourse, state: StudyState, skill: Skill) {
  const activities = course.units
    .flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
    .filter((activity) => (activity.skills.length ? activity.skills.includes(skill) : activity.skill === skill));
  const attempts = activities
    .map((activity) => state.attempts.find((attempt) => attempt.activityId === activity.id))
    .filter((attempt) => attempt !== undefined);
  const performance = attempts.length
    ? Math.round((100 * attempts.filter((attempt) => attempt.correct).length) / attempts.length)
    : null;
  const completed = activities.filter((activity) =>
    state.completedActivityIds.includes(activity.id),
  ).length;
  return { completed, total: activities.length, performance };
}
