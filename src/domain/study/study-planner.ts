import type { PublicCourse, PublicActivity } from "@/content/public";
import type { StudyState } from "./study-state";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
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
): PlannedItem[] {
  const plan: PlannedItem[] = [];
  const dueWords = Object.entries(state.vocabulary)
    .filter(([, item]) => ReviewScheduler.isDue(item.schedule))
    .slice(0, 5);
  const dueMistakes = Object.values(state.mistakes)
    .filter((item) => ReviewScheduler.isDue(item.schedule))
    .slice(0, 3);
  if (featureFlags.SPACED_REPETITION && (dueWords.length || dueMistakes.length))
    plan.push({
      kind: "review",
      id: "due",
      title: "Revisão do dia",
      minutes: Math.min(8, Math.max(4, dueWords.length + dueMistakes.length)),
    });

  const all = course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities));
  const incomplete = all.filter((activity) => !state.completedActivityIds.includes(activity.id));
  const budget = Math.max(10, dailyMinutes);
  for (const activity of incomplete) {
    if (
      plan.reduce((sum, item) => sum + item.minutes, 0) + activity.minutes > budget &&
      plan.length > 0
    )
      continue;
    plan.push({
      kind: "activity",
      id: activity.id,
      title: activity.title,
      minutes: activity.minutes,
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
