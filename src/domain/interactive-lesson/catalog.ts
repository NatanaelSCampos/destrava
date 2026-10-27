import type { PublicCourse } from "@/content/public";
import type { InteractiveLessonDefinition } from "@/content/contracts";
import type { LearningAccessSnapshot } from "@/domain/study/learning-access";
import { courseLessonPath } from "@/lib/course-lesson-navigation";
import { learningActionAvailability } from "@/domain/study/learning-action-availability";
export type GuidedCatalogDefinition = Pick<InteractiveLessonDefinition,
  "id" | "courseId" | "unitId" | "lessonId" | "title" | "estimatedMinutes">;

/** Current-course catalog only. The normal unit URL and server guards remain authoritative. */
export function guidedLessonCatalog(course: PublicCourse, definitions: GuidedCatalogDefinition[], access: LearningAccessSnapshot | null = null) {
  const current = access?.courseId === course.id && access.contentVersion === course.contentVersion ? access : null;
  return course.units.filter(unit => unit.active).flatMap(unit => unit.lessons.filter(lesson => lesson.active).flatMap(lesson => {
    const definition = definitions.find(item => item.courseId === course.id && item.unitId === unit.id &&
      item.lessonId === lesson.id && item.id === lesson.interactiveLessonRef);
    if (!definition) return [];
    const locked = Boolean(unit.access && (!current?.units[unit.id]?.allowed || course.availability?.lockedUnitIds?.includes(unit.id)));
    const unavailable = Boolean(course.availability?.unavailableUnitIds?.includes(unit.id) ||
      course.availability?.unavailableInteractiveLessonIds?.includes(definition.id));
    const action = learningActionAvailability(course, { kind: "interactive", id: definition.id }, { source: "compiled", permitted: true });
    return [{ ...definition, unitNumber: unit.number, unitTitle: unit.title, description: lesson.description,
      href: courseLessonPath(course, unit, lesson), available: !locked && !unavailable && action.eligible,
      message: locked ? "Conclua a prova da unidade anterior para abrir esta aula."
        : unavailable || !action.eligible ? "Esta aula está temporariamente indisponível." : "" }];
  }));
}
