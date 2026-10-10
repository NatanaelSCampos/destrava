import type { CoursePackage, LanguagePackage } from "@/content/contracts";
import type { CapabilityRequirement } from "@/content/capability-contracts";
import { coreSkillSchema } from "@/content/contract-vocabulary";
import { resolveActivityMedia } from "@/content/activity-media";
import {
  negotiateCapabilities,
  CapabilityCompatibilityError,
  type CapabilityEnvironment,
  type LocatedRequirement,
} from "./compatibility";

/** Requirements implied by native content are mandatory, even if no explicit list was supplied. */
export function packageCapabilityRequests(
  course: CoursePackage,
  language: LanguagePackage,
  moduleData: Record<string, unknown>,
) {
  const requests: LocatedRequirement[] = [];
  const add = (
    id: string,
    location: string,
    data: Record<string, unknown> = {},
    version = "1.0.0",
  ) => requests.push({ requirement: { id, version, required: true, data }, location });
  const declared = (items: CapabilityRequirement[] | undefined, location: string) =>
    items?.forEach((requirement, index) =>
      requests.push({ requirement, location: `${location}.capabilityRequirements[${index}]` }),
    );
  declared(course.capabilityRequirements, "course");
  declared(language.capabilityRequirements, "language");
  add("text.normalization", "language.normalization", language.normalization);
  add("presentation.direction", "language.writingSystem.direction", {
    direction: language.writingSystem.direction,
  });
  add("presentation.bidi", "course.presentation");
  for (const [moduleId, module] of Object.entries(language.modules)) {
    if (!module.enabled) continue;
    const id = {
      alphabet: "fundamentals.alphabet",
      numbers: "fundamentals.numbers",
      regionalVariants: "fundamentals.regional_variants",
    }[moduleId];
    const data = moduleData[moduleId];
    add(
      id ?? `module.${moduleId}`,
      `language.modules.${moduleId}`,
      moduleId === "numbers" ? (data as Record<string, unknown>) : { entries: data },
    );
  }
  course.units.forEach((unit, u) => {
    const unitPath = `course.units[${u}]`;
    declared(unit.capabilityRequirements, unitPath);
    add("policy.unit", `${unitPath}.learningPolicy`, unit.learningPolicy);
    for (const policy of [unit.learningPolicy.completion, unit.learningPolicy.mastery])
      if (policy.requirements.some((rule) => rule.kind === "review_score"))
        add("review.spaced", `${unitPath}.learningPolicy.review`);
    unit.lessons.forEach((lesson, l) => {
      const lessonPath = `${unitPath}.lessons[${l}]`;
      declared(lesson.capabilityRequirements, lessonPath);
      lesson.activities.forEach((activity, a) => {
        const location = `${lessonPath}.activities[${a}]`;
        declared(activity.capabilityRequirements, location);
        const { payload } = resolveActivityMedia(activity, course.media);
        const version =
          (activity.type === "ordering" && (payload.reconstruction || payload.answerOrder)) ||
          (activity.type === "writing" && payload.textRequirement)
            ? "1.1.0"
            : "1.0.0";
        add(`activity.${activity.type}`, location, payload, version);
        if (activity.type === "ordering" && payload.reconstruction)
          add(
            "text.reconstruction",
            `${location}.reconstruction`,
            payload.reconstruction as Record<string, unknown>,
          );
        if (activity.type === "writing") {
          const requirement = payload.textRequirement as
            { measure?: Record<string, unknown> } | undefined;
          add(
            "text.measurement",
            `${location}.textMeasure`,
            requirement?.measure ?? { strategy: "whitespace_units" },
          );
        }
        if (activity.evaluation)
          add(`grading.${activity.evaluation.strategy}`, `${location}.evaluation`);
        if (activity.variant) add("linguistic.variant", `${location}.variant`, activity.variant);
        if (activity.presentation)
          add("presentation.bidi", `${location}.presentation`, activity.presentation);
        if (["fill_blank", "short_answer", "writing", "speaking"].includes(activity.type))
          add("text.input", `${location}.input`, activity.presentation ?? {});
        if (activity.evaluation?.answerPolicy)
          add("linguistic.answers", `${location}.answerPolicy`, activity.evaluation.answerPolicy);
        if (activity.type === "listening")
          add(
            (payload.media as { kind?: string } | undefined)?.kind === "audio"
              ? "media.audio"
              : "speech.tts",
            `${location}.audio`,
            (payload.media as { kind?: string; url?: string } | undefined)?.kind === "audio"
              ? { src: (payload.media as { url: string }).url }
              : {},
          );
      });
    });
  });
  course.assessments.forEach((assessment, a) => {
    declared(assessment.capabilityRequirements, `course.assessments[${a}]`);
    add(`assessment.${assessment.method}`, `course.assessments[${a}]`, assessment);
  });
  course.interactiveLessons.forEach((lesson, index) => {
    const location = `course.interactiveLessons[${index}]`;
    add("lesson.interactive", location, lesson);
    for (const segment of lesson.segments) {
      if (segment.presentation?.mode !== "slides" && segment.presentation) {
        const asset = course.media.find((item) => item.id === segment.presentation?.mediaId);
        add("media.presentation", `${location}.segments.${segment.id}.presentation`, {
          src: asset?.src,
          type: asset?.type,
        });
      }
      for (const cue of segment.cues)
        if (cue.action.type === "audio.play") {
          const asset = course.media.find(
            (item) => item.id === (cue.action as { mediaId: string }).mediaId,
          );
          add("media.audio", `${location}.segments.${segment.id}.cues.${cue.id}`, {
            src: asset?.src,
          });
        }
    }
  });
  return requests;
}
export function validatePackageCapabilities(
  course: CoursePackage,
  language: LanguagePackage,
  moduleData: Record<string, unknown>,
  environment?: CapabilityEnvironment,
) {
  const requests = packageCapabilityRequests(course, language, moduleData);
  const report = negotiateCapabilities(requests, environment);
  course.units.forEach((unit, u) =>
    unit.lessons.forEach((lesson, l) =>
      lesson.activities.forEach((activity, a) => {
        const mediaErrors = resolveActivityMedia(activity, course.media).errors;
        if (mediaErrors.length) {
          report.compatible = false;
          report.diagnostics.push({
            code: "CAPABILITY_DATA_INVALID",
            severity: "error",
            capabilityId: `activity.${activity.type}`,
            requiredVersion: "1.0.0",
            supportedVersions: ["1.0.0"],
            location: `course.units[${u}].lessons[${l}].activities[${a}].media`,
            message: mediaErrors.join(" "),
            resolution:
              "Declare one playable listening audio reference or use an interactive presentation.",
          });
        }
        if (!activity.skills.some((skill) => coreSkillSchema.safeParse(skill).success)) {
          report.compatible = false;
          report.diagnostics.push({
            code: "CAPABILITY_DATA_INVALID",
            severity: "error",
            capabilityId: `activity.${activity.type}`,
            requiredVersion: "1.0.0",
            supportedVersions: ["1.0.0"],
            location: `course.units[${u}].lessons[${l}].activities[${a}].skills`,
            message: "No primary skill accepted by the runtime and persistence.",
            resolution:
              "Supply at least one core skill; additional skill metadata does not implement an independent scoring pipeline.",
          });
        }
      }),
    ),
  );
  if (!report.compatible) throw new CapabilityCompatibilityError(report);
  return { requests, report };
}
