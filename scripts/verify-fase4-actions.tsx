import type { CapabilityDiagnostic } from "../src/content/capability-contracts";
import { requireCourseBundle } from "../src/content/course-registry";
import { interactiveLessonSchema } from "../src/content/contracts";
import { courseWithDeviceAvailability } from "../src/lib/client-capabilities";
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { frecuenciasA1 } from "../src/content/frecuencias-a1";
import { publicCourse, type PublicCourse } from "../src/content/public";
import { spanishResources } from "../src/content/spanish-resources";
import { initialStudyState, recordAttempt } from "../src/domain/study/study-state";
import { buildLearningProfile } from "../src/domain/study/learning-profile";
import { LearningRecommendationEngine } from "../src/domain/study/learning-recommendation-engine";
import { buildStudyPlan, nextActivity } from "../src/domain/study/study-planner";
import * as actions from "../src/domain/study/learning-action-availability";
import { projectActionAvailability, projectCapabilityAvailability } from "../src/engine/capabilities/availability-projection";
import { featureFlags } from "../src/lib/feature-flags";
const compiled = { source: "compiled", permitted: true } as const;
const installed = { source: "installed", permitted: true } as const;
const now = new Date("2026-10-22T12:00:00Z");
const course = publicCourse(frecuenciasA1, undefined, {
  dependencies: { "ai.text_service": { state: "unknown", reason: "Configured, verify on execution." } },
});
const vocabulary = spanishResources.vocabulary;
const activity = course.units.flatMap(unit => unit.lessons.flatMap(lesson => lesson.activities)).find(item => item.type === "fill_blank")!;
const mistaken = recordAttempt(structuredClone(initialStudyState), activity, "wrong", {
  correct: false, correctAnswer: "expected", explanation: "Try again.",
});
mistaken.courseId = course.id;
mistaken.mistakes[activity.id].lastMissedAt = now.toISOString();
mistaken.mistakes[activity.id].schedule.nextReviewAt = "2026-10-20T12:00:00Z";
const recommend = (content: PublicCourse, context = compiled) => LearningRecommendationEngine.recommend(content, mistaken,
  buildLearningProfile(content, mistaken, vocabulary, spanishResources, now), vocabulary, spanishResources, { now, actionContext: context });

