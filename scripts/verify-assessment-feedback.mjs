import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dependencies =
  process.env.DESTRAVA_TEST_NODE_MODULES ?? resolve(root, "node_modules");
const require = createRequire(import.meta.url),
  ts = require(resolve(dependencies, "typescript"));
const React = require(resolve(dependencies, "react")),
  jsx = require(resolve(dependencies, "react/jsx-runtime"));
const { renderToStaticMarkup } = require(
  resolve(dependencies, "react-dom/server"),
);
let study,
  overrides = {},
  hookIndex = 0;
const hookReact = {
  ...React,
  useRef: (value) => ({ current: value }),
  useState: (initial) => {
    const index = hookIndex++;
    return [
      Object.hasOwn(overrides, index)
        ? overrides[index]
        : typeof initial === "function"
          ? initial()
          : initial,
      () => {
        throw Error("Unexpected mutation in passive result rendering");
      },
    ];
  },
};
const cache = new Map();
function load(relative) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path);
  const source = readFileSync(path, "utf8");
  const result = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
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
  const imports = (id) => {
    if (id === "react/jsx-runtime") return jsx;
    if (id === "react") return hookReact;
    if (id === "next/link")
      return {
        default: ({ children, ...props }) =>
          React.createElement("a", props, children),
      };
    if (id === "lucide-react") return new Proxy({}, { get: () => () => null });
    if (id === "@/components/study-provider") return { useStudy: () => study };
    if (id === "@/components/activities/exercise-card")
      return {
        ExerciseCard: () =>
          React.createElement("div", { "data-active-exercise": true }),
      };
    if (id === "@/components/learning/text-presentation")
      return {
        LearningText: ({ as = "p", text }) =>
          React.createElement(as, null, text),
      };
    assert.ok(
      id.startsWith(".") || id.startsWith("@/"),
      "Unexpected runtime import " + id,
    );
    const location = id.startsWith("@/")
      ? resolve(root, "src", id.slice(2))
      : resolve(dirname(path), id);
    const found = [location, location + ".ts", location + ".tsx"].find(
      existsSync,
    );
    assert.ok(found, "Missing module " + id);
    return load(found);
  };
  new Function("exports", "require", "module", result.outputText)(
    loadedModule.exports,
    imports,
    loadedModule,
  );
  cache.set(path, loadedModule.exports);
  return loadedModule.exports;
}
const { AssessmentFeedback, assessmentFeedbackEntries } = load(
  "src/components/activities/assessment-feedback.tsx",
);
const { AssessmentResult } = load(
  "src/components/activities/assessment-result.tsx",
);
const { AdaptiveAssessmentRunner } = load(
  "src/components/activities/adaptive-assessment-runner.tsx",
);
const fixed = {
  id: "final",
  method: "fixed",
  purpose: "summative",
  title: "Final check",
  activityIds: ["choice", "fill", "writing"],
  passingPolicy: { overall: 0.8 },
};
const adaptive = {
  id: "diagnostic",
  method: "adaptive",
  purpose: "diagnostic",
  title: "Diagnostic check",
  skillPlan: ["grammar", "grammar"],
  skillWeights: { grammar: 1 },
  bank: [
    { activityId: "choice", skill: "grammar", difficulty: 2 },
    { activityId: "fill", skill: "grammar", difficulty: 2 },
  ],
  passingPolicy: { overall: 0.8 },
};
const course = {
  id: "new-course",
  slug: "new-course",
  level: "A1",
  contentVersion: "1.0.0",
  assessments: [fixed, adaptive],
  units: [
    {
      id: "unit",
      number: 1,
      lessons: [
        {
          id: "lesson",
          slug: "lesson",
          activities: [
            {
              id: "choice",
              title: "Public choice title",
              prompt: "Public choice prompt",
              type: "multiple_choice",
              skills: ["grammar"],
              skill: "grammar",
            },
            {
              id: "fill",
              title: "Public fill title",
              prompt: "Public fill prompt",
              type: "fill_blank",
              skills: ["grammar"],
              skill: "grammar",
            },
            {
              id: "writing",
              title: "Public writing title",
              prompt: "Public writing prompt",
              type: "writing",
              skills: ["writing"],
              skill: "writing",
            },
          ],
        },
      ],
    },
  ],
};
const result = (definition = fixed) => ({
  id: "server-attempt",
  courseId: course.id,
  assessmentId: definition.id,
  contentVersion: course.contentVersion,
  source: "server",
  purpose: definition.purpose,
  method: definition.method,
  status: "completed",
  startedAt: "2026-10-24T12:00:00.000Z",
  finishedAt: "2026-10-24T12:01:00.000Z",
  objectiveScore: 50,
  passed: false,
  answers: [
    {
      activityId: "choice",
      skill: "grammar",
      difficulty: 2,
      correct: false,
      answer: "submitted distractor",
      correctAnswer: "expected reference",
      explanation: "Editorial contrast for this distractor.",
    },
    {
      activityId: "fill",
      skill: "grammar",
      difficulty: 2,
      correct: true,
      answer: "correct response",
      correctAnswer: "correct response",
      explanation: "Editorial explanation for the correct response.",
    },
  ],
});
function state(fixedResults = [], adaptiveResults = []) {
  return {
    assessmentAttempts: fixedResults,
    adaptiveAssessments: adaptiveResults,
    adaptiveProgress: [],
  };
}
function context(value) {
  study = {
    course,
    state: value,
    language: { speech: { support: { speechRecognition: false } } },
    runtime: null,
    submitAssessment: () => {
      throw Error("Unexpected assessment call");
    },
    recordStudyEvent: () => {
      throw Error("Unexpected event");
    },
    confirmAdaptiveProgress: () => {
      throw Error("Unexpected prefix");
    },
  };
}
function render(Component, props, states = {}) {
  hookIndex = 0;
  overrides = states;
  return renderToStaticMarkup(React.createElement(Component, props));
}
const marker = "Aprenda com suas respostas";
test("fixed current server result renders every returned explanation, own response and expected contrast", () => {
  context(state([result()]));
  const html = render(AssessmentResult, { assessmentId: fixed.id });
  assert.match(html, /Aprenda com suas respostas/);
  assert.match(html, /submitted distractor/);
  assert.match(html, /expected reference/);
  assert.match(html, /Editorial contrast/);
  assert.match(html, /Editorial explanation for the correct/);
  assert.equal((html.match(/<summary/g) || []).length, 2);
  assert.match(html, /Public choice title/);
  assert.match(html, /Public choice prompt/);
});
test("latest scoped result wins while previous explanations remain hidden in history", () => {
  const prior = {
    ...result(),
    id: "prior",
    finishedAt: "2026-10-23T12:01:00.000Z",
    answers: [
      {
        ...result().answers[0],
        explanation: "PRIOR_EXPLANATION_MUST_STAY_HIDDEN",
      },
    ],
  };
  context(state([prior, result()]));
  const html = render(AssessmentResult, { assessmentId: fixed.id });
  assert.ok(html.includes(marker));
  assert.ok(!html.includes("PRIOR_EXPLANATION_MUST_STAY_HIDDEN"));
  assert.match(html, /Resultados anteriores/);
});
for (const [name, change] of [
  [
    "historical",
    (r) => {
      r.source = "historical";
    },
  ],
  [
    "course",
    (r) => {
      r.courseId = "old-course";
    },
  ],
  [
    "assessment",
    (r) => {
      r.assessmentId = "foreign";
    },
  ],
  [
    "version",
    (r) => {
      r.contentVersion = "0.9.0";
    },
  ],
  [
    "purpose",
    (r) => {
      r.purpose = "formative";
    },
  ],
  [
    "method",
    (r) => {
      r.method = "adaptive";
    },
  ],
  [
    "not finished",
    (r) => {
      r.status = undefined;
    },
  ],
  [
    "invalid finish",
    (r) => {
      r.finishedAt = "invalid";
    },
  ],
  [
    "foreign answer activity",
    (r) => {
      r.answers[0].activityId = "outside";
    },
  ],
])
  test("feedback stays absent for " + name, () => {
    const value = result();
    change(value);
    assert.deepEqual(assessmentFeedbackEntries(course, fixed, value), []);
    context(state([value]));
    const html = render(AssessmentResult, { assessmentId: fixed.id });
    assert.ok(!html.includes(marker));
    assert.ok(!html.includes("Editorial contrast"));
  });
