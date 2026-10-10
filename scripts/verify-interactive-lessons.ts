import assert from "node:assert/strict";
import { loadContent } from "./content-loader";
import { lessonActionSchema, type CoursePackage } from "../src/content/contracts";
import { validateInteractiveLessons } from "../src/content/validate-interactive-lessons";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse } from "../src/content/public";
import { initialRuntime, reduceRuntime, resumeAnchor, TimelineEngine } from "../src/domain/interactive-lesson/runtime";
import { deriveLessonEvents } from "../src/domain/interactive-lesson/telemetry";
import { curatedInteractiveExamples } from "../src/content/interactive-examples";

const bundles = loadContent();
const spanish = bundles.find((item) => item.course.id === "frecuencias-a1");
const english = bundles.find((item) => item.language.id === "en");
const testLanguage = bundles.find((item) => item.language.id === "xx-Test");
assert.ok(spanish && english && testLanguage, "ES, EN and xx-Test packages are available");
const { course, language } = spanish;
const definition = course.interactiveLessons[0];
assert.ok(definition, "demo interactive lesson exists");
const mutate = (change: (copy: CoursePackage) => void) => {
  const copy = structuredClone(course);
  change(copy);
  return copy;
};
assert.equal(course.schemaVersion, "1.3");
assert.equal(english.course.schemaVersion, "1.3");
assert.equal(testLanguage.course.schemaVersion, "1.3");
assert(english.course.units.every((unit) => unit.lessons.every((lesson) => !lesson.interactiveLessonRef)));
assert.doesNotThrow(() => validateInteractiveLessons(course, language));
assert(curatedInteractiveExamples(course, definition).length > 0);
const withConceptExample = mutate((copy) => {
  copy.concepts.find((item) => item.id === definition.concepts[0])!.examples = [
    { target: "Tengo nueve años.", translations: { "pt-BR": "Tenho nove anos." } },
  ];
});
assert.equal(curatedInteractiveExamples(withConceptExample, definition)[0].text, "Tengo nueve años.");
assert.doesNotThrow(() => validateInteractiveLessons(english.course, english.language));
assert.doesNotThrow(() => validateInteractiveLessons(testLanguage.course, testLanguage.language));
assert.throws(() => validateInteractiveLessons(mutate((copy) => {
  copy.units[0].lessons.find((item) => item.id === definition.lessonId)!.interactiveLessonRef = "missing";
}), language), /Invalid interactiveLessonRef/);
assert.throws(() => validateInteractiveLessons(mutate((copy) => {
  copy.interactiveLessons[0].segments[0].concepts = ["missing"];
}), language), /Unknown segment concept/);
assert.throws(() => validateInteractiveLessons(mutate((copy) => {
  copy.interactiveLessons[0].segments[0].cues[0].atMs = 100_000;
}), language), /Cue outside duration/);
assert.throws(() => validateInteractiveLessons(mutate((copy) => {
  copy.interactiveLessons[0].segments[1].id = copy.interactiveLessons[0].segments[0].id;
}), language), /Duplicate segment ID/);
assert.throws(() => validateInteractiveLessons(mutate((copy) => {
  copy.interactiveLessons[0].segments[0].resumeAnchorsMs = [100_000];
}), language), /Invalid resume anchor/);
assert.throws(() => validateInteractiveLessons(mutate((copy) => {
  copy.interactiveLessons[0].segments[0].cues.push({ id: "bad", atMs: 9000, action: { type: "board.highlight", targetId: "missing" } });
}), language), /Unknown board target/);
assert.throws(() => validateInteractiveLessons(mutate((copy) => {
  copy.interactiveLessons[0].segments[2].activityRef = "missing";
}), language), /Unknown interactive activityRef/);
assert.throws(() => validateInteractiveLessons(course, testLanguage.language), /Required speaking unavailable/);
assert.equal(lessonActionSchema.safeParse({ type: "seek", positionMs: 0 }).success, false);
assert.equal(lessonActionSchema.safeParse({ type: "completeLesson" }).success, false);

const runtimeCourse = runtimeBundle(spanish).course;
const publicLesson = publicCourse(runtimeCourse, language).units.flatMap((unit) => unit.lessons)
  .find((item) => item.id === definition.lessonId);
assert.ok(publicLesson);
const publicPayload = JSON.stringify({ definition, lesson: publicLesson });
for (const privateField of ["answer", "accepted", "fullAnswers"]) {
  assert.equal(publicPayload.includes(`"${privateField}":`), false, `${privateField} must stay on server`);
}

