import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { allCourseBundles } from "../src/content/course-registry";
import { canonicalAdaptiveProgress } from "../src/domain/assessments/adaptive-progress";
import { evaluateAssessment } from "../src/domain/assessments/assessment-engine";
import { checkpointSession } from "../src/domain/study/session-lifecycle";
import { readCourseState } from "../src/domain/study/course-state-storage";
import { InstalledStudyHttpRepository } from "../src/repositories/installed-study-http-repository";
import { sanitizeInstalledDraft, projectInstalledEvidence } from "../src/domain/installed-study/evidence-projection";
import type { ResolvedSession } from "../src/domain/course-installations/contracts";
import { publicCourse } from "../src/content/public";
import type { InstalledRuntimeContext } from "../src/lib/installed-runtime-types";

async function main() {
const bundle = structuredClone(allCourseBundles()[0]);
const course = bundle.course;
const first = course.units.flatMap(u => u.lessons.flatMap(l => l.activities)).find(a => a.type === "multiple_choice")!;
const a = { ...first, id: "synthetic.a", skill: "vocabulary" as const, skills: ["vocabulary" as const], answer: "tok-a", options: ["tok-a", "tok-b"] };
const b = { ...a, id: "synthetic.b" };
course.units[0].lessons[0].activities = [a, b];
course.assessments = [{ id: "synthetic.diagnostic", title: "Synthetic", purpose: "diagnostic", method: "adaptive", objectiveIds: [], skillWeights: {},
  skillPlan: ["vocabulary", "vocabulary"], bank: [{ activityId: a.id, skill: "vocabulary", difficulty: 1 },
  { activityId: b.id, skill: "vocabulary", difficulty: 3 }], passingPolicy: { overall: 0.5 } },
  { id: "synthetic.final", title: "Final", purpose: "summative", method: "fixed", objectiveIds: [], activityIds: [a.id],
    gradingStrategy: "objective_mean", passingPolicy: { overall: 0.5 } }];
const prefix = { attemptId: randomUUID(), assessmentId: "synthetic.diagnostic", startedAt: new Date().toISOString(),
  responses: [{ activityId: a.id, answer: "tok-b" }], answers: [{ correct: true }] };
const canonical = canonicalAdaptiveProgress([prefix], course, bundle.language, "")[0];
assert.equal(canonical.answers?.[0].correct, false, "private grader replaces forged client grade");
assert.deepEqual(canonical.responses, prefix.responses);
assert.throws(() => canonicalAdaptiveProgress([{ ...prefix, responses: [] }], course, bundle.language, ""), "a started attempt without a submitted answer cannot persist a prefix");
assert.deepEqual(canonicalAdaptiveProgress([], course, bundle.language, ""), []);
assert.throws(() => canonicalAdaptiveProgress([{ ...prefix, assessmentId: "synthetic.final" }], course, bundle.language, ""));
assert.throws(() => canonicalAdaptiveProgress([{ ...prefix, responses: [{ activityId: b.id, answer: "tok-a" }] }], course, bundle.language, ""));
assert.throws(() => canonicalAdaptiveProgress([{ ...prefix, responses: [prefix.responses[0], prefix.responses[0]] }], course, bundle.language, ""));
assert.throws(() => canonicalAdaptiveProgress([{ ...prefix, draft: "not submitted" }], course, bundle.language, ""));
const partial = evaluateAssessment(course, prefix.assessmentId, prefix.responses, bundle.language.normalization,
  { language: bundle.language, course, preference: "" }, { allowPartialAdaptive: true });
assert.equal(partial.status, "insufficient"); assert.equal(partial.objectiveScore, null); assert.equal(partial.passed, null);
assert.throws(() => evaluateAssessment(course, prefix.assessmentId, prefix.responses, bundle.language.normalization));
const state = readCourseState(null, course.id, course.languageCode);
const sessionId = randomUUID();
state.activeSessionId = sessionId;
state.sessions = [{ id: sessionId, unitId: course.units[0].id, startedAt: prefix.startedAt, finishedAt: null,
 durationSeconds: 12, activityIds: [], correct: 0, wrong: 0, wordsReviewed: 0,
 plan: [{ kind: "activity", id: a.id, title: "A", minutes: 1 }] }];
const paused = checkpointSession(state, sessionId, { seconds: 15, cursor: 1, paused: true });
assert.equal(paused.sessions[0].paused, true); assert.equal(paused.sessions[0].cursor, 1);
assert.equal(paused.sessions[0].durationSeconds, 15); assert.equal(state.sessions[0].durationSeconds, 12);
assert.deepEqual(paused.completedActivityIds, []);
assert.equal(checkpointSession(paused, "foreign", { seconds: 100 }), paused);
assert.equal(checkpointSession(paused, sessionId, { seconds: 1 }).sessions[0].durationSeconds, 15);
assert.equal(checkpointSession(paused, sessionId, { cursor: NaN }), paused);
assert.equal(checkpointSession(paused, sessionId, { cursor: 50 }).sessions[0].cursor, 1);
const reference = { installationId: randomUUID(), courseId: course.id, contentVersion: course.contentVersion,
 contractVersion: "1.0", envelopeVersion: "1.0.0", languageContractVersion: "1.0", artifactHash: "a".repeat(64) };
const context = { versionSessionId: randomUUID(), userId: randomUUID(), reference, selectionRevision: 1 } as InstalledRuntimeContext;
const resolved = { session: { id: context.versionSessionId, userId: context.userId, reference },
 content: { prepared: { bundle } } } as unknown as ResolvedSession;
const sanitized = sanitizeInstalledDraft({ ...paused, adaptiveProgress: [prefix] }, resolved);
assert.equal(sanitized.sessions[0].cursor, 1); assert.equal(sanitized.sessions[0].paused, true);
assert.equal(sanitized.adaptiveProgress?.[0].answers?.[0].correct, false);
const restored = projectInstalledEvidence(sanitized, resolved, []);
assert.equal(restored.assessmentAttempts.length, 0); assert.equal(restored.adaptiveAssessments.length, 0);
assert.equal(restored.events.filter(e => e.type === "lesson_started").length, 1);
const ended = { ...restored, activeSessionId: null, sessions: restored.sessions.map(x => ({ ...x, finishedAt: prefix.startedAt })) };
const wire = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const roundtrip = sanitizeInstalledDraft(wire(sanitizeInstalledDraft(wire(ended), resolved)), resolved);
assert.equal(roundtrip.events.filter(e => e.type === "lesson_finished").length, 1);
assert.deepEqual(roundtrip.events, sanitizeInstalledDraft(wire(ended), resolved).events);
assert.throws(() => sanitizeInstalledDraft({ ...paused, sessions: paused.sessions.map(x => ({...x, cursor: 100})) }, resolved));
let writes = 0; let failRead = true; let loseAck = true; const commands: string[] = [];
const repo = new InstalledStudyHttpRepository(context, publicCourse(course, bundle.language), async (_input, init) => {
 if (init?.method !== "POST") return failRead ? new Response("", { status: 503 }) : Response.json({ schemaVersion: 1,
 versionSessionId: context.versionSessionId, reference, revision: 0, state: null, updatedAt: null });
 writes++; commands.push(String(init.body)); if (loseAck) { loseAck = false; throw Error("lost ACK"); }
 return Response.json({ schemaVersion: 1, versionSessionId: context.versionSessionId, reference, revision: 1,
 state, updatedAt: new Date().toISOString() });
});
await assert.rejects(repo.load()); await assert.rejects(repo.save(state)); assert.equal(writes, 0);
failRead = false; await repo.load(); await assert.rejects(repo.save(state)); await repo.save(state);
assert.equal(commands[0], commands[1], "lost ACK retry preserves exact command identity"); assert.equal(writes, 2);
console.log("A2 pure checks passed: private adaptive prefix, no drafts/results, session checkpoints, GET failure and lost ACK retry.");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
