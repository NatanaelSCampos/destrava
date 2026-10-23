import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type {
  ActivationCommand,
  ActivationReceipt,
  ActiveSelection,
  ArtifactFile,
  ArtifactStore,
  AuthorizationGrant,
  AuthorizationGuard,
  EvidenceInput,
  Installation,
  InstallationAction,
  InstallationCatalog,
  InstallationErrorCode,
  InstallationReservation,
  InstallationStage,
  InstallationTransition,
  InstalledContentReference,
  VersionEvidence,
  VersionSession,
} from "../src/domain/course-installations/contracts";
import {
  candidateHashes,
  candidateRoot,
  cloneFiles,
  deferred,
  digest,
  editPackageJson,
  externalVersionFixtures,
  importCandidate,
} from "./course-installation-test-fixtures";

type DomainModule = typeof import("../src/domain/course-installations/contracts");
type ServiceModule = typeof import("../src/domain/course-installations/service");
let DomainError: DomainModule["InstallationError"];
const copy = <T,>(value: T): T => structuredClone(value);
const studentA = "00000000-0000-4000-8000-00000000000a";
const studentB = "00000000-0000-4000-8000-00000000000b";
function observeRejection<T>(promise: Promise<T>): Promise<T> {
  void promise.catch(() => undefined); // Observe immediately; the original promise is still awaited and asserted.
  return promise;
}
const playbackEnvironment = {
  dependencies: { "client.media_playback": { state: "available" as const } },
};
const error = (code: InstallationErrorCode, stage: InstallationStage) =>
  new DomainError(code, stage);
function sameJson(a: unknown, b: unknown): boolean {
  const ordered = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(ordered)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, child]) => [key, ordered(child)]),
          )
        : value;
  return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
}
/** Test-only identity brand; never exported by production, and no env flag grants access. */
class TestAuthority implements AuthorizationGuard {
  readonly authority = Object.freeze({ brand: Symbol("QA local authority") });
  readonly grant: AuthorizationGrant = {
    actorId: "qa-local-actor",
    localToken: "qa-token-never-production",
  };
  before?: () => Promise<void>;
  denied = false;
  async assert(
    authority: unknown,
    _action: InstallationAction,
    _reference?: InstalledContentReference,
  ) {
    void _action;
    void _reference;
    await this.before?.();
    if (this.denied || authority !== this.authority) throw error("NOT_AUTHORIZED", "authorization");
    return copy(this.grant);
  }
}
class FakeStore implements ArtifactStore {
  readonly objects = new Map<string, Uint8Array>();
  readonly writes: Array<{ installationId: string; path: string }> = [];
  putCount = 0;
  failPutAt = 0;
  failRead = false;
  beforePut?: () => Promise<void>;
  beforeRead?: () => Promise<void>;
  key(reference: InstalledContentReference, path: string) {
    return reference.installationId + "/" + path;
  }
  async putFile(reference: InstalledContentReference, file: ArtifactFile, bytes: Uint8Array) {
    await this.beforePut?.();
    this.putCount++;
    if (this.putCount === this.failPutAt) throw new Error("QA injected storage outage");
    const key = this.key(reference, file.path);
    const existing = this.objects.get(key);
    if (existing && !Buffer.from(existing).equals(Buffer.from(bytes)))
      throw error("ARTIFACT_INTEGRITY", "storage");
    assert.equal(file.bytes, bytes.byteLength);
    assert.equal(file.sha256, digest(bytes));
    if (!existing) {
      this.objects.set(key, bytes.slice());
      this.writes.push({ installationId: reference.installationId, path: file.path });
    }
  }
  async readFile(reference: InstalledContentReference, path: string) {
    await this.beforeRead?.();
    if (this.failRead) throw new Error("QA injected storage read outage");
    const bytes = this.objects.get(this.key(reference, path));
    if (!bytes) throw new Error("QA missing object");
    return bytes.slice();
  }
}
type CatalogMethod =
  | "reserve"
  | "confirm"
  | "prepare"
  | "approve"
  | "get"
  | "list"
  | "getActive"
  | "activate"
  | "openSession"
  | "getSession"
  | "appendEvidence"
  | "listEvidence";
