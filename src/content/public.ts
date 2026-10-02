import type { Activity, Course, Lesson, Unit } from "./schema";
import { isActivityEnabled } from "@/lib/feature-flags";

export type PublicActivity = Activity extends infer A
  ? A extends Activity
    ? Omit<A, "answer" | "accepted" | "fullAnswers" | "pairs" | "explanation">
    : never
  : never;
export type PublicLesson = Omit<Lesson, "activities"> & { activities: PublicActivity[] };
export type PublicUnit = Omit<Unit, "lessons"> & { lessons: PublicLesson[] };
export type PublicCourse = Omit<Course, "units"> & { units: PublicUnit[] };

export function publicCourse(course: Course): PublicCourse {
  return {
    ...course,
    units: course.units
      .filter((unit) => unit.active)
      .map((unit) => ({
        ...unit,
        lessons: unit.lessons
          .filter((lesson) => lesson.active)
          .map((lesson) => ({
            ...lesson,
            activities: lesson.activities
              .filter((activity) => isActivityEnabled(activity.type))
              .map((activity) => {
                const safe = { ...activity } as Record<string, unknown>;
                for (const privateField of [
                  "answer",
                  "accepted",
                  "fullAnswers",
                  "pairs",
                  "explanation",
                ])
                  delete safe[privateField];
                return safe as PublicActivity;
              }),
          }))
          .filter((lesson) => lesson.activities.length > 0),
      })),
  };
}
