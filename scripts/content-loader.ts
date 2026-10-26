import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  alphabetModuleSchema,
  numbersModuleSchema,
  regionalVariantsModuleSchema,
  coursePackageSchema,
  languagePackageSchema,
  type CoursePackage,
  type LanguagePackage,
} from "../src/content/contracts";
import { packageReferenceIssues } from "../src/content/package-references";
import { runtimeBundle } from "../src/content/runtime-package";
import { validateInteractiveLessons } from "../src/content/validate-interactive-lessons";

const contentRoot = resolve(process.cwd(), "content");
function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
function jsonFiles(path: string): string[] {
  return existsSync(path)
    ? readdirSync(path)
        .filter((name) => name.endsWith(".json"))
        .sort()
    : [];
}

export function loadContent(): Array<{
  course: CoursePackage;
  language: LanguagePackage;
  moduleData: Record<string, unknown>;
}> {
  const languages = new Map<
    string,
    { language: LanguagePackage; moduleData: Record<string, unknown> }
  >();
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
      moduleData[moduleId] =
        moduleId === "alphabet"
          ? alphabetModuleSchema.parse(data)
          : moduleId === "numbers"
            ? numbersModuleSchema.parse(data)
            : moduleId === "regionalVariants"
              ? regionalVariantsModuleSchema.parse(data)
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
      interactiveLessons: jsonFiles(join(root, "interactive-lessons")).map((file) =>
        readJson(join(root, "interactive-lessons", file)),
      ),
    });
    if (course.id !== name) throw new Error(`Course folder mismatch: ${name}`);
    const language = languages.get(course.targetLanguage);
    if (!language)
      throw new Error(`Unknown target language ${course.targetLanguage} for ${course.id}`);
    const references = packageReferenceIssues(course, language.language);
    if (references.length)
      throw new Error(
        references
          .map((issue) => `${issue.code} ${issue.path.join(".")}: ${issue.message}`)
          .join("\n"),
      );
    for (const asset of course.media)
      if (
        asset.src.startsWith("/") &&
        !existsSync(join(process.cwd(), "public", asset.src.slice(1)))
      )
        throw new Error(`Missing media file: ${asset.id}`);
    validateInteractiveLessons(course, language.language);
    runtimeBundle({ course, language: language.language, moduleData: language.moduleData });
    bundles.push({ course, ...language });
  }
  assertUnique(
    bundles.map((bundle) => bundle.course.id),
    "course",
  );
  if (bundles.filter((bundle) => bundle.course.isDefault).length !== 1)
    throw new Error("Exactly one course must have isDefault: true");
  assertUnique(
    bundles.map((bundle) => bundle.course.slug),
    "course slug",
  );
  assertUnique(
    bundles.flatMap((bundle) => bundle.course.units.map((unit) => unit.id)),
    "global unit",
  );
  assertUnique(
    bundles.flatMap((bundle) =>
      bundle.course.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)),
    ),
    "global lesson",
  );
  assertUnique(
    bundles.flatMap((bundle) =>
      bundle.course.units.flatMap((unit) =>
        unit.lessons.flatMap((lesson) => [...lesson.activities, ...(lesson.deferredRecovery?.rules.map(rule => rule.activity) ?? [])].map((activity) => activity.id)),
      ),
    ),
    "global activity",
  );
  assertUnique(
    bundles.flatMap((bundle) => bundle.course.lexicon.map((entry) => entry.id)),
    "global lexicon",
  );
  assertUnique(
    bundles.flatMap((bundle) => bundle.course.assessments.map((assessment) => assessment.id)),
    "global assessment",
  );
  return bundles;
}

function assertUnique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} ID`);
}
