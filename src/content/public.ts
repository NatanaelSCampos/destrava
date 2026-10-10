import type { Activity, Course, Lesson, Unit } from "./schema";
import type { LanguagePackage } from "./contracts";
import { featureFlags } from "@/lib/feature-flags";
import { publicRequirements } from "./capability-contracts";
export { publicRequirements } from "./capability-contracts";
import {
  negotiateCapabilities,
  type CapabilityEnvironment,
} from "@/engine/capabilities/compatibility";
import { projectCapabilityAvailability } from "@/engine/capabilities/availability-projection";
import { serverCapabilityEnvironment } from "@/lib/capability-environment";

export type PublicActivity = Activity extends infer A
  ? A extends Activity
    ? Omit<
        A,
        "answer" | "answerOrder" | "accepted" | "fullAnswers" | "explanation" | "answerPolicy"
      >
    : never
  : never;
export type PublicLesson = Omit<Lesson, "activities"> & { activities: PublicActivity[] };
export type PublicUnit = Omit<Unit, "lessons"> & { lessons: PublicLesson[] };
export type LearningAvailability = {
  unavailableActivityIds: string[];
  unavailableUnitIds?: string[];
  unavailableAssessmentIds?: string[];
  unavailableInteractiveLessonIds?: string[];
  scopeLocations?: Record<string, string>;
  interactiveLessonLocations?: Record<string, string>;
  reasons?: Record<string, string[]>;
  spacedRepetition: boolean;
};
export type PublicCourse = Omit<Course, "units" | "capabilityRequests"> & {
  units: PublicUnit[];
  availability?: LearningAvailability;
};

export function publicCourse(
  course: Course,
  language?: LanguagePackage,
  environment?: CapabilityEnvironment,
  preference?: unknown,
): PublicCourse {
  const report = course.capabilityRequests
    ? (() => {
        const reports = course.capabilityRequests!.map((request) => {
          const scopedActivity = course.units
            .flatMap((unit, u) =>
              unit.lessons.flatMap((lesson, l) =>
                lesson.activities.map((activity, a) => ({
                  activity,
                  location: `course.units[${u}].lessons[${l}].activities[${a}]`,
                })),
              ),
            )
            .find(
              (item) =>
                request.location === item.location ||
                request.location.startsWith(`${item.location}.`),
            );
          const effective = scopedActivity?.activity.variant?.requiredVariant ?? preference;
          return negotiateCapabilities(
            [request],
            environment ??
              (language
                ? serverCapabilityEnvironment(
                    language,
                    typeof effective === "string" ? effective : undefined,
                    course,
                  )
                : {}),
          );
        });
        return {
          compatible: reports.every((r) => r.compatible),
          readiness: reports.some((r) => r.readiness === "unavailable")
            ? ("unavailable" as const)
            : reports.some((r) => r.readiness === "unknown")
              ? ("unknown" as const)
              : ("ready" as const),
          diagnostics: reports.flatMap((r) => r.diagnostics),
          selections: reports.flatMap((r) => r.selections),
        };
      })()
    : course.capabilityReport;
  const interactiveLessonLocations = Object.fromEntries(
    (course.capabilityRequests ?? [])
      .filter((item) => item.requirement.id === "lesson.interactive")
      .map((item) => [String(item.requirement.data?.id), item.location]),
  );
  const projected = projectCapabilityAvailability(
    course,
    report?.diagnostics ?? [],
    undefined,
    interactiveLessonLocations,
  );
  // Explicit destructuring prevents private capability request payloads crossing the SSR boundary.
  const { capabilityRequests: privateRequests, ...safeCourse } = course;
  void privateRequests;
  return {
    ...safeCourse,
    capabilityRequirements: publicRequirements(course.capabilityRequirements),
    languageRequirements: publicRequirements(course.languageRequirements),
    assessments: course.assessments.map((item) => ({
      ...item,
      capabilityRequirements: publicRequirements(item.capabilityRequirements),
    })),
    capabilityReport: report,
    availability: {
      ...projected,
      spacedRepetition: featureFlags.SPACED_REPETITION,
    },
    units: course.units
      .filter((unit) => unit.active)
      .map((unit) => ({
        ...unit,
        capabilityRequirements: publicRequirements(unit.capabilityRequirements),
        lessons: unit.lessons
          .filter((lesson) => lesson.active)
          .map((lesson) => ({
            ...lesson,
            capabilityRequirements: publicRequirements(lesson.capabilityRequirements),
            activities: lesson.activities.map((activity) => {
              const safe = { ...activity } as Record<string, unknown>;
              safe.capabilityRequirements = publicRequirements(activity.capabilityRequirements);
              for (const privateField of [
                "answer",
                "answerOrder",
                "accepted",
                "fullAnswers",
                "explanation",
                "answerPolicy",
              ])
                delete safe[privateField];
              return safe as PublicActivity;
            }),
          })),
      })),
  };
}
