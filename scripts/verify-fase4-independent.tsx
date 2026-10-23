import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import type { PublicCourse } from "../src/content/public";







import { multiSegmentLesson, providerCallbackFixture, renderAssessmentShell, renderNumberGuide, qaEvidence, qaScope, type QaEvidence, QA_NOW, stateWithDueMistake } from "./fase4-qa-fixtures";

type Runtime = import("../src/domain/interactive-lesson/runtime").LessonRuntimeState;

const checks: Array<{ name: string; passed: boolean; error?: string }> = [];
async function check(name: string, run: () => void | Promise<void>) {
  try { await run(); checks.push({ name, passed: true }); console.log("PASS " + name); }
  catch (error) { checks.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }); console.log("FAIL " + name); }
}
async function main() {
  const root = resolve(process.env.FASE4_CANDIDATE_ROOT ?? process.cwd());
  assert.equal(root.toLowerCase(), resolve(process.cwd()).toLowerCase(), "Run from candidate cwd so aliases resolve to candidate");
  const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const selectedTrack = process.argv.includes("--track=B") ? "B" : process.argv.includes("--track=A") ? "A" : "both";
  const candidate = <T,>(path: string) => import(pathToFileURL(resolve(root, path)).href) as Promise<T>;
  const { initialRuntime, emptyBoard, reduceRuntime: runtimeReducer } = await candidate<typeof import("../src/domain/interactive-lesson/runtime")>("src/domain/interactive-lesson/runtime.ts");
  const reduceRuntime = runtimeReducer as unknown as (definition: ReturnType<typeof multiSegmentLesson>, state: Runtime, event: Record<string, unknown>) => Runtime;
  const { deriveLessonEvents } = await candidate<typeof import("../src/domain/interactive-lesson/telemetry")>("src/domain/interactive-lesson/telemetry.ts");
  const { loadContent } = await candidate<typeof import("./content-loader")>("scripts/content-loader.ts");
  const { publicCourse } = await candidate<typeof import("../src/content/public")>("src/content/public.ts");
  const { runtimeBundle } = await candidate<typeof import("../src/content/runtime-package")>("src/content/runtime-package.ts");
  const { buildLearningProfile } = await candidate<typeof import("../src/domain/study/learning-profile")>("src/domain/study/learning-profile.ts");
  const { LearningRecommendationEngine } = await candidate<typeof import("../src/domain/study/learning-recommendation-engine")>("src/domain/study/learning-recommendation-engine.ts");
  const paths = [
    "src/domain/interactive-lesson/runtime.ts",
    "src/domain/interactive-lesson/telemetry.ts",
    "src/domain/study/learning-recommendation-engine.ts",
    "scripts/verify-fase4-independent.tsx", "scripts/fase4-qa-fixtures.ts",
  ];
  for (const path of ["src/domain/interactive-lesson/integrity.ts", "src/domain/interactive-lesson/evidence.ts",
    "src/domain/interactive-lesson/session-state.ts", "src/domain/interactive-lesson/request-body.ts",
    "src/domain/interactive-lesson/progress-receipt.ts", "src/domain/study/study-state.ts",
    "src/components/study-provider.tsx", "src/repositories/supabase-study-repository.ts",
    "src/domain/study/learning-action-availability.ts", "src/engine/capabilities/availability-projection.ts",
    "src/domain/study/study-planner.ts", "src/content/public.ts", "src/components/layout/app-shell.tsx",
    "src/components/basics/number-guide.tsx", "src/lib/client-capabilities.ts"]) if (existsSync(resolve(root, path))) paths.push(path);
  const candidateManifests = [
    [".tmp/fase4-motor/candidate3.json", ".tmp/fase4-motor/candidate2.json", ".tmp/fase4-motor/candidate.json"],
    [".tmp/phase4-b1/final-manifest.json"],
    [".tmp/fase4-cycle/a3-candidate.json", ".tmp/fase4-cycle/a2-candidate.json", ".tmp/fase4-cycle/a-candidate.json"],
    [".tmp/fase4-cycle/b2-candidate.json", ".tmp/fase4-cycle/b-candidate.json"],
  ].flatMap((versions) => {
    const path = versions.find((entry) => existsSync(resolve(root, entry)));
    return path ? [path] : [];
  }).map((path) => {
      const value = JSON.parse(readFileSync(resolve(root, path), "utf8"));
      return { path, candidate: value.candidate, digest: value.digest };
    });
  const hashes = () => paths.map((path) => ({ path, sha256: createHash("sha256").update(readFileSync(resolve(path.startsWith("scripts/verify-fase4") || path === "scripts/fase4-qa-fixtures.ts" ? sourceRoot : root, path))).digest("hex") }));
  const before = hashes();
  const lesson = multiSegmentLesson();
  const initialize = initialRuntime as unknown as (definition: typeof lesson, scope: ReturnType<typeof qaScope>) => Runtime;
  const start = () => reduceRuntime(lesson, initialize(lesson, qaScope()), { type: "START" });
  const submit = (state: Runtime, segmentId: string, sequence: number, accepted = true, changed: Partial<QaEvidence> = {}) => {
    if ("segmentEvidence" in state) return (reduceRuntime as unknown as (definition: typeof lesson, state: Runtime, event: { type: string; evidence: QaEvidence }) => Runtime)(lesson, state, { type: "SEGMENT_EVIDENCE", evidence: { ...qaEvidence(segmentId, sequence, accepted), ...changed } });
    const segment = lesson.segments.find((entry) => entry.id === segmentId)!;
    return segment.type === "speaking" ? reduceRuntime(lesson, state, { type: "SPEAKING_SAVED" }) : reduceRuntime(lesson, state, { type: "CHECKPOINT_RESULT", correct: accepted });
  };
  const next = (state: Runtime) => reduceRuntime(lesson, state, { type: "NEXT", nextBoard: { ...emptyBoard } });
  if (selectedTrack !== "A") {
  await check("B: fixture requires two independent checkpoints and two independent speeches", () => {
    assert.equal(lesson.segments.filter((entry) => entry.type === "checkpoint" && entry.required).length, 3);
    assert.equal(lesson.segments.filter((entry) => entry.type === "speaking" && entry.required).length, 2);
  });
  await check("B: checkpoint A never unlocks unanswered checkpoint B", () => {
    let state = submit(start(), "checkpoint-a", 1);
    state = next(state);
    assert.equal(state.segmentIndex, 1);
    assert.equal(next(state).segmentIndex, 1, "B has no evidence and must remain blocked");
  });
  await check("B: failed checkpoint B stays blocked after checkpoint A passed", () => {
    let state = next(submit(start(), "checkpoint-a", 1));
    state = submit(state, "checkpoint-b", 2, false);
    assert.equal(next(state).segmentIndex, 1, "A's success cannot convert B's failure to passing");
  });
  await check("B: speech A never unlocks unsaved speech B", () => {
    let state = start();
    for (let index = 0; index < 2; index++) state = next(submit(state, lesson.segments[index].id, index + 1));
    state = next(submit(state, "speech-a", 3));
    assert.equal(state.segmentIndex, 3);
    assert.equal(next(state).segmentIndex, 3, "Second speech requires its own saved submission");
  });
  await check("B: telemetry records the second checkpoint's own success", () => {
    const state = next(submit(start(), "checkpoint-a", 1));
    const after = submit(state, "checkpoint-b", 2);
    const events = deriveLessonEvents(state, after, lesson);
    assert.equal(events.filter((event) => event.type === "lesson.checkpoint.passed" && event.segmentId === "checkpoint-b").length, 1);
    assert.equal(deriveLessonEvents(after, after, lesson).filter((event) => event.type === "lesson.checkpoint.passed").length, 0);
  });

  await check("B: each required segment needs its own evidence through completion", () => {
    let current = start();
    for (let index = 0; index < lesson.segments.length; index++) {
      assert.equal(current.segmentIndex, index);
      assert.equal(next(current).segmentIndex, index, "Unanswered required segment must block");
      current = next(submit(current, lesson.segments[index].id, index + 1));
    }
    assert.equal(current.phase, "completed");
    assert.deepEqual(current.completedSegmentIds, lesson.segments.map((segment) => segment.id));
  });
  for (const [field, wrong] of Object.entries({
    userId: "10000000-0000-4000-8000-000000000002", courseId: "foreign-course",
    lessonId: "foreign-lesson", sessionId: "20000000-0000-4000-8000-000000000002",
    contentVersion: "2.0.0", definitionHash: "b".repeat(64), segmentId: "checkpoint-b",
    activityId: "objective-b", kind: "speaking_submitted",
  })) {
    await check("B: incompatible evidence never advances current segment: " + field, () => {
      const current = submit(start(), "checkpoint-a", 1, true, { [field]: wrong });
      assert.equal(next(current).segmentIndex, 0);
      assert.equal(current.completedSegmentIds.length, 0);
    });
  }
  await check("B: rejected attempt is retryable, repeated receipt does not duplicate failures", () => {
    const rejected = submit(start(), "checkpoint-a", 1, false);
    const failures = rejected.checkpointFailures;
    const repeated = submit(rejected, "checkpoint-a", 1, false);
    assert.equal(repeated.checkpointFailures, failures, "Same operation cannot count failure twice");
    const accepted = submit(repeated, "checkpoint-a", 2);
    assert.equal(next(accepted).segmentIndex, 1, "A new valid attempt can satisfy the checkpoint");
  });
  await check("B: older attempt cannot rewrite later accepted evidence or add failures", () => {
    const accepted = submit(start(), "checkpoint-a", 5);
    const old = submit(accepted, "checkpoint-a", 4, false);
    assert.equal(old.checkpointFailures, accepted.checkpointFailures);
    assert.equal(next(old).segmentIndex, 1);
  });

  await check("B: monotonic prior success never turns a new wrong attempt into a new success", () => {
    const accepted = submit(start(), "checkpoint-a", 5);
    const failedNew = submit(accepted, "checkpoint-a", 6, false);
    const failedAgain = submit(failedNew, "checkpoint-a", 5, false);
    assert.equal(failedAgain.checkpointFailures, failedNew.checkpointFailures, "Old sequence cannot add a failure");
    if ("segmentEvidence" in failedNew) {
      const proof = (failedNew as Runtime & { segmentEvidence: Record<string, QaEvidence> }).segmentEvidence["checkpoint-a"];
      assert.equal(proof.attemptId, qaEvidence("checkpoint-a", 5).attemptId);
      assert.equal(proof.accepted, true, "Existing proof is preserved without inventing a new accepted receipt");
    }
  });

  await check("B: second speech emits distinct operational telemetry without replay duplication", () => {
    let current = start();
    current = next(submit(current, "checkpoint-a", 1));
    current = next(submit(current, "checkpoint-b", 2));
    current = next(submit(current, "speech-a", 3));
    const submitted = submit(current, "speech-b", 4);
    assert.equal(deriveLessonEvents(current, submitted, lesson).filter((event) => event.type === "lesson.speaking.attempted" && event.segmentId === "speech-b").length, 1);
    assert.equal(deriveLessonEvents(submitted, submit(submitted, "speech-b", 4), lesson).filter((event) => event.type === "lesson.speaking.attempted").length, 0);
  });
  await check("B: JSON roundtrip and RESTORE preserve independent checkpoint position", () => {
    const current = next(submit(start(), "checkpoint-a", 1));
    const restored = reduceRuntime(lesson, initialize(lesson, qaScope()), { type: "RESTORE", state: JSON.parse(JSON.stringify(current)) });
    assert.equal(restored.segmentIndex, 1);
    assert.equal(next(restored).segmentIndex, 1);
    assert.equal(next(submit(restored, "checkpoint-b", 2)).segmentIndex, 2);
  });
  await check("B: reinforcement does not fabricate checkpoint acceptance", () => {
    let current = submit(start(), "checkpoint-a", 1, false);
    current = submit(current, "checkpoint-a", 2, false);
    current = reduceRuntime(lesson, current, { type: "REINFORCE" });
    current = reduceRuntime(lesson, current, { type: "REINFORCEMENT_DONE" });
    assert.equal(next(current).segmentIndex, 0);
  });
  await check("B: server rejects client map/flags forged beyond trusted session", async () => {
    const integrity = await import(pathToFileURL(resolve("src/domain/interactive-lesson/integrity.ts")).href) as {
      validateRuntimeProgress: (definition: typeof lesson, runtime: unknown, trusted: unknown, scope: ReturnType<typeof qaScope>) => unknown;
      recoverLegacyRuntime: (definition: typeof lesson, scope: ReturnType<typeof qaScope>) => unknown;
    };
    const trusted = start();
    assert.doesNotThrow(() => integrity.validateRuntimeProgress(lesson, trusted, trusted, qaScope()));
    const forged = submit(trusted, "checkpoint-a", 1);
    assert.throws(() => integrity.validateRuntimeProgress(lesson, forged, trusted, qaScope()));
    const recovered = integrity.recoverLegacyRuntime(lesson, qaScope()) as Runtime;
    assert.equal(next(recovered).segmentIndex, 0);
    assert.notEqual(recovered.phase, "completed");
  });


  await check("B: authoritative receipt replay restores general progress before any client flush", async () => {
    const { recordInteractiveLessonReceipt: apply } = await candidate<{
      recordInteractiveLessonReceipt: (state: import("../src/domain/study/study-state").StudyState, course: PublicCourse, receipt: unknown) => import("../src/domain/study/study-state").StudyState;
    }>("src/domain/study/study-state.ts");
    const { SupabaseStudyRepository } = await candidate<typeof import("../src/repositories/supabase-study-repository")>("src/repositories/supabase-study-repository.ts");
    const { readCourseState } = await candidate<typeof import("../src/domain/study/course-state-storage")>("src/domain/study/course-state-storage.ts");
    const packageData = loadContent().find((entry) => entry.course.interactiveLessons.length)!;
    const runtime = runtimeBundle(packageData), target = publicCourse(runtime.course, runtime.language);
    const choose = (type: string) => target.units.flatMap((unit) => unit.lessons.flatMap((owner) => owner.activities.map((activity) => ({ owner, activity })))).find((entry) => entry.activity.type === type)!;
    const objective = choose("multiple_choice"), writing = choose("writing"), speaking = choose("speaking");
    assert(objective && writing && speaking);
    const receipt = (entry: typeof objective, kind: QaEvidence["kind"], sequence: number, accepted = true) => {
      const evidence = { ...qaEvidence("checkpoint-a", sequence, accepted), courseId: target.id, lessonId: entry.owner.id,
        activityId: entry.activity.id, contentVersion: target.contentVersion, kind };
      const keys = ["mistake:", "schedule:"].map((prefix) => prefix + entry.activity.id).concat(
        ["exercise_correct", "exercise_wrong", "exercise_answered", "lesson_completed"].map((event) => "event:" + event + ":" + entry.activity.id));
      return { evidence, answer: "Synthetic learner response", createdAt: QA_NOW.toISOString(),
        ...(kind === "objective_correct" ? { grade: { correct: accepted, correctAnswer: "Own response feedback", explanation: "Synthetic feedback" } } : {}),
        recordingIds: Object.fromEntries(keys.map((key, index) => [key, "40000000-0000-4000-8000-" + String(sequence * 100 + index).padStart(12, "0")])) };
    };
    const receipts = [receipt(objective, "objective_correct", 31), receipt(writing, "writing_submitted", 32), receipt(speaking, "speaking_submitted", 33)];
    let stored = readCourseState(null, target.id, target.languageCode);
    stored.activeSessionId = "unrelated-study-session";
    const writes: Array<{ table: string; rows: Record<string, unknown>[] }> = [];
    const db = { from: (table: string) => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { state: stored }, error: null }),
        upsert: async (rows: Record<string, unknown>[] | Record<string, unknown>) => { writes.push({ table, rows: Array.isArray(rows) ? rows : [rows] }); return { error: null }; } };
      return query;
    } } as unknown as import("@supabase/supabase-js").SupabaseClient;
    type Repository = InstanceType<typeof SupabaseStudyRepository>;
    const Constructor = SupabaseStudyRepository as unknown as new (client: typeof db, userId: string, assessments: undefined,
      interactive: { course: PublicCourse; load: () => Promise<unknown[]> }) => Repository;
    const repository = new Constructor(db, qaScope().userId, undefined, { course: target, load: async () => receipts });
    const recovered = await repository.load(target.id, target.languageCode);
    assert(recovered);
    assert.equal(recovered.attempts.filter((entry) => entry.id === receipts[0].evidence.attemptId).length, 1);
    assert.equal(recovered.writing.filter((entry) => entry.id === receipts[1].evidence.attemptId).length, 1);
    assert.equal(recovered.speaking.filter((entry) => entry.id === receipts[2].evidence.attemptId).length, 1);
    assert.equal(recovered.activeSessionId, "unrelated-study-session");
    assert.equal(recovered.attempts[0].sessionId, null, "Replay must not credit a different active study session");
    assert.equal(recovered.speaking[0].feedback, undefined, "Saved speech has no fabricated acoustic score");
    assert.equal(recovered.writing[0].feedback, undefined, "Saved text has no fabricated correction");
    assert.equal(writes.length, 0, "Recovery before flush is a read, not a hidden save");
    stored = recovered;
    const repeated = await repository.load(target.id, target.languageCode);
    assert.deepEqual(repeated, recovered, "Reload/retry must preserve stable IDs and grades without duplicate evidence");
    await repository.save(recovered, target, []);
    for (const table of ["exercise_attempts", "writing_submissions", "speaking_submissions"])
      assert.equal(writes.filter((entry) => entry.table === table).flatMap((entry) => entry.rows).length, 0,
        "Normalized receipt rows were already committed by the server: " + table);
    const fresh = readCourseState(null, target.id, target.languageCode);
    for (const delta of [{ courseId: "foreign" }, { contentVersion: "foreign" }, { lessonId: "foreign" }, { activityId: "foreign" }, { kind: "speaking_submitted" }])
      assert.equal(apply(fresh, target, { ...receipts[0], evidence: { ...receipts[0].evidence, ...delta } }), fresh);
    const inconsistent = { ...receipts[0], grade: { ...receipts[0].grade!, correct: false } };
    assert.equal(apply(fresh, target, inconsistent), fresh);
    const failRead = new Constructor(db, qaScope().userId, undefined, { course: target, load: async () => { throw Error("Synthetic receipt read failure"); } });
    const beforeWrites = writes.length;
    await assert.rejects(failRead.load(target.id, target.languageCode), /Synthetic receipt read failure/);
    assert.equal(writes.length, beforeWrites, "Failed authoritative read cannot trigger fallback writes");
    const callbacks = await providerCallbackFixture(root, { course: target, resources: runtime.resources, language: runtime.language, children: null });
    assert.throws(() => callbacks.initial.captureInteractiveLessonOwner(), "Loading is not authority to submit");
    const owner = qaScope().userId;
    await callbacks.sync.load(callbacks.sync.beginLoading(), owner, { load: async () => fresh, save: async () => {} });
    const current = callbacks.render(), token = current.captureInteractiveLessonOwner();
    current.applyInteractiveLessonReceipt(receipts[0], token);
    const after = callbacks.sync.getSnapshot().state;
    assert.equal(after.attempts.length, 1);
    current.applyInteractiveLessonReceipt(receipts[0], token);
    assert.deepEqual(callbacks.sync.getSnapshot().state, after);
    assert.throws(() => current.applyInteractiveLessonReceipt({ ...receipts[0], evidence: { ...receipts[0].evidence, userId: qaScope().sessionId } }, token));
    await callbacks.sync.load(callbacks.sync.beginLoading(), owner, { load: async () => fresh, save: async () => {} });
    const later = callbacks.sync.getSnapshot().state;
    assert.throws(() => current.applyInteractiveLessonReceipt(receipts[0], token));
    assert.deepEqual(callbacks.sync.getSnapshot().state, later, "Old generation response must not mutate current account state");
    await callbacks.sync.load(callbacks.sync.beginLoading(), "10000000-0000-4000-8000-000000000002", { load: async () => fresh, save: async () => {} });
    assert.throws(() => current.applyInteractiveLessonReceipt(receipts[0], token));
  });
  await check("B: bounded body rejects chunked overflow without trusting Content-Length", async () => {
    const { readBoundedLessonBody } = await candidate<{ readBoundedLessonBody: (request: Request, maximum: number) => Promise<Uint8Array> }>("src/domain/interactive-lesson/request-body.ts");
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(32)); controller.enqueue(new Uint8Array(33)); }, cancel() { cancelled = true; } });
    const request = new Request("http://127.0.0.1/qa", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await assert.rejects(readBoundedLessonBody(request, 64), (error: unknown) => (error as { status?: number }).status === 413);
    assert.equal(cancelled, true);
    const exact = new Request("http://127.0.0.1/qa", { method: "POST", body: new Uint8Array(64) });
    assert.equal((await readBoundedLessonBody(exact, 64)).byteLength, 64);
  });

  }
  if (selectedTrack !== "B") {
  const bundle = runtimeBundle(loadContent()[0]);
  const course = publicCourse(bundle.course, bundle.language);
  const state = stateWithDueMistake(course);
  const profile = buildLearningProfile(course, state, [], bundle.resources, QA_NOW);
  await check("A: due error on available embedded review remains recommended", () => {
    const recommendations = LearningRecommendationEngine.recommend(course, state, profile, [], bundle.resources, { now: QA_NOW, includeReviews: true });
    assert.ok(recommendations.some((entry) => entry.kind === "review"));
  });
  await check("A: review unavailable on installed course cannot become recommendation", () => {
    const unavailable = { ...course, availability: { ...(course.availability ?? { unavailableActivityIds: [], spacedRepetition: true }), spacedRepetition: false } };
    const recommendations = LearningRecommendationEngine.recommend(unavailable, state, profile, [], bundle.resources, { now: QA_NOW, includeReviews: true });
    assert.equal(recommendations.some((entry) => entry.kind === "review"), false, "Do not send learner to a blocked review route");
    assert.ok(recommendations.some((entry) => entry.kind === "activity"), "Current curriculum must remain an executable alternative");
  });

  await check("A: unavailable activities cannot be suggested as executable practice", () => {
    const ids = course.units.flatMap((unit) => unit.lessons).flatMap((entry) => entry.activities).map((entry) => entry.id);
    const unavailable = { ...course, availability: { ...(course.availability ?? { unavailableActivityIds: [], spacedRepetition: true }), spacedRepetition: false, unavailableActivityIds: ids } };
    const recommendations = LearningRecommendationEngine.recommend(unavailable, state, profile, [], bundle.resources, { now: QA_NOW, includeReviews: true });
    assert.equal(recommendations.filter((entry) => entry.kind === "activity").length, 0);
    assert.equal(recommendations.filter((entry) => entry.kind === "review").length, 0);
    assert.equal(state.completedActivityIds.length, 0, "Unavailable does not imply completed");
  });
  await check("A: implementation/compatibility/operation/permission stay distinct", async () => {
    type Action = { kind: string; id?: string; activityId?: string };
    type Eligibility = { eligible: boolean; implementation: string; compatibility: boolean; operation: string; permission: string; reasons: string[] };
    const { learningActionAvailability: availability } = await import(pathToFileURL(resolve("src/domain/study/learning-action-availability.ts")).href) as {
      learningActionAvailability: (target: PublicCourse, action: Action, context?: { source: "compiled" | "installed"; permitted?: boolean }) => Eligibility;
    };
    const installed = { ...course, availability: { ...(course.availability ?? { unavailableActivityIds: [], spacedRepetition: true }), spacedRepetition: false } };
    for (const kind of ["review", "numbers", "conversation", "image", "micro_lesson", "interactive", "speaking", "tutor"]) {
      const result = availability(installed, { kind }, { source: "installed", permitted: true });
      assert.equal(result.eligible, false, "Installed unsupported path: " + kind);
      assert.ok(result.reasons.length > 0);
    }
    const activityId = course.units[0].lessons[0].activities[0].id;
    const denied = availability(course, { kind: "activity", activityId }, { source: "compiled", permitted: false });
    assert.equal(denied.permission, "denied");
    assert.equal(denied.eligible, false);
    const unknownPermission = availability(course, { kind: "activity", activityId }, { source: "compiled" });
    assert.notEqual(unknownPermission.permission, "allowed");
    const withState = (state: "available" | "unknown" | "unavailable") => ({
      ...course, availability: { ...(course.availability ?? { unavailableActivityIds: [], spacedRepetition: true }), actionStates: { "ai.conversation": { state, reasons: ["Synthetic provider condition"] } } },
    });
    const conditional = availability(withState("unknown"), { kind: "conversation" }, { source: "compiled", permitted: true });
    assert.equal(conditional.operation, "unknown", "Configured does not certify health or quota");
    assert.equal(conditional.eligible, true, "Lead contract preserves guarded conditional compiled attempts");
    assert.ok(conditional.reasons.length > 0, "Conditional attempt needs an honest explanation");
    const absent = availability(withState("unavailable"), { kind: "conversation" }, { source: "compiled", permitted: true });
    assert.equal(absent.operation, "unavailable");
    assert.equal(absent.eligible, false);
  });


  await check("A: required blocked activity is named and optional alternative remains possible", async () => {
    const helper = await import(pathToFileURL(resolve(root, "src/domain/study/learning-action-availability.ts")).href) as {
      unavailableLearningRequirements: (target: PublicCourse, current: import("../src/domain/study/study-state").StudyState, context: { source: "compiled"; permitted: boolean }) => Array<{ label: string; reasons: string[] }>;
    };
    const target = structuredClone(course), unit = target.units[0];
    const ids = unit.lessons.flatMap((lesson) => lesson.activities).slice(0, 2).map((activity) => activity.id);
    assert.equal(ids.length, 2);
    target.units.forEach((entry) => { entry.learningPolicy = { completion: { requirements: [] }, mastery: { requirements: [] } }; });
    unit.learningPolicy = { completion: { requirements: [{ id: "qa-required", label: "QA required practice",
      kind: "participation", activityIds: [ids[0]], minimumCount: 1 }] }, mastery: { requirements: [] } };
    target.availability = { ...target.availability, spacedRepetition: false, unavailableActivityIds: [ids[0]] };
    const obligations = helper.unavailableLearningRequirements(target, state, { source: "compiled", permitted: true });
    assert.ok(obligations.some((entry) => entry.label === "QA required practice" && entry.reasons.length > 0));
    assert.equal(state.completedActivityIds.length, 0);
    unit.learningPolicy.completion.requirements = [{ id: "qa-alternative", label: "QA choose one",
      kind: "participation", activityIds: ids, minimumCount: 1 }];
    assert.equal(helper.unavailableLearningRequirements(target, state, { source: "compiled", permitted: true }).length, 0,
      "One available declared alternative can satisfy a choose-one requirement");
  });
  await check("A: planner and continuation exclude blocked installed resources and activities", async () => {
    const { buildStudyPlan, nextActivity } = await candidate<typeof import("../src/domain/study/study-planner")>("src/domain/study/study-planner.ts");
    const ids = course.units.flatMap((unit) => unit.lessons).flatMap((entry) => entry.activities).map((entry) => entry.id);
    const target = { ...course, availability: { ...(course.availability ?? { unavailableActivityIds: [], spacedRepetition: true }), spacedRepetition: false, unavailableActivityIds: [ids[0]] } };
    type Context = { source: "installed"; permitted: boolean };
    const plan = (buildStudyPlan as unknown as (...args: [PublicCourse, typeof state, number, [], typeof bundle.resources, Date, "difficulties", Context]) => Array<{ kind: string; id: string }>)(target, state, 20, [], bundle.resources, QA_NOW, "difficulties", { source: "installed", permitted: true });
    assert.equal(plan.some((item) => item.kind === "review" || item.kind === "conversation" || item.id === ids[0]), false);
    const continuation = (nextActivity as unknown as (target: PublicCourse, current: typeof state, context: Context) => { id: string } | undefined)(target, state, { source: "installed", permitted: true });
    assert.ok(continuation && continuation.id !== ids[0]);
    target.availability.unavailableActivityIds = ids;
    assert.equal((nextActivity as unknown as (target: PublicCourse, current: typeof state, context: Context) => unknown)(target, state, { source: "installed", permitted: true }), undefined);
  });
  await check("A: actual NumberGuide SSR never promises blocked installed number practice", async () => {
    const target = { ...course, availability: { ...(course.availability ?? { unavailableActivityIds: [], spacedRepetition: true }), actionStates: {
      "numbers.dictation": { state: "unknown" as const, reasons: ["Synthetic configured service"] } } } };
    const study = { course: target, language: bundle.language, resources: bundle.resources };
    const installed = await renderNumberGuide(root, { ...study, runtime: {} });
    assert.equal(/href="\/numbers(?:[?"\/])/.test(installed), false);
    assert.ok(installed.includes('role="status"'));
    assert.equal(installed.includes("formas de praticar"), false);
    const compiled = await renderNumberGuide(root, study);
    assert.ok(/href="\/numbers(?:[?"\/])/.test(compiled));
    assert.ok(compiled.toLowerCase().includes("condicional"));
  });


  await check("A-R1: final-only query target and selector cannot inherit missing diagnostic denial", async () => {
    const final = course.assessments.find((entry) => entry.purpose === "summative");
    assert.ok(final, "Independent final fixture exists");
    const target = structuredClone(course);
    target.assessmentRefs = {};
    target.assessments = [final];
    target.availability = { ...target.availability, spacedRepetition: false, unavailableActivityIds: [],
      unavailableAssessmentIds: [], actionStates: { "assessment.fixed": { state: "available", reasons: [] } } };
    const current = structuredClone(state); current.profile.onboarded = true;
    const study = { course: target, state: current, resources: bundle.resources, language: bundle.language,
      vocabularyItems: [], ready: true, authUserId: qaScope().userId, progressLoadStatus: "loaded",
      syncError: "", pendingProgress: [], hasRecoveredProgress: false };
    const selected = await renderAssessmentShell(root, study, "assessmentId=" + encodeURIComponent(final.id));
    assert.ok(selected.includes("QA assessment route allowed"), "Final available must remain reachable without diagnostic");
    const selector = await renderAssessmentShell(root, study);
    assert.ok(selector.includes("QA assessment route allowed"), "Selector with no diagnostic must remain reachable");
  });
  await check("A-R1: unavailable diagnostic never blocks explicitly selected available final", async () => {
    const final = course.assessments.find((entry) => entry.purpose === "summative");
    const diagnostic = course.assessments.find((entry) => entry.purpose === "diagnostic");
    assert.ok(final && diagnostic);
    const target = structuredClone(course);
    target.assessmentRefs = { diagnostic: diagnostic.id };
    target.availability = { ...target.availability, spacedRepetition: false, unavailableActivityIds: [],
      unavailableAssessmentIds: [diagnostic.id], actionStates: {
        "assessment.fixed": { state: "available", reasons: [] }, "assessment.adaptive": { state: "available", reasons: [] },
      } };
    const current = structuredClone(state); current.profile.onboarded = true;
    const study = { course: target, state: current, resources: bundle.resources, language: bundle.language,
      vocabularyItems: [], ready: true, authUserId: qaScope().userId, progressLoadStatus: "loaded",
      syncError: "", pendingProgress: [], hasRecoveredProgress: false };
    const selected = await renderAssessmentShell(root, study, "assessmentId=" + encodeURIComponent(final.id));
    assert.ok(selected.includes("QA assessment route allowed"));
    const blocked = await renderAssessmentShell(root, study, "assessmentId=" + encodeURIComponent(diagnostic.id));
    assert.equal(blocked.includes("QA assessment route allowed"), false, "Explicit blocked diagnostic stays blocked");
  });

  }
  assert.deepEqual(hashes(), before, "Candidate changed during independent verification");
  const result = { candidateRoot: root, sourceRoot, selectedTrack, candidateManifests, hashes: before, checks, passed: checks.every((entry) => entry.passed), limitations: ["Deterministic hooks test real provider callbacks; effects, browser lifecycle and real auth are outside the pure suite.", "Pure tests only; no browser, database, provider or production certification."] };
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
