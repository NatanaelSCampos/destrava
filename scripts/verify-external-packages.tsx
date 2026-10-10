import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  cpSync,
  copyFileSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  linkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, sep } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { validateExternalPackageDirectory } from "../src/lib/external-package-validation";
import { readExternalPackageDirectory } from "../src/repositories/external-package-directory";
import { validateExternalPackageFiles } from "../src/engine/import/validate-package";
import { parsePackageJson } from "../src/engine/import/json-data";
import { packagePathSchema } from "../src/content/package-contract";
import { gradeActivity } from "../src/domain/activities/grader";
import { evaluateAssessment } from "../src/domain/assessments/assessment-engine";
import { evaluateWritingText } from "../src/engine/text/representation";
import { allCourseBundles } from "../src/content/course-registry";
import type { PackageValidationReport } from "../src/engine/import/validate-package";
import { publicPackageArtifacts } from "../src/engine/import/public-artifacts";

const root = mkdtempSync(join(tmpdir(), "destrava-import-tests-")),
  artifacts = join(root, "public-contracts"),
  producer = join(root, "producer.mjs"),
  directory = join(root, "valid-package");
cpSync(resolve("contracts/package-v1"), artifacts, { recursive: true });
copyFileSync(resolve("scripts/produce-external-course.mjs"), producer);
const appArtifacts = [
  "src/content/generated/registry.ts",
  "src/content/generated/packs/frecuencias-a1.json",
  "src/content/generated/packs/pt-BR.en.a1.general.json",
  "src/content/generated/packs/pt-BR.xx-Test.a1.general.json",
];
const hashes = () =>
  appArtifacts.map((p) => createHash("sha256").update(readFileSync(p)).digest("hex"));
const original = hashes(),
  catalogIds = allCourseBundles().map((b) => b.course.id);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw Error("Network forbidden in external import tests");
};
let checks = 0,
  properties = 0;
