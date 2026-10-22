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
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  InstalledStudyCatalog,
  InstalledProgressWrite,
  RuntimeSelectionCommand,
  RuntimeSelectionEnvelope,
  SelectionReceipt,
  StoredInstalledProgress,
} from "../src/domain/installed-study/contracts";
import type {
  ActiveSelection,
  InstalledContentReference,
  ResolvedInstallation,
  ResolvedSession,
  VersionEvidence,
  VersionSession,
} from "../src/domain/course-installations/contracts";
import type { StudyState } from "../src/domain/study/study-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Deliberately mutable untrusted fixture JSON.
type FixtureJson = Record<string, any>;
export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const copy = <T>(value: T): T => structuredClone(value);
export const studentA = "00000000-0000-4000-8000-00000000000a";
export const studentB = "00000000-0000-4000-8000-00000000000b";
export function candidateRoot() {
  const input = process.env.I8_CANDIDATE_ROOT ?? process.cwd();
  assert(
    isAbsolute(input) && !/^[\\/]{2}/.test(input),
    "Candidate root must be absolute and local",
  );
  assert.equal(pathToFileURL(input).hostname, "");
  const root = realpathSync(input);
  assert(!/^[\\/]{2}/.test(root), "Candidate cannot resolve to UNC");
  return root;
}
export async function importCandidate<T>(path: string): Promise<T> {
  assert(!isAbsolute(path) && !path.split(/[\\/]/).includes(".."));
  const root = candidateRoot(),
    target = realpathSync(resolve(root, path));
  const delta = relative(root, target);
  assert(delta && delta !== ".." && !delta.startsWith(".." + sep) && !isAbsolute(delta));
  return import(pathToFileURL(target).href) as Promise<T>;
}
export function candidateHashes(paths: string[]) {
  const root = candidateRoot();
  return paths.map((path) => {
    assert(existsSync(join(root, path)), `Candidate file is required: ${path}`);
    return { path, sha256: digest(new Uint8Array(readFileSync(join(root, path)))) };
  });
}
export function inventory(directory: string) {
  const files = new Map<string, Uint8Array>();
  const visit = (parent: string) => {
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink());
      const path = join(parent, entry.name);
      if (entry.isDirectory()) visit(path);
      else {
        assert(entry.isFile());
        files.set(
          relative(directory, path).split(sep).join("/"),
          new Uint8Array(readFileSync(path)),
        );
      }
    }
  };
  visit(directory);
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)));
}
export function jsonFile(files: ReadonlyMap<string, Uint8Array>, path: string): FixtureJson {
  assert(files.has(path));
  return JSON.parse(Buffer.from(files.get(path)!).toString("utf8"));
}
export function editPackageJson(
  files: Map<string, Uint8Array>,
  path: string,
  edit: (value: FixtureJson) => void,
) {
  const value = jsonFile(files, path);
  edit(value);
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  files.set(path, bytes);
  if (path === "manifest.json") return;
  const manifest = jsonFile(files, "manifest.json");
  const visit = (child: unknown) => {
    if (!child || typeof child !== "object") return;
    const object = child as Record<string, unknown>;
    if (object.path === path)
      Object.assign(object, { bytes: bytes.byteLength, sha256: digest(bytes) });
    Object.values(object).forEach(visit);
  };
  visit(manifest);
  files.set("manifest.json", Buffer.from(JSON.stringify(manifest) + "\n"));
}
export const cloneFiles = (files: ReadonlyMap<string, Uint8Array>) =>
  new Map([...files].map(([path, bytes]) => [path, bytes.slice()]));