test("no result renders no explanations and requests current confirmation honestly", () => {
  context(state());
  const html = render(AssessmentResult, { assessmentId: fixed.id });
  assert.ok(!html.includes(marker));
  assert.match(html, /resultado atual confirmado/);
  assert.equal(
    render(AssessmentFeedback, {
      course,
      assessment: fixed,
      result: undefined,
    }),
    "",
  );
});
test("writing is an ungraded delivery with no expected-answer or correctness claim", () => {
  const value = result();
  value.answers = [
    {
      activityId: "writing",
      skill: "writing",
      correct: null,
      answer: "A submitted text",
      correctAnswer: "DO_NOT_RENDER_WRITING_KEY",
      explanation: "Texto entregue; n\u00e3o integra a nota objetiva.",
    },
  ];
  const html = render(AssessmentFeedback, {
    course,
    assessment: fixed,
    result: value,
  });
  assert.match(html, /Entrega sem nota/);
  assert.match(html, /qualidade lingu/);
  assert.match(html, /A submitted text/);
  assert.ok(!html.includes("Resposta esperada"));
  assert.ok(!html.includes("DO_NOT_RENDER_WRITING_KEY"));
  assert.ok(!html.includes("Resposta correta"));
});
test("server explanation, answer, contrast and public title are escaped as text", () => {
  const value = result();
  value.answers = [
    {
      ...value.answers[0],
      answer: "<img src=x onerror=alert(1)>",
      correctAnswer: "<script>alert(2)</script>",
      explanation: "<svg onload=alert(3)>Editorial</svg>",
    },
  ];
  const hostileCourse = structuredClone(course);
  hostileCourse.units[0].lessons[0].activities[0].title = "<iframe src=bad>";
  const html = render(AssessmentFeedback, {
    course: hostileCourse,
    assessment: fixed,
    result: value,
  });
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&lt;script"));
  assert.ok(html.includes("&lt;svg"));
  assert.ok(html.includes("&lt;iframe"));
  for (const tag of ["img", "script", "svg", "iframe"])
    assert.ok(!html.includes("<" + tag));
});
test("passive details have native summaries, focus styles and wrap long text for narrow screens", () => {
  const value = result(),
    before = structuredClone(value);
  const html = render(AssessmentFeedback, {
    course,
    assessment: fixed,
    result: value,
  });
  assert.equal((html.match(/<details/g) || []).length, 2);
  assert.equal((html.match(/<summary/g) || []).length, 2);
  assert.match(html, /focus-visible:outline/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.deepEqual(value, before);
});
test("finished insufficient server result explains answers without inventing a score", () => {
  const value = {
    ...result(),
    status: "insufficient",
    objectiveScore: null,
    passed: null,
  };
  context(state([value]));
  const html = render(AssessmentResult, { assessmentId: fixed.id });
  assert.ok(html.includes(marker));
  assert.match(html, /ainda n/);
  assert.ok(!html.includes("null%"));
});
test("adaptive stored current result displays server feedback on the result screen", () => {
  context(state([], [result(adaptive)]));
  const html = render(AdaptiveAssessmentRunner, { assessment: adaptive });
  assert.ok(html.includes(marker));
  assert.match(html, /Editorial contrast/);
});
test("adaptive assessment in progress never displays prior or local feedback", () => {
  context(state([], [result(adaptive)]));
  const local = [
    {
      ...result(adaptive).answers[0],
      explanation: "LOCAL_FEEDBACK_NOT_CONFIRMED",
    },
  ];
  const html = render(
    AdaptiveAssessmentRunner,
    { assessment: adaptive },
    { 1: "2026-10-24T12:00:00.000Z", 2: local, 7: "new-attempt" },
  );
  assert.ok(!html.includes(marker));
  assert.ok(!html.includes("Editorial contrast"));
  assert.ok(!html.includes("LOCAL_FEEDBACK_NOT_CONFIRMED"));
});
test("adaptive finished local state waits for the matching current server attempt", () => {
  context(state([], [result(adaptive)]));
  const html = render(
    AdaptiveAssessmentRunner,
    { assessment: adaptive },
    {
      1: "2026-10-24T12:00:00.000Z",
      2: result(adaptive).answers,
      4: true,
      7: "different-attempt",
    },
  );
  assert.ok(!html.includes(marker));
  assert.ok(!html.includes("Editorial contrast"));
});
test("adaptive matching finished attempt displays only the server explanation", () => {
  context(state([], [result(adaptive)]));
  const local = result(adaptive).answers.map((item) => ({
    ...item,
    explanation: "LOCAL_EXPLANATION_MUST_NOT_RENDER",
  }));
  const html = render(
    AdaptiveAssessmentRunner,
    { assessment: adaptive },
    { 1: "2026-10-24T12:00:00.000Z", 2: local, 4: true, 7: "server-attempt" },
  );
  assert.ok(html.includes(marker));
  assert.ok(html.includes("Editorial contrast"));
  assert.ok(!html.includes("LOCAL_EXPLANATION_MUST_NOT_RENDER"));
});
for (const [name, change] of [
  [
    "history",
    (r) => {
      r.source = "historical";
    },
  ],
  [
    "version",
    (r) => {
      r.contentVersion = "old";
    },
  ],
  [
    "course",
    (r) => {
      r.courseId = "foreign";
    },
  ],
  [
    "purpose",
    (r) => {
      r.purpose = "summative";
    },
  ],
  [
    "method",
    (r) => {
      r.method = "fixed";
    },
  ],
  [
    "assessment",
    (r) => {
      r.assessmentId = "foreign";
    },
  ],
])
  test("adaptive feedback excludes " + name, () => {
    const value = result(adaptive);
    change(value);
    context(state([], [value]));
    const html = render(AdaptiveAssessmentRunner, { assessment: adaptive });
    assert.ok(!html.includes(marker));
    assert.ok(!html.includes("Editorial contrast"));
  });
