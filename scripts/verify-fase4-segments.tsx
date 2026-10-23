import { readFileSync } from "node:fs";
import ts from "typescript";
import { validWav } from "../src/lib/azure-speech";
import { segmentInputSchema } from "../src/domain/interactive-lesson/session-state";
import { LessonIntegrityError } from "../src/domain/interactive-lesson/integrity";
import { assertWellFormedText } from "../src/engine/text/representation";
import { readBoundedLessonBody } from "../src/domain/interactive-lesson/request-body";
import { initialStudyState, recordInteractiveLessonReceipt } from "../src/domain/study/study-state";
import { SupabaseStudyRepository } from "../src/repositories/supabase-study-repository";
import type { PublicCourse } from "../src/content/public";
import { interactiveLessonProgressReceiptSchema, type InteractiveLessonProgressReceipt } from "../src/domain/interactive-lesson/progress-receipt";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { InteractiveLessonDefinition } from "../src/content/contracts";
import { initialRuntime, reduceRuntime, type LessonRuntimeState } from "../src/domain/interactive-lesson/runtime";
import { recoverLegacyRuntime, validateRuntimeProgress } from "../src/domain/interactive-lesson/integrity";
import { canonicalJson, type LessonEvidenceScope, type SegmentEvidence } from "../src/domain/interactive-lesson/evidence";
import { runtimeSchema } from "../src/domain/interactive-lesson/session-state";
import { deriveLessonEvents } from "../src/domain/interactive-lesson/telemetry";
import { gradeActivity } from "../src/domain/activities/grader";
import { evaluateWritingText } from "../src/engine/text/representation";

const definition: InteractiveLessonDefinition = {
  id: "synthetic-interactive", courseId: "synthetic-course", unitId: "synthetic-unit", lessonId: "synthetic-lesson",
  title: "Synthetic independent steps", objectives: ["test"], concepts: [], skills: ["grammar"], estimatedMinutes: 4,
  alternativeExamples: [], segments: (["checkpoint", "checkpoint", "speaking", "speaking", "summary"] as const).map((type, index) => ({
    id: "step-" + index, title: "Step " + index, type, activityRef: type === "summary" ? undefined : "activity-" + index,
    objectives: [], concepts: [], cues: [], required: type !== "summary", allowInterruption: true, resumeAnchorsMs: [0],
  })),
};
const scope: LessonEvidenceScope = { userId: randomUUID(), courseId: definition.courseId, lessonId: definition.lessonId,
  sessionId: randomUUID(), contentVersion: "test-1", definitionHash: "c".repeat(64) };
let sequence = 0;
function proof(state: LessonRuntimeState, accepted: boolean): SegmentEvidence {
  const segment = definition.segments[state.segmentIndex];
  return { ...scope, segmentId: segment.id, activityId: segment.activityRef!, attemptId: randomUUID(), sequence: ++sequence,
    kind: segment.type === "speaking" ? "speaking_submitted" : "objective_correct", accepted };
}
let checks = 0;
const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };
let state = reduceRuntime(definition, initialRuntime(definition, scope), { type: "START" });
check(state.phase === "checkpoint", "starts at first checkpoint");
check(reduceRuntime(definition, { ...state, checkpointPassed: true }, { type: "NEXT", nextBoard: state.board }).segmentIndex === 0,
  "forged global flag cannot pass required segment");
