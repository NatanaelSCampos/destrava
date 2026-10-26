import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dependencies =
  process.env.DESTRAVA_TEST_NODE_MODULES ?? resolve(root, "node_modules");
const require = createRequire(import.meta.url);
const ts = require(resolve(dependencies, "typescript/lib/typescript.js"));
const React = require(resolve(dependencies, "react"));
const jsx = require(resolve(dependencies, "react/jsx-runtime"));
const { renderToStaticMarkup } = require(
  resolve(dependencies, "react-dom/server"),
);

function evaluate(source, filename, importModule, globals = {}) {
  const result = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
  });
  assert.deepEqual(
    result.diagnostics?.filter(
      (item) => item.category === ts.DiagnosticCategory.Error,
    ),
    [],
  );
  const loadedModule = { exports: {} };
  new Function(
    "exports",
    "require",
    "module",
    ...Object.keys(globals),
    result.outputText,
  )(loadedModule.exports, importModule, loadedModule, ...Object.values(globals));
  return loadedModule.exports;
}

// Load pure TypeScript in memory. Operational capability providers are deliberately inert.
const stubs = {
  "@/lib/feature-flags": { featureFlags: { SPACED_REPETITION: true } },
  "@/lib/capability-environment": {
    serverCapabilityEnvironment() {
      throw new Error("No provider environment in pure tests");
    },
  },
  "@/engine/capabilities/compatibility": {
    negotiateCapabilities() {
      throw new Error("Unexpected negotiation");
    },
  },
  "@/engine/capabilities/availability-projection": {
    projectCapabilityAvailability: () => ({ unavailableActivityIds: [] }),
    projectActionAvailability: () => ({}),
  },
};
const cache = new Map();
function load(relative) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path);
  const loadedModule = evaluate(readFileSync(path, "utf8"), path, (id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id === "zod") return require(resolve(dependencies, "zod"));
    assert.ok(
      id.startsWith(".") || id.startsWith("@/"),
      `Unexpected runtime import: ${id}`,
    );
    const location = id.startsWith("@/")
      ? resolve(root, "src", id.slice(2))
      : resolve(dirname(path), id);
    const found = [location, `${location}.ts`, `${location}.tsx`].find(
      existsSync,
    );
    assert.ok(found, `Missing source module: ${id}`);
    return load(found);
  });
  cache.set(path, loadedModule);
  return loadedModule;
}
const { publicCourse } = load("src/content/public.ts");
const { gradeActivity } = load("src/domain/activities/grader.ts");
const { activityPayloadSchemas } = load("src/content/activity-data.ts");

function listening(
  media = {
    kind: "audio",
    url: "/media/synthetic-listening.wav",
    transcriptAvailableAfterAttempt: true,
  },
) {
  return {
    id: "listening-a",
    type: "listening",
    title: "Listen",
    prompt: "Choose",
    minutes: 1,
    transcript: "PRIVATE_TRANSCRIPT_SENTINEL",
    answer: "PRIVATE_ANSWER_SENTINEL",
    accepted: ["PRIVATE_ACCEPTED_SENTINEL"],
    explanation: "PRIVATE_EXPLANATION_SENTINEL",
    options: ["First option", "Second option"],
    media,
  };
}
function project(activity) {
  const course = {
    id: "synthetic-course",
    assessments: [],
    units: [
      { active: true, lessons: [{ active: true, activities: [activity] }] },
    ],
  };
  return publicCourse(course, undefined, {});
}
function projectedActivity(activity) {
  return project(activity).units[0].lessons[0].activities[0];
}

test("recorded listening transcript and private answers do not cross serialized public/SSR projection", () => {
  const exposed = project(listening());
  assert.equal(exposed.units[0].lessons[0].activities[0].transcript, "");
  const serialized = JSON.stringify(exposed);
  const html = renderToStaticMarkup(
    React.createElement("pre", null, serialized),
  );
  assert.doesNotMatch(serialized, /PRIVATE_/);
  assert.doesNotMatch(html, /PRIVATE_/);
  assert.match(serialized, /synthetic-listening\.wav/);
});

test("omitted audio transcript policy defaults to hidden in both schema and projection", () => {
  const media = { kind: "audio", url: "/media/synthetic-listening.wav" };
  assert.equal(projectedActivity(listening(media)).transcript, "");
  const parsed = activityPayloadSchemas.listening.parse({
    transcript: "Text",
    answer: "A",
    options: ["A", "B"],
    media,
  });
  assert.equal(parsed.media.transcriptAvailableAfterAttempt, true);
});

test("explicitly public recorded transcript is preserved", () => {
  const activity = listening({
    kind: "audio",
    url: "/media/synthetic-listening.wav",
    transcriptAvailableAfterAttempt: false,
  });
  assert.equal(projectedActivity(activity).transcript, activity.transcript);
  assert.equal(projectedActivity(activity).answer, undefined);
});

test("TTS and legacy playback retain the text they need to synthesize audio", () => {
  const tts = listening({ kind: "tts", language: "xx-Test" });
  const legacy = listening();
  delete legacy.media;
  assert.equal(projectedActivity(tts).transcript, tts.transcript);
  assert.equal(projectedActivity(legacy).transcript, legacy.transcript);
});

test("private grading still returns the original transcript after correct or incorrect attempts", () => {
  const activity = listening();
  assert.equal(projectedActivity(activity).transcript, "");
  for (const [answer, correct] of [
    [activity.answer, true],
    ["Unrelated answer", false],
  ]) {
    const result = gradeActivity(activity, answer);
    assert.equal(result.correct, correct);
    assert.equal(result.transcript, activity.transcript);
  }
});