class FakeCatalog implements InstallationCatalog {
  readonly rows = new Map<string, Installation>();
  readonly selections = new Map<string, ActiveSelection>();
  readonly history: InstallationTransition[] = [];
  readonly sessions = new Map<string, VersionSession>();
  readonly evidences = new Map<string, VersionEvidence>();
  readonly operations = new Map<
    string,
    { command: ActivationCommand; action: "activate" | "rollback"; receipt: ActivationReceipt }
  >();
  readonly calls: Partial<Record<CatalogMethod, number>> = {};
  readonly failNext = new Set<CatalogMethod>();
  readonly hooks: Partial<Record<CatalogMethod, () => Promise<void>>> = {};
  confirmTimeoutAfterCommit = false;
  async before(method: CatalogMethod) {
    this.calls[method] = (this.calls[method] ?? 0) + 1;
    await this.hooks[method]?.();
    if (this.failNext.delete(method)) throw new Error("QA injected catalog outage at " + method);
  }
  transition(
    row: Installation,
    action: InstallationTransition["action"],
    actorId: string,
    receipt?: ActivationReceipt,
  ) {
    this.history.push({
      id: randomUUID(),
      courseId: row.reference.courseId,
      installationId: row.reference.installationId,
      action,
      actorId,
      operationId: receipt?.operationId ?? null,
      revision: receipt?.selection.revision ?? null,
      previousInstallationId: receipt?.previousInstallationId ?? null,
      nextInstallationId: receipt?.selection.installationId ?? null,
      createdAt: new Date().toISOString(),
    });
  }
  require(id: string) {
    const row = this.rows.get(id);
    if (!row) throw error("INSTALLATION_NOT_FOUND", "resolution");
    return row;
  }
  async reserve(input: InstallationReservation, actorId: string) {
    await this.before("reserve");
    // No await inside the comparison+write: models the catalog's atomic unique constraint.
    const existing = [...this.rows.values()].find(
      (row) =>
        row.reference.courseId === input.identity.courseId &&
        row.reference.contentVersion === input.identity.contentVersion,
    );
    if (existing) {
      if (existing.reference.artifactHash !== input.identity.artifactHash)
        throw error("VERSION_CONFLICT", "reservation");
      return copy(existing);
    }
    const row: Installation = {
      reference: { ...copy(input.identity), installationId: randomUUID() },
      inventory: copy(input.inventory),
      provenance: copy(input.provenance),
      capabilityRequirements: copy(input.capabilityRequirements),
      validation: copy(input.validation),
      state: "preparing",
      preparation: "not_prepared",
      approval: "not_reviewed",
      createdAt: new Date().toISOString(),
      installedAt: null,
      preparedAt: null,
      approvedAt: null,
    };
    this.rows.set(row.reference.installationId, row);
    this.transition(row, "reserve", actorId);
    return copy(row);
  }
  async confirm(id: string, hash: string, actorId: string) {
    await this.before("confirm");
    const row = this.require(id);
    if (row.reference.artifactHash !== hash) throw error("ARTIFACT_INTEGRITY", "confirmation");
    if (row.state !== "installed") {
      row.state = "installed";
      row.installedAt = new Date().toISOString();
      this.transition(row, "confirm", actorId);
    }
    if (this.confirmTimeoutAfterCommit) {
      this.confirmTimeoutAfterCommit = false;
      throw new Error("QA response lost after confirmation");
    }
    return copy(row);
  }
  async prepare(id: string, hash: string, actorId: string) {
    await this.before("prepare");
    const row = this.require(id);
    if (row.reference.artifactHash !== hash) throw error("ARTIFACT_INTEGRITY", "preparation");
    if (row.state !== "installed") throw error("INSTALLATION_INCOMPLETE", "preparation");
    if (row.preparation !== "prepared") {
      row.preparation = "prepared";
      row.preparedAt = new Date().toISOString();
      this.transition(row, "prepare", actorId);
    }
    return copy(row);
  }
  async approve(id: string, hash: string, grant: AuthorizationGrant) {
    await this.before("approve");
    const row = this.require(id);
    if (row.reference.artifactHash !== hash) throw error("ARTIFACT_INTEGRITY", "approval");
    if (row.preparation !== "prepared") throw error("INSTALLATION_NOT_PREPARED", "approval");
    if (row.approval !== "local_test_approved") {
      row.approval = "local_test_approved";
      row.approvedAt = new Date().toISOString();
      this.transition(row, "approve", grant.actorId);
    }
    return copy(row);
  }
  async get(id: string) {
    await this.before("get");
    return copy(this.rows.get(id) ?? null);
  }
  async list(courseId: string) {
    await this.before("list");
    return copy([...this.rows.values()].filter((r) => r.reference.courseId === courseId));
  }
  async getActive(courseId: string) {
    await this.before("getActive");
    return copy(this.selections.get(courseId) ?? { courseId, installationId: null, revision: 0 });
  }
  async activate(
    command: ActivationCommand,
    action: "activate" | "rollback",
    reference: InstalledContentReference,
    grant: AuthorizationGrant,
  ) {
    await this.before("activate");
    // Dedup/CAS and pointer+audit mutation are a single synchronous critical section.
    const opKey = command.courseId + "/" + command.operationId;
    const prior = this.operations.get(opKey);
    if (prior) {
      if (!sameJson(prior.command, command) || prior.action !== action)
        throw error("OPERATION_CONFLICT", "activation");
      return copy(prior.receipt);
    }
    const row = this.require(command.installationId);
    if (!sameJson(row.reference, reference) || command.courseId !== reference.courseId)
      throw error("INVALID_INPUT", "activation");
    if (row.state !== "installed") throw error("INSTALLATION_INCOMPLETE", "activation");
    if (row.preparation !== "prepared") throw error("INSTALLATION_NOT_PREPARED", "activation");
    if (row.approval !== "local_test_approved")
      throw error("INSTALLATION_NOT_APPROVED", "activation");
    const active = this.selections.get(command.courseId) ?? {
      courseId: command.courseId,
      installationId: null,
      revision: 0,
    };
    if (active.revision !== command.expectedRevision)
      throw error("REVISION_CONFLICT", "activation");
    const receipt: ActivationReceipt = {
      operationId: command.operationId,
      action,
      actorId: grant.actorId,
      previousInstallationId: active.installationId,
      selection: {
        courseId: command.courseId,
        installationId: command.installationId,
        revision: active.revision + 1,
      },
      reference: copy(reference),
      createdAt: new Date().toISOString(),
    };
    this.selections.set(command.courseId, copy(receipt.selection));
    this.operations.set(opKey, { command: copy(command), action, receipt: copy(receipt) });
    this.transition(row, action, grant.actorId, receipt);
    return copy(receipt);
  }
  async transitions(courseId: string) {
    return copy(this.history.filter((r) => r.courseId === courseId));
  }
  async openSession(userId: string, courseId: string, sessionId: string) {
    await this.before("openSession");
    const previous = this.sessions.get(sessionId);
    if (previous) {
      if (previous.userId !== userId || previous.reference.courseId !== courseId)
        throw error("SESSION_CONFLICT", "session");
      return copy(previous);
    }
    const active = this.selections.get(courseId);
    if (!active?.installationId) throw error("NO_ACTIVE_VERSION", "session");
    const row = this.require(active.installationId);
    const session: VersionSession = {
      id: sessionId,
      userId,
      reference: copy(row.reference),
      activeRevision: active.revision,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, session);
    return copy(session);
  }
  async getSession(userId: string, sessionId: string) {
    await this.before("getSession");
    const row = this.sessions.get(sessionId);
    return copy(row?.userId === userId ? row : null);
  }
  async appendEvidence(userId: string, session: VersionSession, input: EvidenceInput) {
    await this.before("appendEvidence");
    const pinned = this.sessions.get(session.id);
    if (!pinned || pinned.userId !== userId || !sameJson(pinned.reference, session.reference))
      throw error("SESSION_NOT_FOUND", "evidence");
    const key = session.id + "/" + input.id;
    const previous = this.evidences.get(key);
    if (previous) {
      const { userId: _u, sessionId: _s, reference: _r, createdAt: _c, ...before } = previous;
      void _u;
      void _s;
      void _r;
      void _c;
      if (!sameJson(before, input)) throw error("EVIDENCE_CONFLICT", "evidence");
      return copy(previous);
    }
    const row: VersionEvidence = {
      ...copy(input),
      userId,
      sessionId: session.id,
      reference: copy(pinned.reference),
      createdAt: new Date().toISOString(),
    };
    this.evidences.set(key, row);
    return copy(row);
  }
  async listEvidence(userId: string, sessionId: string) {
    await this.before("listEvidence");
    return copy(
      [...this.evidences.values()].filter((r) => r.userId === userId && r.sessionId === sessionId),
    );
  }
}
async function expectCode(run: () => Promise<unknown>, code: InstallationErrorCode) {
  await assert.rejects(run, (caught: unknown) => {
    assert(caught instanceof DomainError, "Failure must be a sanitized domain error");
    assert.equal(caught.code, code);
    assert(!caught.message.includes("QA injected"), "Adapter exception details must not leak");
    return true;
  });
}
async function main() {
  const { projectActionAvailability } = await importCandidate<
    typeof import("../src/engine/capabilities/availability-projection")
  >("src/engine/capabilities/availability-projection.ts");
  ({ InstallationError: DomainError } = await importCandidate<DomainModule>(
    "src/domain/course-installations/contracts.ts",
  ));
  const { CourseInstallationService } = await importCandidate<ServiceModule>(
    "src/domain/course-installations/service.ts",
  );
  const { gradeActivity } = await importCandidate<typeof import("../src/domain/activities/grader")>(
    "src/domain/activities/grader.ts",
  );
  const { evaluateAssessment } = await importCandidate<
    typeof import("../src/domain/assessments/assessment-engine")
  >("src/domain/assessments/assessment-engine.ts");
  const fixture = externalVersionFixtures();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Network forbidden in independent I7 unit tests");
  };
  const records: Array<{ scenario: string; result: "passed" | "failed"; error?: string }> = [];
  const make = () => {
    const catalog = new FakeCatalog(),
      store = new FakeStore(),
      guard = new TestAuthority();
    const service = new CourseInstallationService({
      catalog,
      store,
      authorizer: guard,
      environment: playbackEnvironment,
    });
    return { catalog, store, guard, service, authority: guard.authority };
  };
  type Setup = ReturnType<typeof make>;
  const command = (
    row: Installation,
    revision: number,
    operationId = randomUUID(),
  ): ActivationCommand => ({
    courseId: row.reference.courseId,
    installationId: row.reference.installationId,
    expectedRevision: revision,
    operationId,
  });
  const ready = async (f: Setup, files: ReadonlyMap<string, Uint8Array>) => {
    const installed = await f.service.install(files, f.authority);
    await f.service.prepareForHomologation(installed.reference.installationId, f.authority);
    return f.service.recordLocalApproval(installed.reference.installationId, f.authority);
  };
  const activateV1 = async (f: Setup) => {
    const row = await ready(f, fixture.v1);
    const receipt = await f.service.activate(command(row, 0), f.authority);
    return { row, receipt };
  };
  const check = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
      records.push({ scenario: name, result: "passed" });
      console.log("OK " + name);
    } catch (caught) {
      records.push({
        scenario: name,
        result: "failed",
        error: caught instanceof Error ? caught.message : "Unknown error",
      });
      console.error("FAIL " + name, caught);
      process.exitCode = 1;
    }
  };
  try {
    await check("default authority denies every privileged mutation before effects", async () => {
      const f = make(),
        denied = new CourseInstallationService({ store: f.store, catalog: f.catalog });
      await expectCode(() => denied.install(fixture.v1, {}), "NOT_AUTHORIZED");
      for (const call of [
        () => denied.prepareForHomologation(randomUUID(), {}),
        () => denied.recordLocalApproval(randomUUID(), {}),
        () =>
          denied.activate(
            {
              courseId: fixture.courseId,
              installationId: randomUUID(),
              expectedRevision: 0,
              operationId: randomUUID(),
            },
            {},
          ),
        () =>
          denied.rollback(
            {
              courseId: fixture.courseId,
              installationId: randomUUID(),
              expectedRevision: 0,
              operationId: randomUUID(),
            },
            {},
          ),
      ])
        await expectCode(call, "NOT_AUTHORIZED");
      assert.equal(f.catalog.rows.size, 0);
      assert.equal(f.store.objects.size, 0);
      assert.equal(f.catalog.history.length, 0);
    });
    await check(
      "real CLI issuer rejects production before local profile, Docker or gate effects",
      async () => {
        const issuerPath = join(candidateRoot(), "scripts/course-installation-local-authority.ts");
        const source = readFileSync(issuerPath, "utf8");
        const compiled = ts.transpileModule(source, {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        const effects = { profile: 0, docker: 0, gate: 0, client: 0 };
        const exports: Record<string, unknown> = {};
        const fakeProcess = { env: { NODE_ENV: "production" } };
        const requireMock = (id: string) => {
          if (id === "server-only") return {};
          if (id === "node:crypto") return { randomBytes, createHash };
          if (id === "node:child_process")
            return {
              execFileSync() {
                effects.gate++;
                return "";
              },
            };
          if (id === "@supabase/supabase-js")
            return {
              createClient() {
                effects.client++;
                return {};
              },
            };
          if (id === "./local-environment.mjs")
            return {
              projectId: "espanhol-plataform",
              localEnvironment() {
                effects.profile++;
                return {
                  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
                  SUPABASE_SECRET_KEY: "test-only",
                };
              },
              assertLocalDocker() {
                effects.docker++;
              },
            };
          if (id.endsWith("/course-installations/contracts"))
            return { InstallationError: DomainError };
          throw new Error("Unexpected issuer import " + id);
        };
        runInNewContext(compiled, { exports, require: requireMock, process: fakeProcess, Buffer });
        const issue = exports.createLocalCourseInstallationContext as () => Promise<{
          authority: unknown;
          authorizer: AuthorizationGuard;
        }>;
        await expectCode(issue, "NOT_AUTHORIZED");
        assert.deepEqual(effects, { profile: 0, docker: 0, gate: 0, client: 0 });
        fakeProcess.env.NODE_ENV = "test";
        const context = await issue();
        assert.equal(effects.gate, 1);
        await expectCode(
          () =>
            context.authorizer.assert(JSON.parse(JSON.stringify(context.authority)), "activate"),
          "NOT_AUTHORIZED",
        );
        fakeProcess.env.NODE_ENV = "production";
        await expectCode(
          () => context.authorizer.assert(context.authority, "activate"),
          "NOT_AUTHORIZED",
        );
        assert.equal(
          effects.gate,
          1,
          "A token issued in tests must not reopen the gate in production",
        );
      },
    );
    await check(
      "untrusted editorial approved production metadata never authorizes installation",
      async () => {
        const f = make(),
          files = cloneFiles(fixture.v1);
        editPackageJson(files, "manifest.json", (m) => {
          m.provenance.material = "production";
          m.provenance.review = { status: "approved", reviewedBy: "forged", reference: "forged" };
        });
        await expectCode(() => f.service.install(files, { ...f.guard.grant }), "NOT_AUTHORIZED");
        assert.equal(f.store.putCount, 0);
        assert.equal(f.catalog.rows.size, 0);
      },
    );
    await check(
      "installed HTTP runtime denies production even with local flags and preserves ordinary static course resolution",
      async () => {
        const source = readFileSync(
          join(candidateRoot(), "src/lib/course-installation-runtime.ts"),
          "utf8",
        );
        const compiled = ts.transpileModule(source, {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        const effects = { client: 0, service: 0, catalog: 0, store: 0 };
        const exports: Record<string, unknown> = {};
        const ordinary = { course: { id: "ordinary-static-fixture" } };
        const requireMock = (id: string) => {
          if (id === "server-only") return {};
          if (id === "@supabase/supabase-js")
            return {
              createClient() {
                effects.client++;
                return {};
              },
            };
          if (id === "@/content/course-registry")
            return {
              findCourseBundle() {
                return ordinary;
              },
            };
          if (id === "@/content/public")
            return {
              publicCourse() {
                return {};
              },
            };
          if (id === "@/domain/course-installations/contracts")
            return { InstallationError: DomainError };
          if (id === "@/domain/course-installations/service")
            return {
              CourseInstallationService: class {
                constructor() {
                  effects.service++;
                }
              },
            };
          if (id === "@/repositories/supabase-course-installations")
            return {
              SupabaseCourseInstallationCatalog: class {
                constructor() {
                  effects.catalog++;
                }
              },
              SupabaseCourseArtifactStore: class {
                constructor() {
                  effects.store++;
                }
              },
            };
          throw new Error("Unexpected HTTP runtime import " + id);
        };
        runInNewContext(compiled, {
          exports,
          require: requireMock,
          process: {
            env: {
              NODE_ENV: "production",
              DESTRAVA_LOCAL_ONLY: "1",
              DESTRAVA_LOCAL_PROJECT: "espanhol-plataform",
              NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
              SUPABASE_SECRET_KEY: "synthetic-never-a-key",
            },
          },
          Buffer,
        });
        const runtime = exports.courseInstallationRuntime as () => unknown;
        const resolve = exports.resolveRuntimeCourse as (
          courseId: string,
          userId?: string,
          sessionId?: string,
        ) => Promise<unknown>;
        await expectCode(async () => runtime(), "NOT_AUTHORIZED");
        await expectCode(() => resolve(fixture.courseId, studentA, randomUUID()), "NOT_AUTHORIZED");
        await expectCode(() => resolve(fixture.courseId, studentA, ""), "NOT_AUTHORIZED");
        assert.deepEqual(effects, { client: 0, service: 0, catalog: 0, store: 0 });
        assert.deepEqual(await resolve(ordinary.course.id), ordinary);
      },
    );

    const versionGuardCode = ts.transpileModule(
      readFileSync(join(candidateRoot(), "src/lib/versioned-operation-guard.ts"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    const aiGuardCode = ts.transpileModule(
      readFileSync(join(candidateRoot(), "src/domain/ai/ai-request-guard.ts"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    type BodyCase = { request: Request; verifyOriginal(): Promise<void> };
    const jsonBodyCase = (
      contentType: string | null,
      version: unknown = "00000000-0000-4000-8000-00000000000c",
      options: { query?: string; header?: string; bodyScope?: boolean } = {},
    ): BodyCase => {
      const body: Record<string, unknown> = { marker: "qa-original-body" };
      if (options.bodyScope !== false) body.versionSessionId = version;
      const request = new Request("http://qa.local.test/api/ai/writing" + (options.query ?? ""), {
        method: "POST",
        headers: {
          ...(contentType ? { "Content-Type": contentType } : {}),
          ...(options.header !== undefined ? { "x-destrava-version-session": options.header } : {}),
        },
        body: new TextEncoder().encode(JSON.stringify(body)),
      });
      if (contentType === null) assert.equal(request.headers.has("Content-Type"), false);
      return {
        request,
        async verifyOriginal() {
          assert.equal(request.bodyUsed, false);
          assert.deepEqual(await request.json(), body);
        },
      };
    };
    const formBodyCase = (urlencoded: boolean): BodyCase => {
      const expected = {
        marker: "qa-original-body",
        versionSessionId: "00000000-0000-4000-8000-00000000000c",
      };
      const body = urlencoded ? new URLSearchParams(expected) : new FormData();
      if (body instanceof FormData)
        for (const [name, value] of Object.entries(expected)) body.append(name, value);
      const request = new Request("http://qa.local.test/api/pronunciation", {
        method: "POST",
        body,
      });
      return {
        request,
        async verifyOriginal() {
          assert.equal(request.bodyUsed, false);
          assert.deepEqual(Object.fromEntries((await request.formData()).entries()), expected);
        },
      };
    };
    const admissionCases: Array<{ name: string; parser: "json" | "form"; make(): BodyCase }> = [
      {
        name: "JSON standard Content-Type",
        parser: "json",
        make: () => jsonBodyCase("application/json"),
      },
      {
        name: "JSON text/plain Content-Type",
        parser: "json",
        make: () => jsonBodyCase("text/plain"),
      },
      { name: "JSON without Content-Type", parser: "json", make: () => jsonBodyCase(null) },
      {
        name: "JSON uppercase Content-Type",
        parser: "json",
        make: () => jsonBodyCase("APPLICATION/JSON; CHARSET=UTF-8"),
      },
      {
        name: "JSON null version ID still supplies scope",
        parser: "json",
        make: () => jsonBodyCase("text/plain", null),
      },
      {
        name: "JSON invalid version ID still supplies scope",
        parser: "json",
        make: () => jsonBodyCase(null, "invalid-session-id"),
      },
      { name: "multipart form version scope", parser: "form", make: () => formBodyCase(false) },
      { name: "urlencoded form version scope", parser: "form", make: () => formBodyCase(true) },
      {
        name: "invalid query version ID",
        parser: "json",
        make: () =>
          jsonBodyCase("text/plain", undefined, {
            bodyScope: false,
            query: "?versionSessionId=invalid-session-id",
          }),
      },
      {
        name: "empty query version ID",
        parser: "json",
        make: () => jsonBodyCase(null, undefined, { bodyScope: false, query: "?versionSessionId" }),
      },
      {
        name: "invalid header version ID",
        parser: "json",
        make: () =>
          jsonBodyCase("application/json", undefined, {
            bodyScope: false,
            header: "invalid-session-id",
          }),
      },
      {
        name: "empty header version ID",
        parser: "json",
        make: () => jsonBodyCase(null, undefined, { bodyScope: false, header: "" }),
      },
    ];
    for (const configured of [true, false]) {
      for (const scenario of admissionCases) {
        await check(
          "R4 admission before quota and paid work: " +
            scenario.name +
            (configured ? " authenticated" : " development fallback"),
          async () => {
            const effects = { client: 0, rpc: 0, mockPaid: 0, localQuotaWrites: 0 };
            const versionExports: Record<string, unknown> = {},
              aiExports: Record<string, unknown> = {};
            const globals = { Request, Response, FormData, URL, Headers, TextEncoder, Buffer };
            runInNewContext(versionGuardCode, {
              ...globals,
              exports: versionExports,
              require(id: string) {
                if (id === "server-only") return {};
                throw new Error("Unexpected version guard import " + id);
              },
            });
            class QuotaWindowMap extends Map<string, unknown> {
              override set(key: string, value: unknown) {
                effects.localQuotaWrites++;
                return super.set(key, value);
              }
            }
            runInNewContext(aiGuardCode, {
              ...globals,
              exports: aiExports,
              Map: QuotaWindowMap,
              process: { env: { NODE_ENV: "development" } },
              require(id: string) {
                if (id === "server-only") return {};
                if (id === "next/server")
                  return {
                    NextResponse: {
                      json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
                    },
                  };
                if (id === "@/lib/versioned-operation-guard") return versionExports;
                // A configured synthetic service keeps the positive control admitted;
                // version-scope assertions below remain unchanged, with no real provider.
                if (id === "@/lib/capability-environment")
                  return { serverServiceAvailability: () => ({ "ai.text_service": { state: "unknown" } }) };
                if (id === "@/engine/capabilities/availability-projection")
                  return { projectActionAvailability };
                if (id === "@/lib/supabase/server")
                  return {
                    isSupabaseConfigured: () => configured,
                    getAuthenticatedUser: async () => ({ id: studentA }),
                    createSupabaseServerClient: async () => {
                      effects.client++;
                      return {
                        rpc: async () => {
                          effects.rpc++;
                          return { data: randomUUID(), error: null };
                        },
                      };
                    },
                  };
                throw new Error("Unexpected AI guard import " + id);
              },
            });
            const guard = aiExports.guardAIRequest as (
              request: Request,
              feature: string,
              parser?: "json" | "form",
            ) => Promise<{ error?: Response; reservationId?: string | null }>;
            // A positive control proves authenticated fixtures do not reject everything before scope parsing.
            const control = jsonBodyCase("application/json", undefined, { bodyScope: false });
            const admitted = await guard(control.request, "writing", "json");
            assert.equal(admitted.error, undefined);
            effects.mockPaid++; // Simulate the route's next step; never import or call a real provider.
            assert.equal(effects.rpc, configured ? 1 : 0);
            assert.equal(effects.localQuotaWrites, configured ? 0 : 1);
            await control.verifyOriginal();
            effects.client = 0;
            effects.rpc = 0;
            effects.mockPaid = 0;
            effects.localQuotaWrites = 0;
            const bodyCase = scenario.make();
            const rejected = await guard(bodyCase.request, "writing", scenario.parser);
            if (!rejected.error) effects.mockPaid++;
            assert(
              rejected.error instanceof Response,
              "Scoped request reached ordinary/compiled AI admission",
            );
            assert.equal(rejected.error.status, 422);
            assert.equal((await rejected.error.json()).error, "VERSIONED_OPERATION_UNAVAILABLE");
            assert.deepEqual(effects, { client: 0, rpc: 0, mockPaid: 0, localQuotaWrites: 0 });
            await bodyCase.verifyOriginal();
          },
        );
      }
    }
    await check(
      "R4 form-consuming routes declare the same parser used by their request bodies",
      async () => {
        for (const path of [
          "src/app/api/pronunciation/route.ts",
          "src/app/api/ai/image-description/route.ts",
          "src/app/api/ai/conversation/transcribe/route.ts",
        ]) {
          const file = ts.createSourceFile(
            path,
            readFileSync(join(candidateRoot(), path), "utf8"),
            ts.ScriptTarget.ES2022,
            true,
          );
          const calls: ts.CallExpression[] = [];
          const visit = (node: ts.Node) => {
            if (
              ts.isCallExpression(node) &&
              ts.isIdentifier(node.expression) &&
              node.expression.text === "guardAIRequest"
            )
              calls.push(node);
            ts.forEachChild(node, visit);
          };
          visit(file);
          assert(calls.length > 0, "A form consumer lost its admission guard");
          for (const call of calls) {
            const parser = call.arguments[2];
            assert(
              parser && ts.isStringLiteral(parser) && parser.text === "form",
              "Form body consumer must declare form admission: " + path,
            );
          }
        }
      },
    );

    await check(
      "valid installation distinguishes identities and never activates automatically",
      async () => {
        const f = make(),
          row = await f.service.install(fixture.v1, f.authority);
        assert.equal(row.reference.courseId, fixture.courseId);
        assert.equal(row.reference.contentVersion, "1.0.0");
        assert.equal(row.reference.contractVersion, "1.5");
        assert.equal(row.reference.envelopeVersion, "1.0.0");
        assert.equal(row.reference.languageContractVersion, "1.1");
        assert.match(row.reference.artifactHash, /^[a-f0-9]{64}$/);
        assert.match(row.reference.installationId, /^[0-9a-f-]{36}$/);
        assert.equal(row.state, "installed");
        assert.equal(row.preparation, "not_prepared");
        assert.equal(row.approval, "not_reviewed");
        assert.equal(row.inventory.length, fixture.v1.size);
        assert(row.installedAt);
        assert.equal(row.approvedAt, null);
        assert.equal((await f.catalog.getActive(fixture.courseId)).installationId, null);
        await expectCode(
          () => f.service.createSession(studentA, fixture.courseId),
          "NO_ACTIVE_VERSION",
        );
      },
    );
    await check(
      "exact/reordered reinstalls preserve installation and immutable artifact history",
      async () => {
        const f = make(),
          first = await f.service.install(fixture.v1, f.authority);
        const count = f.store.writes.length,
          history = copy(f.catalog.history);
        const repeated = await f.service.install(cloneFiles(fixture.v1), f.authority);
        const reversed = await f.service.install(new Map([...fixture.v1].reverse()), f.authority);
        assert.deepEqual(repeated.reference, first.reference);
        assert.deepEqual(reversed.reference, first.reference);
        assert.equal(f.catalog.rows.size, 1);
        assert.equal(f.store.writes.length, count);
        assert.deepEqual(f.catalog.history, history);
      },
    );
    await check(
      "same version changed answer/policy/media conflicts without modifying stored bytes",
      async () => {
        const f = make(),
          first = await f.service.install(fixture.v1, f.authority),
          before = copy(f.store.objects);
        const changed = cloneFiles(fixture.v2);
        editPackageJson(changed, "documents/course.json", (c) => {
          c.contentVersion = "1.0.0";
        });
        editPackageJson(changed, "manifest.json", (m) => {
          m.contentVersion = "1.0.0";
        });
        await expectCode(() => f.service.install(changed, f.authority), "VERSION_CONFLICT");
        assert.deepEqual(f.store.objects, before);
        assert.deepEqual(
          (await f.catalog.get(first.reference.installationId))!.reference,
          first.reference,
        );
      },
    );
    await check("manifest-only change belongs to immutable artifact and conflicts", async () => {
      const f = make(),
        first = await f.service.install(fixture.v1, f.authority),
        changed = cloneFiles(fixture.v1);
      editPackageJson(changed, "manifest.json", (m) => {
        m.producer.name = "A different producer claim";
      });
      await expectCode(() => f.service.install(changed, f.authority), "VERSION_CONFLICT");
      assert.equal(f.catalog.rows.size, 1);
      assert.equal((await f.catalog.getActive(first.reference.courseId)).revision, 0);
    });
    await check(
      "input byte snapshot precedes first await and resists caller mutation",
      async () => {
        const f = make(),
          input = cloneFiles(fixture.v1),
          entered = deferred<void>(),
          release = deferred<void>();
        f.guard.before = async () => {
          entered.resolve();
          await release.promise;
        };
        const pending = observeRejection(f.service.install(input, f.authority));
        await Promise.race([
          entered.promise,
          pending.then(() => assert.fail("Installation completed before the authority barrier")),
        ]);
        input.get(fixture.mediaPath)![55] ^= 1;
        input.delete("documents/course.json");
        release.resolve();
        const row = await pending;
        const resolved = await f.service.resolveInstallation(row.reference.installationId);
        assert.deepEqual(
          resolved.prepared.assets.get(fixture.mediaPath),
          fixture.v1.get(fixture.mediaPath),
        );
      },
    );
    for (const mode of [
      "missing-document",
      "tampered-media",
      "required-capability",
      "script",
    ] as const) {
      await check("invalid package has zero catalog/storage effects: " + mode, async () => {
        const f = make(),
          files = cloneFiles(fixture.v1);
        if (mode === "missing-document") files.delete("documents/course.json");
        if (mode === "tampered-media") files.get(fixture.mediaPath)![50] ^= 1;
        if (mode === "required-capability")
          editPackageJson(files, "manifest.json", (m) => {
            m.capabilityRequirements = [
              { id: "qa.executor.missing", version: "1.0.0", required: true, data: {} },
            ];
          });
        if (mode === "script")
          files.set("run.js", Buffer.from('throw new Error("must never run")'));
        await expectCode(() => f.service.install(files, f.authority), "INVALID_PACKAGE");
        assert.equal(f.catalog.rows.size, 0);
        assert.equal(f.store.objects.size, 0);
      });
    }
    await check(
      "database reservation failure is sanitized and leaves no uploaded files",
      async () => {
        const f = make();
        f.catalog.failNext.add("reserve");
        await expectCode(() => f.service.install(fixture.v1, f.authority), "CATALOG_FAILED");
        assert.equal(f.store.objects.size, 0);
        assert.equal(f.catalog.rows.size, 0);
      },
    );
    await check(
      "partial storage failure remains incomplete and retry reuses installation",
      async () => {
        const f = make();
        f.store.failPutAt = 3;
        await expectCode(() => f.service.install(fixture.v1, f.authority), "STORAGE_FAILED");
        const incomplete = [...f.catalog.rows.values()][0];
        assert.equal(incomplete.state, "preparing");
        assert.equal(incomplete.approval, "not_reviewed");
        await expectCode(
          () => f.service.activate(command(incomplete, 0), f.authority),
          "INSTALLATION_INCOMPLETE",
        );
        assert.equal((await f.catalog.getActive(fixture.courseId)).installationId, null);
        f.store.failPutAt = 0;
        const recovered = await f.service.install(fixture.v1, f.authority);
        assert.equal(recovered.reference.installationId, incomplete.reference.installationId);
        assert.equal(recovered.state, "installed");
        assert.equal(f.store.objects.size, fixture.v1.size);
      },
    );
    await check("confirmation failure retains staging and retry completes once", async () => {
      const f = make();
      f.catalog.failNext.add("confirm");
      await expectCode(() => f.service.install(fixture.v1, f.authority), "CATALOG_FAILED");
      assert.equal([...f.catalog.rows.values()][0].state, "preparing");
      const installed = await f.service.install(fixture.v1, f.authority);
      assert.equal(installed.state, "installed");
      assert.equal(f.catalog.history.filter((h) => h.action === "confirm").length, 1);
      assert.equal(f.store.writes.length, fixture.v1.size);
    });
    await check(
      "timeout after confirmation commit retries idempotently without activation",
      async () => {
        const f = make();
        f.catalog.confirmTimeoutAfterCommit = true;
        await expectCode(() => f.service.install(fixture.v1, f.authority), "CATALOG_FAILED");
        const installed = await f.service.install(fixture.v1, f.authority);
        assert.equal(installed.state, "installed");
        assert.equal(f.catalog.rows.size, 1);
        assert.equal(f.catalog.history.filter((h) => h.action === "confirm").length, 1);
        assert.equal((await f.catalog.getActive(fixture.courseId)).revision, 0);
      },
    );
    await check(
      "two concurrent installs of identical artifact converge to one installation",
      async () => {
        const f = make();
        const rows = await Promise.all([
          f.service.install(fixture.v1, f.authority),
          f.service.install(cloneFiles(fixture.v1), f.authority),
        ]);
        assert.deepEqual(rows[0].reference, rows[1].reference);
        assert.equal(f.catalog.rows.size, 1);
        assert.equal(f.store.objects.size, fixture.v1.size);
      },
    );
    await check(
      "concurrent divergent artifact at same version has one winner and one conflict",
      async () => {
        const f = make(),
          changed = cloneFiles(fixture.v1);
        editPackageJson(changed, "manifest.json", (m) => {
          m.producer.name = "Concurrent conflicting producer";
        });
        const outcomes = await Promise.allSettled([
          f.service.install(fixture.v1, f.authority),
          f.service.install(changed, f.authority),
        ]);
        assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
        const loser = outcomes.find((o) => o.status === "rejected");
        assert(loser?.status === "rejected");
        assert.equal(loser.reason.code, "VERSION_CONFLICT");
        assert.equal(f.catalog.rows.size, 1);
      },
    );
    await check(
      "installed/prepared/approved are separate and each transition is required",
      async () => {
        const f = make(),
          row = await f.service.install(fixture.v1, f.authority);
        await expectCode(
          () => f.service.activate(command(row, 0), f.authority),
          "INSTALLATION_NOT_PREPARED",
        );
        await expectCode(
          () => f.service.recordLocalApproval(row.reference.installationId, f.authority),
          "INSTALLATION_NOT_PREPARED",
        );
        const prepared = await f.service.prepareForHomologation(
          row.reference.installationId,
          f.authority,
        );
        assert.equal(prepared.preparation, "prepared");
        assert.equal(prepared.approval, "not_reviewed");
        await expectCode(
          () => f.service.activate(command(row, 0), f.authority),
          "INSTALLATION_NOT_APPROVED",
        );
        const approved = await f.service.recordLocalApproval(
          row.reference.installationId,
          f.authority,
        );
        assert.equal(approved.approval, "local_test_approved");
        assert.equal((await f.catalog.getActive(fixture.courseId)).revision, 0);
      },
    );
    for (const path of ["curriculum/unit-0.json", fixture.mediaPath, "manifest.json"]) {
      await check(
        "integrity corruption blocks activation and leaves existing active selection: " + path,
        async () => {
          const f = make(),
            { row: first, receipt } = await activateV1(f),
            second = await ready(f, fixture.v2);
          f.store.objects.get(f.store.key(second.reference, path))![0] ^= 1;
          await expectCode(
            () => f.service.activate(command(second, receipt.selection.revision), f.authority),
            "ARTIFACT_INTEGRITY",
          );
          assert.equal(
            (await f.catalog.getActive(fixture.courseId)).installationId,
            first.reference.installationId,
          );
        },
      );
    }
    await check(
      "store read outage prevents activation rather than accepting cached preparation",
      async () => {
        const f = make(),
          row = await ready(f, fixture.v1);
        f.store.failRead = true;
        await expectCode(() => f.service.activate(command(row, 0), f.authority), "STORAGE_FAILED");
        assert.equal((await f.catalog.getActive(fixture.courseId)).revision, 0);
      },
    );
    for (const state of ["unknown", "unavailable"] as const) {
      await check("required playback operational " + state + " rejects activation", async () => {
        const f = make(),
          row = await ready(f, fixture.v1);
        const unresolved = new CourseInstallationService({
          catalog: f.catalog,
          store: f.store,
          authorizer: f.guard,
          environment: { dependencies: { "client.media_playback": { state } } },
        });
        await expectCode(
          () => unresolved.activate(command(row, 0), f.authority),
          "INVALID_PACKAGE",
        );
        assert.equal((await f.catalog.getActive(fixture.courseId)).revision, 0);
      });
    }
    await check(
      "catalog activation failure never changes active pointer or success history",
      async () => {
        const f = make(),
          row = await ready(f, fixture.v1),
          before = copy(f.catalog.history);
        f.catalog.failNext.add("activate");
        await expectCode(() => f.service.activate(command(row, 0), f.authority), "CATALOG_FAILED");
        assert.equal((await f.catalog.getActive(fixture.courseId)).revision, 0);
        assert.deepEqual(f.catalog.history, before);
      },
    );
    await check(
      "two concurrent activations using one revision produce exactly one winner",
      async () => {
        const f = make(),
          first = await ready(f, fixture.v1),
          second = await ready(f, fixture.v2);
        const outcomes = await Promise.allSettled([
          f.service.activate(command(first, 0), f.authority),
          f.service.activate(command(second, 0), f.authority),
        ]);
        assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
        const loser = outcomes.find((o) => o.status === "rejected");
        assert(loser?.status === "rejected");
        assert.equal(loser.reason.code, "REVISION_CONFLICT");
        assert.equal((await f.catalog.getActive(fixture.courseId)).revision, 1);
        assert.equal(f.catalog.history.filter((h) => h.action === "activate").length, 1);
      },
    );
    await check(
      "old activation retry after newer activation returns receipt without reverting selection",
      async () => {
        const f = make(),
          first = await ready(f, fixture.v1),
          old = command(first, 0);
        const receipt = await f.service.activate(old, f.authority),
          second = await ready(f, fixture.v2);
        const newer = await f.service.activate(
          command(second, receipt.selection.revision),
          f.authority,
        );
        const repeated = await f.service.activate(old, f.authority);
        assert.deepEqual(repeated, receipt);
        assert.deepEqual(await f.catalog.getActive(fixture.courseId), newer.selection);
        await expectCode(
          () =>
            f.service.activate(
              { ...old, installationId: second.reference.installationId },
              f.authority,
            ),
          "OPERATION_CONFLICT",
        );
      },
    );
    await check(
      "multiple service consumers read committed current selection after warm resolution",
      async () => {
        const f = make(),
          { row, receipt } = await activateV1(f);
        const consumer = new CourseInstallationService({
          catalog: f.catalog,
          store: f.store,
          environment: playbackEnvironment,
        });
        assert.equal(
          (await consumer.resolveActive(fixture.courseId)).installation.reference.installationId,
          row.reference.installationId,
        );
        const second = await ready(f, fixture.v2);
        await f.service.activate(command(second, receipt.selection.revision), f.authority);
        assert.equal(
          (await consumer.resolveActive(fixture.courseId)).installation.reference.installationId,
          second.reference.installationId,
        );
        f.catalog.failNext.add("getActive");
        await expectCode(() => consumer.resolveActive(fixture.courseId), "CATALOG_FAILED");
      },
    );
    await check(
      "rollback restores V1 for new sessions while preserving V2 and immutable audit trail",
      async () => {
        const f = make(),
          { row: first, receipt } = await activateV1(f),
          second = await ready(f, fixture.v2);
        const updated = await f.service.activate(
          command(second, receipt.selection.revision),
          f.authority,
        );
        const before = copy(f.catalog.history);
        const reverted = await f.service.rollback(
          command(first, updated.selection.revision),
          f.authority,
        );
        assert.equal(reverted.action, "rollback");
        assert.equal(reverted.selection.installationId, first.reference.installationId);
        assert.equal(f.catalog.rows.size, 2);
        assert.deepEqual(f.catalog.history.slice(0, before.length), before);
        assert.equal(
          (await f.service.createSession(studentA, fixture.courseId)).reference.installationId,
          first.reference.installationId,
        );
      },
    );
    await check("rollback failure leaves V2 selection and history untouched", async () => {
      const f = make(),
        { row: first, receipt } = await activateV1(f),
        second = await ready(f, fixture.v2);
      const current = await f.service.activate(
          command(second, receipt.selection.revision),
          f.authority,
        ),
        before = copy(f.catalog.history);
      f.catalog.failNext.add("activate");
      await expectCode(
        () => f.service.rollback(command(first, current.selection.revision), f.authority),
        "CATALOG_FAILED",
      );
      assert.deepEqual(await f.catalog.getActive(fixture.courseId), current.selection);
      assert.deepEqual(f.catalog.history, before);
    });
    await check(
      "stale rollback competes with update using CAS and cannot revert a later decision",
      async () => {
        const f = make(),
          { row: first, receipt } = await activateV1(f),
          second = await ready(f, fixture.v2);
        const current = await f.service.activate(
          command(second, receipt.selection.revision),
          f.authority,
        );
        await expectCode(
          () => f.service.rollback(command(first, receipt.selection.revision), f.authority),
          "REVISION_CONFLICT",
        );
        assert.deepEqual(await f.catalog.getActive(fixture.courseId), current.selection);
      },
    );
    await check(
      "concurrent rollback and activation use one revision and preserve the winning receipt",
      async () => {
        const f = make(),
          { row: first, receipt } = await activateV1(f),
          second = await ready(f, fixture.v2);
        const current = await f.service.activate(
          command(second, receipt.selection.revision),
          f.authority,
        );
        const before = f.catalog.history.length;
        const outcomes = await Promise.allSettled([
          f.service.rollback(command(first, current.selection.revision), f.authority),
          f.service.activate(command(second, current.selection.revision), f.authority),
        ]);
        const winner = outcomes.find((outcome) => outcome.status === "fulfilled");
        const loser = outcomes.find((outcome) => outcome.status === "rejected");
        assert(winner?.status === "fulfilled");
        assert(loser?.status === "rejected");
        assert.equal(loser.reason.code, "REVISION_CONFLICT");
        assert.deepEqual(await f.catalog.getActive(fixture.courseId), winner.value.selection);
        assert.equal(f.catalog.history.length, before + 1);
      },
    );

    await check(
      "sessions use original grading/evaluation/policy/media after V2 and rollback",
      async () => {
        const f = make(),
          { row: first, receipt } = await activateV1(f);
        const session1 = await f.service.createSession(studentA, fixture.courseId, randomUUID());
        const second = await ready(f, fixture.v2);
        const current = await f.service.activate(
          command(second, receipt.selection.revision),
          f.authority,
        );
        const session2 = await f.service.createSession(studentA, fixture.courseId, randomUUID());
        await f.service.rollback(command(first, current.selection.revision), f.authority);
        const reopened = new CourseInstallationService({
          catalog: f.catalog,
          store: f.store,
          environment: playbackEnvironment,
        });
        for (const [session, index] of [
          [session1, 0],
          [session2, 1],
        ] as const) {
          const resolved = await reopened.resolveSession(studentA, session.id),
            bundle = resolved.content.prepared.bundle;
          const activity = bundle.course.units[0].lessons[0].activities.find(
            (a) => a.id === fixture.activityId,
          )!;
          const context = {
            language: bundle.language,
            course: bundle.course,
            preference: "variant-b",
          };
          assert.equal(
            gradeActivity(activity, fixture.answers[index], bundle.language.normalization, context)!
              .correct,
            true,
          );
          assert.equal(
            gradeActivity(
              activity,
              fixture.answers[index === 0 ? 1 : 0],
              bundle.language.normalization,
              context,
            )!.correct,
            false,
          );
          const evaluated = evaluateAssessment(
            bundle.course,
            fixture.assessmentId,
            [{ activityId: fixture.activityId, answer: fixture.answers[index] }],
            bundle.language.normalization,
            context,
          );
          assert.equal(evaluated.objectiveScore, 100);
          assert.equal(bundle.course.contentVersion, index === 0 ? "1.0.0" : "2.0.0");
          const policy = bundle.course.units[0].learningPolicy;
          assert(policy);
          const requirement = policy.mastery.requirements[0];
          assert("minimumScore" in requirement);
          assert.equal(requirement.minimumScore, index === 0 ? 100 : 75);
          assert.deepEqual(
            resolved.content.prepared.assets.get(fixture.mediaPath),
            (index === 0 ? fixture.v1 : fixture.v2).get(fixture.mediaPath),
          );
        }
        assert.deepEqual((await reopened.resolveSession(studentA, session1.id)).session, session1);
        assert.deepEqual((await reopened.resolveSession(studentA, session2.id)).session, session2);
      },
    );
    await check(
      "session creation crossing activation commits exactly one complete version binding",
      async () => {
        const f = make(),
          { row: first, receipt } = await activateV1(f),
          second = await ready(f, fixture.v2);
        const entered = deferred<void>(),
          release = deferred<void>();
        f.catalog.hooks.openSession = async () => {
          entered.resolve();
          await release.promise;
        };
        const started = observeRejection(
          f.service.createSession(studentA, fixture.courseId, randomUUID()),
        );
        await Promise.race([
          entered.promise,
          started.then(() => assert.fail("Session completed before the catalog barrier")),
        ]);
        try {
          await f.service.activate(command(second, receipt.selection.revision), f.authority);
        } finally {
          release.resolve();
        }
        const session = await started;
        assert(
          [first.reference.installationId, second.reference.installationId].includes(
            session.reference.installationId,
          ),
        );
        const resolved = await f.service.resolveSession(studentA, session.id);
        assert.deepEqual(resolved.session.reference, resolved.content.installation.reference);
        const repeated = await f.service.createSession(studentA, fixture.courseId, session.id);
        assert.deepEqual(repeated, session);
      },
    );
    await check(
      "cross-owner session access/evidence and session-id reuse are rejected",
      async () => {
        const f = make();
        await activateV1(f);
        const session = await f.service.createSession(studentA, fixture.courseId, randomUUID());
        await expectCode(() => f.service.resolveSession(studentB, session.id), "SESSION_NOT_FOUND");
        await expectCode(
          () =>
            f.service.recordEvidence(studentB, session.id, {
              id: randomUUID(),
              kind: "activity",
              definitionId: fixture.activityId,
              input: "x",
              result: true,
            }),
          "SESSION_NOT_FOUND",
        );
        await expectCode(
          () => f.service.createSession(studentB, fixture.courseId, session.id),
          "SESSION_CONFLICT",
        );
        assert.equal(f.catalog.evidences.size, 0);
      },
    );
    await check(
      "evidence idempotency preserves old version/result and detects conflicting reuse",
      async () => {
        const f = make(),
          { row: first, receipt } = await activateV1(f),
          session = await f.service.createSession(studentA, fixture.courseId, randomUUID());
        const input: EvidenceInput = {
          id: randomUUID(),
          kind: "assessment",
          definitionId: fixture.assessmentId,
          input: { answer: fixture.answers[0] },
          result: { score: 100 },
        };
        const evidence = await f.service.recordEvidence(studentA, session.id, input),
          second = await ready(f, fixture.v2);
        const current = await f.service.activate(
          command(second, receipt.selection.revision),
          f.authority,
        );
        await f.service.rollback(command(first, current.selection.revision), f.authority);
        assert.deepEqual(
          await f.service.recordEvidence(studentA, session.id, copy(input)),
          evidence,
        );
        assert.deepEqual(await f.service.listEvidence(studentA, session.id), [evidence]);
        assert.deepEqual(evidence.reference, first.reference);
        await expectCode(
          () => f.service.recordEvidence(studentA, session.id, { ...input, result: { score: 0 } }),
          "EVIDENCE_CONFLICT",
        );
        assert.deepEqual(await f.service.listEvidence(studentA, session.id), [evidence]);
      },
    );
    await check(
      "invalid user and session IDs are rejected without creating or reusing a binding",
      async () => {
        const f = make();
        await activateV1(f);
        await expectCode(
          () => f.service.createSession("invalid-user-id", fixture.courseId, randomUUID()),
          "INVALID_INPUT",
        );
        await expectCode(
          () => f.service.createSession(studentA, fixture.courseId, "invalid-session-id"),
          "INVALID_INPUT",
        );
        await expectCode(
          () => f.service.resolveSession(studentA, "invalid-session-id"),
          "INVALID_INPUT",
        );
        await expectCode(
          () => f.service.listEvidence("invalid-user-id", randomUUID()),
          "INVALID_INPUT",
        );
        assert.equal(f.catalog.sessions.size, 0);
        assert.equal(f.catalog.evidences.size, 0);
      },
    );
    await check(
      "invalid installation UUIDs are rejected independently of installation existence",
      async () => {
        const f = make();
        await expectCode(
          () => f.service.resolveInstallation("invalid-installation-id"),
          "INVALID_INPUT",
        );
        await expectCode(
          () => f.service.prepareForHomologation("invalid-installation-id", f.authority),
          "INVALID_INPUT",
        );
        await expectCode(
          () => f.service.recordLocalApproval("invalid-installation-id", f.authority),
          "INVALID_INPUT",
        );
        assert.equal(f.catalog.rows.size, 0);
        assert.equal(f.catalog.history.length, 0);
      },
    );
    await check(
      "invalid activation operation or installation IDs never change active selection",
      async () => {
        const f = make(),
          row = await ready(f, fixture.v1);
        await expectCode(
          () =>
            f.service.activate(
              { ...command(row, 0), operationId: "invalid-operation-id" },
              f.authority,
            ),
          "INVALID_INPUT",
        );
        await expectCode(
          () =>
            f.service.rollback(
              { ...command(row, 0), installationId: "invalid-installation-id" },
              f.authority,
            ),
          "INVALID_INPUT",
        );
        assert.equal((await f.catalog.getActive(fixture.courseId)).revision, 0);
        assert.equal(f.catalog.operations.size, 0);
      },
    );

    await check("evidence definition must exist in its pinned course and kind", async () => {
      const f = make();
      await activateV1(f);
      const session = await f.service.createSession(studentA, fixture.courseId, randomUUID());
      for (const input of [
        {
          id: randomUUID(),
          kind: "assessment" as const,
          definitionId: fixture.activityId,
          input: null,
          result: null,
        },
        {
          id: randomUUID(),
          kind: "activity" as const,
          definitionId: "missing-definition",
          input: null,
          result: null,
        },
      ])
        await expectCode(
          () => f.service.recordEvidence(studentA, session.id, input),
          "DEFINITION_NOT_FOUND",
        );
      assert.equal(f.catalog.evidences.size, 0);
    });
    await check(
      "public projection hides correction canaries and assets stay scoped by installation",
      async () => {
        const f = make(),
          first = await f.service.install(fixture.v1, f.authority),
          second = await f.service.install(fixture.v2, f.authority);
        for (const row of [first, second]) {
          const resolved = await f.service.resolveInstallation(row.reference.installationId),
            serialized = JSON.stringify(resolved.prepared.publicCourse);
          for (const canary of fixture.rubricCanaries) assert(!serialized.includes(canary));
          for (const answer of fixture.answers) assert(!serialized.includes(answer));
          const publicActivity = resolved.prepared.publicCourse.units[0].lessons[0].activities[0];
          assert(!("answer" in publicActivity));
          assert(!("explanation" in publicActivity));
        }
        assert.notDeepEqual(
          f.store.objects.get(f.store.key(first.reference, fixture.mediaPath)),
          f.store.objects.get(f.store.key(second.reference, fixture.mediaPath)),
        );
        assert.equal((await f.catalog.list(fixture.courseId)).length, 2);
      },
    );
    await check(
      "unknown or abandoned installations never resolve as current runnable content",
      async () => {
        const f = make();
        await expectCode(
          () => f.service.resolveInstallation(randomUUID()),
          "INSTALLATION_NOT_FOUND",
        );
        const row = await f.service.install(fixture.v1, f.authority);
        f.catalog.rows.get(row.reference.installationId)!.state = "abandoned";
        await expectCode(
          () => f.service.resolveInstallation(row.reference.installationId),
          "INSTALLATION_ABANDONED",
        );
      },
    );
    console.log(
      JSON.stringify({
        independentQA: "I7",
        candidate: candidateHashes([
          "src/domain/course-installations/contracts.ts",
          "src/domain/course-installations/service.ts",
          "src/lib/course-installation-runtime.ts",
          "scripts/course-installation-local-authority.ts",
          "src/domain/ai/ai-request-guard.ts",
          "src/lib/versioned-operation-guard.ts",
        ]),
        scenarios: records,
        passed: records.filter((r) => r.result === "passed").length,
        failed: records.filter((r) => r.result === "failed").length,
        databaseOperations: 0,
        paidCalls: 0,
        publicationOperations: 0,
        limitation:
          "Fake atomic catalog does not prove SQL transactions; local integration remains a separate required gate.",
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
    fixture.cleanup();
  }
}
void main().catch((caught: unknown) => {
  console.error(caught);
  process.exitCode = 1;
});
