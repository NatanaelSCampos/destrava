import type { PublicCourse } from "@/content/public";
import type { InteractiveLessonDefinition } from "@/content/contracts";

export type CourseLessonLocation = { courseSlug: string; unitSlug: string; lessonSlug: string };
export function courseLessonPath(course: { slug: string }, unit: { number: number }, lesson: { slug: string }) {
  return `/course/${encodeURIComponent(course.slug)}/unit/${unit.number}/lesson/${encodeURIComponent(lesson.slug)}`;
}
/** Resolve the exact active lesson. A course URL never selects a fallback lesson. */
export function resolveCourseLesson(course: PublicCourse, location: CourseLessonLocation) {
  if (location.courseSlug !== course.slug) return undefined;
  const unit = course.units.find(item => item.slug === location.unitSlug || String(item.number) === location.unitSlug);
  if (!unit?.active || course.availability?.unavailableUnitIds?.includes(unit.id)) return undefined;
  const lesson = unit.lessons.find(item => item.slug === location.lessonSlug);
  return lesson?.active ? { unit, lesson } : undefined;
}
export function courseInteractiveLesson(course: PublicCourse, definitions: InteractiveLessonDefinition[], location: CourseLessonLocation) {
  const resolved = resolveCourseLesson(course, location);
  if (!resolved || !resolved.lesson.interactiveLessonRef || course.availability?.unavailableInteractiveLessonIds?.includes(resolved.lesson.interactiveLessonRef)) return undefined;
  const definition = definitions.find(item => item.id === resolved.lesson.interactiveLessonRef && item.lessonId === resolved.lesson.id);
  return definition ? { ...resolved, definition } : undefined;
}
