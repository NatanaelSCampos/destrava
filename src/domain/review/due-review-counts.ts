import type { StudyState } from "@/domain/study/study-state";
import type { ReviewStructure } from "@/content/review-structures";
import { ReviewScheduler } from "./review-scheduler";

export function dueReviewCounts(
  state: Pick<StudyState, "vocabulary" | "mistakes"> & {
    structureReviews?: StudyState["structureReviews"];
    pronunciationReviews?: StudyState["pronunciationReviews"];
  },
  vocabularyItems: ReadonlyArray<{ id: string }>,
  now = new Date(),
  activityIds?: ReadonlySet<string>,
  structures: ReadonlyArray<ReviewStructure> = [],
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

  const dueStructures = structures.filter((item) => {
    const progress = state.structureReviews?.[item.id];
    return progress && ReviewScheduler.isDue(progress.schedule, now);
  }).length;
  const pronunciation = Object.values(state.pronunciationReviews ?? {}).filter(
    (item) => (!activityIds || activityIds.has(item.activityId)) && ReviewScheduler.isDue(item.schedule, now),
  ).length;

  return { words, mistakes, structures: dueStructures, pronunciation, total: words + mistakes + dueStructures + pronunciation };
}
