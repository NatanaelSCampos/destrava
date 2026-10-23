import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { requireCourseBundle } from "../src/content/course-registry";
import { publicCourse } from "../src/content/public";
import { serverServiceAvailability } from "../src/lib/capability-environment";
import { learningActionAvailability } from "../src/domain/study/learning-action-availability";
import { unsupportedVersionScope } from "../src/lib/versioned-operation-guard";
import { LessonIntegrityError, recoverLegacyRuntime, validateRuntimeProgress } from "../src/domain/interactive-lesson/integrity";
import { initialRuntime } from "../src/domain/interactive-lesson/runtime";
import { runtimeSchema, sessionInputSchema } from "../src/domain/interactive-lesson/session-state";
import { readBoundedLessonBody } from "../src/domain/interactive-lesson/request-body";

// Execute exact function bodies, replacing only I/O boundaries. These tests do not
// import a server-only module or construct a real SDK/database/browser client.
function functions<T>(path: string, names: string[], bindings: Record<string, unknown>): T {
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const declarations = names.map((name) => {
    const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert(declaration, `Missing real function ${name} in ${path}`);
    return declaration.getText(ast).replace(/^export\s+/, "");
  });
  const exports = {};
  const code = ts.transpileModule(`${declarations.join("\n")}\nObject.assign(exports, {${names.join(",")}});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports, ...bindings });
  return exports as T;
}
const publicUrl = "http://127.0.0.1:59999/QA_URL_CANARY";
const publicKey = "QA_PUBLIC_KEY_CANARY";
const privateKey = "QA_PRIVATE_KEY_CANARY";
const bundle = requireCourseBundle("frecuencias-a1");
const environmentNames = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const;
async function configured(run: () => unknown | Promise<unknown>, options = { url: true, publicKey: true, privateKey: true }) {
  const previous = new Map(environmentNames.map((name) => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw Error("Network forbidden in interactive availability tests"); };
  for (const name of environmentNames) delete process.env[name];
  if (options.url) process.env.NEXT_PUBLIC_SUPABASE_URL = publicUrl;
  if (options.publicKey) process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publicKey;
  if (options.privateKey) process.env.SUPABASE_SECRET_KEY = privateKey;
  try { await run(); }
  finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    globalThis.fetch = originalFetch;
    assert.equal(networkCalls, 0, "No provider/database network call is allowed");
  }
}
function projection() {
  const dependencies = serverServiceAvailability();
  const course = publicCourse(bundle.course, bundle.language, { dependencies });
  return { dependencies, course, action: learningActionAvailability(course, { kind: "interactive" }, { source: "compiled", permitted: true }) };
}
function writer() {
  let sdkCalls = 0;
  const loadedModule = functions<{ lessonWriter(): unknown }>("src/domain/interactive-lesson/server.ts", ["lessonWriter"], {
    process, LessonIntegrityError,
    createClient: () => { sdkCalls++; return { syntheticWriter: true }; },
  });
  return { call: loadedModule.lessonWriter, calls: () => sdkCalls };
}
const writerUnavailable = (error: unknown) => error instanceof LessonIntegrityError && error.code === "LESSON_WRITER_UNAVAILABLE" && error.status === 503;

test("R1P2 missing private writer config projects unavailable operation", () => configured(() => {
  const { action } = projection();
  assert.equal(action.operation, "unavailable", "Known missing writer configuration must not claim unknown readiness");
}, { url: true, publicKey: true, privateKey: false }));

test("R1P2 missing private writer config suppresses the compiled interactive CTA", () => configured(() => {
  const { action } = projection();
  assert.equal(action.eligible, false, "An impossible interactive action must not be offered");
  const client = writer();
  assert.throws(client.call, writerUnavailable);
  assert.equal(client.calls(), 0);
}, { url: true, publicKey: true, privateKey: false }));

test("complete configuration stays unknown rather than claiming a healthy service", () => configured(() => {
  const { action } = projection();
  assert.equal(action.operation, "unknown");
  assert.equal(action.eligible, true);
  const client = writer();
  assert.equal(JSON.stringify(client.call()), JSON.stringify({ syntheticWriter: true }));
  assert.equal(client.calls(), 1);
}));

test("missing public URL or public key blocks the interactive operation", async () => {
  for (const options of [{ url: false, publicKey: true, privateKey: true }, { url: true, publicKey: false, privateKey: true }]) {
    await configured(() => {
      const { action } = projection();
      assert.equal(action.operation, "unavailable");
      assert.equal(action.eligible, false);
    }, options);
  }
});

test("complete server configuration never enables the unsupported installed integration", () => configured(() => {
  const { course } = projection();
  const action = learningActionAvailability(course, { kind: "interactive" }, { source: "installed", permitted: true });
  assert.equal(action.compatibility, false);
  assert.equal(action.eligible, false);
}));

test("denied or unknown permission keeps the interactive action ineligible", () => configured(() => {
  const { course } = projection();
  for (const permitted of [false, undefined]) {
    const action = learningActionAvailability(course, { kind: "interactive" }, { source: "compiled", permitted });
    assert.equal(action.eligible, false);
    assert.equal(action.permission, permitted === false ? "denied" : "unknown");
  }
}));

test("service and public course projections never expose URL or key canaries", async () => {
  for (const privatePresent of [false, true]) await configured(() => {
    const { dependencies, course, action } = projection();
    const serialized = JSON.stringify({ dependencies, course, action });
    for (const canary of [publicUrl, publicKey, privateKey, "QA_URL_CANARY", "SUPABASE_SECRET_KEY"]) assert(!serialized.includes(canary));
  }, { url: true, publicKey: true, privateKey: privatePresent });
});

function sessionHandlers(options: { anonymous?: boolean; unavailable?: boolean; readFailure?: boolean } = {}) {
  const definition = bundle.coursePackage.interactiveLessons[0];
  assert(definition);
  const lesson = bundle.course.units.flatMap((unit) => unit.lessons).find((item) => item.id === definition.lessonId);
  assert(lesson);
  const userId = "00000000-0000-4000-8000-00000000000a";
  const scope = { userId, courseId: bundle.course.id, lessonId: lesson.id,
    sessionId: "00000000-0000-4000-8000-00000000000b", contentVersion: bundle.coursePackage.contentVersion, definitionHash: "a".repeat(64) };
  const runtime = initialRuntime(definition, scope);
  const row = { id: scope.sessionId, revision: 4, content_version: scope.contentVersion,
    definition_hash: scope.definitionHash, runtime_state: runtime };
  let reads = 0, sdkCalls = 0, writes = 0, availabilityChecks = 0;
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => { reads++; return { data: row, error: options.readFailure ? { code: "SYNTHETIC_READ_FAILURE" } : null }; },
  };
  const server = functions<{
    lessonWriter(): unknown;
    readLessonSession(...args: unknown[]): unknown;
    sessionScope(...args: unknown[]): unknown;
    trustedSessionRuntime(...args: unknown[]): unknown;
  }>("src/domain/interactive-lesson/server.ts", ["lessonWriter", "readLessonSession", "sessionScope", "trustedSessionRuntime"], {
    process, LessonIntegrityError, initialRuntime, runtimeSchema, recoverLegacyRuntime,
    createClient: () => { sdkCalls++; return {}; },
  });
  const context = { bundle, lesson, definition, definitionHash: scope.definitionHash };
  const handlers = functions<{ GET(request: Request): Promise<Response>; POST(request: Request): Promise<Response> }>(
    "src/app/api/interactive-lessons/session/route.ts", ["failure", "GET", "POST"], {
      NextResponse: Response, URL, TextDecoder, LessonIntegrityError, readBoundedLessonBody,
      unsupportedVersionScope, sessionInputSchema, validateRuntimeProgress, ...server,
      getAuthenticatedUser: async () => options.anonymous ? null : { id: userId },
      assertCompiledLessonSelected: async () => undefined,
      assertLessonAvailable: () => { availabilityChecks++; if (options.unavailable) throw new LessonIntegrityError("LESSON_UNAVAILABLE", 503); },
      resolveLessonContext: () => context,
      authenticatedLessonDb: async () => ({ from: () => query }),
      newLessonSessionId: () => scope.sessionId,
      saveLessonSession: async () => { writes++; throw Error("Unexpected write in a rejecting or reading path"); },
      deriveLessonEvents: () => [],
    },
  );
  return { handlers, runtime, row, scope, counts: () => ({ reads, sdkCalls, writes, availabilityChecks }),
    read: () => new Request(`http://127.0.0.1/api/interactive-lessons/session?courseId=${scope.courseId}&lessonId=${scope.lessonId}`),
    post: (revision: number = row.revision, extra: Record<string, unknown> = {}) => new Request("http://127.0.0.1/api/interactive-lessons/session", {
      method: "POST", body: JSON.stringify({ courseId: scope.courseId, lessonId: scope.lessonId,
        contentVersion: scope.contentVersion, revision, runtime, ...extra }),
    }),
  };
}

