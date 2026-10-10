// Trusted test producer. Node built-ins and public JSON artifacts only; this script is NOT package content.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, relative, sep } from "node:path";
import { createHash } from "node:crypto";

const [contractDirectory, outputDirectory, mode] = process.argv.slice(2);
if (!contractDirectory || !outputDirectory || (mode && mode !== "--unsupported"))
  throw Error(
    "Usage: node producer.mjs <public-contract-directory> <new-output-directory> [--unsupported]",
  );
const contract = JSON.parse(readFileSync(resolve(contractDirectory, "compatibility.json"), "utf8"));
const source = JSON.parse(readFileSync(resolve(contractDirectory, "example-source.json"), "utf8"));
const catalog = JSON.parse(readFileSync(resolve(contractDirectory, "capabilities.json"), "utf8"));
for (const name of ["manifest", "language", "course-metadata", "unit", "assessments"]) {
  const schema = JSON.parse(
    readFileSync(resolve(contractDirectory, `${name}.schema.json`), "utf8"),
  );
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema")
    throw Error("Unsupported public schema dialect");
}
if (
  !catalog.capabilities.some(
    (entry) => entry.id === "presentation.bidi" && entry.support === "implemented",
  )
)
  throw Error("Required public capability missing");
const root = resolve(outputDirectory);
if (existsSync(root))
  throw Error("Use a new output directory; existing content will not be overwritten");
mkdirSync(root, { recursive: true });
function file(path, bytes) {
  const target = resolve(root, path);
  const segment = relative(root, target);
  if (segment.startsWith(`..${sep}`) || segment === "..")
    throw Error("Output path escaped producer directory");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}
const json = (path, value) => file(path, Buffer.from(JSON.stringify(value, null, 2) + "\n"));
if (mode === "--unsupported")
  source.course.capabilityRequirements = [
    { id: "presentation.bidi", version: "99.0.0", required: true, data: {} },
  ];
const wave = Buffer.alloc(16044);
wave.write("RIFF", 0);
wave.writeUInt32LE(wave.length - 8, 4);
wave.write("WAVE", 8);
wave.write("fmt ", 12);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(16000, 24);
wave.writeUInt32LE(32000, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write("data", 36);
wave.writeUInt32LE(16000, 40);
const asset = { ...file("resources/phrase.wav", wave), mediaType: "audio/wav" };
const documents = {
  language: json("documents/language.json", source.language),
  course: json("documents/course.json", source.course),
  units: source.units.map((unit, index) => json(`curriculum/unit-${index}.json`, unit)),
  concepts: json("sections/concepts.json", source.concepts),
  lexicon: json("sections/lexicon.json", source.lexicon),
  assessments: json("sections/assessments.json", source.assessments),
  media: json("sections/media.json", source.media),
};
json("manifest.json", {
  format: contract.format,
  envelopeVersion: contract.versions.envelope[0],
  id: source.course.id,
  contentVersion: source.course.contentVersion,
  contracts: { language: source.language.schemaVersion, course: source.course.schemaVersion },
  producer: { id: "external.test-producer", name: "Independent simulated producer" },
  provenance: {
    material: "test",
    origin: "imported",
    sources: [{ label: "Synthetic public example", reference: "example-source.json" }],
    review: { status: "draft" },
  },
  documents,
  assets: [asset],
});
console.log(
  JSON.stringify({
    produced: true,
    format: contract.format,
    material: "test",
    mode: mode ?? "compatible",
    privateImports: 0,
  }),
);
