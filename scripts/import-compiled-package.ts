import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readExternalPackageDirectory } from "../src/repositories/external-package-directory";
import { validateExternalPackageFiles } from "../src/engine/import/validate-package";
import { coursePackageSchema, languagePackageSchema } from "../src/content/contracts";

const sha = (bytes: Uint8Array | string) => crypto.createHash("sha256").update(bytes).digest("hex");
const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const safeId = /^[a-z0-9][a-z0-9-]{1,100}$/;

function within(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." &&
    !relative.startsWith(".." + path.sep));
}

/** Inspect every existing component, including dangling links and the final file. */
export function assertCompiledDestination(root: string, target: string, mustBeNew = false) {
  if (!within(root, target) || root === target) throw new Error("Destination outside checkout");
  const parts = path.relative(root, target).split(path.sep);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isSymbolicLink()) throw new Error("Destination links forbidden");
    if (!within(root, fs.realpathSync(current))) throw new Error("Resolved destination outside checkout");
    const leaf = index === parts.length - 1;
    if (!leaf && !stat.isDirectory()) throw new Error("Destination parent is not a directory");
    if (leaf && (mustBeNew || !stat.isFile() || stat.nlink !== 1))
      throw new Error("Destination must be a regular single-link file or new");
  }
}

/** Consumer-only conversion. The producer remains independent of this layout. */
export async function prepareCompiledImport(directory: string) {
  const snapshot = await readExternalPackageDirectory(directory);
  const validated = validateExternalPackageFiles(snapshot.files, { diagnostics: snapshot.diagnostics });
  if (!validated.prepared || !validated.report.technicallyValid || !validated.report.compatible)
    throw new Error("Package rejected: " + JSON.stringify(validated.report.diagnostics));
  const { manifest, bundle, assets } = validated.prepared;
  if (!safeId.test(manifest.id) || !safeId.test(bundle.language.id))
    throw new Error("Compiled folder IDs must be portable lowercase identifiers");
  const manifestBytes = snapshot.files.get("manifest.json");
  if (!manifestBytes) throw new Error("Missing manifest snapshot");
  const digest = sha(manifestBytes);
  const prefix = "/media/courses/" + manifest.id + "/" + manifest.contentVersion + "/" + digest;
  const course = structuredClone(bundle.coursePackage);
  const language = structuredClone(bundle.language);
  const resolveAsset = (source: string) => {
    if (!assets.has(source)) throw new Error("Undeclared asset reference");
    return prefix + "/" + source;
  };
  for (const media of course.media) media.src = resolveAsset(media.src);
  for (const unit of course.units)
    for (const lesson of unit.lessons)
      for (const activity of [...lesson.activities, ...(lesson.deferredRecovery?.rules.map(rule => rule.activity) ?? [])]) {
        const media = activity.payload.media;
        if (media && typeof media === "object" && "kind" in media && media.kind === "audio" &&
            "url" in media && typeof media.url === "string") media.url = resolveAsset(media.url);
      }
  const files = new Map<string, Buffer>();
  const targets = new Set<string>();
  const courseRoot = "content/courses/" + course.id;
  const languageRoot = "content/languages/" + language.id;
  function addFile(target: string, bytes: Buffer) {
    const normalized = path.posix.normalize(target);
    const canonical = normalized.normalize("NFC").toLowerCase();
    if (target !== normalized || ![courseRoot + "/", languageRoot + "/", "public" + prefix + "/"]
      .some(root => target.startsWith(root)) || targets.has(canonical))
      throw new Error("Duplicate or invalid compiled destination");
    targets.add(canonical);
    files.set(target, bytes);
  }
  for (const [id, reference] of Object.entries(manifest.documents.modules ?? {})) {
    const bytes = snapshot.files.get(reference.path);
    if (!bytes) throw new Error("Missing validated module");
    if (!/^[A-Za-z][A-Za-z0-9-]{0,79}$/.test(id)) throw new Error("Unsafe module identifier");
    const destination = "modules/" + id + ".json";
    language.modules[id].source = destination;
    addFile(languageRoot + "/" + destination, Buffer.from(bytes));
  }
  course.isDefault = false;
  coursePackageSchema.parse(course);
  languagePackageSchema.parse(language);
  const { units, concepts, lexicon, assessments, missions, roleplays, media, interactiveLessons, ...metadata } = course;
  addFile(languageRoot + "/manifest.json", json(language));
  addFile(courseRoot + "/course.json", json(metadata));
  for (const [name, value] of Object.entries({ concepts, lexicon, assessments, missions, roleplays, media }))
    addFile(courseRoot + "/" + name + ".json", json(value));
  // Public IDs remain opaque content. Deterministic filenames never contain them.
  units.forEach((unit, index) => addFile(courseRoot + "/units/" + String(index + 1).padStart(3, "0") + ".json", json(unit)));
  interactiveLessons.forEach((definition, index) =>
    addFile(courseRoot + "/interactive-lessons/" + String(index + 1).padStart(3, "0") + ".json", json(definition)));
  for (const [name, bytes] of assets) addFile("public" + prefix + "/" + name, Buffer.from(bytes));
  return {
    files, report: validated.report,
    mapping: {
      format: "destrava.compiled-import/1.0",
      courseId: course.id, contentVersion: course.contentVersion, languageId: language.id,
      sourceManifestSha256: digest, defaultChanged: false,
      assets: [...assets].map(([source, bytes]) => ({ source, destination: prefix + "/" + source, sha256: sha(bytes) })),
      files: [...files].map(([target, bytes]) => ({ path: target, bytes: bytes.length, sha256: sha(bytes) })),
    },
  };
}

