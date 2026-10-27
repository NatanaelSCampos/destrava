import type { Course } from "@/content/schema";
import type { LiveTopicContext } from "./live-contract";
import type { LearningAccessSnapshot } from "@/domain/study/learning-access";
export function studiedLiveTopics(
  course: Course,
  studied: ReadonlySet<string>,
  access: LearningAccessSnapshot,
): LiveTopicContext[] {
  if (access.courseId !== course.id || access.contentVersion !== course.contentVersion) return [];
  const examIds = new Set(
    course.assessments.flatMap((a) => (a.method === "fixed" && a.exam ? a.activityIds : [])),
  );
  return course.units
    .filter((unit) => unit.active && access.units[unit.id]?.allowed)
    .flatMap((unit) =>
      unit.lessons
        .filter((lesson) => lesson.active && !lesson.interactiveLessonRef)
        .flatMap((lesson) => {
          const done = lesson.activities.filter((a) => studied.has(a.id) && !examIds.has(a.id));
          if (!done.length) return [];
          const examples: LiveTopicContext["examples"] = [];
          for (const a of done) {
            const payload = a as unknown as {
              teaching?: { lines?: Array<{ text?: unknown; translation?: unknown }> };
            };
            for (const line of payload.teaching?.lines ?? []) {
              if (typeof line.text !== "string" || examples.some((x) => x.text === line.text))
                continue;
              examples.push({
                text: line.text.slice(0, 260),
                translation:
                  typeof line.translation === "string" ? line.translation.slice(0, 260) : "",
              });
              if (examples.length >= 8) break;
            }
          }
          return [
            {
              id: lesson.id,
              title: lesson.title,
              description: lesson.description,
              unitId: unit.id,
              unitTitle: unit.title,
              unitNumber: unit.number,
              lessonOrder: lesson.order,
              studiedActivities: done.length,
              examples: examples.slice(0, 8),
              objectives: Object.values(lesson.objectiveLabels ?? {}).slice(0, 6),
            },
          ];
        }),
    );
}
