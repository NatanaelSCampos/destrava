import type { PublicCourse, PublicActivity } from "@/content/public";
import type { StudyState } from "./study-state";
import { buildLearningProfile } from "./learning-profile";
import { LearningRecommendationEngine } from "./learning-recommendation-engine";
import { featureFlags } from "@/lib/feature-flags";

export type PlannedItem = {
  kind: "activity" | "review";
  id: string;
  title: string;
  minutes: number;
};

export function buildStudyPlan(
  course: PublicCourse,
  state: StudyState,
  dailyMinutes: number,
  vocabularyItems: ReadonlyArray<{ id: string; spanish: string; lessonId: string }> = [],
  now = new Date(),
): PlannedItem[] {
  const profile = buildLearningProfile(course, state, vocabularyItems, now);
  const recommendations = LearningRecommendationEngine.recommend(
    course,
    state,
    profile,
    vocabularyItems,
    { now, includeReviews: featureFlags.SPACED_REPETITION },
  );
  const plan: PlannedItem[] = [];
  const budget = Math.max(10, dailyMinutes);
  for (const recommendation of recommendations) {
    if (
      plan.reduce((sum, item) => sum + item.minutes, 0) + recommendation.minutes > budget &&
      plan.length > 0
    )
      continue;
    plan.push({
      kind: recommendation.kind,
      id: recommendation.id,
      title: recommendation.title,
      minutes: recommendation.minutes,
    });
    if (plan.length >= 7) break;
  }
  return plan;
}

export function nextActivity(course: PublicCourse, state: StudyState): PublicActivity | undefined {
  return course.units
    .flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
    .find((activity) => !state.completedActivityIds.includes(activity.id));
}