test("authenticated session recovery remains readable without the private writer key", () => configured(async () => {
  const fixture = sessionHandlers({ unavailable: true });
  const response = await fixture.handlers.GET(fixture.read());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const result = await response.json();
  assert.equal(result.session.id, fixture.row.id);
  assert.deepEqual(result.session.runtime_state, fixture.runtime);
  assert.deepEqual(fixture.counts(), { reads: 1, sdkCalls: 0, writes: 0, availabilityChecks: 0 });
}, { url: true, publicKey: true, privateKey: false }));

test("anonymous session reads and writes stay denied before storage or SDK access", () => configured(async () => {
  const fixture = sessionHandlers({ anonymous: true });
  assert.equal((await fixture.handlers.GET(fixture.read())).status, 401);
  assert.equal((await fixture.handlers.POST(fixture.post())).status, 401);
  assert.deepEqual(fixture.counts(), { reads: 0, sdkCalls: 0, writes: 0, availabilityChecks: 0 });
}));

test("installed version scope is rejected before compiled session writes", () => configured(async () => {
  const fixture = sessionHandlers();
  assert.equal((await fixture.handlers.POST(fixture.post(4, { versionSessionId: fixture.scope.sessionId }))).status, 422);
  assert.deepEqual(fixture.counts(), { reads: 0, sdkCalls: 0, writes: 0, availabilityChecks: 0 });
}));

