import { frecuenciasA1 } from "@/content/frecuencias-a1";
import { findActivity } from "@/content/schema";

export type RelevantMistake = { activityId: string; originalAnswer: string; correctAnswer: string };

export class TutorContextBuilder {
  static build(activityId: string | undefined, mistakes: RelevantMistake[]) {
    const activity = activityId ? findActivity(frecuenciasA1, activityId) : undefined;
    const lesson = frecuenciasA1.units
      .flatMap((unit) => unit.lessons)
      .find((item) => item.activities.some((entry) => entry.id === activityId));
    return {
      course: frecuenciasA1.title,
      level: frecuenciasA1.level,
      unit:
        frecuenciasA1.units.find((unit) => unit.lessons.some((item) => item.id === lesson?.id))
          ?.title ?? "Unidade atual",
      lesson: lesson?.title ?? "Curso A1",
      activity: activity
        ? {
            title: activity.title,
            prompt: activity.prompt,
            correctAnswer: "answer" in activity ? activity.answer : null,
            explanation: activity.explanation ?? null,
          }
        : null,
      mistakes: mistakes.slice(0, 3).map((item) => ({
        originalAnswer: item.originalAnswer.slice(0, 150),
        correctAnswer: item.correctAnswer.slice(0, 150),
      })),
    };
  }
}
