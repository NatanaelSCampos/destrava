import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  coursePackageSchema, languagePackageSchema,
  type CoursePackage, type LanguagePackage,
} from "../src/content/contracts";

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
      moduleData[moduleId] = readJson(path);
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
    bundles.push({ course, ...language });
  }
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
    if (assessment.unitId && !units.has(assessment.unitId))
      throw new Error(`Unknown assessment unit: ${assessment.id}`);
    for (const item of assessment.bank)
      if (!activityIds.has(item.activityId)) throw new Error(`Unknown assessment activity: ${item.activityId}`);
  }
  for (const mission of course.missions)
    for (const concept of mission.recommendedConcepts ?? [])
      if (!concepts.has(concept)) throw new Error(`Unknown mission concept: ${concept}`);
  for (const roleplay of course.roleplays)
    if (!course.missions.some((mission) => mission.scenario === roleplay.scenario))
      throw new Error(`Roleplay has no mission scenario: ${roleplay.id}`);
  for (const media of course.media)
    if (media.src.startsWith("/") && !existsSync(join(process.cwd(), "public", media.src.slice(1))))
      throw new Error(`Missing media file: ${media.src}`);
  for (const variant of language.variants) {
    const provider = language.speech.providers.azure?.[variant.id];
    if (language.capabilities.speechRecognition && !provider?.recognitionLocale)
      throw new Error(`Missing Azure recognition configuration: ${language.id}/${variant.id}`);
  }
}
