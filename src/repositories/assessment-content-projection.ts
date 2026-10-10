import type { CoursePackage } from "@/content/contracts";
import { assessmentActivityIds } from "@/content/assessment-references";

export function assessmentSeedRows(course: CoursePackage) {
  return course.assessments.map((definition) => ({
    id: definition.id,
    course_id: course.id,
    unit_id: definition.unitId ?? null,
    lesson_id: definition.lessonId ?? null,
    title: definition.title,
    purpose: definition.purpose,
    method: definition.method,
    definition,
    passing_score: Math.round(definition.passingPolicy.overall * 100),
    active: true,
    activityIds: assessmentActivityIds(definition),
  }));
}
