import { findActivity, type Course } from "@/content/schema";
import type { LanguagePackage } from "@/content/contracts";
import { variantLabel } from "@/content/language-variant";

export type RelevantMistake = { activityId: string; originalAnswer: string; correctAnswer: string };

export class TutorContextBuilder {
  static build(
    course: Course,
    language: LanguagePackage,
    activityId: string | undefined,
    mistakes: RelevantMistake[],
    variantId: string,
  ) {
    const activity = activityId ? findActivity(course, activityId) : undefined;
    const unit = course.units.find((item) => item.lessons.some((lesson) =>
      lesson.activities.some((entry) => entry.id === activityId)));
    const lesson = unit?.lessons.find((item) => item.activities.some((entry) => entry.id === activityId));
    return {
      course: course.title,
      level: course.level,
      language: language.identity.nativeName,
      variant: variantLabel(language, variantId),
      unit: unit?.title ?? "Unidade atual",
      lesson: lesson?.title ?? "Curso",
      activity: activity ? {
        title: activity.title,
        prompt: activity.prompt,
        correctAnswer: "answer" in activity ? activity.answer : null,
        explanation: activity.explanation ?? null,
      } : null,
      mistakes: mistakes.slice(0, 3).map((item) => ({
        originalAnswer: item.originalAnswer.slice(0, 150),
        correctAnswer: item.correctAnswer.slice(0, 150),
      })),
    };
  }
}
