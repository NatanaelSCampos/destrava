import type { AssessmentDefinition } from "@/content/contracts";
import type { CapabilityDiagnostic } from "@/content/capability-contracts";

type CourseScopes = {
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
  const reasons: Record<string, string[]> = {};
  const scopeLocations: Record<string, string> = {};
  course.units.forEach((unit, u) => {
    const unitPath = originalLocations?.[`unit:${unit.id}`] ?? `course.units[${u}]`;
    scopeLocations[`unit:${unit.id}`] = unitPath;
    const unitBlockers = blocking.filter((item) =>
      item.location.startsWith(`${unitPath}.capabilityRequirements`),
    );
    if (!unit.active || globalBlockers.length || unitBlockers.length)
      unavailableUnitIds.push(unit.id);
    unit.lessons.forEach((lesson, l) => {
      const lessonPath = originalLocations?.[`lesson:${lesson.id}`] ?? `${unitPath}.lessons[${l}]`;
      scopeLocations[`lesson:${lesson.id}`] = lessonPath;
      const lessonBlockers = blocking.filter((item) =>
        item.location.startsWith(`${lessonPath}.capabilityRequirements`),
      );
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
      ([, location]) =>
        globalBlockers.length ||
        blocking.some(
          (item) => item.location === location || item.location.startsWith(`${location}.`),
        ),
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
  };
}