export function independentLearningFixtures() {
  const root = mkdtempSync(join(tmpdir(), "destrava-i8-independent-"));
  const candidate = candidateRoot();
  assert(!root.startsWith(candidate + sep), "Producer must execute outside the candidate checkout");
  const contracts = join(root, "public-contracts"),
    producer = join(root, "producer.mjs");
  cpSync(join(candidate, "contracts/package-v1"), contracts, { recursive: true });
  copyFileSync(
    fileURLToPath(new URL("./produce-independent-learning-course.mjs", import.meta.url)),
    producer,
  );
  const courseId = "qa.i8." + randomUUID();
  const minimalEnvironment: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    SystemRoot: process.env.SystemRoot,
    TEMP: root,
    TMP: root,
    LANG: "C",
    TZ: "UTC",
  };
  const produce = (
    name: string,
    version: string,
    extra: string[] = [],
    producedCourseId = courseId,
  ) => {
    const output = join(root, name);
    const receipt = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--permission",
          "--allow-fs-read=" + root,
          "--allow-fs-write=" + root,
          producer,
          contracts,
          output,
          "--course-id=" + producedCourseId,
          "--version=" + version,
          ...extra,
        ],
        { cwd: root, env: minimalEnvironment, encoding: "utf8", windowsHide: true },
      ),
    );
    assert.equal(receipt.produced, true);
    assert.equal(receipt.material, "test");
    assert.equal(receipt.courseId, producedCourseId);
    assert.equal(receipt.contentVersion, version);
    return { directory: output, receipt, files: inventory(output) };
  };
  const first = produce("v1", "1.0.0"),
    second = produce("v2", "2.0.0");
  const answers = ["I8 alpha::I8 beta::I8 gamma", "I8 gamma::I8 beta::I8 alpha"];
  return {
    root,
    contracts,
    producer,
    courseId,
    produce,
    v1: first.files,
    v2: second.files,
    directories: [first.directory, second.directory],
    answers,
    rubricCanaries: ["I8_PRIVATE_CRITERION_V1", "I8_PRIVATE_CRITERION_V2"],
    unitId: "opaque-unit",
    lessonId: "opaque-lesson",
    activityId: "opaque-ordering",
    contentActivityId: "opaque-content",
    writingActivityId: "opaque-writing",
    assessmentId: "opaque-final",
    producerSource: readFileSync(producer, "utf8"),
    assertNoPrivate(value: unknown) {
      const serialized = typeof value === "string" ? value : JSON.stringify(value);
      for (const marker of [...answers, "I8_PRIVATE_CRITERION_V1", "I8_PRIVATE_CRITERION_V2"])
        assert(
          !serialized.includes(marker),
          "Unattempted private answer/correction criterion leaked",
        );
      assert(
        !/"(?:answerOrder|acceptedAnswers|canonicalAnswer)"\s*:/.test(serialized),
        "Private correction field leaked",
      );
    },
    cleanup() {
      const checked = realpathSync(root),
        temp = realpathSync(tmpdir());
      assert(
        checked.startsWith(temp + sep) && checked !== temp && !checked.startsWith(candidate + sep),
      );
      rmSync(checked, { recursive: true });
    },
  };
}