test("F3: unavailable SRS keeps a due error as an executable curriculum activity", () => {
  const content = structuredClone(course); content.availability!.spacedRepetition = false;
  const before = JSON.stringify(mistaken);
  const result = recommend(content);
  assert(!result.some(item => item.kind === "review"));
  assert(result.some(item => item.kind === "activity" && item.source === "mistake" && item.id === activity.id));
  assert.equal(JSON.stringify(mistaken), before);
});
test("compiled available review preserves review priority", () => {
  if (featureFlags.SPACED_REPETITION) assert.equal(recommend(course)[0]?.kind, "review");
});
test("unsupported installed operations cannot be enabled by an available DTO", () => {
  const content = structuredClone(course);
  for (const value of Object.values(content.availability!.actionStates!)) value.state = "available";
  for (const kind of ["review", "numbers", "conversation", "image", "micro_lesson", "interactive", "speaking", "tutor"] as const)
    assert.equal(actions.learningActionAvailability(content, { kind }, installed).eligible, false, kind);
});
test("operation unknown is conditional; missing service and missing state are unavailable", () => {
  const conditional = actions.learningActionAvailability(course, { kind: "conversation" }, compiled);
  assert.equal(conditional.operation, "unknown"); assert.equal(conditional.eligible, featureFlags.AI_TUTOR);
  assert(conditional.reasons.some(reason => reason.includes("condicional")));
  const missing = publicCourse(frecuenciasA1, undefined, { dependencies: { "ai.text_service": { state: "unavailable", reason: "Absent" } } });
  assert.equal(actions.learningActionAvailability(missing, { kind: "conversation" }, compiled).eligible, false);
  delete missing.availability!.actionStates;
  assert.equal(actions.learningActionAvailability(missing, { kind: "conversation" }, compiled).operation, "unavailable");
});
test("permission denied and unknown never become allowed", () => {
  for (const permitted of [false, undefined]) {
    const result = actions.learningActionAvailability(course, { kind: "review" }, { source: "compiled", permitted });
    assert.equal(result.eligible, false); assert.notEqual(result.permission, "allowed");
  }
});
test("ineligible activities cannot enter recommendations, plans, or nextActivity", () => {
  const content = structuredClone(course);
  const allIds = content.units.flatMap(unit => unit.lessons.flatMap(lesson => lesson.activities.map(item => item.id)));
  content.availability!.unavailableActivityIds = allIds;
  content.availability!.spacedRepetition = false;
  assert(!recommend(content).some(item => item.kind === "activity"));
  assert(!buildStudyPlan(content, mistaken, 15, vocabulary, spanishResources, now, "guided", compiled).some(item => item.kind === "activity"));
  assert.equal(nextActivity(content, mistaken, compiled), undefined);
});
test("installed plan does not add blocked review or focused conversation", () => {
  const plan = buildStudyPlan(course, mistaken, 15, vocabulary, spanishResources, now, "difficulties", installed);
  assert(!plan.some(item => item.kind === "review" || item.kind === "conversation"));
  assert(plan.some(item => item.kind === "activity" && item.id === activity.id));
});
test("unavailable required item remains named and does not mutate completion", () => {
  const content = structuredClone(course), unit = content.units[0];
  unit.learningPolicy = { completion: { requirements: [] }, mastery: { requirements: [] } };
  unit.learningPolicy.completion.requirements = [{ kind: "participation", id: "required", label: "Required synthetic practice", activityIds: [activity.id] }];
  content.availability!.unavailableActivityIds = [activity.id];
  const before = JSON.stringify(mistaken);
  assert(actions.unavailableLearningRequirements(content, mistaken, compiled).some(item => item.label === "Required synthetic practice"));
  assert.equal(JSON.stringify(mistaken), before);
});
test("DTO projection never serializes provider configuration", () => {
  const encoded = JSON.stringify(course.availability);
  for (const forbidden of ["OPENAI_API_KEY", "AZURE_SPEECH_KEY", "endpoint", "apiKey", "service_role"]) assert(!encoded.includes(forbidden));
});
function renderedNumberGuide(content: PublicCourse, source: "compiled" | "installed") {
  const exports: Record<string, unknown> = {};
  const noop = () => null;
  const requireMock = (name: string): unknown => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "react") return { useMemo: (fn: () => unknown) => fn(), useState: (value: unknown) => [value, noop] };
    if (name === "next/link") return { default: ({ children, ...props }: Record<string, unknown>) => createElement("a", props, children as never), __esModule: true };
    if (name === "lucide-react") return { ArrowRight: noop, Hash: noop, Search: noop };
    if (name.includes("learning-action-availability")) return actions;
    if (name.includes("text-presentation")) return { useTextPresentation: () => () => ({}), LearningText: ({ text }: { text: string }) => text };
    if (name.includes("speak-button")) return { SpeakButton: noop };
    if (name.includes("number-practice")) return { numberPracticeLink: (id: string) => `/numbers?prompt=${id}` };
    if (name.includes("study-provider")) return { useStudy: () => ({ course: content, resources: spanishResources,
      language: { identity: { nativeName: "Synthetic" } }, runtime: source === "installed" ? {} : undefined }) };
    throw Error(`Unexpected component dependency ${name}`);
  };
  const code = ts.transpileModule(fs.readFileSync("src/components/basics/number-guide.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: requireMock });
  return renderToStaticMarkup(createElement(exports.NumberGuide as () => ReturnType<typeof createElement>));
}
test("F4: actual NumberGuide output has no global or per-card blocked practice links", () => {
  assert(!renderedNumberGuide(course, "installed").includes('href="/numbers'));
  const compiledHtml = renderedNumberGuide(course, "compiled");
  assert(compiledHtml.includes('href="/numbers')); assert(compiledHtml.includes("condicional"));
});
function environmentModule(options: { key?: boolean; azure?: boolean }) {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(fs.readFileSync("src/lib/capability-environment.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, process: { env: { ...(options.key ? { OPENAI_API_KEY: "synthetic" } : {}), ...(options.azure ? { AZURE_SPEECH_KEY: "synthetic" } : {}) } }, require: (name: string) => {
    if (name.includes("azure-speech")) return { speechEndpoint: () => options.azure ? "synthetic-endpoint" : null };
    if (name.includes("feature-flags")) return { featureFlags };
    if (name.includes("language-variant")) return { speechLocale: () => "synthetic", textToSpeechLocale: () => "synthetic" };
    throw Error("Unexpected environment dependency " + name);
  } });
  return exports;
}
test("shared configuration projection preserves unavailable, configured unknown, and language restrictions", () => {
  const missing = environmentModule({});
  const configured = environmentModule({ key: true, azure: true });
  const service = configured.serverServiceAvailability as () => Record<string, { state: string }>;
  assert.equal(service()["ai.text_service"].state, "unknown");
  assert.equal((missing.serverServiceAvailability as typeof service)()["ai.text_service"].state, "unavailable");
  const environment = (configured.serverCapabilityEnvironment as (language: unknown) => { dependencies: Record<string, { state: string }> })({ speech: { support: { speechRecognition: false, pronunciationAssessment: false, textToSpeech: false } } });
  assert.equal(environment.dependencies["speech.recognition_service"].state, "unavailable");
  assert.equal(environment.dependencies["speech.pronunciation_service"].state, "unavailable");
});

