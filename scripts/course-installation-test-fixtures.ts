import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export function candidateRoot() {
  const input = process.env.I7_CANDIDATE_ROOT ?? process.cwd();
  assert(isAbsolute(input), "I7_CANDIDATE_ROOT must be an absolute local directory");
  assert(!/^[\\/]{2}/.test(input), "UNC/network candidate roots are forbidden");
  const url = pathToFileURL(input);
  assert.equal(url.hostname, "", "The candidate must use a local file URL");
  const root = realpathSync(input);
  assert(!/^[\\/]{2}/.test(root), "Candidate symlinks must not resolve to UNC");
  return root;
}
export async function importCandidate<T>(path: string): Promise<T> {
  const root = candidateRoot();
  assert(!isAbsolute(path) && !path.split(/[\\/]/).includes(".."));
  const target = realpathSync(resolve(root, path));
  const delta = relative(root, target);
  assert(delta && delta !== ".." && !delta.startsWith(".." + sep) && !isAbsolute(delta));
  return import(pathToFileURL(target).href) as Promise<T>;
}
export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export function cloneFiles(files: ReadonlyMap<string, Uint8Array>) {
  return new Map([...files].map(([path, bytes]) => [path, bytes.slice()]));
}
type MutableJson = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- Deliberately mutable untrusted fixture documents.
export function jsonFile(files: ReadonlyMap<string, Uint8Array>, path: string): MutableJson {
  return JSON.parse(Buffer.from(files.get(path)!).toString("utf8"));
}
export function editPackageJson(
  files: Map<string, Uint8Array>,
  path: string,
  edit: (value: MutableJson) => void,
) {
  const value = jsonFile(files, path);
  edit(value);
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  files.set(path, bytes);
  if (path !== "manifest.json") rehashPackageFile(files, path);
}
export function rehashPackageFile(files: Map<string, Uint8Array>, path: string) {
  const manifest = jsonFile(files, "manifest.json");
  const bytes = files.get(path)!;
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const object = value as MutableJson;
    if (object.path === path)
      Object.assign(object, { bytes: bytes.byteLength, sha256: digest(bytes) });
    for (const child of Object.values(object)) walk(child);
  };
  walk(manifest);
  files.set("manifest.json", Buffer.from(JSON.stringify(manifest) + "\n"));
}
export function externalVersionFixtures() {
  const root = mkdtempSync(join(tmpdir(), "destrava-i7-qa-"));
  const publicArtifacts = join(root, "public-contracts");
  const producer = join(root, "producer.mjs");
  const output = join(root, "output");
  const candidate = candidateRoot();
  cpSync(join(candidate, "contracts/package-v1"), publicArtifacts, { recursive: true });
  copyFileSync(join(candidate, "scripts/produce-external-course.mjs"), producer);
  const source = readFileSync(producer, "utf8");
  assert(!/from\s+["'](?!node:)|import\s*\(|require\s*\(/.test(source));
  const receipt = JSON.parse(
    execFileSync(process.execPath, [producer, publicArtifacts, output], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  assert.equal(receipt.privateImports, 0);
  const files = new Map<string, Uint8Array>();
  const inventory = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      assert(!entry.isSymbolicLink());
      if (entry.isDirectory()) inventory(path);
      else
        files.set(relative(output, path).split(sep).join("/"), new Uint8Array(readFileSync(path)));
    }
  };
  inventory(output);
  const courseId = "qa.i7." + randomUUID();
  const answers = ["qa-v1-alpha::qa-v1-beta::qa-v1-alpha", "qa-v2-gamma::qa-v2-delta::qa-v2-gamma"];
  const rubricCanaries = [
    "QA_PRIVATE_CRITERION_V1_" + randomUUID(),
    "QA_PRIVATE_CRITERION_V2_" + randomUUID(),
  ];
  const makeVersion = (index: number) => {
    const version = cloneFiles(files);
    const words =
      index === 0
        ? ["qa-v1-alpha", "qa-v1-beta", "qa-v1-alpha"]
        : ["qa-v2-gamma", "qa-v2-delta", "qa-v2-gamma"];
    editPackageJson(version, "documents/course.json", (course) => {
      course.id = courseId;
      course.slug = courseId.replaceAll(".", "-");
      course.contentVersion = index === 0 ? "1.0.0" : "2.0.0";
    });
    editPackageJson(version, "curriculum/unit-0.json", (unit) => {
      const activities = unit.lessons[0].activities;
      activities[0].payload.words = words;
      activities[0].payload.answer = answers[index];
      activities[0].payload.explanation = rubricCanaries[index];
      activities[1].payload.explanation = rubricCanaries[index];
      unit.learningPolicy.completion.requirements[0].minimumCount = 1;
      unit.learningPolicy.mastery.requirements[0].minimumScore = index === 0 ? 100 : 75;
    });
    editPackageJson(version, "sections/assessments.json", (definitions) => {
      definitions[0].passingPolicy.overall = index === 0 ? 1 : 0.75;
    });
    const media = version.get("resources/phrase.wav")!;
    media[44] = index + 1;
    rehashPackageFile(version, "resources/phrase.wav");
    editPackageJson(version, "manifest.json", (manifest) => {
      manifest.id = courseId;
      manifest.contentVersion = index === 0 ? "1.0.0" : "2.0.0";
    });
    return version;
  };
  return {
    root,
    courseId,
    v1: makeVersion(0),
    v2: makeVersion(1),
    answers,
    rubricCanaries,
    activityId: "opaque-ordering",
    assessmentId: "opaque-final",
    unitId: "opaque-unit",
    mediaPath: "resources/phrase.wav",
    cleanup() {
      const checked = realpathSync(root);
      assert(
        checked.startsWith(realpathSync(tmpdir()) + sep) && checked !== realpathSync(tmpdir()),
      );
      rmSync(checked, { recursive: true });
    },
  };
}
export function candidateHashes(paths: string[]) {
  const root = candidateRoot();
  return paths
    .filter((path) => existsSync(join(root, path)))
    .map((path) => ({
      path,
      sha256: digest(new Uint8Array(readFileSync(join(root, path)))),
    }));
}
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
