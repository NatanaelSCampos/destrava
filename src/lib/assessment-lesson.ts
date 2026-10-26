import type { PublicCourse, PublicLesson, PublicUnit } from "@/content/public";
import { assessmentActivityIds } from "@/content/assessment-references";

/** Assessment banks are identified by declared references, never by a lesson name. */
export function assessmentsForLesson(
  course: Pick<PublicCourse, "assessments">,
  unit: Pick<PublicUnit, "id">,
  lesson: Pick<PublicLesson, "id" | "activities">,
): PublicCourse["assessments"] {
  if (!lesson.activities.length) return [];

  const assessments = course.assessments.filter(
    (assessment) =>
      assessment.lessonId === lesson.id &&
      (assessment.unitId === undefined || assessment.unitId === unit.id),
  );
  const assessedIds = new Set(assessments.flatMap(assessmentActivityIds));

  const byId = new Map(lesson.activities.map(activity => [activity.id, activity]));
  if (!assessedIds.size || [...assessedIds].some(id => !byId.has(id))) return [];
  const supportIds = new Set(lesson.activities.filter(activity => assessedIds.has(activity.id))
    .flatMap(activity => activity.supportActivityIds ?? []));
  return lesson.activities.every(activity => assessedIds.has(activity.id) ||
    (activity.type === "lesson_content" && supportIds.has(activity.id))) ? assessments : [];
}