test("projection preserves frozen private source and audio media metadata", () => {
  const activity = listening();
  Object.freeze(activity.media);
  Object.freeze(activity);
  const original = JSON.stringify(activity);
  const exposed = projectedActivity(activity);
  assert.equal(JSON.stringify(activity), original);
  assert.deepEqual(exposed.media, activity.media);
  assert.equal(activity.transcript, "PRIVATE_TRANSCRIPT_SENTINEL");
});

const classroomPath =
  "src/components/interactive-lesson/interactive-classroom.tsx";
const classroom = readFileSync(resolve(root, classroomPath), "utf8");
const ast = ts.createSourceFile(
  classroomPath,
  classroom,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function findNode(predicate) {
  let found;
  function visit(node) {
    if (!found && predicate(node)) found = node;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, "Expected region of the real classroom component");
  return found;
}
function captureFunction(name, globals) {
  const node = findNode(
    (item) => ts.isFunctionDeclaration(item) && item.name?.text === name,
  );
  return evaluate(
    `${node.getText(ast)}\nexport { ${name} };`,
    `${name}.ts`,
    () => {
      throw new Error("Unexpected handler import");
    },
    globals,
  )[name];
}
function flags(value) {
  return evaluate(
    readFileSync(resolve(root, "src/lib/feature-flags.ts"), "utf8"),
    "feature-flags.ts",
    () => {},
    {
      process: { env: { NEXT_PUBLIC_FEATURE_AI_TUTOR: value } },
    },
  ).featureFlags;
}
const tutorForm = findNode(
  (item) =>
    ts.isConditionalExpression(item) &&
    item.condition.getText(ast) === "featureFlags.AI_TUTOR" &&
    item.whenTrue.getText(ast).includes('className="live-ask"'),
);
function renderForm(enabled) {
  const { TutorForm } = evaluate(
    `export function TutorForm() { return (${tutorForm.getText(ast)}); }`,
    "tutor-form.tsx",
    (id) => {
      assert.equal(id, "react/jsx-runtime");
      return jsx;
    },
    {
      featureFlags: flags(String(enabled)),
      question: "A valid question",
      teachingBusy: false,
      questionComposing: false,
      setQuestionComposing() {},
      setQuestion() {},
      askTeacher() {},
      MessageCircle: () => null,
      Send: () => null,
      LearningTextarea: (props) => { const attributes={...props}; delete attributes.textRole; delete attributes.onCompositionChange; return React.createElement("textarea", attributes); },
    },
  );
  return renderToStaticMarkup(React.createElement(TutorForm));
}

test("AI tutor flag false renders an honest notice with no question form", () => {
  const html = renderForm(false);
  assert.match(html, /apoio preparado/);
  assert.match(html, /Dúvidas livres não recebem respostas automáticas/);
  assert.doesNotMatch(html, /<(form|textarea|button)\b/);
});

test("AI tutor flag true retains the question form", () => {
  const html = renderForm(true);
  assert.match(html, /<form/);
  assert.match(html, /<textarea/);
  assert.match(html, /type="submit"/);
  assert.doesNotMatch(html, /não recebem respostas automáticas/);
});

test("disabled AI handler returns before fetch or any classroom state changes", async () => {
  let calls = 0;
  const forbidden = () => {
    calls += 1;
    throw new Error("Disabled tutor must not run");
  };
  const handler = captureFunction("askTeacher", {
    featureFlags: flags("false"),
    questionComposing: false,
    fetch: forbidden,
    intervene: forbidden,
    setTeachingBusy: forbidden,
    setQuestion: forbidden,
    setSupportMode: forbidden,
  });
  await handler("A valid question");
  assert.equal(calls, 0);
});

test("enabled AI handler preserves its request path using a local fake fetch only", async () => {
  const requests = [];
  const handler = captureFunction("askTeacher", {
    featureFlags: flags("true"),
    questionComposing: false,
    teachingBusy: false,
    requestId: { current: 0 },
    state: { phase: "paused", positionMs: 100 },
    intervene() {},
    setSupportMode() {},
    setTeachingBusy() {},
    setQuestion() {},
    setTeaching() {},
    courseId: "course-a",
    definition: { lessonId: "lesson-a" },
    segment: { id: "segment-a" },
    fetch: async (...request) => {
      requests.push(request);
      return {
        ok: true,
        json: async () => ({ message: "Local fixture", actions: [] }),
      };
    },
  });
  await handler("  A valid question  ");
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "/api/ai/interactive-lesson");
  assert.equal(JSON.parse(requests[0][1].body).question, "A valid question");
});

test("deterministic explain/example/practice interventions remain usable with AI disabled", () => {
  for (const mode of ["explain", "example", "practice"]) {
    const events = [];
    const selected = [];
    const intervene = captureFunction("intervene", {
      featureFlags: flags("false"),
      segment: { allowInterruption: true, resumeAnchorsMs: [0] },
      state: { phase: "paused", positionMs: 100 },
      nextActivity: "practice-a",
      cancelPlayback() {},
      setSupportMode: (value) => selected.push(value),
      setPracticeActivityRef() {},
      setTeaching() {},
      dispatch: (event) => events.push(event),
      resumeAnchor: () => 0,
      fetch() {
        throw new Error("Deterministic support must not call a provider");
      },
    });
    intervene(mode);
    assert.deepEqual(selected, [mode]);
    assert.equal(events[0].type, "INTERVENE");
    assert.equal(events[0].reason, mode);
  }
});
