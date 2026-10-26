import type { Course } from "@/content/schema";
import type { CapabilityDiagnostic } from "@/content/capability-contracts";
import { capabilityRegistry } from "@/engine/capabilities/registry";
import {
  negotiateCapabilities,
  type CapabilityEnvironment,
  type LocatedRequirement,
} from "@/engine/capabilities/compatibility";
import type { InstalledCompatibilityReport } from "./contracts";

const integrated = new Set([
  "presentation.direction",
  "presentation.bidi",
  "text.input",
  "text.normalization",
  "text.reconstruction",
  "text.measurement",
  "linguistic.variant",
  "linguistic.answers",
  "grading.exact-normalized",
  "activity.lesson_content",
  "activity.multiple_choice",
  "activity.true_false",
  "activity.fill_blank",
  "activity.ordering",
  "activity.short_answer",
  "activity.writing",
  "activity.listening",
  "activity.flashcard",
  "activity.review",
  "activity.quiz",
  "assessment.fixed",
  "assessment.adaptive",
  "policy.unit",
  "media.audio",
  "speech.tts",
  "lexicon.dictionary",
  "fundamentals.alphabet",
  "fundamentals.regional_variants",
  "fundamentals.numbers",
]);
const reason = (id: string) =>
  id === "review.spaced"
    ? "Private review evidence is not integrated with installed courses."
    : id === "numbers.dictation"
      ? "The engine's number practice is partial and has no installed-course evidence integration."
      : id === "activity.writing"
        ? "Manual writing submissions are integrated; AI feedback is a separate capability."
        : integrated.has(id)
          ? "Integrated with installed course content; operational availability must be checked separately."
          : "This execution path is not integrated with installed courses.";

export const installedCapabilitySupport = Object.freeze(
  [...capabilityRegistry.keys()].map((id) =>
    Object.freeze({ id, integrated: integrated.has(id), reason: reason(id) }),
  ),
);

/** Preserve host availability while denying paths that cannot resolve installed content. */
export function installedCapabilityEnvironment(
  baseEnv: CapabilityEnvironment = {},
): CapabilityEnvironment {
  const environment = structuredClone(baseEnv);
  environment.capabilities = { ...environment.capabilities };
  for (const entry of installedCapabilitySupport)
    if (!entry.integrated)
      environment.capabilities[entry.id] = { state: "unavailable", reason: entry.reason };
  return environment;
}

function requestsFor(course: Course): LocatedRequirement[] {
  const requests = [...(course.capabilityRequests ?? [])];
  const declared = (items: Course["capabilityRequirements"], location: string) =>
    items?.forEach((requirement, index) =>
      requests.push({ requirement, location: location + ".capabilityRequirements[" + index + "]" }),
    );
  const add = (id: string, location: string, version = "1.0.0") =>
    requests.push({ requirement: { id, version, required: true }, location });
  declared(course.capabilityRequirements, "course");
  declared(course.languageRequirements, "language");
  course.assessments.forEach((a, i) => {
    if (a.method === "fixed" && a.exam) add("assessment.exam", `course.assessments[${i}].exam`);
  });
  course.units.forEach((unit, u) => {
    const unitPath = "course.units[" + u + "]";
    declared(unit.capabilityRequirements, unitPath);
    if (unit.access) add("learning.access", unitPath + ".access");
    if (unit.learningPolicy) {
      add("policy.unit", unitPath + ".learningPolicy");
      for (const group of ["completion", "mastery"] as const)
        unit.learningPolicy[group].requirements.forEach((rule, r) => {
          const path = unitPath + ".learningPolicy." + group + ".requirements[" + r + "]";
          if (rule.kind === "review_score") add("review.spaced", path);
          if (rule.kind === "submission" && rule.practice === "speaking")
            add("activity.speaking", path);
        });
    }
    unit.lessons.forEach((lesson, l) => {
      const lessonPath = unitPath + ".lessons[" + l + "]";
      declared(lesson.capabilityRequirements, lessonPath);
      if (lesson.stages) add("lesson.stages", lessonPath + ".stages");
      if (lesson.interactiveLessonRef)
        add("lesson.interactive", lessonPath + ".interactiveLessonRef");
      lesson.activities.forEach((activity, a) => {
        const path = lessonPath + ".activities[" + a + "]";
        declared(activity.capabilityRequirements, path);
        const newer =
          (activity.type === "ordering" && (activity.reconstruction || activity.answerOrder)) ||
          (activity.type === "writing" && activity.textRequirement);
        add("activity." + activity.type, path, newer ? "1.1.0" : "1.0.0");
        if (activity.type === "listening")
          add(activity.media?.kind === "audio" ? "media.audio" : "speech.tts", path + ".audio");
      });
    });
  });
  course.assessments.forEach((assessment, a) => {
    const path = "course.assessments[" + a + "]";
    declared(assessment.capabilityRequirements, path);
    add("assessment." + assessment.method, path);
  });
  return requests.filter(
    (entry, index) =>
      requests.findIndex(
        (other) =>
          other.location === entry.location &&
          other.requirement.id === entry.requirement.id &&
          other.requirement.version === entry.requirement.version &&
          other.requirement.required === entry.requirement.required,
      ) === index,
  );
}

/** Integration readiness only. Package data and provider readiness retain their own gates. */
export function installedCourseCompatibility(course: Course): InstalledCompatibilityReport {
  const report = negotiateCapabilities(
    requestsFor(course),
    installedCapabilityEnvironment(),
    capabilityRegistry,
    { validateData: false },
  );
  const diagnostics: CapabilityDiagnostic[] = report.diagnostics
    .filter((entry) => entry.code !== "CAPABILITY_AVAILABILITY_UNKNOWN")
    .map((entry) => {
      if (
        entry.code !== "CAPABILITY_UNAVAILABLE" &&
        !(
          entry.code === "CAPABILITY_NOT_IMPLEMENTED" &&
          capabilityRegistry.has(entry.capabilityId) &&
          !integrated.has(entry.capabilityId)
        )
      )
        return entry;
      return {
        ...entry,
        code: "CAPABILITY_UNAVAILABLE" as const,
        condition: "installed.integration",
        message: reason(entry.capabilityId),
        resolution:
          "Use an integrated installed-course path or implement and qualify this integration.",
      };
    });
  return {
    compatible: !diagnostics.some((entry) => entry.severity === "error"),
    diagnostics,
  };
}
