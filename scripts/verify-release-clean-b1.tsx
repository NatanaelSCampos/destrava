import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";
import { initialRuntime, reduceRuntime, emptyBoard } from "../src/domain/interactive-lesson/runtime";
import { multiSegmentLesson, type QaScope, type QaEvidence } from "./fase4-qa-fixtures";
import { assertLocalDocker, assertLocalUrl, localApi, localApp, localEnvironment, workspace } from "./release-clean-environment.mjs";

type Runtime = ReturnType<typeof initialRuntime> & { evidenceScope?: QaScope | null; segmentEvidence?: Record<string, QaEvidence> };
type Saved = { sessionId: string; revision: number; runtime: Runtime; evidence?: Record<string, unknown>; grade?: { correct: boolean } };
type Handlers = { GET?: (request: Request) => Promise<Response>; POST: (request: Request) => Promise<Response> };
type Student = { id: string; client: SupabaseClient; email: string; password: string };
function wav(bytes = 16044) {
  const data = Buffer.alloc(bytes); data.write("RIFF", 0); data.writeUInt32LE(bytes - 8, 4);
  data.write("WAVE", 8); data.write("fmt ", 12); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(16000, 24);
  data.writeUInt32LE(32000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(bytes - 44, 40); return data;
}
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = ""; for (const char of secret.toUpperCase().replace(/=+$/, "")) {
    const digit = alphabet.indexOf(char); assert(digit >= 0);
    bits += digit.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest(), offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
/** LEAD ONLY: the public local wrapper supplies the isolated environment. No migration/deletion here. */
async function main() {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.equal(resolve(process.cwd()).toLowerCase(), resolve(workspace).toLowerCase());
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, localApi);
  const isolation = assertLocalDocker(), env = localEnvironment();
  assert.equal(env.APP_ORIGIN, localApp);
  const originalFetch = globalThis.fetch;
  let externalAttempts = 0;
  globalThis.fetch = (input, init) => {
    try { assertLocalUrl(typeof input === "string" || input instanceof URL ? input : input.url, [localApi, localApp]); }
    catch { externalAttempts++; throw Error("External destination rejected in F4 QA"); }
    return originalFetch(input, { ...init, redirect: "manual" });
  };
  const retainedSyntheticUsers: string[] = [], checks: string[] = [];
  const paths = ["src/domain/interactive-lesson/runtime.ts", "src/domain/interactive-lesson/integrity.ts",
    "src/domain/interactive-lesson/server.ts", "src/domain/interactive-lesson/session-state.ts",
    "src/app/api/interactive-lessons/session/route.ts", "src/app/api/interactive-lessons/segment/route.ts",
    "supabase/migrations/20261022000100_interactive_segment_evidence.sql", "scripts/verify-release-clean-b1.tsx"];
  const hashes = () => paths.map((path) => ({ path, sha256: createHash("sha256").update(readFileSync(resolve(path))).digest("hex") }));
  const before = hashes();
  const check = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); console.log("PASS " + name); };
  try {
    const admin = createClient(localApi, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const student = async (): Promise<Student> => {
      const email = "fase4-qa-" + randomUUID() + "@example.test", password = "Fase4-QA-" + randomUUID() + "!";
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert(!created.error && created.data.user, "Synthetic local account creation failed");
      retainedSyntheticUsers.push(created.data.user.id);
      const client = createClient(localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const login = await client.auth.signInWithPassword({ email, password }); assert(!login.error);
      return { id: created.data.user.id, client, email, password };
    };

    const raw = structuredClone(loadContent().find((item) => item.course.interactiveLessons.length)!);
    assert(raw, "Seeded compiled interactive fixture required");
    const definition = multiSegmentLesson(), existing = raw.course.interactiveLessons[0];
    const ownerUnitData = raw.course.units.find((unit) => unit.id === existing.unitId)!;
    const all = ownerUnitData.lessons.flatMap((lesson) => lesson.activities);
    const objectives = all.filter((item) => item.type === "multiple_choice").slice(0, 2);
    const speeches = all.filter((item) => item.type === "speaking").slice(0, 2);
    const writing = structuredClone(all.find((item) => item.type === "writing")!);
    assert.equal(objectives.length, 2); assert.equal(speeches.length, 2); assert(writing);
    if (writing.type === "writing") { writing.payload = { ...writing.payload, minWords: 1 }; delete writing.payload.textRequirement; }
    const activities = [...objectives, ...speeches, writing];
    definition.id = existing.id; definition.courseId = raw.course.id; definition.unitId = existing.unitId; definition.lessonId = existing.lessonId;
    definition.segments.forEach((segment, index) => { segment.activityRef = activities[index].id; });
    const container = raw.course.units.flatMap((unit) => unit.lessons).find((lesson) => lesson.id === existing.lessonId)!;
    const selectedIds = new Set(activities.map((activity) => activity.id));
    for (const lesson of raw.course.units.flatMap((unit) => unit.lessons)) {
      lesson.activities = lesson.activities.filter((activity) => !selectedIds.has(activity.id));
    }
    container.activities.push(...activities); raw.course.interactiveLessons = [definition];
    for (const unit of raw.course.units) unit.lessons = unit.lessons.filter((lesson) => lesson.activities.length > 0);
    const bundle = runtimeBundle(raw);
    bundle.course = structuredClone(bundle.course);
    for (const [table, ids] of [["courses", [raw.course.id]], ["lessons", [existing.lessonId]], ["activities", activities.map((activity) => activity.id)]] as const) {
      const rows = await admin.from(table).select("id").in("id", [...ids]); assert(!rows.error);
      assert.equal(rows.data.length, ids.length, "Synthetic VM catalog requires existing FK rows: " + table);
    }
    // Only the catalog is synthetic. Identity and MFA below call real LOCAL Auth/RPC;
    // reads/writes and the service-only transactional RPC use real LOCAL Supabase.
    const owner = await student(), other = await student();
    const fixture = { bundle, client: owner.client };
    const vm = { __fase4Qa: fixture, module: { exports: {} }, exports: {}, require: createRequire(import.meta.url),
      process: { ...process, env: { ...process.env, ...env, DESTRAVA_LOCAL_ONLY: "0" } }, console, Buffer, Request, Response, Headers,
      FormData, File, Blob, URL, TextEncoder, TextDecoder, setTimeout, clearTimeout, fetch: globalThis.fetch };
    async function handlers(path: string): Promise<Handlers> {
      const output = await build({ entryPoints: [resolve(path)], bundle: true, write: false, format: "cjs",
        platform: "node", packages: "external", tsconfig: resolve("tsconfig.json"), plugins: [{
          name: "qa-local-catalog-auth",
          setup(builder) {
            builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "qa" }));
            builder.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, () => ({ path: "auth", namespace: "qa" }));
            builder.onResolve({ filter: /^@\/content\/course-registry$/ }, () => ({ path: "catalog", namespace: "qa" }));
            builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path: name }) => ({ loader: "js", contents:
              name === "empty" ? "" : name === "catalog" ?
              "export const defaultCourseId=globalThis.__fase4Qa.bundle.course.id;export const allCourseBundles=()=>[globalThis.__fase4Qa.bundle];export const findCourseBundle=id=>id===defaultCourseId?globalThis.__fase4Qa.bundle:undefined;export const requireCourseBundle=id=>{const b=findCourseBundle(id);if(!b)throw Error('No synthetic bundle');return b;};" :
              "export const createSupabaseServerClient=async()=>globalThis.__fase4Qa.client;export const getAuthenticatedUser=async()=>{const client=globalThis.__fase4Qa.client;const {data,error}=await client.auth.getUser();if(error||!data.user)return null;const access=await client.rpc('mfa_access_allowed');return !access.error&&access.data===true?data.user:null;};"
            }));
          }
        }] });
      const context = { ...vm, module: { exports: {} }, exports: {} };
      runInNewContext(output.outputFiles[0].text, context, { filename: path });
      return context.module.exports as Handlers;
    }
    const sessions = await handlers("src/app/api/interactive-lessons/session/route.ts");
    const segments = await handlers("src/app/api/interactive-lessons/segment/route.ts");
    const endpoint = "/api/interactive-lessons/session";
    const request = (path: string, body?: unknown) => new Request(localApp + path, body === undefined ? undefined : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const sessionBody = (runtime: Runtime, revision: number | null) => ({ courseId: raw.course.id,
      lessonId: existing.lessonId, contentVersion: raw.course.contentVersion, runtime, revision });
    const submit = async (body: unknown) => segments.POST(request("/api/interactive-lessons/segment", body));
    const snapshot = async (userId = owner.id) => {
      const result = await admin.from("interactive_lesson_sessions").select("*").eq("user_id", userId)
        .eq("course_id", raw.course.id).eq("lesson_id", existing.lessonId).maybeSingle(); assert(!result.error); return result.data;
    };
    let saved!: Saved;
    await check("VM+SQL creates session with authenticated owner and server scope", async () => {
      const response = await sessions.POST(request(endpoint, sessionBody(initialRuntime(definition), null)));
      assert.equal(response.status, 200); saved = await response.json() as Saved;
      assert.equal(saved.runtime.evidenceScope?.userId, owner.id);
      assert.equal(saved.runtime.evidenceScope?.sessionId, saved.sessionId);
      const begun = reduceRuntime(definition, saved.runtime, { type: "START" });
      const started = await sessions.POST(request(endpoint, sessionBody(begun, saved.revision)));
      assert.equal(started.status, 200); saved = await started.json() as Saved;
    });
    const input = (answer: string, attemptId = randomUUID()) => ({
      courseId: raw.course.id, lessonId: existing.lessonId, contentVersion: raw.course.contentVersion,
      sessionId: saved.sessionId, revision: saved.revision, segmentId: definition.segments[saved.runtime.segmentIndex].id,
      activityId: definition.segments[saved.runtime.segmentIndex].activityRef!, attemptId, answer,
    });

    for (const dimension of ["unit", "lesson", "activity"] as const) {
      await check("VM+SQL required capability unavailable at " + dimension + " scope never writes", async () => {
        const { publicCourse } = await import("../src/content/public");
        const unitIndex = bundle.course.units.findIndex((unit) => unit.id === definition.unitId);
        const lessonIndex = bundle.course.units[unitIndex].lessons.findIndex((lesson) => lesson.id === definition.lessonId);
        const activityId = definition.segments[0].activityRef!;
        const activityIndex = bundle.course.units[unitIndex].lessons[lessonIndex].activities.findIndex((activity) => activity.id === activityId);
        assert(unitIndex >= 0 && lessonIndex >= 0 && activityIndex >= 0);
        const unitPath = "course.units[" + unitIndex + "]", lessonPath = unitPath + ".lessons[" + lessonIndex + "]";
        const location = (dimension === "unit" ? unitPath : dimension === "lesson" ? lessonPath : lessonPath + ".activities[" + activityIndex + "]") + ".capabilityRequirements[0]";
        const previous = bundle.course.capabilityRequests, privateBefore = JSON.stringify(bundle.coursePackage);
        const sqlState = async () => {
          const counts: Record<string, number | null> = {};
          for (const table of ["study_events", "exercise_attempts", "writing_submissions", "speaking_submissions"]) {
            const result = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", owner.id);
            assert(!result.error); counts[table] = result.count;
          }
          const receipts = await admin.from("interactive_lesson_receipts").select("attempt_id", { count: "exact", head: true }).eq("session_id", saved.sessionId);
          assert(!receipts.error); counts.receipts = receipts.count;
          return { row: await snapshot(), counts };
        };
        const before = await sqlState();
        bundle.course.capabilityRequests = [...(previous ?? []), {
          requirement: { id: "ai.tutor", version: "1.0.0", required: true }, location,
        }];
        try {
          assert.equal(JSON.stringify(bundle.coursePackage), privateBefore, "Metadata-only host block must not change the pinned hash");
          const projected = publicCourse(bundle.course, bundle.language);
          assert.ok(projected.availability?.unavailableActivityIds.includes(activityId), "Real projection must establish target unavailability");
          assert.equal(saved.runtime.segmentIndex, 0);
          assert.equal(saved.runtime.phase, "checkpoint", "Use an otherwise valid target, not an invalid completed-phase request");
          const objective = bundle.course.units[unitIndex].lessons[lessonIndex].activities[activityIndex];
          assert.equal(objective.type, "multiple_choice");
          const answer = objective.type === "multiple_choice" ? objective.answer : "";
          const read = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&lessonId=" + existing.lessonId));
          const attempted = await submit(input(answer));
          const persisted = await sessions.POST(request(endpoint, sessionBody(saved.runtime, saved.revision)));
          const after = await sqlState();
          assert.deepEqual(after, before, "Unavailable context must leave rows, native evidence, events and receipts unchanged");
          assert.equal(read.status, 200, "Own existing progress remains readable despite an operational capability block");
          const readBody = await read.json();
          assert.equal(readBody.session.id, saved.sessionId);
          assert.equal(readBody.session.revision, saved.revision);
          assert.deepEqual(readBody.session.runtime_state, saved.runtime);
          assert.equal(readBody.session.runtime_state.evidenceScope.userId, owner.id);
          const recovery = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&receipts=1"));
          assert.equal(recovery.status, 200, "Own authoritative receipts remain available for recovery");
          assert.deepEqual((await recovery.json()).receipts, [], "Reading cannot invent evidence before the first attempt");
          assert.deepEqual(await sqlState(), before, "Both recovery reads must remain read-only");
          assert.deepEqual([attempted.status, persisted.status], [503, 503], "Unavailable execution must reject both write paths");
        } finally { bundle.course.capabilityRequests = previous; }
      });
    }

    await check("VM+SQL forged completion is rejected without row change", async () => {
      const beforeRow = await snapshot(); const forged = { ...saved.runtime, phase: "completed",
        segmentIndex: definition.segments.length - 1, completedSegmentIds: definition.segments.map((item) => item.id),
        checkpointPassed: true, speakingSaved: true };
      const response = await sessions.POST(request(endpoint, sessionBody(forged as Runtime, saved.revision)));
      assert([400, 422].includes(response.status)); assert.deepEqual(await snapshot(), beforeRow);
    });

    await check("VM+SQL injected read failure is explicit and cannot overwrite existing session", async () => {
      const beforeRow = await snapshot();
      const readFault = {
        auth: owner.client.auth, rpc: owner.client.rpc.bind(owner.client),
        from: (table: string) => table === "interactive_lesson_sessions" ? {
          select() { return this; }, eq() { return this; },
          maybeSingle: async () => ({ data: null, error: { code: "QA_READ_FAULT", message: "Synthetic read failure" } }),
        } : owner.client.from(table),
      };
      fixture.client = readFault as unknown as SupabaseClient;
      try {
        assert.equal((await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&lessonId=" + existing.lessonId))).status, 503);
        assert.equal((await sessions.POST(request(endpoint, sessionBody(saved.runtime, saved.revision)))).status, 503);
        assert.equal((await submit(input("synthetic"))).status, 503);
        assert.deepEqual(await snapshot(), beforeRow);
      } finally { fixture.client = owner.client; }
    });
    await check("VM+SQL changed content version or private definition hash never falls back", async () => {
      const beforeRow = await snapshot(), oldVersion = bundle.coursePackage.contentVersion, oldTitle = bundle.coursePackage.title;
      try {
        bundle.coursePackage.contentVersion = "qa-different-version";
        const changed = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&lessonId=" + existing.lessonId));
        assert.equal(changed.status, 409); assert.deepEqual(await snapshot(), beforeRow);
        bundle.coursePackage.contentVersion = oldVersion;
        bundle.coursePackage.title = oldTitle + " synthetic hash mutation";
        const changedHash = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&lessonId=" + existing.lessonId));
        assert.equal(changedHash.status, 409); assert.deepEqual(await snapshot(), beforeRow);
      } finally { bundle.coursePackage.contentVersion = oldVersion; bundle.coursePackage.title = oldTitle; }
    });

    let firstReceipt!: ReturnType<typeof input>;
    await check("VM+SQL objective failure cannot advance; identical retry counts once", async () => {
      const failed = input("qa-deliberately-wrong-" + randomUUID()); firstReceipt = failed;
      const response = await submit(failed); assert.equal(response.status, 200);
      saved = await response.json() as Saved; assert.equal(saved.evidence?.accepted, false);
      assert.equal(saved.grade?.correct, false);
      assert.equal(reduceRuntime(definition, saved.runtime, { type: "NEXT", nextBoard: emptyBoard }).segmentIndex, 0);
      const beforeRow = await snapshot(); const repeated = await submit(failed); assert.equal(repeated.status, 200);
      assert.deepEqual(await snapshot(), beforeRow);
    });
    await check("VM+SQL same attempt divergent payload is rejected", async () => {
      const beforeRow = await snapshot(); const response = await submit({ ...firstReceipt, answer: "different" });
      assert.equal(response.status, 409); assert.deepEqual(await snapshot(), beforeRow);
    });
    await check("VM+SQL owner/session/segment/activity/version mismatches never write", async () => {
      for (const delta of [{ sessionId: randomUUID() }, { segmentId: definition.segments[1].id },
        { activityId: activities[1].id }, { contentVersion: "foreign-version" }, { revision: saved.revision - 1 }]) {
        const beforeRow = await snapshot(); const response = await submit({ ...input("synthetic"), ...delta });
        assert(response.status >= 400); assert.deepEqual(await snapshot(), beforeRow);
      }
      fixture.client = other.client;
      const beforeRow = await snapshot(); const response = await submit(input("synthetic"));
      assert(response.status >= 400); assert.deepEqual(await snapshot(), beforeRow);
      fixture.client = owner.client;
    });
    await check("VM+SQL invalid text/size/type boundaries reject before evidence write", async () => {
      for (const answer of ["x".repeat(3001), "\ud800", 42]) {
        const beforeRow = await snapshot(); const response = await submit({ ...input(""), answer });
        assert(response.status >= 400); assert.deepEqual(await snapshot(), beforeRow);
      }
      const huge = new Request(localApp + "/api/interactive-lessons/segment", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: " ".repeat(750001) });
      assert.equal((await segments.POST(huge)).status, 413);
    });
    for (let index = 0; index < definition.segments.length; index++) {
      await check("VM+SQL independent segment submission and progress: " + definition.segments[index].id, async () => {
        const activity = activities[index];
        const privateActivity = bundle.course.units.flatMap((unit) => unit.lessons).flatMap((lesson) => lesson.activities).find((entry) => entry.id === activity.id)!;
        const body = input(privateActivity.type === "multiple_choice" ? privateActivity.answer : "Synthetic learner submission");
        let response: Response;
        if (definition.segments[index].type === "speaking") {
          const postAudio = async (audio: Buffer) => {
            const form = new FormData(); Object.entries(body).forEach(([key, value]) => form.set(key, String(value)));
            form.set("audio", new File([new Uint8Array(audio)], "synthetic.wav", { type: "audio/wav" }));
            return segments.POST(new Request(localApp + "/api/interactive-lessons/segment", { method: "POST", body: form }));
          };
          const beforeRow = await snapshot();
          for (const audio of [Buffer.from("invalid"), wav(700002), wav(640046), (() => { const bad = wav(); bad.writeUInt32LE(1, 4); return bad; })()]) {
            assert((await postAudio(audio)).status >= 400); assert.deepEqual(await snapshot(), beforeRow);
          }
          response = await postAudio(index === 2 ? wav(640044) : wav());
        } else response = await submit(body);
        assert.equal(response.status, 200); saved = await response.json() as Saved;
        assert.equal(saved.evidence?.segmentId, definition.segments[index].id); assert.equal(saved.evidence?.accepted, true);
        if (activity.type !== "multiple_choice") assert.equal(saved.grade, undefined, "Submission is not an objective score");
        const advanced = reduceRuntime(definition, saved.runtime, { type: "NEXT", nextBoard: emptyBoard });
        const persisted = await sessions.POST(request(endpoint, sessionBody(advanced, saved.revision)));
        assert.equal(persisted.status, 200); saved = await persisted.json() as Saved;
        const reloaded = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&lessonId=" + existing.lessonId));
        assert.equal(reloaded.status, 200); const roundtrip = await reloaded.json();
        assert.deepEqual(roundtrip.session.runtime_state, saved.runtime);
        if (index === 0) {
          const replayBefore = await snapshot(), replay = await submit(firstReceipt);
          assert.equal(replay.status, 200); const result = await replay.json();
          assert.equal(result.runtime.segmentIndex, saved.runtime.segmentIndex);
          assert.deepEqual(await snapshot(), replayBefore, "Old receipt replay cannot rewind later state");
        }
      });
    }
    await check("VM+SQL final state needs all five independent proofs", async () => {
      assert.equal(saved.runtime.phase, "completed");
      const row = await snapshot(); assert.equal(row.status, "completed");
      assert.equal(Object.keys((saved.runtime as Runtime & { segmentEvidence: object }).segmentEvidence).length, 5);
    });

    await check("VM+SQL reviewing preserves prior proof but a new wrong attempt stays explicitly wrong", async () => {
      const oldProof = (saved.runtime as Runtime & { segmentEvidence: Record<string, QaEvidence> }).segmentEvidence[definition.segments[0].id];
      const restored = reduceRuntime(definition, saved.runtime, { type: "RESTORE", state: {
        ...saved.runtime, phase: "checkpoint", segmentIndex: 0, positionMs: 0, completedSegmentIds: [],
      } });
      const opened = await sessions.POST(request(endpoint, sessionBody(restored, saved.revision)));
      assert.equal(opened.status, 200); saved = await opened.json() as Saved;
      const wrongInput = input("qa-new-incorrect-review-" + randomUUID());
      const wrongResponse = await submit(wrongInput); assert.equal(wrongResponse.status, 200);
      saved = await wrongResponse.json() as Saved;
      assert.equal(saved.evidence?.accepted, false); assert.equal(saved.grade?.correct, false);
      const preserved = (saved.runtime as Runtime & { segmentEvidence: Record<string, QaEvidence> }).segmentEvidence[definition.segments[0].id];
      assert.equal(preserved.attemptId, oldProof.attemptId, "Old valid proof survives, not a new passing grade");
      assert.notEqual(preserved.attemptId, wrongInput.attemptId);
      let completed = saved.runtime;
      for (let index = 0; index < definition.segments.length; index++) completed = reduceRuntime(definition, completed, { type: "NEXT", nextBoard: emptyBoard });
      assert.equal(completed.phase, "completed");
      const closed = await sessions.POST(request(endpoint, sessionBody(completed, saved.revision)));
      assert.equal(closed.status, 200); saved = await closed.json() as Saved;
    });



    for (const dimension of ["unit", "lesson"] as const) {
      await check("VM+SQL inactive " + dimension + " is denied without fallback or row change", async () => {
        const ownerUnit = bundle.course.units.find((unit) => unit.id === definition.unitId)!;
        const ownerLesson = ownerUnit.lessons.find((lesson) => lesson.id === definition.lessonId)!;
        const target = dimension === "unit" ? ownerUnit : ownerLesson;
        const priorActive = target.active, privateBefore = JSON.stringify(bundle.coursePackage), beforeRow = await snapshot();
        target.active = false;
        try {
          assert.equal(JSON.stringify(bundle.coursePackage), privateBefore, "Change only host projection; do not let a hash conflict mask the active-context guard");
          const response = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&lessonId=" + existing.lessonId));
          assert([400, 404, 422, 503].includes(response.status), "Inactive context is an explicit refusal, not a successful session read");
          const changed = await sessions.POST(request(endpoint, sessionBody(saved.runtime, saved.revision)));
          assert([400, 404, 422, 503].includes(changed.status));
          const attempt = await submit(input("synthetic"));
          assert([400, 404, 422, 503].includes(attempt.status));
          const receipts = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&receipts=1"));
          if (receipts.status === 200) assert.deepEqual((await receipts.json()).receipts, []);
          else assert([400, 404, 422, 503].includes(receipts.status));
          assert.deepEqual(await snapshot(), beforeRow);
        } finally { target.active = priorActive; }
      });
    }

    await check("VM+SQL own receipt API recovers general progress after closing before flush", async () => {
      const response = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&receipts=1"));
      assert.equal(response.status, 200);
      const data = await response.json();
      const { interactiveLessonProgressReceiptSchema } = await import(pathToFileURL(resolve("src/domain/interactive-lesson/progress-receipt.ts")).href);
      const { SupabaseStudyRepository } = await import("../src/repositories/supabase-study-repository");
      const { publicCourse } = await import("../src/content/public");
      const receipts = data.receipts.map((value: unknown) => interactiveLessonProgressReceiptSchema.parse(value));
      assert(receipts.length >= 6);
      for (const receipt of receipts) {
        assert.equal(receipt.evidence.userId, owner.id);
        assert.equal(receipt.evidence.courseId, raw.course.id);
        assert.equal(receipt.evidence.contentVersion, raw.course.contentVersion);
        assert.equal(receipt.evidence.sessionId, saved.sessionId);
        const encoded = JSON.stringify(receipt);
        for (const field of ["audioBase64", "audioPath", "audioUrl", "fullAnswers", "answerPolicy"])
          assert.equal(encoded.includes('"' + field + '":'), false);
      }
      const target = publicCourse(bundle.course, bundle.language);
      const repository = new SupabaseStudyRepository(owner.client, owner.id, undefined, { course: target, load: async () => receipts });
      const recovered = await repository.load(raw.course.id, bundle.language.id);
      assert(recovered);
      const objectiveIds = receipts.filter((entry: { evidence: { kind: string } }) => entry.evidence.kind === "objective_correct").map((entry: { evidence: { attemptId: string } }) => entry.evidence.attemptId);
      assert.equal(recovered.attempts.filter((attempt) => objectiveIds.includes(attempt.id)).length, objectiveIds.length);
      assert.equal(recovered.writing.filter((attempt) => receipts.some((receipt: { evidence: { attemptId: string } }) => receipt.evidence.attemptId === attempt.id)).length, 1);
      assert.equal(recovered.speaking.filter((attempt) => receipts.some((receipt: { evidence: { attemptId: string } }) => receipt.evidence.attemptId === attempt.id)).length, 2);
      const reloaded = await repository.load(raw.course.id, bundle.language.id);
      assert.deepEqual(reloaded, recovered);
      const persisted = await owner.client.from("user_course_state").select("state").eq("user_id", owner.id).eq("course_id", raw.course.id).maybeSingle();
      assert(!persisted.error);
      assert(!persisted.data || !persisted.data.state.attempts?.some((attempt: { id: string }) => objectiveIds.includes(attempt.id)),
        "The test recovered before saving the browser study snapshot");
      fixture.client = other.client;
      try {
        const foreign = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&receipts=1"));
        assert.equal(foreign.status, 200); assert.deepEqual((await foreign.json()).receipts, []);
      } finally { fixture.client = owner.client; }
    });

    await check("LOCAL RLS denies foreign reads and authenticated direct insert/update", async () => {
      const foreign = await other.client.from("interactive_lesson_sessions").select("id").eq("id", saved.sessionId);
      assert(!foreign.error); assert.deepEqual(foreign.data, []);
      const beforeRow = await snapshot();
      const updated = await owner.client.from("interactive_lesson_sessions").update({ runtime_state: {}, status: "completed" }).eq("id", saved.sessionId).select("id");
      assert(updated.error || updated.data?.length === 0); assert.deepEqual(await snapshot(), beforeRow);
      const inserted = await other.client.from("interactive_lesson_sessions").insert({ ...beforeRow, id: randomUUID(), user_id: other.id }).select("id");
      assert(inserted.error); assert.equal(await snapshot(other.id), null);
    });
    await check("LOCAL RPC denies authenticated and anonymous privileged write bypass", async () => {
      const anonymous = createClient(localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
      for (const client of [owner.client, anonymous]) {
        const beforeRow = await snapshot(); const result = await client.rpc("save_interactive_lesson_session", {
          p_user_id: owner.id, p_session_id: saved.sessionId, p_course_id: raw.course.id,
          p_lesson_id: existing.lessonId, p_content_version: raw.course.contentVersion,
          p_definition_hash: saved.runtime.evidenceScope?.definitionHash, p_expected_revision: saved.revision,
          p_runtime: saved.runtime, p_attempt: null,
        });
        assert(result.error); assert.deepEqual(await snapshot(), beforeRow);
      }
    });
    await check("VM+SQL current state CAS rejects concurrent stale overwrite", async () => {
      const body = sessionBody(saved.runtime, saved.revision);
      const results = await Promise.all([sessions.POST(request(endpoint, body)), sessions.POST(request(endpoint, body))]);
      assert.deepEqual(results.map((response) => response.status).sort(), [200, 409]);
    });
    await check("LOCAL MFA authenticated AAL1 cannot read/operate after verified factor; AAL2 can", async () => {
      const aal1 = createClient(localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
      assert(!(await aal1.auth.signInWithPassword({ email: owner.email, password: owner.password })).error);
      const enrolled = await owner.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "F4 independent synthetic" });
      assert(!enrolled.error && enrolled.data.type === "totp");
      const verified = await owner.client.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: totp(enrolled.data.totp.secret) });
      assert(!verified.error);
      fixture.client = aal1;
      const blocked = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&lessonId=" + existing.lessonId));
      assert.equal(blocked.status, 401);
      const denied = await aal1.from("interactive_lesson_sessions").select("id").eq("id", saved.sessionId);
      assert(denied.error || denied.data?.length === 0);
      fixture.client = owner.client;
      const allowed = await sessions.GET!(request(endpoint + "?courseId=" + raw.course.id + "&lessonId=" + existing.lessonId));
      assert.equal(allowed.status, 200);
    });
    assert.deepEqual(hashes(), before); assert.equal(externalAttempts, 0);
    console.log(JSON.stringify({ passed: true, checks, candidateRoot: process.cwd(), hashes: before, isolation,
      externalAttempts, retainedSyntheticUsers, limitations: [
        "VM executes real candidate handlers against real local Auth/MFA and SQL, with synthetic catalog.",
        "Does not certify HTTP cookies/proxy/browser; Lead runs that journey separately.",
        "Synthetic WAV proves saved submission validation only, not STT/pronunciation or acoustic quality.",
      ] }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ passed: false, checks, retainedSyntheticUsers, externalAttempts }));
    throw error;
  } finally { globalThis.fetch = originalFetch; }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