/** Ports model only transactional storage; no grading/resolution algorithm is duplicated here. */
export class MemoryInstalledStudyCatalog implements InstalledStudyCatalog {
  selections = new Map<string, RuntimeSelectionEnvelope>();
  receipts = new Map<string, SelectionReceipt>();
  active = new Map<string, ActiveSelection>();
  sessions = new Map<string, VersionSession>();
  versions = new Map<string, ResolvedInstallation>();
  progress = new Map<string, StoredInstalledProgress>();
  evidence: VersionEvidence[] = [];
  fail = new Set<string>();
  calls: string[] = [];
  beforeSelect?: () => Promise<void>;
  error!: (
    code:
      | "SELECTION_CONFLICT"
      | "PROGRESS_CONFLICT"
      | "OPERATION_CONFLICT"
      | "NO_ACTIVE_VERSION"
      | "NOT_AUTHORIZED",
  ) => Error;
  private effect(name: string) {
    this.calls.push(name);
    if (this.fail.delete(name)) throw Error("PRIVATE_QA_ADAPTER_OUTAGE_" + name);
  }
  key(user: string, reference: InstalledContentReference) {
    return user + "/" + reference.installationId + "/" + reference.artifactHash;
  }
  async getSelection(userId: string): Promise<RuntimeSelectionEnvelope> {
    this.effect("getSelection");
    return copy(
      this.selections.get(userId) ?? {
        schemaVersion: 1,
        userId,
        revision: 0,
        selection: null,
        updatedAt: null,
      },
    );
  }
  async getSelectionReceipt(userId: string, operationId: string) {
    this.effect("getSelectionReceipt");
    return copy(this.receipts.get(userId + "/" + operationId) ?? null);
  }
  async select(
    userId: string,
    command: RuntimeSelectionCommand,
    active?: { selection: ActiveSelection; reference: InstalledContentReference },
  ) {
    this.effect("select");
    await this.beforeSelect?.();
    const receiptKey = userId + "/" + command.operationId,
      prior = this.receipts.get(receiptKey);
    if (prior) {
      if (JSON.stringify(prior.command) !== JSON.stringify(command))
        throw this.error("OPERATION_CONFLICT");
      return copy(prior.result);
    }
    const previous = this.selections.get(userId);
    if ((previous?.revision ?? 0) !== command.expectedRevision)
      throw this.error("SELECTION_CONFLICT");
    let selection: RuntimeSelectionEnvelope["selection"] = {
      source: "compiled",
      courseId: command.courseId,
    };
    if (command.source === "installed") {
      const current = this.active.get(command.courseId);
      if (!current?.installationId || !active) throw this.error("NO_ACTIVE_VERSION");
      if (JSON.stringify(current) !== JSON.stringify(active.selection))
        throw this.error("SELECTION_CONFLICT");
      assert.equal(current.installationId, active.reference.installationId);
      const session: VersionSession = {
        id: randomUUID(),
        userId,
        reference: copy(active.reference),
        activeRevision: current.revision,
        createdAt: new Date().toISOString(),
      };
      this.sessions.set(session.id, session);
      selection = { source: "installed", courseId: command.courseId, versionSessionId: session.id };
    }
    const result: RuntimeSelectionEnvelope = {
      schemaVersion: 1,
      userId,
      revision: (previous?.revision ?? 0) + 1,
      selection,
      updatedAt: new Date().toISOString(),
    };
    this.selections.set(userId, copy(result));
    this.receipts.set(receiptKey, { command: copy(command), result: copy(result) });
    return copy(result);
  }
  async listActive() {
    this.effect("listActive");
    return copy([...this.active.values()]);
  }
  async readProgress(userId: string, reference: InstalledContentReference) {
    this.effect("readProgress");
    return copy(this.progress.get(this.key(userId, reference)) ?? null);
  }
  async writeProgress(
    userId: string,
    session: VersionSession,
    command: InstalledProgressWrite,
    canonicalState: StudyState,
  ) {
    this.effect("writeProgress");
    if (session.userId !== userId || this.sessions.get(session.id)?.userId !== userId)
      throw this.error("NOT_AUTHORIZED");
    const key = this.key(userId, session.reference),
      previous = this.progress.get(key);
    if ((previous?.revision ?? 0) !== command.expectedRevision)
      throw this.error("PROGRESS_CONFLICT");
    const next = {
      userId,
      reference: copy(session.reference),
      revision: (previous?.revision ?? 0) + 1,
      state: copy(canonicalState),
      updatedAt: new Date().toISOString(),
    };
    this.progress.set(key, next);
    return copy(next);
  }
  async listVersionEvidence(userId: string, reference: InstalledContentReference) {
    this.effect("listVersionEvidence");
    return copy(
      this.evidence.filter(
        (entry) =>
          entry.userId === userId &&
          this.key(userId, entry.reference) === this.key(userId, reference),
      ),
    );
  }
  async resolveSession(userId: string, sessionId: string): Promise<ResolvedSession> {
    this.effect("resolveSession");
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) throw this.error("NOT_AUTHORIZED");
    return {
      session: copy(session),
      content: await this.resolveInstallation(session.reference.installationId),
    };
  }
  async resolveInstallation(id: string): Promise<ResolvedInstallation> {
    this.effect("resolveInstallation");
    const version = this.versions.get(id);
    if (!version) throw this.error("NO_ACTIVE_VERSION");
    return version;
  }
}