const cues = definition.segments[1].cues;
const timeline = new TimelineEngine();
timeline.load(cues);
assert.equal(timeline.getStateAt(0).elements.length, 1);
assert.equal(timeline.seek(12000).highlightedIds[0], "ella");
assert.equal(timeline.getStateAt(16000).elements.length, 4);
const effectsEngine = new TimelineEngine();
effectsEngine.load([{ id: "sound", atMs: 3000, action: { type: "audio.play", mediaId: "demo" } }]);
assert.equal(effectsEngine.seek(4000).elements.length, 0);
assert.equal(effectsEngine.tick(4000).effects.length, 0, "seek cannot replay audio");
effectsEngine.reset();
assert.equal(effectsEngine.tick(4000).effects.length, 1);
assert.equal(effectsEngine.tick(4000).effects.length, 0);
assert.equal(resumeAnchor([0, 8000, 17000, 25000], 18400), 17000);

let state = initialRuntime(definition);
const canonicalSegments = JSON.stringify(definition.segments);
const firstEvents = deriveLessonEvents(null, reduceRuntime(definition, state, { type: "START" }), definition);
assert.deepEqual(firstEvents.map((event) => event.type), ["lesson.started", "lesson.segment.started"]);
state = reduceRuntime(definition, state, { type: "START" });
assert.equal(state.phase, "presenting");
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: timeline.getStateAt(0) });
assert.equal(state.segmentIndex, 0, "presentation cannot be skipped");
state = reduceRuntime(definition, state, { type: "TICK", positionMs: 8000, board: new TimelineEngine().getStateAt(0) });
state = reduceRuntime(definition, state, { type: "INTERVENE", reason: "explain", anchorMs: 7000 });
assert.equal(state.phase, "intervening");
assert.equal(state.resumePoint?.anchorMs, 7000);
assert(deriveLessonEvents(reduceRuntime(definition, state, { type: "RESUME", board: state.board }), state, definition)
  .some((event) => event.type === "lesson.did_not_understand"));
assert.equal("mastery" in state, false, "intervention changes no mastery");
state = reduceRuntime(definition, state, { type: "RESUME", board: timeline.getStateAt(0) });
assert.equal(state.positionMs, 7000);
state = reduceRuntime(definition, state, { type: "TICK", positionMs: 14000, board: state.board });
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: timeline.getStateAt(0) });
assert.equal(state.segmentIndex, 1);
state = reduceRuntime(definition, state, { type: "TICK", positionMs: 20000, board: timeline.getStateAt(20000) });
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: timeline.getStateAt(0) });
assert.equal(state.phase, "checkpoint");
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: timeline.getStateAt(0) });
assert.equal(state.segmentIndex, 2, "required checkpoint blocks progress");
state = reduceRuntime(definition, state, { type: "CHECKPOINT_RESULT", correct: false });
state = reduceRuntime(definition, state, { type: "CHECKPOINT_RESULT", correct: false });
state = reduceRuntime(definition, state, { type: "REINFORCE" });
assert.equal(state.runtimePath.filter((node) => node.kind === "reinforcement").length, 1);
assert.equal(JSON.stringify(definition.segments), canonicalSegments, "runtime adaptation does not edit authored content");
state = reduceRuntime(definition, state, { type: "REINFORCE" });
assert.equal(state.runtimePath.filter((node) => node.kind === "reinforcement").length, 1, "no reinforcement loop");
state = reduceRuntime(definition, state, { type: "REINFORCEMENT_DONE" });
state = reduceRuntime(definition, state, { type: "CHECKPOINT_RESULT", correct: true });
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: timeline.getStateAt(0) });
assert.equal(state.phase, "speaking");
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: timeline.getStateAt(0) });
assert.equal(state.segmentIndex, 3, "required speaking blocks progress");
state = reduceRuntime(definition, state, { type: "SPEAKING_SAVED" });
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: timeline.getStateAt(0) });
state = reduceRuntime(definition, state, { type: "NEXT", nextBoard: timeline.getStateAt(0) });
assert.equal(state.phase, "completed");
assert.equal("mastery" in state, false, "operational completion changes no mastery");
const restored = reduceRuntime(definition, initialRuntime(definition), { type: "RESTORE", state: JSON.parse(JSON.stringify(state)) });
assert.deepEqual(restored, state, "serialized session restores its runtime path and completion");
console.log("Interactive lesson: content, privacy, timeline, transitions, ES/EN/xx-Test verified.");