function guarded(options: { key?: boolean; azure?: boolean; installed?: boolean; auth?: boolean; version?: boolean } = {}) {
  const exports: Record<string, unknown> = {}; let reservations = 0;
  const code = ts.transpileModule(fs.readFileSync("src/domain/ai/ai-request-guard.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const requireMock = (name: string) => {
    if (name === "next/server") return { NextResponse: { json: Response.json } };
    if (name.includes("capability-environment")) return environmentModule(options);
    if (name.includes("availability-projection")) return { projectActionAvailability };
    if (name.includes("supabase/server")) return { isSupabaseConfigured: () => true, getAuthenticatedUser: async () => options.auth === false ? null : { id: "synthetic-user" },
      createSupabaseServerClient: async () => ({ rpc: async () => { reservations++; return { data: "reservation", error: null }; } }) };
    if (name.includes("versioned-operation-guard")) return { unsupportedVersionRequest: async () => options.version ? Response.json({}, { status: 422 }) : null };
    if (name.includes("application-course-runtime")) return { isSelectedInstalled: async () => Boolean(options.installed) };
    throw Error(`Unexpected guard dependency ${name}`);
  };
  vm.runInNewContext(code, { exports, require: requireMock, Response, process: { env: { DESTRAVA_LOCAL_ONLY: "1", NODE_ENV: "development", ...(options.key ? { OPENAI_API_KEY: "synthetic" } : {}), ...(options.azure ? { AZURE_SPEECH_KEY: "synthetic" } : {}) } } });
  return { run: exports.guardAIRequest as (request: Request, feature: string) => Promise<{ error?: Response; userId?: string }>, reservations: () => reservations };
}
for (const scenario of [{ auth: false, expected: 401 }, { installed: true, expected: 422 }, { version: true, expected: 422 }, { expected: 503 }]) {
  test(`guard before quota: ${JSON.stringify(scenario)}`, async () => {
    const guard = guarded(scenario);
    assert.equal((await guard.run(new Request("https://synthetic.invalid"), "tutor")).error?.status, scenario.expected);
    assert.equal(guard.reservations(), 0);
  });
}
test("configured unknown permits guarded reservation, not fake health", async () => {
  const guard = guarded({ key: true }); assert(!(await guard.run(new Request("https://synthetic.invalid"), "tutor")).error); assert.equal(guard.reservations(), 1);
});
test("Azure transcription does not require an OpenAI key", async () => {
  const guard = guarded({ azure: true }); assert(!(await guard.run(new Request("https://synthetic.invalid"), "conversation_transcription")).error); assert.equal(guard.reservations(), 1);
});

function assessmentFixture(withDiagnostic = false) {
  const content = structuredClone(course);
  content.assessmentRefs = {};
  content.assessments = [{ id: "synthetic-final", title: "Synthetic final", purpose: "summative", method: "fixed",
    objectiveIds: [], activityIds: [activity.id], gradingStrategy: "objective_mean", passingPolicy: { overall: 0.8 } }];
  if (withDiagnostic) {
    content.assessments.push({ ...content.assessments[0], id: "synthetic-diagnostic", purpose: "diagnostic" });
    content.assessmentRefs.diagnostic = "synthetic-diagnostic";
    content.availability!.unavailableAssessmentIds = ["synthetic-diagnostic"];
  }
  return content;
}
test("A-R1: final-only course accepts the explicitly requested final in compiled and installed context", () => {
  const content = assessmentFixture();
  const action = actions.learningActionForPath("/assessment?assessmentId=synthetic-final")!;
  assert.deepEqual(action, { kind: "assessment", id: "synthetic-final" });
  for (const context of [compiled, installed]) assert.equal(actions.learningActionAvailability(content, action, context).eligible, true);
});
test("A-R1: unavailable diagnostic does not block a different available final", () => {
  const content = assessmentFixture(true);
  const final = actions.learningActionForPath("/assessment", new URLSearchParams("assessmentId=synthetic-final"))!;
  assert.equal(actions.learningActionAvailability(content, final, installed).eligible, true);
  assert.equal(actions.learningActionAvailability(content, { kind: "assessment", id: "synthetic-diagnostic" }, installed).eligible, false);
});
test("A-R1: selector remains accessible without an ID or diagnostic; invalid and unavailable IDs remain denied", () => {
  for (const content of [assessmentFixture(), assessmentFixture(true)]) {
    assert.equal(actions.learningActionAvailability(content, actions.learningActionForPath("/assessment")!, installed).eligible, true);
    assert.equal(actions.learningActionAvailability(content, { kind: "assessment", id: "foreign-final" }, installed).eligible, false);
    content.availability!.unavailableAssessmentIds = ["synthetic-final"];
    assert.equal(actions.learningActionAvailability(content, { kind: "assessment", id: "synthetic-final" }, installed).eligible, false);
  }
});
function renderedAssessmentGate(content: PublicCourse, query: string) {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(fs.readFileSync("src/components/layout/app-shell.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name: string): unknown => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "next/navigation") return { useSearchParams: () => new URLSearchParams(query) };
    if (name === "next/link") return { default: ({ children, ...props }: Record<string, unknown>) => createElement("a", props, children as never), __esModule: true };
    if (name.includes("learning-action-availability")) return actions;
    if (name.includes("study-provider")) return { useStudy: () => ({ course: content, runtime: {} }) };
    // Other imports belong to AppShell itself; the isolated real gate does not execute them.
    return {};
  } });
  return renderToStaticMarkup(createElement(exports.AssessmentAvailabilityGate as ({ children }: { children: string }) => ReturnType<typeof createElement>, null, "ASSESSMENT_CONTENT"));
}
test("A-R1 actual gate preserves explicit-final content and selector, and blocks the unavailable explicit choice", () => {
  for (const content of [assessmentFixture(), assessmentFixture(true)]) {
    assert(renderedAssessmentGate(content, "assessmentId=synthetic-final").includes("ASSESSMENT_CONTENT"));
    assert(renderedAssessmentGate(content, "").includes("ASSESSMENT_CONTENT"));
    assert(!renderedAssessmentGate(content, "assessmentId=foreign-final").includes("ASSESSMENT_CONTENT"));
    content.availability!.unavailableAssessmentIds = ["synthetic-final"];
    assert(!renderedAssessmentGate(content, "assessmentId=synthetic-final").includes("ASSESSMENT_CONTENT"));
    assert(renderedAssessmentGate(content, "assessmentId=synthetic-final").includes('href="/assessment"'));
  }
});