for (const field of ["userId", "courseId", "lessonId", "sessionId", "contentVersion", "definitionHash", "segmentId", "activityId"] as const) {
  const wrong = { ...proof(state, true), [field]: "wrong" };
  check(reduceRuntime(definition, state, { type: "SEGMENT_EVIDENCE", evidence: wrong }) === state, "rejects wrong " + field);
}
const failure = proof(state, false);
state = reduceRuntime(definition, state, { type: "SEGMENT_EVIDENCE", evidence: failure });
check(!state.checkpointPassed && state.checkpointFailures === 1, "failure stays failure");
check(reduceRuntime(definition, state, { type: "SEGMENT_EVIDENCE", evidence: failure }) === state, "retry does not duplicate failure");
const passed = proof(state, true);
const before = state;
state = reduceRuntime(definition, state, { type: "SEGMENT_EVIDENCE", evidence: passed });
check(state.checkpointPassed, "new valid attempt can pass");
check(deriveLessonEvents(before, state, definition).some((event) => event.type === "lesson.checkpoint.passed"), "first checkpoint telemetry");
check(reduceRuntime(definition, state, { type: "SEGMENT_EVIDENCE", evidence: failure }) === state, "stale failure cannot change success");
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: state.board });
check(!state.checkpointPassed && state.segmentIndex === 1, "checkpoint A cannot pass B");
check(reduceRuntime(definition, state, { type: "NEXT", nextBoard: state.board }).segmentIndex === 1, "B still blocks");
const saved = JSON.parse(JSON.stringify(state));
state = reduceRuntime(definition, initialRuntime(definition, scope), { type: "RESTORE", state: saved });
check(canonicalJson(state) === canonicalJson(saved), "round trip preserves current required checkpoint");
const secondBefore = state;
state = reduceRuntime(definition, state, { type: "SEGMENT_EVIDENCE", evidence: proof(state, true) });
check(deriveLessonEvents(secondBefore, state, definition).some((event) => event.segmentId === "step-1" && event.type === "lesson.checkpoint.passed"), "second checkpoint telemetry retained");
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: state.board });
check(!state.speakingSaved, "first speaking starts without evidence");
state = reduceRuntime(definition, state, { type: "SEGMENT_EVIDENCE", evidence: proof(state, true) });
check(state.speakingSaved, "first speaking accepts delivered evidence");
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: state.board });
check(!state.speakingSaved, "speaking A cannot release B");
check(reduceRuntime(definition, state, { type: "NEXT", nextBoard: state.board }).segmentIndex === 3, "second speaking blocks");
const speechBefore = state;
state = reduceRuntime(definition, state, { type: "SEGMENT_EVIDENCE", evidence: proof(state, true) });
check(deriveLessonEvents(speechBefore, state, definition).some((event) => event.type === "lesson.speaking.attempted" && event.segmentId === "step-3"), "second speaking telemetry retained");
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: state.board });
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: state.board });
check(state.phase === "completed", "all required segments allow completion");
validateRuntimeProgress(definition, state, state, scope); checks++;
check(runtimeSchema.safeParse(state).success, "persisted schema accepts scoped runtime");
const review = reduceRuntime(definition, initialRuntime(definition, scope), { type: "RESTORE",
  state: { ...initialRuntime(definition, scope), segmentEvidence: state.segmentEvidence, segmentFailures: state.segmentFailures,
    segmentAttemptSequences: state.segmentAttemptSequences } });
const reviewing = reduceRuntime(definition, review, { type: "START" });
const secondReview = reduceRuntime(definition, reviewing, { type: "NEXT", nextBoard: reviewing.board });
check(secondReview.checkpointPassed && secondReview.segmentIndex === 1, "review projects existing verified evidence for its current step");
validateRuntimeProgress(definition, secondReview, state, scope); checks++;
const nextTrial = proof(secondReview, true);
const retried = reduceRuntime(definition, secondReview, { type: "SEGMENT_EVIDENCE", evidence: nextTrial });
check(retried.segmentAttemptSequences["step-1"] === nextTrial.sequence, "review allows a new valid attempt without deleting history");
const forged = structuredClone(state); delete forged.segmentEvidence["step-1"];
assert.throws(() => validateRuntimeProgress(definition, state, forged, scope)); checks++;
assert.throws(() => validateRuntimeProgress(definition, { ...state, segmentEvidence: {} }, state, scope)); checks++;
const legacy = recoverLegacyRuntime(definition, scope);
check(legacy.segmentIndex === 0 && !legacy.checkpointPassed && Object.keys(legacy.segmentEvidence).length === 0, "legacy flags do not become evidence");
const restoredLegacy = reduceRuntime(definition, initialRuntime(definition, scope), { type: "RESTORE",
  state: { ...legacy, schemaVersion: 1, checkpointPassed: true, speakingSaved: true } as unknown as LessonRuntimeState });
