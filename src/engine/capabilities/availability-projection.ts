import { capabilityRegistry } from "./registry";
import { negotiateCapabilities } from "./compatibility";
import type { AssessmentDefinition } from "@/content/contracts";
import type { CapabilityDiagnostic } from "@/content/capability-contracts";

export type InteractiveLessonAvailabilityScope = {
  unitId: string;
  lessonId: string;
  requiredActivityIds: string[];
};

type CourseScopes = {
  availability?: { interactiveLessonScopes?: Record<string, InteractiveLessonAvailabilityScope> };
  units: Array<{
    id: string;
    active: boolean;
    lessons: Array<{ id: string; active: boolean; activities: Array<{ id: string }> }>;
  }>;
  assessments: AssessmentDefinition[];
};
/** Same scope interpretation on server and device; no I/O, flags or private payloads. */
export function projectCapabilityAvailability(
  course: CourseScopes,
  diagnostics: readonly CapabilityDiagnostic[],
  originalLocations?: Record<string, string>,
  interactiveLessonLocations: Record<string, string> = {},
  interactiveLessonScopes: Record<string, InteractiveLessonAvailabilityScope> = course.availability?.interactiveLessonScopes ?? {},
) {
  const blocking = diagnostics.filter((item) => item.severity === "error");
  const globalBlockers = blocking.filter(
    (item) =>
      item.location.startsWith("course.capabilityRequirements") ||
      item.location.startsWith("language.capabilityRequirements") ||
      item.location === "course.presentation" ||
      item.location === "language.writingSystem.direction",
  );
  const unavailableUnitIds: string[] = [],
    unavailableActivityIds: string[] = [];
  const unavailableLessonIds = new Set<string>();
  const reasons: Record<string, string[]> = {};
  const scopeLocations: Record<string, string> = {};
  course.units.forEach((unit, u) => {
    const unitPath = originalLocations?.[`unit:${unit.id}`] ?? `course.units[${u}]`;
    scopeLocations[`unit:${unit.id}`] = unitPath;
    const unitBlockers = blocking.filter((item) =>
      item.location === unitPath || item.location.startsWith(`${unitPath}.capabilityRequirements`),
    );
    if (!unit.active || globalBlockers.length || unitBlockers.length)
      unavailableUnitIds.push(unit.id);
    unit.lessons.forEach((lesson, l) => {
      const lessonPath = originalLocations?.[`lesson:${lesson.id}`] ?? `${unitPath}.lessons[${l}]`;
      scopeLocations[`lesson:${lesson.id}`] = lessonPath;
      const lessonBlockers = blocking.filter((item) =>
        item.location === lessonPath || item.location.startsWith(`${lessonPath}.capabilityRequirements`),
      );
      if (!unit.active || !lesson.active || globalBlockers.length || unitBlockers.length || lessonBlockers.length)
        unavailableLessonIds.add(lesson.id);
      lesson.activities.forEach((activity, a) => {
        const prefix =
          originalLocations?.[`activity:${activity.id}`] ?? `${lessonPath}.activities[${a}]`;
        scopeLocations[`activity:${activity.id}`] = prefix;
        const activityBlockers = [
          ...globalBlockers,
          ...unitBlockers,
          ...lessonBlockers,
          ...blocking.filter(
            (item) => item.location === prefix || item.location.startsWith(`${prefix}.`),
          ),
        ];
        if (!unit.active || !lesson.active || activityBlockers.length) {
          unavailableActivityIds.push(activity.id);
          reasons[activity.id] = activityBlockers.length
            ? activityBlockers.map((item) => item.message)
            : ["Esta atividade está temporariamente indisponível."];
        }
      });
    });
  });
  const unavailableAssessmentIds = course.assessments
    .filter(
      (definition, index) =>
        globalBlockers.length ||
        blocking.some(
          (item) =>
            item.location === `course.assessments[${index}]` ||
            item.location.startsWith(`course.assessments[${index}].`),
        ) ||
        (definition.method === "fixed"
          ? definition.activityIds
          : definition.bank.map((item) => item.activityId)
        ).some((id) => unavailableActivityIds.includes(id)),
    )
    .map((item) => item.id);
  const unavailableInteractiveLessonIds = Object.entries(interactiveLessonLocations)
    .filter(
      ([id, location]) => {
        if (globalBlockers.length || blocking.some(item => item.location === location || item.location.startsWith(`${location}.`))) return true;
        const scope = interactiveLessonScopes[id];
        if (!scope) return false; // Backward-compatible callers without the new internal metadata.
        const unit = course.units.find(item => item.id === scope.unitId);
        const lesson = unit?.lessons.find(item => item.id === scope.lessonId);
        return !unit?.active || !lesson?.active || unavailableUnitIds.includes(scope.unitId) ||
          unavailableLessonIds.has(scope.lessonId) || scope.requiredActivityIds.some(activityId =>
            !lesson.activities.some(activity => activity.id === activityId) || unavailableActivityIds.includes(activityId));
      },
    )
    .map(([id]) => id);
  return {
    unavailableActivityIds,
    unavailableUnitIds,
    unavailableAssessmentIds,
    unavailableInteractiveLessonIds,
    reasons,
    scopeLocations,
    interactiveLessonLocations,
    interactiveLessonScopes,
  };
}

/** Minimal operational states; no provider settings or private data cross this boundary. */
export type ActionAvailabilityState = {
  state: "available" | "unavailable" | "unknown";
  reasons: string[];
};
export function projectActionAvailability(environment: import("./compatibility").CapabilityEnvironment = {}) {
  const ids = [...capabilityRegistry.keys()].filter(id => id.startsWith("activity.") || id.startsWith("ai.") || id.startsWith("speech.") || [
    "review.spaced", "numbers.dictation", "ai.conversation", "ai.conversation_mission",
    "ai.micro_lesson", "ai.image_description", "ai.tutor", "lesson.interactive",
    "assessment.fixed", "assessment.adaptive",
  ].includes(id));
  return Object.fromEntries(ids.map(id => {
    // Preserve the limited compiled exercise without promoting its capability support.
    if (id === "numbers.dictation") {
      const condition = environment.capabilities?.[id];
      return [id, { state: condition?.state === "unavailable" ? "unavailable" : "unknown",
        reasons: [condition?.reason ?? "Prática limitada às convenções numéricas suportadas neste curso."] } satisfies ActionAvailabilityState];
    }
    const report = negotiateCapabilities([{ requirement: { id, version: "1.0.0", required: true }, location: "action" }], environment, capabilityRegistry, { validateData: false });
    return [id, { state: report.diagnostics.some(item => item.severity === "error") ? "unavailable"
      : report.diagnostics.length ? "unknown" : "available",
      reasons: report.diagnostics.map(item => item.message) } satisfies ActionAvailabilityState];
  }));
}
