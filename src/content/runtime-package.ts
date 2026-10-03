import { coursePackageSchema, languagePackageSchema, type CoursePackage, type LanguagePackage } from "./contracts";
import { courseSchema, type Course, type Skill } from "./schema";
import type { LanguageResources, DictionaryEntry, VocabularyItem } from "./language-resources";
import type { AlphabetLetter, RegionalTopic } from "./fundamentals-types";
import type { NumberPrompt } from "@/domain/numbers/number-practice";
import type { ConversationScenario } from "./conversation-scenarios";
import type { ImageDescriptionScene } from "./image-description-scenes";
import type { VisualCue } from "./visual-vocabulary";

export type CompiledPackage = {
  course: CoursePackage;
  language: LanguagePackage;
  moduleData: Record<string, unknown>;
};

export function runtimeBundle(raw: CompiledPackage) {
  const coursePackage = coursePackageSchema.parse(raw.course);
  const language = languagePackageSchema.parse(raw.language);
  if (coursePackage.targetLanguage !== language.id)
    throw new Error(`Course ${coursePackage.id} targets ${coursePackage.targetLanguage}, not ${language.id}`);
  const activitySkill = (skills: string[]): Skill => {
    const core = skills.find((skill) => ["vocabulary", "grammar", "listening", "writing", "speaking", "reading"].includes(skill));
    if (!core) throw new Error(`Activity has no runtime skill: ${skills.join(", ")}`);
    return core as Skill;
  };
  const course: Course = courseSchema.parse({
    id: coursePackage.id, slug: coursePackage.slug, title: coursePackage.title,
    languageCode: language.id, level: coursePackage.framework.exitLevel,
    description: coursePackage.description,
    learningConcepts: coursePackage.concepts.map((concept) => ({ id: concept.id, label: concept.name })),
    units: coursePackage.units.map((unit) => ({
      id: unit.id, slug: unit.slug, title: unit.title, number: unit.order,
      description: unit.description, objectives: unit.objectives, active: unit.active,
      lessons: unit.lessons.map((lesson) => ({
        id: lesson.id, slug: lesson.slug, title: lesson.title, order: lesson.order,
        eyebrow: lesson.eyebrow, description: lesson.description,
        minutes: lesson.minutes, active: lesson.active,
        activities: lesson.activities.map((activity) => ({
          ...activity.payload,
          id: activity.id, type: activity.type, title: activity.title,
          prompt: activity.prompt, skill: activitySkill(activity.skills),
          skills: activity.skills,
          conceptIds: activity.concepts, minutes: activity.minutes,
          normalization: activity.evaluation?.normalization,
        })),
      })),
    })),
  });

  const alphabet = (raw.moduleData.alphabet ?? []) as AlphabetLetter[];
  const numbers = (raw.moduleData.numbers ?? { prompts: [], categoryLabels: {} }) as {
    prompts: NumberPrompt[]; categoryLabels: Record<string, string>;
  };
  const regionalTopics = (raw.moduleData.regionalVariants ?? []) as RegionalTopic[];
  const vocabulary: VocabularyItem[] = coursePackage.lexicon.filter((entry) => entry.lessonId).map((entry) => ({
    id: entry.id, term: entry.surface ?? entry.lemma,
    translation: entry.meanings[0].translations[coursePackage.sourceLanguage]?.[0] ?? "",
    example: entry.examples?.[0]?.target ?? "",
    lessonId: entry.lessonId!,
  }));
  const dictionary: Record<string, DictionaryEntry> = Object.fromEntries(
    coursePackage.lexicon.map((entry) => [entry.id, {
      className: entry.className,
      senses: entry.meanings.map((meaning, index) => ({
        meaning: meaning.translations[coursePackage.sourceLanguage]?.[0] ?? "",
        example: entry.examples?.[index]?.target ?? entry.examples?.[0]?.target ?? "",
      })),
      aliases: entry.aliases,
      regionalNote: entry.regionalNote,
    }]),
  );
  const conversationScenarios: ConversationScenario[] = coursePackage.missions.map((mission) => {
    const roleplay = coursePackage.roleplays.find((entry) => entry.scenario === mission.scenario);
    return {
      id: mission.id, focusConceptIds: mission.recommendedConcepts,
      title: mission.title ?? mission.scenario, setting: mission.setting ?? mission.scenario,
      character: mission.character ?? roleplay?.character.role ?? "Colega",
      opening: mission.opening ?? "Olá!",
      objectives: mission.objectiveDetails ?? mission.objectives.map((objective) => ({
        id: objective, label: objective, hint: "",
      })),
      roleplay: roleplay ? {
        characterRole: roleplay.character.role,
        maxVocabularyLevel: roleplay.constraints?.maxVocabularyLevel,
        allowHints: roleplay.constraints?.allowHints,
      } : undefined,
    };
  });
  const imageScenes: ImageDescriptionScene[] = coursePackage.media
    .filter((item) => item.type === "image" && Array.isArray(item.metadata?.facts))
    .map((item) => ({
      id: item.id, image: item.src, title: String(item.metadata?.title ?? item.id),
      alt: String(item.metadata?.alt ?? ""), prompt: String(item.metadata?.prompt ?? ""),
      facts: item.metadata?.facts as string[],
    }));
  const resources: LanguageResources = {
    courseId: coursePackage.id, languageCode: language.id,
    languageLabel: language.identity.nativeName,
    regionalContentHref: language.modules.regionalVariants?.enabled ? "/basics?topic=regions" : undefined,
    vocabulary, dictionary,
    structures: coursePackage.practice?.reviewStructures ?? [],
    numbers: numbers.prompts, numberCategoryLabels: numbers.categoryLabels,
    conversationScenarios, imageScenes,
    visualVocabulary: Object.fromEntries(coursePackage.lexicon.filter((entry) => entry.visualCue)
      .map((entry) => [entry.id, entry.visualCue as VisualCue])),
    reviewClozeForms: Object.fromEntries(coursePackage.lexicon.filter((entry) => entry.clozeForms)
      .map((entry) => [entry.id, entry.clozeForms!])),
    alphabet, regionalTopics,
  };
  return { coursePackage, language, course, resources };
}