check(!restoredLegacy.checkpointPassed && !restoredLegacy.speakingSaved, "legacy restore ignores global booleans");
const written = evaluateWritingText("one two three", { minWords: 3 });
check(written.accepted, "writing reuses submitted-text measurement without inventing objective correctness");
const objective = gradeActivity({ id: "synthetic-objective", type: "short_answer", accepted: ["alpha"], answer: "alpha" } as Parameters<typeof gradeActivity>[0], "beta");
check(objective?.correct === false, "reuses existing objective grader");


async function verifyRecoveryAndBounds() {
  const course = { id: scope.courseId, contentVersion: scope.contentVersion, languageCode: "xx",
    units: [{ lessons: [{ id: scope.lessonId, activities: [
      { id: "activity-0", type: "short_answer", skill: "grammar", conceptIds: [] },
      { id: "activity-2", type: "speaking", skill: "speaking", conceptIds: [] },
    ] }] }] } as unknown as PublicCourse;
  const recordingIds = Object.fromEntries(["mistake:activity-0", "schedule:activity-0", "event:exercise_wrong:activity-0", "event:exercise_answered:activity-0", "event:lesson_completed:activity-2"]
    .map((key) => [key, randomUUID()]));
  const receipt: InteractiveLessonProgressReceipt = { evidence: { ...scope, segmentId: "step-0", activityId: "activity-0",
    attemptId: randomUUID(), sequence: 1, kind: "objective_correct", accepted: false }, answer: "beta",
    createdAt: "2026-10-23T00:00:00.000Z", grade: { correct: false, correctAnswer: "alpha", explanation: "Try again" }, recordingIds };
  const blank = { ...structuredClone(initialStudyState), courseId: scope.courseId, languageCode: "xx" };
  const projected = recordInteractiveLessonReceipt(blank, course, receipt);
  check(projected.attempts[0].id === receipt.evidence.attemptId && projected.attempts[0].interactiveReceipt, "receipt preserves native attempt identity");
  check(recordInteractiveLessonReceipt(projected, course, receipt) === projected, "progress retry is idempotent");
  check(projected.mistakes["activity-0"].timesMissed === 1, "single receipt increments mistake once");
  // Closing immediately after server ACK can leave no user_course_state row. Replay still restores the attempt.
  const db = { from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) }; return query; } };
  const repository = new SupabaseStudyRepository(db as unknown as ConstructorParameters<typeof SupabaseStudyRepository>[0], scope.userId,
    undefined, { course, load: async () => [receipt] });
  const recovered = await repository.load(scope.courseId, "xx");
  check(recovered?.attempts[0].id === receipt.evidence.attemptId, "close before flush recovers from trusted receipt on load");
  check(recovered?.mistakes["activity-0"].timesMissed === 1, "recovery does not duplicate errors");
  const unreadable = new SupabaseStudyRepository(db as unknown as ConstructorParameters<typeof SupabaseStudyRepository>[0], scope.userId,
    undefined, { course, load: async () => { throw new Error("read failed"); } });
  await assert.rejects(unreadable.load(scope.courseId, "xx"), /read failed/); checks++;
  const spoken: InteractiveLessonProgressReceipt = { ...receipt, evidence: { ...receipt.evidence,
    attemptId: randomUUID(), segmentId: "step-2", activityId: "activity-2", accepted: true, kind: "speaking_submitted" }, grade: undefined };
  const delivered = recordInteractiveLessonReceipt(projected, course, spoken);
  check(delivered.speaking[0].audioUrl === null && !delivered.speaking[0].audioPath && !delivered.speaking[0].feedback,
    "public replay contains no private audio path or invented acoustic score");
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(6)); controller.enqueue(new Uint8Array(6)); }, cancel() { cancelled = true; } });
  const request = new Request("http://localhost/body", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readBoundedLessonBody(request, 10), (error: unknown) => error instanceof Error && "status" in error && error.status === 413); checks++;
  check(cancelled, "oversize chunked body is cancelled without trusting Content-Length");
  const bounded = await readBoundedLessonBody(new Request("http://localhost/body", { method: "POST", body: "safe" }), 4);
  check(new TextDecoder().decode(bounded) === "safe", "exact byte bound accepted");
  await verifyWavDurationHandler();
  console.log("B1 technical checks: " + checks + " passed; no database, browser or provider calls.");
}
verifyRecoveryAndBounds().catch((error) => { console.error(error); process.exitCode = 1; });

