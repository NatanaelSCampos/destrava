// Experimental independent author: Node built-ins + exported public documents only.
// This script is a tool of the producer. It is never included in package content.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from "node:fs";
import { resolve, relative, dirname, isAbsolute, sep } from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    version: { type: "string", default: "1.0.0" },
    "course-id": { type: "string", default: "independent.i8.fixture" },
    mandatory: { type: "string" },
    unsupported: { type: "boolean", default: false },
  },
});
assert.equal(
  positionals.length,
  2,
  "Usage: node producer.mjs <public-contracts> <new-output> [--version=1.0.0|2.0.0] [--course-id=id] [--mandatory=id] [--unsupported]",
);
assert(
  ["1.0.0", "2.0.0"].includes(values.version),
  "Only the two experimental versions are supported",
);
assert(
  /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(values["course-id"]),
  "Invalid synthetic course ID",
);
const contractRoot = realpathSync(resolve(positionals[0]));
assert(!/^[\\/]{2}/.test(contractRoot), "Only local public contract directories are allowed");
const publicJson = (file) => JSON.parse(readFileSync(resolve(contractRoot, file), "utf8"));
const compatibility = publicJson("compatibility.json");
const catalog = publicJson("capabilities.json");
for (const name of [
  "manifest",
  "language",
  "course-metadata",
  "unit",
  "assessments",
  "concepts",
  "lexicon",
])
  assert.equal(
    publicJson(`${name}.schema.json`).$schema,
    "https://json-schema.org/draft/2020-12/schema",
  );
for (const id of [
  "activity.lesson_content",
  "activity.ordering",
  "activity.writing",
  "grading.exact-normalized",
])
  assert(
    catalog.capabilities.some((entry) => entry.id === id && entry.support === "implemented"),
    `Public capability missing: ${id}`,
  );
const source = publicJson("example-source.json");
assert(compatibility.versions.course.includes(source.course.schemaVersion));
assert(compatibility.versions.language.includes(source.language.schemaVersion));
const second = values.version === "2.0.0";
const courseId = values["course-id"];
const language = structuredClone(source.language);
language.id = "xx-I8";
language.identity = { name: "Synthetic interoperability language", nativeName: "I8 fixture" };
language.writingSystem = { direction: "ltr", scripts: ["Latn"], caseSensitive: false };
language.modules = {};
const course = structuredClone(source.course);
Object.assign(course, {
  id: courseId,
  slug: courseId.replaceAll(".", "-"),
  contentVersion: values.version,
  targetLanguage: language.id,
  title: `Curso independente I8 ${values.version} [${courseId}]`,
  description:
    "Percurso sintético externo. Sem conteúdo editorial real ou dependência de provedor.",
});
const unit = structuredClone(source.units[0]);
unit.title = `Unidade independente ${values.version}`;
unit.skills = ["vocabulary", "writing"];
const lesson = unit.lessons[0];
lesson.title = `Lição independente ${values.version}`;
const ordering = structuredClone(lesson.activities[0]);
const tokens = ["I8 alpha", "I8 beta", "I8 gamma"];
const order = second ? [2, 1, 0] : [0, 1, 2];
ordering.title = "Ordenação independente";
ordering.prompt = "Monte a sequência sintética e confira a correção.";
ordering.payload = {
  words: tokens,
  answer: order.map((index) => tokens[index]).join("::"),
  answerOrder: order,
  reconstruction: { strategy: "separator", separator: "::" },
  explanation: `I8_PRIVATE_CRITERION_${second ? "V2" : "V1"}`,
};
const writing = structuredClone(lesson.activities[1]);
writing.title = "Escrita manual independente";
writing.payload = {
  guidance: ["Escreva de dois a quarenta grafemas; não há avaliação de IA."],
  textRequirement: { measure: { strategy: "graphemes" }, minimum: 2, maximum: 40 },
};
const content = {
  id: "opaque-content",
  type: "lesson_content",
  title: "Conteúdo independente",
  skills: ["vocabulary"],
  concepts: [],
  minutes: 1,
  payload: {
    body: "Este pequeno percurso foi produzido fora do repositório do motor.",
    highlights: ["Dados, contrato e execução possuem fronteiras distintas."],
  },
};
lesson.activities = [content, ordering, writing];
lesson.minutes = 5;
unit.learningPolicy.completion.requirements = [
  {
    id: "read-content",
    label: "Estudar conteúdo",
    kind: "participation",
    activityIds: [content.id],
    minimumCount: 1,
  },
];
unit.learningPolicy.mastery.requirements[0].minimumScore = second ? 50 : 100;
const assessments = structuredClone(source.assessments);
assessments[0].passingPolicy.overall = second ? 0.5 : 1;
assessments[0].activityIds = [ordering.id];
const requirements = [];
if (values.mandatory) {
  const capability = catalog.capabilities.find((entry) => entry.id === values.mandatory);
  assert(capability, "Mandatory fixture must use a published capability");
  requirements.push({
    id: capability.id,
    version: capability.supportedVersions[0],
    required: true,
    data: {},
  });
}
if (values.unsupported)
  requirements.push({ id: "presentation.bidi", version: "99.0.0", required: true, data: {} });
if (requirements.length) course.capabilityRequirements = requirements;
else delete course.capabilityRequirements;
const root = resolve(positionals[1]);
assert(!/^[\\/]{2}/.test(root), "Only a local output directory is allowed");
assert(!existsSync(root), "Existing output will not be overwritten");
mkdirSync(root, { recursive: true });
function json(path, value) {
  const target = resolve(root, path);
  const delta = relative(root, target);
  assert(delta && delta !== ".." && !delta.startsWith(".." + sep) && !isAbsolute(delta));
  mkdirSync(dirname(target), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
  writeFileSync(target, bytes);
  return {
    path,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
const documents = {
  language: json("documents/language.json", language),
  course: json("documents/course.json", course),
  units: [json("curriculum/unit-0.json", unit)],
  concepts: json("sections/concepts.json", []),
  lexicon: json("sections/lexicon.json", []),
  assessments: json("sections/assessments.json", assessments),
};
json("manifest.json", {
  format: compatibility.format,
  envelopeVersion: compatibility.versions.envelope[0],
  id: courseId,
  contentVersion: values.version,
  contracts: { language: language.schemaVersion, course: course.schemaVersion },
  producer: { id: "independent.i8.producer", name: "Independent experimental author" },
  provenance: {
    material: "test",
    origin: "imported",
    sources: [{ label: "Public synthetic authoring example", reference: "example-source.json" }],
    review: { status: "draft" },
  },
  documents,
  assets: [],
});
console.log(
  JSON.stringify({
    produced: true,
    contentVersion: values.version,
    courseId,
    material: "test",
    privateImports: 0,
  }),
);
