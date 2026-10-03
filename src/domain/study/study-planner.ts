import type { PublicCourse, PublicActivity } from "@/content/public";
import type { PlannedItem, PlannedReviewItem, SessionMode, StudyState } from "./study-state";
import { buildLearningProfile } from "./learning-profile";
import { LearningRecommendationEngine } from "./learning-recommendation-engine";
import { featureFlags } from "@/lib/feature-flags";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import type { LanguageResources } from "@/content/language-resources";

function reviewCandidates(
  course: PublicCourse,
  state: StudyState,
  vocabularyItems: ReadonlyArray<{ id: string; lessonId: string }>,
  now: Date,
  mode: SessionMode,
  resources: Pick<LanguageResources, "structures">,
): PlannedReviewItem[] {
  const activityIds = new Set(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id)),
    ),
  );
  const lessonIds = new Set(
    course.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)),
  );
  const mistakes = Object.values(state.mistakes)
    .filter((item) => activityIds.has(item.activityId) && ReviewScheduler.isDue(item.schedule, now))
    .sort(
      (a, b) =>
        b.timesMissed - a.timesMissed ||
        a.schedule.nextReviewAt.localeCompare(b.schedule.nextReviewAt),
    )
    .map((item): PlannedReviewItem => ({ kind: "mistake", id: item.activityId }));
  const signalCounts = new Map<string, number>();
  for (const event of state.events)
    if (event.itemId && (event.type === "vocabulary_search" || event.type === "vocabulary_audio")) {
      const key = `${event.type}:${event.itemId}`;
      signalCounts.set(key, (signalCounts.get(key) ?? 0) + 1);
    }
  const words = vocabularyItems
    .filter((word) => {
      const progress = state.vocabulary[word.id];
      return (
        lessonIds.has(word.lessonId) &&
        progress &&
        (mode === "difficulties"
          ? progress.status === "difficult" ||
            (progress.schedule.reviewCount > 0 && progress.schedule.masteryScore < 50) ||
            (signalCounts.get(`vocabulary_search:${word.id}`) ?? 0) >= 3 ||
            (signalCounts.get(`vocabulary_audio:${word.id}`) ?? 0) >= 3
          : ReviewScheduler.isDue(progress.schedule, now))
      );
    })
    .sort((a, b) => {
      const first = state.vocabulary[a.id];
      const second = state.vocabulary[b.id];
      return (
        first.schedule.masteryScore - second.schedule.masteryScore ||
        first.schedule.nextReviewAt.localeCompare(second.schedule.nextReviewAt)
      );
    })
    .map((word): PlannedReviewItem => ({ kind: "word", id: word.id }));
  const structures = resources.structures.length
    ? resources.structures
        .filter((item) => {
          const progress = state.structureReviews?.[item.id];
          return (
            lessonIds.has(item.lessonId) &&
            progress &&
            (mode === "difficulties"
              ? progress.schedule.masteryScore < 50
              : ReviewScheduler.isDue(progress.schedule, now))
          );
        })
        .map((item): PlannedReviewItem => ({ kind: "structure", id: item.id }))
    : [];
  const pronunciation = Object.values(state.pronunciationReviews ?? {})
    .filter((item) => activityIds.has(item.activityId) && ReviewScheduler.isDue(item.schedule, now))
    .map((item): PlannedReviewItem => ({ kind: "pronunciation", id: item.id }));
  return [...mistakes, ...pronunciation, ...words, ...structures];
}

export function buildStudyPlan(
  course: PublicCourse,
  state: StudyState,
  dailyMinutes: number,
  vocabularyItems: ReadonlyArray<{ id: string; term?: string; spanish?: string; lessonId: string }>,
  resources: LanguageResources,
  now = new Date(),
  mode: SessionMode = "guided",
): PlannedItem[] {
  const profile = buildLearningProfile(course, state, vocabularyItems, resources, now);
  const recommendations = LearningRecommendationEngine.recommend(
    course,
    state,
    profile,
    vocabularyItems,
    resources,
    { now, includeReviews: false },
  );
  const plan: PlannedItem[] = [];
  const budget = Math.max(1, Math.round(dailyMinutes));
  const focusedConversation = mode === "difficulties" && budget >= 10
    ? resources.conversationScenarios.find((scenario) =>
        scenario.focusConceptIds?.some((id) =>
          profile.concepts.some((concept) => concept.id === id && concept.score !== null && concept.score < 75),
        ),
      ) ?? resources.conversationScenarios[0]
    : undefined;
  const activityBudget = budget - (focusedConversation ? 3 : 0);
  const candidates = featureFlags.SPACED_REPETITION
    ? reviewCandidates(course, state, vocabularyItems, now, mode, resources)
    : [];
  if (candidates.length) {
    const count = Math.min(candidates.length, Math.max(1, Math.floor(budget / 3)), 5);
    plan.push({
      kind: "review",
      id: "due",
      title: `Revisar ${count} ${count === 1 ? "item" : "itens"}`,
      minutes: count,
      reviewItems: candidates.slice(0, count),
    });
  }
  for (const recommendation of recommendations) {
    if (recommendation.kind !== "activity") continue;
    if (mode === "difficulties" && recommendation.source === "curriculum") continue;
    if (
      plan[0]?.kind === "review" &&
      plan[0].reviewItems?.some((item) => item.kind === "mistake" && item.id === recommendation.id)
    )
      continue;
    if (plan.reduce((sum, item) => sum + item.minutes, 0) + recommendation.minutes > activityBudget)
      continue;
    plan.push({
      kind: recommendation.kind,
      id: recommendation.id,
      title: recommendation.title,
      minutes: recommendation.minutes,
    });
    if (plan.length >= 7) break;
  }
  if (focusedConversation && plan.length > 0) {
    plan.push({
      kind: "conversation",
      id: focusedConversation.id,
      title: `Conversa curta: ${focusedConversation.title}`,
      minutes: 3,
    });
  }
  const review = plan.find((item) => item.kind === "review");
  if (review && review.reviewItems) {
    const remaining = budget - plan.reduce((sum, item) => sum + item.minutes, 0);
    const extra = candidates.slice(
      review.reviewItems.length,
      review.reviewItems.length + remaining,
    );
    if (extra.length) {
      review.reviewItems = [...review.reviewItems, ...extra];
      review.minutes += extra.length;
      review.title = `Revisar ${review.reviewItems.length} itens`;
    }
  }
  return plan;
}

export function nextActivity(course: PublicCourse, state: StudyState): PublicActivity | undefined {
  return course.units
    .flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
    .find((activity) => !state.completedActivityIds.includes(activity.id));
}
