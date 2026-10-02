import type { LearningRecommendation } from "@/domain/study/learning-recommendation-engine";
import { numberPracticeLink } from "@/domain/numbers/number-practice";

export function recommendationLink(courseSlug: string, item: LearningRecommendation) {
  if (item.kind === "number") return numberPracticeLink(item.id);
  return item.kind === "review"
    ? "/review"
    : `/course/${courseSlug}/unit/${item.unitNumber}/lesson/${item.lessonSlug}?activity=${encodeURIComponent(item.id)}`;
}