async function check(name: string, run: () => unknown | Promise<unknown>) {
  await run();
  checks++;
  console.log(`OK ${name}`);
}
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  await check("portable artifacts match canonical schemas without divergent definitions", () => {
    for (const [file, expected] of Object.entries(publicPackageArtifacts()))
      assert.deepEqual(
        JSON.parse(readFileSync(resolve("contracts/package-v1", file), "utf8")),
        expected,
      );
  });
  const produced = JSON.parse(
    execFileSync(process.execPath, [producer, artifacts, directory], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  assert.equal(produced.privateImports, 0);
  const snapshot = await readExternalPackageDirectory(directory);
  assert.deepEqual(snapshot.diagnostics, []);
  const base = snapshot.files;
  const fresh = () => new Map([...base].map(([key, value]) => [key, value.slice()]));
  const read = (files: Map<string, Uint8Array>, path: string) =>
    JSON.parse(Buffer.from(files.get(path)!).toString());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mutators deliberately create schema-invalid heterogeneous JSON.
  const edit = (files: Map<string, Uint8Array>, path: string, mutate: (data: any) => void) => {
    const data = read(files, path);
    mutate(data);
    const bytes = Buffer.from(JSON.stringify(data) + "\n");
    files.set(path, bytes);
    if (path !== "manifest.json") {
      const manifest = read(files, "manifest.json");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Integrity metadata is traversed before any document schema is trusted.
      const walk = (value: any) => {
        if (!value || typeof value !== "object") return;
        if (value.path === path) {
          value.sha256 = digest(bytes);
          value.bytes = bytes.length;
        }
        for (const child of Object.values(value)) walk(child);
      };
      walk(manifest);
      files.set("manifest.json", Buffer.from(JSON.stringify(manifest) + "\n"));
    }
  };
  const rejected = (files: Map<string, Uint8Array>, code: string) => {
    const result = validateExternalPackageFiles(files);
    assert.equal(result.report.preparation, "rejected");
    assert.equal(result.prepared, undefined);
    assert(
      result.report.diagnostics.some((d) => d.code === code),
      JSON.stringify(result.report.diagnostics.map((d) => d.code)),
    );
    return result;
  };
  const valid = validateExternalPackageFiles(base);
  assert(valid.prepared);
  await check("independent external producer uses only public schemas/example/catalog", () => {
    assert(!directory.startsWith(resolve(process.cwd()) + sep));
    const source = readFileSync(producer, "utf8");
    assert(!/from\s+["'](?!node:)|import\s*\(|require\s*\(/.test(source));
    assert(
      !source.includes("src/content") &&
        !source.includes("supabase") &&
        !source.includes("runtimeBundle"),
    );
    assert(!readFileSync(join(artifacts, "capabilities.json"), "utf8").includes('"file": "src/'));
  });
  await check(
    "valid package prepares without installation and has unknown operational media health",
    async () => {
      const result = await validateExternalPackageDirectory(directory);
      assert.equal(result.report.technicallyValid, true);
      assert.equal(result.report.compatible, true);
      assert.equal(result.report.preparation, "prepared");
      assert.equal(result.report.readiness, "unknown");
      assert.equal(result.report.activation, "not_performed");
    },
  );
  await check(
    "invalid manifest and unsupported envelope/content versions report precise fields",
    () => {
      const files = fresh();
      edit(files, "manifest.json", (m) => {
        m.format = "unknown";
        m.envelopeVersion = "99.0.0";
        m.contracts.course = "99.0";
      });
      const result = rejected(files, "CONTRACT_VERSION_UNSUPPORTED");
      assert(result.report.diagnostics.length >= 3);
      assert(result.report.diagnostics.some((d) => d.field === "/envelopeVersion"));
    },
  );
  await check("required JSON document missing is rejected", () => {
    const files = fresh();
    files.delete("documents/language.json");
    rejected(files, "DOCUMENT_MISSING");
  });
  await check("duplicate curricular entity IDs are rejected", () => {
    const files = fresh();
    edit(files, "curriculum/unit-0.json", (unit) =>
      unit.lessons[0].activities.push(structuredClone(unit.lessons[0].activities[0])),
    );
    const result = rejected(files, "DUPLICATE_ID");
    assert(
      result.report.diagnostics.some(
        (d) => d.document === "curriculum/unit-0.json" && d.field.includes("/activities/"),
      ),
    );
  });
  await check("unknown concept and invalid lexicon lesson are independent semantic errors", () => {
    const files = fresh();
    edit(
      files,
      "curriculum/unit-0.json",
      (unit) => (unit.lessons[0].activities[0].concepts = ["missing"]),
    );
    edit(files, "sections/lexicon.json", (entries) =>
      entries.push({
        id: "entry",
        language: "xx-External",
        lemma: "x",
        lessonId: "missing",
        meanings: [{ id: "meaning", translations: { "pt-BR": ["x"] } }],
      }),
    );
    const result = rejected(files, "REFERENCE_MISSING");
    assert(result.report.diagnostics.filter((d) => d.code === "REFERENCE_MISSING").length >= 2);
  });
  await check("invalid assessment reference is mapped to its actual document", () => {
    const files = fresh();
    edit(files, "sections/assessments.json", (a) => (a[0].activityIds = ["missing"]));
    const result = rejected(files, "SEMANTIC_INVALID");
    assert(result.report.diagnostics.some((d) => d.document === "sections/assessments.json"));
  });
  await check("policy cannot depend on invalid/unrelated evidence", () => {
    const files = fresh();
    edit(
      files,
      "curriculum/unit-0.json",
      (unit) => (unit.learningPolicy.completion.requirements[0].activityIds = ["missing"]),
    );
    const result = rejected(files, "SEMANTIC_INVALID");
    assert(result.report.diagnostics.some((d) => d.field.includes("/learningPolicy/")));
  });
  await check("unknown mandatory capability blocks preparation", () => {
    const files = fresh();
    edit(
      files,
      "documents/course.json",
      (c) =>
        (c.capabilityRequirements = [
          { id: "unknown.executor", version: "1.0.0", required: true, data: {} },
        ]),
    );
    rejected(files, "CAPABILITY_UNKNOWN");
  });
  await check("incompatible version and partial capability are not promoted to supported", () => {
    const files = fresh();
    edit(
      files,
      "documents/course.json",
      (c) =>
        (c.capabilityRequirements = [
          { id: "presentation.bidi", version: "99.0.0", required: true, data: {} },
        ]),
    );
    rejected(files, "CAPABILITY_VERSION_INCOMPATIBLE");
    const partial = fresh();
    edit(
      partial,
      "documents/course.json",
      (c) =>
        (c.capabilityRequirements = [
          {
            id: "numbers.dictation",
            version: "1.0.0",
            required: true,
            data: {
              prompts: [
                {
                  id: "n",
                  category: "n",
                  display: "1",
                  spoken: "one",
                  example: "one",
                  exampleTranslation: "um",
                },
              ],
              categoryLabels: { n: "n" },
            },
          },
        ]),
    );
    const r = validateExternalPackageFiles(partial);
    assert.equal(r.report.preparation, "rejected");
    assert(r.report.diagnostics.some((d) => d.category === "compatibility"));
  });
  await check("optional capability needs valid alternative; valid fallback is preserved", () => {
    const files = fresh();
    edit(
      files,
      "manifest.json",
      (m) =>
        (m.capabilityRequirements = [
          { id: "optional.unknown", version: "1.0.0", required: false, data: {} },
        ]),
    );
    const r = validateExternalPackageFiles(files);
    assert.equal(r.report.preparation, "rejected");
    const good = fresh();
    edit(
      good,
      "manifest.json",
      (m) =>
        (m.capabilityRequirements = [
          {
            id: "optional.unknown",
            version: "1.0.0",
            required: false,
            data: {},
            fallback: {
              id: "text.normalization",
              version: "1.0.0",
              data: read(good, "documents/language.json").normalization,
            },
          },
        ]),
    );
    const accepted = validateExternalPackageFiles(good);
    assert(accepted.prepared);
    assert(
      accepted.prepared.bundle.course.capabilityRequirements!.some(
        (req) => req.id === "optional.unknown",
      ),
    );
  });
  await check("invalid course and mandatory activity variants are rejected", () => {
    const files = fresh();
    edit(files, "documents/course.json", (c) => (c.defaultVariant = "missing"));
    rejected(files, "VARIANT_INVALID");
  });
  await check("incompatible textual strategies do not disappear", () => {
    const files = fresh();
    edit(
      files,
      "curriculum/unit-0.json",
      (unit) => (unit.lessons[0].activities[0].payload.reconstruction.strategy = "unknown"),
    );
    const r = validateExternalPackageFiles(files);
    assert.equal(r.report.preparation, "rejected");
    assert(r.report.diagnostics.some((d) => d.code === "CAPABILITY_DATA_INVALID"));
  });
  await check(
    "RTL, repeated tokens, text measures and assessment semantics survive conversion",
    () => {
      const b = valid.prepared!.bundle,
        activities = b.course.units[0].lessons[0].activities,
        ordering = activities[0];
      assert(ordering.type === "ordering");
      assert.deepEqual(ordering.answerOrder, [0, 1, 2]);
      assert.equal(ordering.reconstruction?.separator, "::");
      assert.equal(ordering.variant!.requiredVariant, "variant-b");
      assert.equal(ordering.presentation!.fields!.tokens!.direction, "auto");
      assert.equal(b.language.writingSystem.direction, "rtl");
      assert.equal(b.course.units[0].learningPolicy!.completion.requirements[0].kind, "submission");
      assert.equal(b.course.assessments[0].purpose, "summative");
      assert.equal(b.course.units[0].assessmentRefs.final, "opaque-final");
      assert(
        activities[1].type === "writing" && evaluateWritingText("你好", activities[1]).accepted,
      );
    },
  );
  await check("mandatory media absent, tampered bytes and type mismatch are rejected", () => {
    const missing = fresh();
    missing.delete("resources/phrase.wav");
    rejected(missing, "DOCUMENT_MISSING");
    const tampered = fresh();
    tampered.get("resources/phrase.wav")![20] ^= 1;
    rejected(tampered, "INTEGRITY_MISMATCH");
    const wrong = fresh();
    edit(wrong, "manifest.json", (m) => (m.assets[0].mediaType = "image/png"));
    rejected(wrong, "RESOURCE_TYPE_MISMATCH");
  });
  await check("malicious resource paths and remote fetches are blocked", () => {
    for (const src of [
      "../secret.wav",
      "/absolute.wav",
      "https://example.test/audio.wav",
      "file:///secret.wav",
      "data:audio/wav;base64,a",
    ]) {
      const files = fresh();
      edit(files, "sections/media.json", (m) => (m[0].src = src));
      rejected(files, "RESOURCE_PATH_INVALID");
    }
  });
  await check("structurally plausible package with mismatched identities is rejected", () => {
    const files = fresh();
    edit(files, "documents/course.json", (c) => (c.contentVersion = "2.0.0"));
    rejected(files, "PACKAGE_IDENTITY_MISMATCH");
  });
  await check("test material and fake claimed approval never authorize publication", () => {
    assert.equal(valid.report.editorial.material, "test");
    assert.equal(valid.report.editorial.declaredApproval, "draft");
    assert.equal(valid.report.editorial.eligibleForPublication, false);
    const files = fresh();
    edit(
      files,
      "manifest.json",
      (m) =>
        (m.provenance.review = {
          status: "approved",
          reviewedBy: "unverified-test-actor",
          reference: "synthetic-claim",
        }),
    );
    const result = validateExternalPackageFiles(files);
    assert(result.prepared);
    assert.equal(result.report.editorial.producerTrust, "unverified");
    assert.equal(result.report.editorial.published, false);
    assert.equal(result.report.editorial.eligibleForPublication, false);
  });
  await check(
    "public projection and accidental result serialization cannot leak private answers",
    () => {
      const prepared = valid.prepared!,
        activity = prepared.publicCourse.units[0].lessons[0].activities[0];
      for (const key of [
        "answer",
        "answerOrder",
        "accepted",
        "fullAnswers",
        "answerPolicy",
        "explanation",
      ])
        assert(!(key in activity));
      assert(!("capabilityRequests" in prepared.publicCourse));
      assert(!JSON.stringify(valid).includes("שלום::A12::שלום"));
      assert(!JSON.stringify(valid).includes('"bundle"'));
    },
  );
  await check("existing grader and assessment executor execute external prepared activity", () => {
    const b = valid.prepared!.bundle,
      a = b.course.units[0].lessons[0].activities[0];
    assert(a.type === "ordering");
    const context = { language: b.language, course: b.course, preference: "variant-a" };
    assert(gradeActivity(a, a.answer, b.language.normalization, context)!.correct);
    const evaluation = evaluateAssessment(
      b.course,
      "opaque-final",
      [{ activityId: a.id, answer: a.answer }],
      b.language.normalization,
      context,
    );
    assert.equal(evaluation.objectiveScore, 100);
    assert("variantId" in evaluation.answers[0]);
    assert.equal(evaluation.answers[0].variantId, "variant-b");
  });
  await check(
    "unknown fields and ignored localized instructions are rejected without semantic loss",
    () => {
      const ignored = fresh();
      edit(
        ignored,
        "curriculum/unit-0.json",
        (unit) =>
          (unit.lessons[0].activities[0].instructions = { "pt-BR": "Do something different" }),
      );
      rejected(ignored, "UNSUPPORTED_SEMANTIC_FIELD");
      const unknown = fresh();
      edit(
        unknown,
        "curriculum/unit-0.json",
        (unit) => (unit.lessons[0].activities[0].silentNewRule = "required"),
      );
      rejected(unknown, "UNSUPPORTED_FIELD");
    },
  );
  await check(
    "prerequisite cycles and missing dependencies are rejected; acyclic metadata stays explicit",
    () => {
      const files = fresh();
      edit(files, "sections/concepts.json", (c) =>
        c.push(
          { id: "a", language: "xx-External", type: "function", name: "A", prerequisites: ["b"] },
          { id: "b", language: "xx-External", type: "function", name: "B", prerequisites: ["a"] },
        ),
      );
      rejected(files, "PREREQUISITE_CYCLE");
      edit(files, "sections/concepts.json", (c) => (c[1].prerequisites = []));
      const r = validateExternalPackageFiles(files);
      assert(r.prepared);
      assert(r.report.diagnostics.some((d) => d.code === "METADATA_ONLY_PREREQUISITES"));
      assert.deepEqual(r.prepared.bundle.coursePackage.concepts[0].prerequisites, ["b"]);
    },
  );
  await check(
    "malformed JSON diagnostics do not expose private snippets; unsafe keys and duplicates rejected",
    () => {
      const files = fresh();
      files.set(
        "curriculum/unit-0.json",
        Buffer.from('{"answer":"private-canary-answer",unquoted}'),
      );
      const r = rejected(files, "JSON_INVALID");
      assert(!JSON.stringify(r.report).includes("private-canary-answer"));
      for (const text of ['{"x":1,"x":2}', '{"__proto__":{}}', '{"x":"\\ud800"}'])
        assert.throws(() => parsePackageJson(Buffer.from(text)));
    },
  );
  await check("multiple independent document errors retain stable locations", () => {
    const files = fresh();
    edit(files, "documents/language.json", (l) => (l.writingSystem.direction = "vertical"));
    edit(files, "curriculum/unit-0.json", (u) => (u.skills = ["not-a-skill"]));
    const r = validateExternalPackageFiles(files);
    assert(r.report.diagnostics.some((d) => d.document === "documents/language.json"));
    assert(r.report.diagnostics.some((d) => d.document === "curriculum/unit-0.json"));
  });
  await check("known capability unavailable differs from incompatible and masks execution", () => {
    const r = validateExternalPackageFiles(base, {
      environment: {
        capabilities: {
          "presentation.bidi": { state: "unavailable", reason: "synthetic unavailable renderer" },
        },
      },
    });
    assert.equal(r.report.compatible, true);
    assert.equal(r.report.readiness, "unavailable");
    assert(r.prepared);
    assert(r.prepared.publicCourse.availability!.unavailableActivityIds.length > 0);
    assert.equal(r.report.activation, "not_performed");
  });
  await check(
    "module documents are shared-schema data; unsafe source URLs and variants are rejected",
    () => {
      const files = fresh();
      const topic = [
        {
          id: "topic",
          title: "Fixture",
          meaning: "Test",
          note: "Synthetic",
          variants: [{ region: "variant-a", term: "x", example: "x" }],
          checkPrompt: "Test?",
          checkRegion: "variant-a",
          sources: [{ label: "Synthetic informational link", url: "https://example.test/info" }],
        },
      ];
      const bytes = Buffer.from(JSON.stringify(topic));
      files.set("modules/topics.json", bytes);
      edit(
        files,
        "manifest.json",
        (m) =>
          (m.documents.modules = {
            regionalVariants: {
              path: "modules/topics.json",
              bytes: bytes.length,
              sha256: digest(bytes),
            },
          }),
      );
      edit(
        files,
        "documents/language.json",
        (l) => (l.modules.regionalVariants = { enabled: true, source: "modules/topics.json" }),
      );
      const good = validateExternalPackageFiles(files);
      assert(good.prepared);
      assert.equal(good.prepared.bundle.resources.regionalTopics.length, 1);
      const url = new Map([...files].map(([k, v]) => [k, v.slice()]));
      edit(
        url,
        "modules/topics.json",
        (entries) => (entries[0].sources[0].url = "javascript://unsafe"),
      );
      rejected(url, "SOURCE_URL_UNSAFE");
      const region = new Map([...files].map(([k, v]) => [k, v.slice()]));
      edit(region, "modules/topics.json", (entries) => (entries[0].variants[0].region = "missing"));
      rejected(region, "VARIANT_INVALID");
      const mismatch = new Map([...files].map(([k, v]) => [k, v.slice()]));
      edit(
        mismatch,
        "documents/language.json",
        (l) => (l.modules.regionalVariants.source = "other.json"),
      );
      rejected(mismatch, "MODULE_SOURCE_MISMATCH");
    },
  );
  await check(
    "directory adapter refuses scripts, symlinks, junctions and hard links without following",
    async () => {
      const scripts = join(root, "scripts-package");
      cpSync(directory, scripts, { recursive: true });
      writeFileSync(join(scripts, "execute.js"), 'throw new Error("must not run")');
      const scriptResult = await validateExternalPackageDirectory(scripts);
      assert.equal(scriptResult.report.preparation, "rejected");
      assert(scriptResult.report.diagnostics.some((d) => d.code === "PACKAGE_FILE_TYPE_INVALID"));
      const linkRoot = join(root, "linked-package");
      cpSync(directory, linkRoot, { recursive: true });
      symlinkSync(join(root, "public-contracts"), join(linkRoot, "escape"), "junction");
      const linked = await validateExternalPackageDirectory(linkRoot);
      assert.equal(linked.report.preparation, "rejected");
      assert(linked.report.diagnostics.some((d) => d.code === "PACKAGE_LINK_FORBIDDEN"));
      const hardRoot = join(root, "hardlinked-package");
      cpSync(directory, hardRoot, { recursive: true });
      linkSync(join(artifacts, "language.schema.json"), join(hardRoot, "hard.json"));
      assert.equal(
        (await validateExternalPackageDirectory(hardRoot)).report.preparation,
        "rejected",
      );
    },
  );
  await check("duplicate/case-conflicting names and undeclared files rejected", () => {
    const files = fresh();
    files.set("DOCUMENTS/LANGUAGE.JSON", files.get("documents/language.json")!);
    rejected(files, "PACKAGE_NAME_COLLISION");
    const extra = fresh();
    extra.set("extra.json", Buffer.from("{}"));
    rejected(extra, "FILE_UNDECLARED");
  });
  await check("limits bound file count, JSON complexity and data-only processing", () => {
    const files = fresh();
    for (let i = 0; i < 257; i++) files.set(`extra-${i}.json`, Buffer.from("{}"));
    rejected(files, "PACKAGE_SIZE_LIMIT");
    assert.throws(() => parsePackageJson(Buffer.from("[".repeat(80) + "0" + "]".repeat(80))));
    assert.throws(() => parsePackageJson(new Uint8Array(1024 * 1024 + 1)));
  });
  await check("CLI dry-run has safe report and no activation side effects", () => {
    const ok = spawnSync(
      process.execPath,
      ["--import", "tsx", resolve("scripts/validate-external-package.ts"), directory, "--dry-run"],
      { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, TSX_DISABLE_CACHE: "1" } },
    );
    assert.equal(ok.status, 0, ok.stderr);
    const report = JSON.parse(ok.stdout);
    assert.equal(report.activation, "not_performed");
    assert(!ok.stdout.includes("שלום::A12::שלום"));
    const incompatible = join(root, "incompatible-package");
    execFileSync(process.execPath, [producer, artifacts, incompatible, "--unsupported"], {
      cwd: root,
    });
    const bad = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve("scripts/validate-external-package.ts"),
        incompatible,
        "--dry-run",
      ],
      { encoding: "utf8", env: { ...process.env, TSX_DISABLE_CACHE: "1" } },
    );
    assert.equal(bad.status, 1);
    assert(
      (JSON.parse(bad.stdout) as PackageValidationReport).diagnostics.some(
        (d) => d.code === "CAPABILITY_VERSION_INCOMPATIBLE",
      ),
    );
  });
  await check(
    "path properties reject traversal/absolute/encoded paths while allowing portable names",
    () => {
      let seed = 0x617;
      const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
      for (let i = 0; i < 500; i++) {
        const name = `folder-${random()}/file-${random()}.json`;
        assert(packagePathSchema.safeParse(name).success);
        properties++;
        for (const prefix of ["../", "/", "C:/", "https://host/", "a\\", "%2e%2e/"]) {
          assert(!packagePathSchema.safeParse(prefix + name).success);
          properties++;
        }
      }
    },
  );
  await check(
    "valid and rejected preparation leave application catalog and compiled artifacts unchanged",
    () => {
      assert.deepEqual(hashes(), original);
      assert.deepEqual(
        allCourseBundles().map((b) => b.course.id),
        catalogIds,
      );
      assert.equal(catalogIds.length, 3);
    },
  );
  console.log(
    JSON.stringify({
      externalPackages: "passed",
      groups: checks,
      pathAssertions: properties,
      seed: "0x617",
      externalProducer: true,
      privateProducerImports: 0,
      publicationOperations: 0,
      databaseOperations: 0,
      paidCalls: 0,
    }),
  );
}
void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
    const allowed = resolve(tmpdir()) + sep;
    if (!resolve(root).startsWith(allowed))
      throw Error("Cleanup escaped the intended temporary directory");
    rmSync(root, { recursive: true, force: true });
  });