const interactiveScopesCourse = {
  units: [{ id: "scope-unit", active: true, lessons: [{ id: "scope-lesson", active: true,
    activities: [{ id: "required-ref" }, { id: "optional-ref" }] }] }], assessments: [],
};
const interactiveLocations = { "scope-class": "course.interactiveLessons[0]" };
const interactiveScopes = { "scope-class": { unitId: "scope-unit", lessonId: "scope-lesson", requiredActivityIds: ["required-ref"] } };
const blocker = (location: string): CapabilityDiagnostic => ({ code: "CAPABILITY_UNAVAILABLE", severity: "error", capabilityId: "text.input",
  requiredVersion: "1.0.0", supportedVersions: ["1.0.0"], location, message: "Synthetic scope blocked", resolution: "Restore the required dependency" });
test("B-R3 canonical projection inherits unit, lesson and required-activity blockers", () => {
  for (const location of ["course.units[0].capabilityRequirements[0]", "course.units[0].lessons[0].capabilityRequirements[0]", "course.units[0].lessons[0].activities[0].input"]) {
    const result = projectCapabilityAvailability(interactiveScopesCourse, [blocker(location)], undefined, interactiveLocations, interactiveScopes);
    assert(result.unavailableInteractiveLessonIds.includes("scope-class"), location);
  }
});
test("B-R3 inactive parent and absent required reference fail closed", () => {
  const inactiveUnit = structuredClone(interactiveScopesCourse); inactiveUnit.units[0].active = false;
  const inactiveLesson = structuredClone(interactiveScopesCourse); inactiveLesson.units[0].lessons[0].active = false;
  const missingActivity = structuredClone(interactiveScopesCourse); missingActivity.units[0].lessons[0].activities = [{ id: "optional-ref" }];
  const missingOwner = structuredClone(interactiveScopesCourse); missingOwner.units = [];
  for (const content of [inactiveUnit, inactiveLesson, missingActivity, missingOwner])
    assert(projectCapabilityAvailability(content, [], undefined, interactiveLocations, interactiveScopes).unavailableInteractiveLessonIds.includes("scope-class"));
});
test("B-R3 optional blocked activity does not block the whole class", () => {
  const result = projectCapabilityAvailability(interactiveScopesCourse, [blocker("course.units[0].lessons[0].activities[1].input")], undefined, interactiveLocations, interactiveScopes);
  assert(result.unavailableActivityIds.includes("optional-ref"));
  assert(!result.unavailableInteractiveLessonIds.includes("scope-class"));
});
test("B-R3 four-argument reprojection inherits transported metadata", () => {
  const content = { ...interactiveScopesCourse, availability: { interactiveLessonScopes: interactiveScopes } };
  assert(projectCapabilityAvailability(content, [blocker("course.units[0].lessons[0].activities[0].input")], undefined, interactiveLocations).unavailableInteractiveLessonIds.includes("scope-class"));
});
function interactivePublicFixture(voiceRequired: boolean) {
  const bundle = requireCourseBundle("frecuencias-a1");
  const source = structuredClone(bundle.course);
  const request = source.capabilityRequests!.find(item => item.requirement.id === "lesson.interactive")!;
  const definition = interactiveLessonSchema.parse(request.requirement.data);
  for (const segment of definition.segments) if (segment.type === "speaking") segment.required = voiceRequired;
  const transcript = definition.segments.find(segment => segment.presentation?.transcript.length)?.presentation?.transcript;
  if (transcript?.[0]) transcript[0].text = "PRIVATE_NARRATION_SENTINEL";
  request.requirement.data = { ...definition, privateAnswer: "PRIVATE_GRADE_SENTINEL" };
  const exposed = publicCourse(source, bundle.language, { dependencies: {
    "learning.session_store": { state: "available" }, "client.recording": { state: "available" },
    "client.audio_output": { state: "available" }, "client.media_playback": { state: "available" },
  } });
  return { exposed, bundle, definition };
}
test("B-R3 SSR transports only owner IDs and required activity IDs, never private content", () => {
  const { exposed, definition } = interactivePublicFixture(false);
  const scope = exposed.availability!.interactiveLessonScopes![definition.id];
  assert.deepEqual(Object.keys(scope).sort(), ["lessonId", "requiredActivityIds", "unitId"]);
  assert.equal(scope.unitId, definition.unitId); assert.equal(scope.lessonId, definition.lessonId);
  assert.deepEqual(scope.requiredActivityIds, [...new Set(definition.segments.filter(segment => segment.required && segment.activityRef).map(segment => segment.activityRef))]);
  const serialized = JSON.stringify(exposed);
  for (const forbidden of ["PRIVATE_NARRATION_SENTINEL", "PRIVATE_GRADE_SENTINEL", '"capabilityRequests":']) assert(!serialized.includes(forbidden));
});
test("B-R3 device reprojection uses SSR metadata: required recording blocks class; optional recording does not", () => {
  for (const voiceRequired of [true, false]) {
    const { exposed, bundle, definition } = interactivePublicFixture(voiceRequired);
    assert(!exposed.availability!.unavailableInteractiveLessonIds!.includes(definition.id));
    const withoutMic = courseWithDeviceAvailability(exposed, 14, bundle.language);
    const speech = definition.segments.find(segment => segment.type === "speaking")!.activityRef!;
    assert(withoutMic.availability!.unavailableActivityIds.includes(speech));
    assert.equal(withoutMic.availability!.unavailableInteractiveLessonIds!.includes(definition.id), voiceRequired);
    assert.deepEqual(withoutMic.availability!.interactiveLessonScopes, exposed.availability!.interactiveLessonScopes);
    const restored = courseWithDeviceAvailability(withoutMic, 15, bundle.language);
    assert(!restored.availability!.unavailableInteractiveLessonIds!.includes(definition.id));
  }
});
