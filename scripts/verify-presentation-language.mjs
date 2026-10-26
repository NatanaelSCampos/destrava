import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dependencies =
  process.env.DESTRAVA_TEST_NODE_MODULES ?? resolve(root, "node_modules");
const require = createRequire(import.meta.url);
const ts = require(resolve(dependencies, "typescript/lib/typescript.js"));
function evaluate(source, filename, importModule, globals = {}) {
  const result = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.CommonJS,
    },
    reportDiagnostics: true,
  });
  assert.deepEqual(
    result.diagnostics?.filter(
      (item) => item.category === ts.DiagnosticCategory.Error,
    ),
    [],
  );
  const loadedModule = { exports: {} };
  new Function(
    "exports",
    "require",
    "module",
    ...Object.keys(globals),
    result.outputText,
  )(loadedModule.exports, importModule, loadedModule, ...Object.values(globals));
  return loadedModule.exports;
}
const cache = new Map();
function load(relative) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path);
  const loadedModule = evaluate(readFileSync(path, "utf8"), path, (id) => {
    if (id === "zod") return require(resolve(dependencies, "zod"));
    assert.ok(
      id.startsWith(".") || id.startsWith("@/"),
      `Unexpected runtime import: ${id}`,
    );
    const location = id.startsWith("@/")
      ? resolve(root, "src", id.slice(2))
      : resolve(dirname(path), id);
    const found = [location, `${location}.ts`].find(existsSync);
    assert.ok(found, `Missing pure module: ${id}`);
    return load(found);
  });
  cache.set(path, loadedModule);
  return loadedModule;
}
const { presentationLanguage } = load("src/engine/presentation/language.ts");
const { resolveTextPresentation } = load("src/engine/presentation/text.ts");
const { transcriptNarration, NarrationController } = load(
  "src/domain/interactive-lesson/narration-controller.ts",
);
const language = {
  id: "es-a-tu-paso",
  identity: { iso639_1: "es", iso639_3: "spa" },
  writingSystem: { direction: "ltr" },
};
const classroomPath =
  "src/components/interactive-lesson/interactive-classroom.tsx";
const classroom = ts.createSourceFile(
  classroomPath,
  readFileSync(resolve(root, classroomPath), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let contextInitializer;
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(classroom) === "narrationContext"
  )
    contextInitializer = node.initializer;
  ts.forEachChild(node, visit);
}
visit(classroom);
assert.ok(contextInitializer, "Real classroom narration context must exist");
function classroomContext(target = language, targetLocale = "es-ES") {
  const course = Object.freeze({
    id: "opaque-course",
    languageCode: "es-a-tu-paso",
    sourceLanguage: "pt-BR",
  });
  const { context } = evaluate(
    `export const context = (${contextInitializer.getText(classroom)});`,
    "classroom-context.ts",
    () => {
      throw new Error("Unexpected context import");
    },
    {
      course,
      language: target,
      targetLocale,
      variantResolution: { speechFallback: "same_language" },
      presentationLanguage,
    },
  );
  assert.equal(course.languageCode, "es-a-tu-paso");
  return context;
}
function transcript(textLanguage) {
  return [
    {
      startMs: 120,
      endMs: 300,
      text: "Hola. Texto no determina idioma.",
      ...(textLanguage === undefined
        ? {}
        : { textPresentation: { language: textLanguage } }),
    },
  ];
}
function assertTextOnly(lines) {
  let spoken = 0;
  const snapshots = [];
  const narrator = new NarrationController(
    () => {
      spoken += 1;
      throw new Error("No voice should be requested");
    },
    (snapshot) => snapshots.push(snapshot),
  );
  narrator.start(lines);
  assert.equal(spoken, 0);
  assert.equal(snapshots.at(-1).status, "text");
  narrator.dispose();
}

test("opaque package ID uses declared ISO language for default text presentation", () => {
  assert.equal(presentationLanguage(language), "es");
  assert.deepEqual(
    resolveTextPresentation(language, { sourceLanguage: "pt-BR" }),
    { lang: "es", dir: "ltr" },
  );
  for (const role of ["user", "fragment"])
    assert.deepEqual(resolveTextPresentation(language, {}, role), {
      lang: "es",
      dir: "auto",
    });
});