async function main() {
  const [directory, mode, receipt] = process.argv.slice(2);
  if (!directory || !["--dry-run", "--apply"].includes(mode) || !receipt ||
      process.argv.length !== 5) throw new Error("Usage: import-compiled-package.ts <package> --dry-run|--apply <new-receipt.json>");
  const root = fs.realpathSync(".");
  const receiptPath = path.resolve(receipt);
  if (!receiptPath.startsWith(path.join(root, ".tmp") + path.sep))
    throw new Error("Receipt must be new and within checkout .tmp");
  assertCompiledDestination(root, receiptPath, true);
  const plan = await prepareCompiledImport(directory);
  for (const [relative, bytes] of plan.files) {
    const absolute = path.resolve(relative);
    assertCompiledDestination(root, absolute);
    const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (stat && !fs.readFileSync(absolute).equals(bytes))
      throw new Error("Existing different destination: " + relative);
  }
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  // Intent is persisted before writes; interruption requires explicit reconciliation.
  const receiptHandle = fs.openSync(receiptPath, "wx");
  try {
    const saveReceipt = (status: string) => {
      const bytes = json({ ...plan.mapping, mode, status });
      fs.writeSync(receiptHandle, bytes, 0, bytes.length, 0);
      fs.ftruncateSync(receiptHandle, bytes.length);
      fs.fsyncSync(receiptHandle);
    };
    saveReceipt(mode === "--dry-run" ? "planned" : "attempting");
    if (mode === "--apply") {
      for (const [relative, bytes] of plan.files) {
        const absolute = path.resolve(relative);
        assertCompiledDestination(root, absolute);
        if (fs.lstatSync(absolute, { throwIfNoEntry: false })) {
          if (!fs.readFileSync(absolute).equals(bytes)) throw new Error("Destination changed");
          continue;
        }
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, bytes, { flag: "wx" });
      }
      saveReceipt("written-not-compiled");
    }
  } finally { fs.closeSync(receiptHandle); }
  console.log(JSON.stringify({ courseId: plan.mapping.courseId, contentVersion: plan.mapping.contentVersion,
    files: plan.files.size, mode, sourceManifestSha256: plan.mapping.sourceManifestSha256 }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve("scripts/import-compiled-package.ts"))
  void main().catch(error => { console.error(error instanceof Error ? error.message : "Compiled import failed"); process.exitCode = 1; });
