import type { Activity, Course, Lesson, Unit } from "./schema";
import { isActivityEnabled } from "@/lib/feature-flags";
import type { LanguagePackage } from "./contracts";
import { featureFlags } from "@/lib/feature-flags";

export type PublicActivity = Activity extends infer A
  ? A extends Activity
    ? Omit<A, "answer" | "accepted" | "fullAnswers" | "explanation">
    : never
  : never;
export type PublicLesson = Omit<Lesson, "activities"> & { activities: PublicActivity[] };
export type PublicUnit = Omit<Unit, "lessons"> & { lessons: PublicLesson[] };
export type LearningAvailability = {
  unavailableActivityIds: string[];
  spacedRepetition: boolean;
};
export type PublicCourse = Omit<Course, "units"> & { units: PublicUnit[]; availability?: LearningAvailability };

export function publicCourse(course: Course, language?: LanguagePackage): PublicCourse {
  const enabled = (activity: Activity) => isActivityEnabled(activity.type) &&
    (activity.type !== "speaking" || language?.capabilities.speechRecognition !== false) &&
    (activity.type !== "listening" || language?.capabilities.textToSpeech !== false || activity.media?.kind === "audio");
  return {
    ...course,
    availability: {
      unavailableActivityIds: course.units.flatMap(unit => unit.lessons.flatMap(lesson =>
        lesson.activities.filter(activity => !unit.active || !lesson.active || !enabled(activity)).map(activity => activity.id))),
      spacedRepetition: featureFlags.SPACED_REPETITION,
    },
    units: course.units
      .filter((unit) => unit.active)
      .map((unit) => ({
        ...unit,
        lessons: unit.lessons
          .filter((lesson) => lesson.active)
          .map((lesson) => ({
            ...lesson,
            activities: lesson.activities
              .filter(enabled)
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
      })),
  };
}