test("ISO precedence trims declared values and falls back to ISO3 then exact legacy ID", () => {
  const cases = [
    [{ id: "opaque", identity: { iso639_1: " es ", iso639_3: "spa" } }, "es"],
    [
      { id: "opaque", identity: { iso639_1: " \t ", iso639_3: " spa " } },
      "spa",
    ],
    [{ id: "opaque", identity: { iso639_3: " spa " } }, "spa"],
    [{ id: "opaque", identity: { iso639_1: "", iso639_3: " " } }, "opaque"],
    [{ id: "legacy-id" }, "legacy-id"],
    [{ id: " legacy-id ", identity: {} }, " legacy-id "],
  ];
  for (const [input, expected] of cases)
    assert.equal(presentationLanguage(input), expected);
});

test("source Portuguese and interface language retain their existing defaults", () => {
  assert.deepEqual(
    resolveTextPresentation(language, { sourceLanguage: "pt-BR" }, "source"),
    { lang: "pt-BR", dir: "auto" },
  );
  assert.deepEqual(resolveTextPresentation(language, {}, "source"), {
    lang: "pt-BR",
    dir: "auto",
  });
  assert.deepEqual(resolveTextPresentation(language, {}, "interface"), {
    lang: "pt-BR",
    dir: "ltr",
  });
});

test("explicit content and field overrides keep their precedence and direction", () => {
  const declaration = {
    content: { language: "ar", direction: "rtl" },
    fields: { title: { language: "en-GB", direction: "ltr" } },
  };
  assert.deepEqual(
    resolveTextPresentation(language, {}, "target", declaration),
    { lang: "ar", dir: "rtl" },
  );
  assert.deepEqual(
    resolveTextPresentation(language, {}, "target", declaration, "title"),
    { lang: "en-GB", dir: "ltr" },
  );
  assert.equal(
    resolveTextPresentation(
      { ...language, writingSystem: { direction: "rtl" } },
      {},
    ).dir,
    "rtl",
  );
});

test("explicit legacy opaque presentation metadata is not rewritten to ISO", () => {
  const declaration = { fields: { transcript: { language: "es-a-tu-paso" } } };
  assert.equal(
    resolveTextPresentation(language, {}, "target", declaration, "transcript")
      .lang,
    "es-a-tu-paso",
  );
  assertTextOnly(
    transcriptNarration(transcript("es-a-tu-paso"), classroomContext()),
  );
});

test("real classroom context maps an ES transcript to the supplied es-ES variant locale", () => {
  const context = classroomContext();
  assert.equal(context.targetLanguage, "es");
  assert.equal(context.targetLocale, "es-ES");
  const [line] = transcriptNarration(transcript("es"), context);
  assert.equal(line.language, "es");
  assert.equal(line.role, "target");
  assert.equal(line.locale, "es-ES");
  assert.equal(line.anchorMs, 120);
});

test("declared source transcript remains Portuguese while the target uses ISO", () => {
  const [line] = transcriptNarration(transcript("pt-BR"), classroomContext());
  assert.equal(line.role, "source");
  assert.equal(line.locale, "pt-BR");
});

test("unknown, absent or merely prefixed language declarations do not acquire narration", () => {
  for (const declared of [undefined, "fr", "es-MX", "es-a-tu-paso"]) {
    const lines = transcriptNarration(transcript(declared), classroomContext());
    assert.equal(lines[0].role, null);
    assert.equal(lines[0].locale, null);
    assertTextOnly(lines);
  }
});

test("missing compatible target locale falls back to text without a source-language voice", () => {
  const context = classroomContext(language, null);
  assert.equal(context.targetFallbackAllowed, true);
  const lines = transcriptNarration(transcript("es"), context);
  assert.equal(lines[0].role, "target");
  assert.equal(lines[0].locale, null);
  assertTextOnly(lines);
});

test("legacy language without ISO preserves its ID without guessing from text or names", () => {
  const legacy = {
    id: "opaque-language",
    identity: { nativeName: "Espa\u00f1ol" },
    writingSystem: { direction: "ltr" },
  };
  assert.equal(presentationLanguage(legacy), "opaque-language");
  assert.equal(resolveTextPresentation(legacy, {}).lang, "opaque-language");
  assert.equal(classroomContext(legacy).targetLanguage, "opaque-language");
  assertTextOnly(
    transcriptNarration(transcript("es"), classroomContext(legacy)),
  );
});

test("presentation and narration context do not mutate frozen language or package identity", () => {
  const frozen = Object.freeze({
    ...language,
    identity: Object.freeze({ ...language.identity }),
    writingSystem: Object.freeze({ ...language.writingSystem }),
  });
  const before = JSON.stringify(frozen);
  presentationLanguage(frozen);
  resolveTextPresentation(frozen, { sourceLanguage: "pt-BR" });
  classroomContext(frozen);
  assert.equal(JSON.stringify(frozen), before);
  assert.equal(frozen.id, "es-a-tu-paso");
});