test("unavailable lesson keeps its write guard before session storage access", () => configured(async () => {
  const fixture = sessionHandlers({ unavailable: true });
  const response = await fixture.handlers.POST(fixture.post());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "LESSON_UNAVAILABLE");
  assert.deepEqual(fixture.counts(), { reads: 0, sdkCalls: 0, writes: 0, availabilityChecks: 1 });
}));

test("stale revision and failed session read never reach the writer", () => configured(async () => {
  const stale = sessionHandlers();
  const conflict = await stale.handlers.POST(stale.post(3));
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, "LESSON_REVISION_CONFLICT");
  assert.equal(stale.counts().sdkCalls, 0); assert.equal(stale.counts().writes, 0);
  const failed = sessionHandlers({ readFailure: true });
  const response = await failed.handlers.POST(failed.post());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "LESSON_READ_FAILED");
  assert.equal(failed.counts().sdkCalls, 0); assert.equal(failed.counts().writes, 0);
}));

test("private writer guard independently rejects a validated write without its key", () => configured(async () => {
  // This isolates the writer defense after a positive admission decision; real
  // availability is tested above. It does not replace authentication/MFA SQL tests.
  const fixture = sessionHandlers();
  const response = await fixture.handlers.POST(fixture.post());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "LESSON_WRITER_UNAVAILABLE");
  assert.deepEqual(fixture.counts(), { reads: 1, sdkCalls: 0, writes: 0, availabilityChecks: 1 });
}, { url: true, publicKey: true, privateKey: false }));
