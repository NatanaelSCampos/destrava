import type { Activity, Course, Lesson, Unit } from "./schema";
import { publicPresentation } from "./text-presentation";
import { interactiveLessonSchema, type LanguagePackage } from "./contracts";
import { featureFlags } from "@/lib/feature-flags";
import { publicRequirements } from "./capability-contracts";
export { publicRequirements } from "./capability-contracts";
import {
  negotiateCapabilities,
  type CapabilityEnvironment,
} from "@/engine/capabilities/compatibility";
import { projectCapabilityAvailability, projectActionAvailability, type ActionAvailabilityState, type InteractiveLessonAvailabilityScope } from "@/engine/capabilities/availability-projection";
import { serverCapabilityEnvironment } from "@/lib/capability-environment";

export type PublicActivity = Activity extends infer A
  ? A extends Activity
    ? Omit<
        A,
        "answer" | "answerOrder" | "accepted" | "fullAnswers" | "explanation" | "answerPolicy" | "feedback"
      >
    : never
  : never;
export type PublicLesson = Omit<Lesson, "activities" | "deferredRecovery"> & {
  activities: PublicActivity[];
  deferredRecovery?: Omit<NonNullable<Lesson["deferredRecovery"]>, "rules"> & {
    rules: Array<Omit<NonNullable<Lesson["deferredRecovery"]>["rules"][number], "activity"> & { activity: PublicActivity }>;
  };
};
export function publicActivity(activity: Activity): PublicActivity {
  const safe = { ...activity } as Record<string, unknown>;
  safe.capabilityRequirements = publicRequirements(activity.capabilityRequirements);
  safe.presentation = publicPresentation(activity.presentation, activity.type === "listening" && activity.media?.kind === "audio" && activity.media.transcriptAvailableAfterAttempt !== false);
  for (const field of ["answer", "answerOrder", "accepted", "fullAnswers", "explanation", "answerPolicy", "feedback"])
    delete safe[field];
  if (activity.type === "listening" && activity.media?.kind === "audio" &&
    activity.media.transcriptAvailableAfterAttempt !== false) safe.transcript = "";
  return safe as PublicActivity;
}
export type PublicUnit = Omit<Unit, "lessons"> & { lessons: PublicLesson[] };
export type LearningAvailability = {
  unavailableActivityIds: string[];
  unavailableUnitIds?: string[];
  unavailableAssessmentIds?: string[];
  unavailableInteractiveLessonIds?: string[];
  scopeLocations?: Record<string, string>;
  interactiveLessonLocations?: Record<string, string>;
  interactiveLessonScopes?: Record<string, InteractiveLessonAvailabilityScope>;
  reasons?: Record<string, string[]>;
  spacedRepetition: boolean;
  actionStates?: Record<string, ActionAvailabilityState>;
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
  // Configuration and activity scope are request-local. Never cache user state or a
  // public DTO across calls: preferences and operational conditions can change.
  const environments = new Map<string | undefined, CapabilityEnvironment>();
  const effectiveEnvironment = (value: unknown): CapabilityEnvironment => {
    if (environment) return environment;
    if (!language) return {};
    const variant = typeof value === "string" ? value : undefined;
    let selected = environments.get(variant);
    if (!selected) {
      selected = serverCapabilityEnvironment(language, variant, course);
      environments.set(variant, selected);
    }
    return selected;
  };
  const report = course.capabilityRequests
    ? (() => {
        const activityLocations = new Map<string, Activity>();
        course.units.forEach((unit, u) => unit.lessons.forEach((lesson, l) => {
          const prefix = `course.units[${u}].lessons[${l}]`;
          lesson.activities.forEach((activity, a) =>
            activityLocations.set(`${prefix}.activities[${a}]`, activity));
          lesson.deferredRecovery?.rules.forEach((rule, r) =>
            activityLocations.set(`${prefix}.deferredRecovery.rules[${r}].activity`, rule.activity));
        }));
        const reports = course.capabilityRequests!.map((request) => {
          // Walk dot-delimited ancestors, preserving the exact scope boundary.
          // In particular, activities[1] must never match activities[10].
          let location = request.location;
          let scopedActivity = activityLocations.get(location);
          while (!scopedActivity && location.includes(".")) {
            location = location.slice(0, location.lastIndexOf("."));
            scopedActivity = activityLocations.get(location);
          }
          const effective = scopedActivity?.variant?.requiredVariant ?? preference;
          return negotiateCapabilities([request], effectiveEnvironment(effective));
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
  const interactiveLessonScopes: Record<string, InteractiveLessonAvailabilityScope> = {};
  for (const request of course.capabilityRequests ?? []) {
    if (request.requirement.id !== "lesson.interactive") continue;
    const parsed = interactiveLessonSchema.safeParse(request.requirement.data);
    if (!parsed.success) continue;
    const definition = parsed.data;
    interactiveLessonScopes[definition.id] = {
      unitId: definition.unitId,
      lessonId: definition.lessonId,
      requiredActivityIds: [...new Set(definition.segments.flatMap(segment =>
        segment.required && segment.activityRef ? [segment.activityRef] : []))],
    };
  }
  const projected = projectCapabilityAvailability(
    course,
    report?.diagnostics ?? [],
    undefined,
    interactiveLessonLocations,
    interactiveLessonScopes,
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
      actionStates: projectActionAvailability(effectiveEnvironment(preference)),
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
            activities: lesson.activities.map(publicActivity),
            deferredRecovery: lesson.deferredRecovery ? {
              ...lesson.deferredRecovery,
              rules: lesson.deferredRecovery.rules.map(rule => ({
                ...rule, activity: publicActivity(rule.activity),
              })),
            } : undefined,
          })),
      })),
  };
}
