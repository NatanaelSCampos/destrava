import type { CoursePackage } from "@/content/contracts";
import { assessmentActivityIds } from "@/content/assessment-references";
import { publicRequirements } from "@/content/capability-contracts";

export function assessmentSeedRows(course: CoursePackage) {
  return course.assessments.map((definition) => ({
    id: definition.id,
    course_id: course.id,
    unit_id: definition.unitId ?? null,
    lesson_id: definition.lessonId ?? null,
    title: definition.title,
    purpose: definition.purpose,
    method: definition.method,
    definition: { ...definition, ...(definition.capabilityRequirements ? { capabilityRequirements: publicRequirements(definition.capabilityRequirements) } : {}) },
    passing_score: Math.round(definition.passingPolicy.overall * 100),
    active: true,
    activityIds: assessmentActivityIds(definition),
  }));
}
