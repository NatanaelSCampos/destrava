import assert from "node:assert/strict";
import test from "node:test";
import { loadContent } from "./content-loader.ts";
import { runtimeBundle } from "../src/content/runtime-package.ts";
import { coursePackageSchema } from "../src/content/contracts.ts";
import { publicCourse } from "../src/content/public.ts";
import { gradeActivity } from "../src/domain/activities/grader.ts";
import { teachingSchema } from "../src/content/teaching.ts";
import { deferredRecoveryStatus } from "../src/domain/study/deferred-recovery.ts";
import { capabilityRegistry } from "../src/engine/capabilities/registry.ts";
import { negotiateCapabilities } from "../src/engine/capabilities/compatibility.ts";
const fixture = loadContent().find(bundle => bundle.language.id === "xx-Test");
assert.ok(fixture);
function sample() {
  const raw = structuredClone(fixture);
  raw.course.schemaVersion = "1.6";
  const lesson = raw.course.units[0].lessons[0];
  const source = lesson.activities.find(activity => activity.type === "multiple_choice");
  assert.ok(source);
  const concept = source.concepts[0] ?? raw.course.concepts[0].id;
  source.concepts = [concept];
  source.payload.feedback = { summaryCorrect: "Confirmed.", summaryIncorrect: "Try a new situation.",
    alternatives: source.payload.options.map(answer => ({ answer, detail: "PRIVATE_OPTION_" + answer })) };
  const teaching = {
    id: "synthetic-teaching", type: "lesson_content", title: "One idea", prompt: "Observe.",
    skills: source.skills, concepts: [concept], minutes: 1,
    payload: { body: "A short explanation.", highlights: [], teaching: {
      kind: "concept", lines: [{ text: "Target phrase", translation: "Meaning", audioMediaId: "synthetic-audio" }],
    } },
  };
  lesson.activities.unshift(teaching);
  source.payload.supportActivityIds = [teaching.id];
  raw.course.media.push({ id: "synthetic-audio", type: "audio", src: "/media/test/phrase.wav",
    metadata: { author: "Test author", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceUrl: "https://example.org/test-audio", credit: "Synthetic contract fixture; no playback claim." } });
  const recovery = structuredClone(source);
  recovery.id = "synthetic-recovery";
  recovery.prompt = "Another authored example.";
  recovery.payload.explanation = "PRIVATE_RECOVERY_EXPLANATION";
  recovery.payload.feedback.alternatives = source.payload.options.map(answer => ({ answer, detail: "PRIVATE_RECOVERY_" + answer }));
  lesson.deferredRecovery = { delayActivities: 3, maxPerConcept: 1,
    rules: [{ sourceActivityIds: [source.id], conceptId: concept, activity: recovery }] };
  return { raw, lesson, source, recovery, teaching };
}
test("old packages still parse and execute without opting in", () => {
  const result = runtimeBundle(structuredClone(fixture));
  assert.equal(result.course.teachingMedia, undefined);
  assert.equal(result.course.units[0].lessons[0].deferredRecovery, undefined);
});
test("new package resolves audio references without carrying arbitrary metadata", () => {
  const { raw } = sample();
  raw.course.media.at(-1).metadata.secret = "MUST_NOT_BE_PROJECTED";
  const result = runtimeBundle(raw);
  assert.equal(result.course.teachingMedia.find(asset => asset.id === "synthetic-audio").src, "/media/test/phrase.wav");
  assert.ok(!JSON.stringify(result.course.teachingMedia).includes("MUST_NOT_BE_PROJECTED"));
});
test("1.5 refuses teaching and recovery even when payload parser understands them", () => {
  const { raw } = sample(); raw.course.schemaVersion = "1.5";
  assert.equal(coursePackageSchema.safeParse(raw.course).success, false);
});
test("teaching rejects HTML/DSL fields and dialogue without speakers", () => {
  assert.equal(teachingSchema.safeParse({ kind: "concept", lines: [{ text: "A" }], html: "<script/>" }).success, false);
  assert.equal(teachingSchema.safeParse({ kind: "dialogue", lines: [{ text: "A" }] }).success, false);
});
test("diagram requires real distinct node references", () => {
  assert.equal(teachingSchema.safeParse({ kind: "concept", lines: [{ text: "A" }],
    diagram: { nodes: [{ id: "a", label: "A", kind: "person" }, { id: "b", label: "B", kind: "place" }],
      links: [{ from: "a", to: "x", label: "at" }] } }).success, false);
});
for (const src of ["https://other.example/a.wav", "//other.example/a.wav", "/media/../secret.wav", "/media/%2e%2e/a.wav", "/media/a.wav?token=x"]) {
  test("teaching refuses unproved media path " + src, () => {
    const { raw } = sample(); raw.course.media.at(-1).src = src;
    assert.equal(coursePackageSchema.safeParse(raw.course).success, false);
  });
}
test("audio needs author, per-asset license and source", () => {
  const { raw } = sample(); delete raw.course.media.at(-1).metadata.license;
  assert.equal(coursePackageSchema.safeParse(raw.course).success, false);
});
test("help cannot reach another lesson or an answer activity", () => {
  const { raw, source } = sample(); source.payload.supportActivityIds = [source.id];
  assert.equal(coursePackageSchema.safeParse(raw.course).success, false);
});
test("feedback keys cover the real options exactly once", () => {
  const { raw, source } = sample(); source.payload.feedback.alternatives[0].answer = "orphan";
  assert.equal(coursePackageSchema.safeParse(raw.course).success, false);
});
test("private feedback and recovery answers never cross public projection", () => {
  const { raw } = sample(); const runtime = runtimeBundle(raw);
  const exposed = publicCourse(runtime.course, runtime.language);
  const json = JSON.stringify(exposed);
  assert.ok(!json.includes("PRIVATE_OPTION_"));
  assert.ok(!json.includes("PRIVATE_RECOVERY_"));
  const recovery = exposed.units[0].lessons[0].deferredRecovery.rules[0].activity;
  assert.equal(recovery.answer, undefined);
  assert.equal(recovery.feedback, undefined);
  assert.equal(recovery.explanation, undefined);
});
test("private feedback is returned only by actual grading after submission", () => {
  const { raw, source } = sample(); const result = runtimeBundle(raw);
  const activity = result.course.units[0].lessons[0].activities.find(item => item.id === source.id);
  const grade = gradeActivity(activity, source.payload.answer, raw.language.normalization,
    { course: result.course, language: result.language });
  assert.equal(grade.correct, true);
  assert.match(grade.feedback.detail, /^PRIVATE_OPTION_/);
});
test("legacy activity capability rejects modern fields; 2.0 accepts them", () => {
  const { teaching } = sample();
  const request = version => negotiateCapabilities([{ location: "test",
    requirement: { id: "activity.lesson_content", version, required: true, data: teaching.payload } }], {}, capabilityRegistry);
  assert.equal(request("1.0.0").compatible, false);
  assert.equal(request("2.0.0").compatible, true);
});
for (const delay of [1, 5]) test("recovery rejects delay " + delay, () => {
  const { raw, lesson } = sample(); lesson.deferredRecovery.delayActivities = delay;
  assert.equal(coursePackageSchema.safeParse(raw.course).success, false);
});
test("recovery rejects source outside the declared lesson/concept", () => {
  const { raw, lesson } = sample(); lesson.deferredRecovery.rules[0].sourceActivityIds = ["foreign"];
  assert.equal(coursePackageSchema.safeParse(raw.course).success, false);
});
test("recovery variant is not a normal completion obligation", () => {
  const { raw, recovery } = sample(); const result = runtimeBundle(raw);
  assert.ok(!result.course.units[0].lessons[0].activities.some(activity => activity.id === recovery.id));
});
function schedulerFixture() {
  const { raw, source } = sample();
  const lesson = publicCourse(runtimeBundle(raw).course, raw.language).units[0].lessons[0];
  const t = "2026-10-24T10:00:00.000Z";
  const state = { attempts: [{ id: "initial", activityId: source.id, correct: false, createdAt: t }],
    events: [] };
  const others = lesson.activities.filter(activity => activity.id !== source.id).slice(0, 3);
  assert.equal(others.length, 3);
  function event(activityId, seconds, type = "lesson_completed") {
    return { id: "event-" + seconds, activityId, type, createdAt: new Date(Date.parse(t) + seconds * 1000).toISOString() };
  }
  return { lesson, state, others, event };
}
test("exactly three distinct actual learning activities make recovery due", () => {
  const { lesson, state, others, event } = schedulerFixture();
  state.events = others.slice(0, 2).map((activity, i) => event(activity.id, i + 1));
  assert.equal(deferredRecoveryStatus(lesson, state).length, 0);
  state.events.push(event(others[2].id, 3));
  assert.equal(deferredRecoveryStatus(lesson, state)[0].initialAttemptId, "initial");
});
test("navigation, help, repeated completion and older events do not fill the delay", () => {
  const { lesson, state, others, event } = schedulerFixture();
  state.events = [event(others[0].id, 1), event(others[0].id, 2), event(others[1].id, 3, "help_opened"),
    event(others[2].id, -1), event(others[2].id, 4, "navigation")];
  assert.equal(deferredRecoveryStatus(lesson, state).length, 0);
});
test("recovery attempt persists separately and consumes finite cue across reload/replay", () => {
  const { lesson, state, others, event } = schedulerFixture();
  state.events = others.map((activity, i) => event(activity.id, i + 1));
  const cue = deferredRecoveryStatus(lesson, state)[0];
  const before = structuredClone(state.attempts[0]);
  state.attempts.push({ id: "later", activityId: cue.activity.id, correct: true, createdAt: "2026-10-24T10:01:00.000Z" });
  assert.equal(deferredRecoveryStatus(lesson, JSON.parse(JSON.stringify(state))).length, 0);
  assert.deepEqual(state.attempts[0], before);
});

for (const [field, value] of [["goals", ["travel"]], ["contexts", ["unknown-context"]]]) {
  test("recovery obeys the same declared " + field + " boundary as normal activities", () => {
    const { raw, recovery } = sample(); recovery[field] = value;
    assert.equal(coursePackageSchema.safeParse(raw.course).success, false);
  });
}
test("a reordered object or new feedback is not a different authored recovery example", () => {
  const { raw, source, recovery } = sample();
  recovery.type = source.type; recovery.prompt = source.prompt;
  recovery.payload = Object.fromEntries(Object.entries(structuredClone(source.payload)).reverse());
  recovery.payload.explanation = "Another feedback does not change the stimulus.";
  assert.equal(coursePackageSchema.safeParse(raw.course).success, false);
});
test("portable external assets and declared objective labels are accepted", () => {
  const { raw, lesson } = sample();
  raw.course.media.at(-1).src = "assets/synthetic-audio.wav";
  lesson.objectives = ["observable-action"]; lesson.objectiveLabels = { "observable-action": "One observable action." };
  assert.equal(coursePackageSchema.safeParse(raw.course).success, true);
});
