import type { StudyState } from "@/domain/study/study-state";
import { reviewStructures } from "@/content/review-structures";
import { ReviewScheduler } from "./review-scheduler";

export function dueReviewCounts(
  state: Pick<StudyState, "vocabulary" | "mistakes"> & {
    structureReviews?: StudyState["structureReviews"];
  },
  vocabularyItems: ReadonlyArray<{ id: string }>,
  now = new Date(),
  activityIds?: ReadonlySet<string>,
) {
  const words = vocabularyItems.filter((word) => {
    const item = state.vocabulary[word.id];
    return item && ReviewScheduler.isDue(item.schedule, now);
  }).length;
  const mistakes = Object.values(state.mistakes).filter(
    (item) =>
      (!activityIds || activityIds.has(item.activityId)) &&
      ReviewScheduler.isDue(item.schedule, now),
  ).length;

  const structures = reviewStructures.filter((item) => {
    const progress = state.structureReviews?.[item.id];
    return progress && ReviewScheduler.isDue(progress.schedule, now);
  }).length;

  return { words, mistakes, structures, total: words + mistakes + structures };
}
