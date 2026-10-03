import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  alphabetModuleSchema, numbersModuleSchema, regionalVariantsModuleSchema,
  coursePackageSchema, languagePackageSchema,
  type CoursePackage, type LanguagePackage,
} from "../src/content/contracts";
import { runtimeBundle } from "../src/content/runtime-package";

const contentRoot = resolve(process.cwd(), "content");
function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
function jsonFiles(path: string): string[] {
  return existsSync(path) ? readdirSync(path).filter((name) => name.endsWith(".json")).sort() : [];
}

export function loadContent(): Array<{
  course: CoursePackage;
  language: LanguagePackage;
  moduleData: Record<string, unknown>;
}> {
  const languages = new Map<string, { language: LanguagePackage; moduleData: Record<string, unknown> }>();
  for (const name of readdirSync(join(contentRoot, "languages"))) {
    const root = join(contentRoot, "languages", name);
    const language = languagePackageSchema.parse(readJson(join(root, "manifest.json")));
    if (language.id !== name) throw new Error(`Language folder mismatch: ${name}`);
    const moduleData: Record<string, unknown> = {};
    for (const [moduleId, module] of Object.entries(language.modules)) {
      if (!module.enabled) continue;
      if (!module.source) throw new Error(`Missing source for ${language.id}.${moduleId}`);
      const path = resolve(root, module.source);
      if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`))
        throw new Error(`Module source escapes its language folder: ${path}`);
      const data = readJson(path);
      moduleData[moduleId] = moduleId === "alphabet" ? alphabetModuleSchema.parse(data)
        : moduleId === "numbers" ? numbersModuleSchema.parse(data)
        : moduleId === "regionalVariants" ? regionalVariantsModuleSchema.parse(data)
        : data;
    }
    languages.set(language.id, { language, moduleData });
  }
  const bundles = [];
  for (const name of readdirSync(join(contentRoot, "courses"))) {
    const root = join(contentRoot, "courses", name);
    const manifest = readJson(join(root, "course.json")) as Record<string, unknown>;
    const course = coursePackageSchema.parse({
      ...manifest,
      units: jsonFiles(join(root, "units")).map((file) => readJson(join(root, "units", file))),
      concepts: readJson(join(root, "concepts.json")),
      lexicon: readJson(join(root, "lexicon.json")),
      missions: readJson(join(root, "missions.json")),
      roleplays: readJson(join(root, "roleplays.json")),
      assessments: readJson(join(root, "assessments.json")),
      media: readJson(join(root, "media.json")),
    });
    if (course.id !== name) throw new Error(`Course folder mismatch: ${name}`);
    const language = languages.get(course.targetLanguage);
    if (!language) throw new Error(`Unknown target language ${course.targetLanguage} for ${course.id}`);
    validateReferences(course, language.language);
    runtimeBundle({ course, language: language.language, moduleData: language.moduleData });
    bundles.push({ course, ...language });
  }
  assertUnique(bundles.map((bundle) => bundle.course.id), "course");
  if (bundles.filter((bundle) => bundle.course.isDefault).length !== 1)
    throw new Error("Exactly one course must have isDefault: true");
  assertUnique(bundles.map((bundle) => bundle.course.slug), "course slug");
  assertUnique(bundles.flatMap((bundle) => bundle.course.units.map((unit) => unit.id)), "global unit");
  assertUnique(bundles.flatMap((bundle) => bundle.course.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id))), "global lesson");
  assertUnique(bundles.flatMap((bundle) => bundle.course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id)))), "global activity");
  assertUnique(bundles.flatMap((bundle) => bundle.course.lexicon.map((entry) => entry.id)), "global lexicon");
  assertUnique(bundles.flatMap((bundle) => bundle.course.assessments.map((assessment) => assessment.id)), "global assessment");
  return bundles;
}

function assertUnique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} ID`);
}

function validateReferences(course: CoursePackage, language: LanguagePackage) {
  if (course.schemaVersion !== "1.0" || language.schemaVersion !== "1.0")
    throw new Error(`Unsupported package schema: ${course.id}`);
  if (course.defaultVariant && !language.variants.some((variant) => variant.id === course.defaultVariant))
    throw new Error(`Unknown course variant ${course.defaultVariant}`);
  const concepts = new Set(course.concepts.map((item) => item.id));
  const words = new Set(course.lexicon.map((item) => item.id));
  const units = new Set(course.units.map((item) => item.id));
  const lessonIds = course.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id));
  const lessons = new Set(lessonIds);
  const activities = course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities));
  const activityIds = new Set(activities.map((activity) => activity.id));
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const assessments = new Set(course.assessments.map((item) => item.id));
  assertUnique(course.units.map((item) => item.id), "unit");
  assertUnique(lessonIds, "lesson");
  assertUnique(activities.map((item) => item.id), "activity");
  assertUnique(course.concepts.map((item) => item.id), "concept");
  assertUnique(course.lexicon.map((item) => item.id), "lexicon");
  assertUnique(course.missions.map((item) => item.id), "mission");
  assertUnique(course.media.map((item) => item.id), "media");
  assertUnique(course.assessments.map((item) => item.id), "assessment");
  for (const concept of course.concepts) {
    if (concept.language !== language.id) throw new Error(`Concept language mismatch: ${concept.id}`);
    for (const prerequisite of concept.prerequisites ?? [])
      if (!concepts.has(prerequisite)) throw new Error(`Unknown prerequisite ${prerequisite}`);
  }
  for (const entry of course.lexicon) {
    if (entry.language !== language.id) throw new Error(`Lexicon language mismatch: ${entry.id}`);
    if (entry.lessonId && !lessons.has(entry.lessonId)) throw new Error(`Unknown lexicon lesson ${entry.lessonId}`);
    if (!entry.meanings.some((meaning) => meaning.translations[course.sourceLanguage]?.length))
      throw new Error(`Missing ${course.sourceLanguage} translation for ${entry.id}`);
  }
  for (const unit of course.units) {
    if (unit.assessmentId && !assessments.has(unit.assessmentId))
      throw new Error(`Unknown unit assessment ${unit.assessmentId}`);
    for (const concept of unit.introduces?.concepts ?? [])
      if (!concepts.has(concept)) throw new Error(`Unknown introduced concept ${concept}`);
    for (const word of unit.introduces?.vocabulary ?? [])
      if (!words.has(word)) throw new Error(`Unknown introduced word ${word}`);
  }
  for (const activity of activities) {
    for (const concept of activity.concepts)
      if (!concepts.has(concept)) throw new Error(`Unknown concept ${concept} on ${activity.id}`);
    for (const media of activity.media ?? [])
      if (!course.media.some((item) => item.id === media)) throw new Error(`Unknown media ${media}`);
    const payload = activity.payload;
    if (Array.isArray(payload.options) && typeof payload.answer === "string" &&
      !payload.options.includes(payload.answer))
      throw new Error(`Answer missing from options: ${activity.id}`);
  }
  for (const assessment of course.assessments) {
    const objectiveTypes = new Set([
      "multiple_choice", "true_false", "fill_blank", "ordering", "short_answer", "listening",
    ]);
    const weightSum = Object.values(assessment.skillWeights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(weightSum - 1) > 0.02)
      throw new Error(`Assessment weights must sum to 1: ${assessment.id}`);
    if (assessment.unitId && !units.has(assessment.unitId))
      throw new Error(`Unknown assessment unit: ${assessment.id}`);
    for (const item of assessment.bank) {
      if (!activityIds.has(item.activityId)) throw new Error(`Unknown assessment activity: ${item.activityId}`);
      const activity = activityById.get(item.activityId)!;
      if (!activity.skills.includes(item.skill))
        throw new Error(`Assessment skill mismatch: ${item.activityId}/${item.skill}`);
      if (!objectiveTypes.has(activity.type))
        throw new Error(`Assessment activity cannot be graded objectively: ${item.activityId}`);
    }
    for (const skill of new Set(assessment.skillPlan)) {
      const needed = assessment.skillPlan.filter((item) => item === skill).length;
      const available = new Set(assessment.bank.filter((item) => item.skill === skill).map((item) => item.activityId)).size;
      if (available < needed)
        throw new Error(`Assessment needs ${needed} distinct ${skill} questions: ${assessment.id}`);
    }
  }
  for (const mission of course.missions)
    for (const concept of mission.recommendedConcepts ?? [])
      if (!concepts.has(concept)) throw new Error(`Unknown mission concept: ${concept}`);
  for (const roleplay of course.roleplays) {
    const mission = course.missions.find((item) => item.scenario === roleplay.scenario);
    if (!mission) throw new Error(`Roleplay has no mission scenario: ${roleplay.id}`);
    for (const objective of roleplay.objectives)
      if (!mission.objectives.includes(objective))
        throw new Error(`Roleplay objective not in mission: ${roleplay.id}/${objective}`);
  }
  for (const media of course.media)
    if (media.src.startsWith("/") && !existsSync(join(process.cwd(), "public", media.src.slice(1))))
      throw new Error(`Missing media file: ${media.src}`);
  for (const variant of language.variants) {
    const provider = language.speech.providers.azure?.[variant.id];
    if (language.capabilities.speechRecognition && !provider?.recognitionLocale)
      throw new Error(`Missing Azure recognition configuration: ${language.id}/${variant.id}`);
    if (language.capabilities.pronunciationAssessment && !provider?.assessmentLocale && variant.id === language.speech.defaultVariant)
      throw new Error(`Missing Azure assessment configuration: ${language.id}/${variant.id}`);
    if (language.capabilities.textToSpeech &&
        !Object.values(language.speech.providers).some((locales) => locales[variant.id]?.ttsLocale))
      throw new Error(`Missing TTS configuration: ${language.id}/${variant.id}`);
  }
}
