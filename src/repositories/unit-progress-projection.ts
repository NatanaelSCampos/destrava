import type { PublicCourse, PublicUnit } from "@/content/public";
import type { StudyState } from "@/domain/study/study-state";
import { unitProgress } from "@/domain/study/progress";

/** Derived/read-model data only. Reloads always recompute from source evidence. */
export function projectUnitProgress(
  userId: string,
  course: PublicCourse,
  unit: PublicUnit,
  state: StudyState,
  vocabulary: ReadonlyArray<{ id: string; lessonId: string }>,
  now: string,
) {
  const progress = unitProgress(unit, state, vocabulary, course);
  return {
    user_id: userId,
    unit_id: unit.id,
    content_version: course.contentVersion,
    completion_percent: progress.percentage,
    participation_percent: progress.participationPercentage,
    completed_at: progress.isCompleted ? now : null,
    mastered_at: progress.isMastered ? now : null,
    exercise_score: progress.exerciseScore,
    review_score: progress.reviewScore,
    assessment_score: progress.assessmentScore,
    policy_state: { completion: progress.completion, mastery: progress.mastery },
    updated_at: now,
  };
}
