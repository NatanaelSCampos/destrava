import type { Activity, Course, Lesson, Unit } from "./schema";
import { isActivityEnabled } from "@/lib/feature-flags";
import type { LanguagePackage } from "./contracts";

export type PublicActivity = Activity extends infer A
  ? A extends Activity
    ? Omit<A, "answer" | "accepted" | "fullAnswers" | "explanation">
    : never
  : never;
export type PublicLesson = Omit<Lesson, "activities"> & { activities: PublicActivity[] };
export type PublicUnit = Omit<Unit, "lessons"> & { lessons: PublicLesson[] };
export type PublicCourse = Omit<Course, "units"> & { units: PublicUnit[] };

export function publicCourse(course: Course, language?: LanguagePackage): PublicCourse {
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
              .filter((activity) => isActivityEnabled(activity.type) &&
                (activity.type !== "speaking" || language?.capabilities.speechRecognition !== false) &&
                (activity.type !== "listening" || language?.capabilities.textToSpeech !== false || activity.media?.kind === "audio"))
              .map((activity) => {
                const safe = { ...activity } as Record<string, unknown>;
                for (const privateField of [
                  "answer",
                  "accepted",
                  "fullAnswers",
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
