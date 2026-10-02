import type { LearningRecommendation } from "@/domain/study/learning-recommendation-engine";

export function recommendationLink(courseSlug: string, item: LearningRecommendation) {
  return item.kind === "review"
    ? "/review"
    : `/course/${courseSlug}/unit/${item.unitNumber}/lesson/${item.lessonSlug}?activity=${encodeURIComponent(item.id)}`;
}
