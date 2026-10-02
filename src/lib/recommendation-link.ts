import type { LearningRecommendation } from "@/domain/study/learning-recommendation-engine";
import { numberPracticeLink } from "@/domain/numbers/number-practice";

export function recommendationLink(courseSlug: string, item: LearningRecommendation) {
  if (item.kind === "number") return numberPracticeLink(item.id);
  if (item.kind === "conversation")
    return item.sessionId
      ? `/conversation?session=${encodeURIComponent(item.sessionId)}`
      : item.id === "free"
        ? "/conversation"
        : `/conversation?scenario=${encodeURIComponent(item.id)}`;
  if (item.kind === "image") return `/describe?scene=${encodeURIComponent(item.id)}`;
  return item.kind === "review"
    ? "/review"
    : `/course/${courseSlug}/unit/${item.unitNumber}/lesson/${item.lessonSlug}?activity=${encodeURIComponent(item.id)}`;
}