// Execute the actual POST handler with in-memory ports; no database or provider is available.
async function verifyWavDurationHandler() {
  let writes = 0;
  const speechState = { ...initialRuntime(definition, scope), segmentIndex: 2, phase: "speaking" as const };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) };
  const context = { bundle: { coursePackage: { contentVersion: scope.contentVersion }, language: {}, course: {} },
    definition, lesson: { activities: [{ id: "activity-2", type: "speaking" }] } };
  let resolveContext: () => unknown = () => context;
  const ports: Record<string, unknown> = {
    "@/domain/interactive-lesson/request-body": { readBoundedLessonBody },
    "next/server": { NextResponse: { json: (value: unknown, options?: ResponseInit) => Response.json(value, options) } },
    "@/lib/supabase/server": { getAuthenticatedUser: async () => ({ id: scope.userId }) },
    "@/lib/versioned-operation-guard": { unsupportedVersionScope: () => null },
    "@/domain/activities/grader": { gradeActivity },
    "@/engine/text/representation": { evaluateWritingText, assertWellFormedText },
    "@/lib/user-course-variant": { userCourseVariant: async () => undefined },
    "@/lib/azure-speech": { validWav },
    "@/domain/interactive-lesson/integrity": { LessonIntegrityError },
    "@/domain/interactive-lesson/runtime": { reduceRuntime },
    "@/domain/interactive-lesson/session-state": { segmentInputSchema },
    "@/domain/interactive-lesson/server": {
      assertCompiledLessonSelected: async () => undefined, assertLessonAvailable: () => undefined,
      authenticatedLessonDb: async () => ({}), digestLessonInput: () => "a".repeat(64),
      lessonWriter: () => ({ from: () => query }), readLessonSession: async () => ({ id: scope.sessionId, revision: 1 }),
      resolveLessonContext: () => resolveContext(), sessionScope: () => scope, trustedSessionRuntime: () => speechState,
      saveLessonSession: async (_writer: unknown, _scope: unknown, _revision: unknown, runtime: unknown) => {
        writes++; return { sessionId: scope.sessionId, revision: 2, runtime };
      }, publicProgressReceipt: () => { throw new Error("Unexpected receipt replay"); },
    },
  };
  const source = readFileSync("src/app/api/interactive-lessons/segment/route.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const handlerModule = { exports: {} as { POST?: (request: Request) => Promise<Response> } };
  new Function("require", "module", "exports", compiled)((name: string) => {
    if (!(name in ports)) throw new Error("Unexpected handler dependency: " + name);
    return ports[name];
  }, handlerModule, handlerModule.exports);
  const handler = handlerModule.exports.POST!;
  function wav(samples: number) {
    const dataBytes = samples * 2;
    const audio = Buffer.alloc(44 + dataBytes);
    audio.write("RIFF", 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write("WAVE", 8);
    audio.write("fmt ", 12); audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20);
    audio.writeUInt16LE(1, 22); audio.writeUInt32LE(16000, 24); audio.writeUInt32LE(32000, 28);
    audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write("data", 36);
    audio.writeUInt32LE(dataBytes, 40);
    return audio;
  }
  for (const [samples, expectedStatus] of [[320000, 200], [320001, 400], [336000, 400]] as const) {
    const form = new FormData();
    const input = { courseId: scope.courseId, lessonId: scope.lessonId, contentVersion: scope.contentVersion,
      sessionId: scope.sessionId, revision: "1", segmentId: "step-2", activityId: "activity-2", attemptId: randomUUID(), answer: "self-reported" };
    for (const [key, value] of Object.entries(input)) form.append(key, value);
    const audio = wav(samples);
    form.append("audio", new Blob([audio], { type: "audio/wav" }), "duration.wav");
    const before = writes;
    const response = await handler(new Request("http://localhost/api/interactive-lessons/segment", { method: "POST", body: form }));
    check(response.status === expectedStatus, "actual handler duration boundary " + audio.length + " bytes: expected " + expectedStatus + ", received " + response.status);
    check(writes - before === (expectedStatus === 200 ? 1 : 0), "invalid duration never persists a receipt or attempt");
    if (expectedStatus !== 200) check((await response.json()).error === "LESSON_INVALID_AUDIO", "duration rejection is explicit invalid audio");
  }
  // Load the actual private resolver too, with a synthetic catalog and no live clients.
  const activeLesson = { id: scope.lessonId, active: true, interactiveLessonRef: definition.id,
    activities: [{ id: "activity-2", type: "speaking" }] };
  const activeUnit = { id: definition.unitId, active: true, lessons: [activeLesson] };
  const bundle = { course: { id: scope.courseId, units: [activeUnit] }, language: {},
    coursePackage: { contentVersion: scope.contentVersion, interactiveLessons: [definition] } };
  const resolverPorts: Record<string, unknown> = {
    "server-only": {}, "node:crypto": { createHash, randomUUID },
    "@supabase/supabase-js": { createClient: () => { throw new Error("No live client in handler test"); } },
    "@/content/course-registry": { findCourseBundle: () => bundle },
    "@/content/public": {}, "@/lib/supabase/server": {}, "./progress-receipt": { interactiveLessonProgressReceiptSchema },
    "./evidence": { canonicalJson }, "./integrity": { LessonIntegrityError, recoverLegacyRuntime },
    "./runtime": { initialRuntime }, "./session-state": { runtimeSchema },
  };
  const resolverSource = readFileSync("src/domain/interactive-lesson/server.ts", "utf8");
  const resolverCompiled = ts.transpileModule(resolverSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const resolverModule = { exports: {} as { resolveLessonContext?: (courseId: string, lessonId: string) => unknown } };
  new Function("require", "module", "exports", resolverCompiled)((name: string) => {
    if (!(name in resolverPorts)) throw new Error("Unexpected resolver dependency: " + name);
    return resolverPorts[name];
  }, resolverModule, resolverModule.exports);
  resolveContext = () => resolverModule.exports.resolveLessonContext!(scope.courseId, scope.lessonId);
  check(Boolean(resolveContext()), "actual resolver accepts active owner unit and lesson");
  for (const inactive of [activeUnit, activeLesson]) {
    inactive.active = false;
    const form = new FormData();
    const input = { courseId: scope.courseId, lessonId: scope.lessonId, contentVersion: scope.contentVersion,
      sessionId: scope.sessionId, revision: "1", segmentId: "step-2", activityId: "activity-2", attemptId: randomUUID(), answer: "self-reported" };
    for (const [key, value] of Object.entries(input)) form.append(key, value);
    form.append("audio", new Blob([wav(320000)], { type: "audio/wav" }), "active.wav");
    const before = writes;
    const response = await handler(new Request("http://localhost/api/interactive-lessons/segment", { method: "POST", body: form }));
    check(response.status === 404, "actual handler/resolver rejects inactive owner unit or lesson");
    check(writes === before, "inactive curriculum never persists a receipt or attempt");
    inactive.active = true;
  }

}
