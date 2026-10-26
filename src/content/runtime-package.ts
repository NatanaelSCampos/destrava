import {
  coursePackageSchema,
  languagePackageSchema,
  type CoursePackage,
  type LanguagePackage,
} from "./contracts";
import { courseSchema, type Course, type Skill, type Activity } from "./schema";
import type { LanguageResources, DictionaryEntry, VocabularyItem } from "./language-resources";
import type { AlphabetLetter, RegionalTopic } from "./fundamentals-types";
import type { NumberPrompt } from "@/domain/numbers/number-practice";
import type { ConversationScenario } from "./conversation-scenarios";
import type { ImageDescriptionScene } from "./image-description-scenes";
import type { VisualCue } from "./visual-vocabulary";
import { validatePackageCapabilities } from "@/engine/capabilities/package-compatibility";
import { validateInteractiveLessons } from "./validate-interactive-lessons";
import { coreSkillSchema } from "./contract-vocabulary";
import { resolveActivityMedia } from "./activity-media";
import { requireLearningVariant } from "@/engine/variants/resolution";
import { declaredAnswers } from "@/engine/variants/answers";

export type CompiledPackage = {
  course: CoursePackage;
  language: LanguagePackage;
  moduleData: Record<string, unknown>;
};

export function runtimeBundle(raw: CompiledPackage) {
  const coursePackage = coursePackageSchema.parse(raw.course);
  const language = languagePackageSchema.parse(raw.language);
  if (coursePackage.targetLanguage !== language.id)
    throw new Error(
      `Course ${coursePackage.id} targets ${coursePackage.targetLanguage}, not ${language.id}`,
    );
  requireLearningVariant(language, coursePackage);
  for (const unit of coursePackage.units)
    for (const lesson of unit.lessons)
      for (const activity of [
        ...lesson.activities,
        ...(lesson.deferredRecovery?.rules.map((rule) => rule.activity) ?? []),
      ]) {
        // Validate references independently of a learner's future preference.
        requireLearningVariant(
          language,
          coursePackage,
          activity.variant?.requiredVariant ?? activity.variant?.acceptedVariants?.[0],
          activity.variant,
        );
        for (const alternative of activity.evaluation?.answerPolicy?.alternatives ?? [])
          if (
            alternative.variants?.some(
              (id) =>
                !(coursePackage.acceptedVariants ?? language.variants.map((v) => v.id)).includes(
                  id,
                ),
            )
          )
            throw new Error(`Unknown/unsupported answer alternative variant in ${activity.id}`);
        const policy = activity.evaluation?.answerPolicy;
        if (policy?.requiredForms) {
          const payload = activity.payload;
          const declared = [
            payload.answer,
            ...(Array.isArray(payload.accepted) ? payload.accepted : []),
            ...(Array.isArray(payload.fullAnswers) ? payload.fullAnswers : []),
            ...(policy.alternatives ?? []).map((a) => a.text),
          ];
          if (policy.requiredForms.some((text) => !declared.includes(text)))
            throw new Error(`Required forms must be declared answers in ${activity.id}`);
          if (
            ![
              "multiple_choice",
              "true_false",
              "fill_blank",
              "ordering",
              "short_answer",
              "listening",
            ].includes(activity.type)
          )
            throw new Error(`Required whole forms need an objective activity in ${activity.id}`);
        }
      }
  validateInteractiveLessons(coursePackage, language);
  const capabilities = validatePackageCapabilities(coursePackage, language, raw.moduleData);
  const activitySkill = (skills: string[]): Skill => {
    const core = skills.find((skill) => coreSkillSchema.safeParse(skill).success);
    if (!core) throw new Error(`Activity has no runtime skill: ${skills.join(", ")}`);
    return core as Skill;
  };
  const adaptActivity = (
    activity: CoursePackage["units"][number]["lessons"][number]["activities"][number],
  ): Activity =>
    ({
      ...resolveActivityMedia(activity, coursePackage.media).payload,
      id: activity.id,
      type: activity.type,
      title: activity.title,
      prompt: activity.prompt,
      skill: activitySkill(activity.skills),
      skills: activity.skills,
      conceptIds: activity.concepts,
      minutes: activity.minutes,
      goals: activity.goals,
      contexts: activity.contexts,
      capabilityRequirements: activity.capabilityRequirements,
      normalization: activity.evaluation?.normalization,
      variant: activity.variant,
      presentation: activity.presentation,
      answerPolicy: activity.evaluation?.answerPolicy,
    }) as Activity;
  const course: Course = courseSchema.parse({
    id: coursePackage.id,
    slug: coursePackage.slug,
    title: coursePackage.title,
    languageCode: language.id,
    level: coursePackage.framework.exitLevel,
    sourceLanguage: coursePackage.sourceLanguage,
    defaultVariant: coursePackage.defaultVariant,
    acceptedVariants: coursePackage.acceptedVariants,
    description: coursePackage.description,
    contentVersion: coursePackage.contentVersion,
    ...(["1.6", "1.7", "1.8", "1.9", "1.10"].includes(coursePackage.schemaVersion)
      ? {
          teachingMedia: coursePackage.media
            .filter((asset) => asset.type === "audio")
            .map((asset) => ({
              id: asset.id,
              src: asset.src,
              ...Object.fromEntries(
                ["author", "license", "licenseUrl", "sourceUrl", "credit"].map((key) => [
                  key,
                  typeof asset.metadata?.[key] === "string" ? asset.metadata[key] : "",
                ]),
              ),
            })),
        }
      : {}),
    assessments: coursePackage.assessments,
    assessmentRefs: coursePackage.assessmentRefs,
    capabilityRequirements: coursePackage.capabilityRequirements,
    languageRequirements: language.capabilityRequirements,
    capabilityReport: capabilities.report,
    capabilityRequests: capabilities.requests,
    learningConcepts: coursePackage.concepts.map((concept) => ({
      id: concept.id,
      label: concept.name,
    })),
    units: coursePackage.units.map((unit) => ({
      id: unit.id,
      slug: unit.slug,
      title: unit.title,
      number: unit.order,
      description: unit.description,
      objectives: unit.objectives,
      active: unit.active,
      skills: unit.skills,
      assessmentRefs: unit.assessmentRefs,
      learningPolicy: unit.learningPolicy,
      access: unit.access,
      capabilityRequirements: unit.capabilityRequirements,
      lessons: unit.lessons.map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        order: lesson.order,
        interactiveLessonRef: lesson.interactiveLessonRef,
        capabilityRequirements: lesson.capabilityRequirements,
        objectiveLabels: lesson.objectiveLabels,
        stages: lesson.stages,
        eyebrow: lesson.eyebrow,
        description: lesson.description,
        minutes: lesson.minutes,
        active: lesson.active,
        activities: lesson.activities.map(adaptActivity),
        deferredRecovery: lesson.deferredRecovery
          ? {
              ...lesson.deferredRecovery,
              rules: lesson.deferredRecovery.rules.map((rule) => ({
                ...rule,
                activity: adaptActivity(rule.activity),
              })),
            }
          : undefined,
      })),
    })),
  });

  for (const unit of course.units)
    for (const lesson of unit.lessons)
      for (const activity of [
        ...lesson.activities,
        ...(lesson.deferredRecovery?.rules.map((rule) => rule.activity) ?? []),
      ]) {
        if (!activity.answerPolicy?.requiredForms) continue;
        const variants = activity.variant?.requiredVariant
          ? [activity.variant.requiredVariant]
          : (activity.variant?.acceptedVariants ??
            course.acceptedVariants ??
            language.variants.map((v) => v.id));
        for (const id of variants)
          if (!declaredAnswers(activity, id).length)
            throw new Error(
              `No required whole answer form is authorized for variant ${id} in ${activity.id}`,
            );
      }

  const alphabet = (raw.moduleData.alphabet ?? []) as AlphabetLetter[];
  const numbers = (raw.moduleData.numbers ?? { prompts: [], categoryLabels: {} }) as {
    prompts: NumberPrompt[];
    categoryLabels: Record<string, string>;
  };
  const regionalTopics = (raw.moduleData.regionalVariants ?? []) as RegionalTopic[];
  const vocabulary: VocabularyItem[] = coursePackage.lexicon
    .filter((entry) => entry.lessonId)
    .map((entry) => ({
      id: entry.id,
      term: entry.surface ?? entry.lemma,
      translation: entry.meanings[0].translations[coursePackage.sourceLanguage]?.[0] ?? "",
      example: entry.examples?.[0]?.target ?? "",
      lessonId: entry.lessonId!,
    }));
  const dictionary: Record<string, DictionaryEntry> = Object.fromEntries(
    coursePackage.lexicon.map((entry) => [
      entry.id,
      {
        className: entry.className,
        senses: entry.meanings.map((meaning, index) => ({
          meaning: meaning.translations[coursePackage.sourceLanguage]?.[0] ?? "",
          example: entry.examples?.[index]?.target ?? entry.examples?.[0]?.target ?? "",
        })),
        aliases: entry.aliases,
        regionalNote: entry.regionalNote,
      },
    ]),
  );
  const conversationScenarios: ConversationScenario[] = coursePackage.missions.map((mission) => {
    const roleplay = coursePackage.roleplays.find((entry) => entry.scenario === mission.scenario);
    return {
      id: mission.id,
      focusConceptIds: mission.recommendedConcepts,
      goals: [...new Set([...(mission.goals ?? []), ...(roleplay?.goals ?? [])])],
      contexts: [...new Set([...(mission.contexts ?? []), ...(roleplay?.contexts ?? [])])],
      title: mission.title ?? mission.scenario,
      setting: mission.setting ?? mission.scenario,
      character: mission.character ?? roleplay?.character.role ?? "Colega",
      opening: mission.opening ?? "Olá!",
      objectives:
        mission.objectiveDetails ??
        mission.objectives.map((objective) => ({
          id: objective,
          label: objective,
          hint: "",
        })),
      roleplay: roleplay
        ? {
            characterRole: roleplay.character.role,
            maxVocabularyLevel: roleplay.constraints?.maxVocabularyLevel,
            allowHints: roleplay.constraints?.allowHints,
          }
        : undefined,
    };
  });
  const imageScenes: ImageDescriptionScene[] = coursePackage.media
    .filter((item) => item.type === "image" && Array.isArray(item.metadata?.facts))
    .map((item) => ({
      id: item.id,
      image: item.src,
      title: String(item.metadata?.title ?? item.id),
      alt: String(item.metadata?.alt ?? ""),
      prompt: String(item.metadata?.prompt ?? ""),
      facts: item.metadata?.facts as string[],
    }));
  const resources: LanguageResources = {
    learningOptions: {
      supportedGoals: coursePackage.supportedGoals ?? ["general"],
      contexts: coursePackage.contexts ?? [],
      skillFloors: coursePackage.skillFloors ?? {},
    },
    courseId: coursePackage.id,
    languageCode: language.id,
    languageLabel: language.identity.nativeName,
    regionalContentHref: language.modules.regionalVariants?.enabled
      ? "/basics?topic=regions"
      : undefined,
    vocabulary,
    dictionary,
    structures: coursePackage.practice?.reviewStructures ?? [],
    numbers: numbers.prompts,
    numberCategoryLabels: numbers.categoryLabels,
    conversationScenarios,
    imageScenes,
    visualVocabulary: Object.fromEntries(
      coursePackage.lexicon
        .filter((entry) => entry.visualCue)
        .map((entry) => [entry.id, entry.visualCue as VisualCue]),
    ),
    reviewClozeForms: Object.fromEntries(
      coursePackage.lexicon
        .filter((entry) => entry.clozeForms)
        .map((entry) => [entry.id, entry.clozeForms!]),
    ),
    alphabet,
    regionalTopics,
  };
  return { coursePackage, language, course, resources };
}
