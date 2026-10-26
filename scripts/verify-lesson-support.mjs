import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

// Compile in memory: no generated files, shared caches, services or dependency installation.
function loadSource(path, imports = {}) {
  const result = ts.transpileModule(readFileSync(resolve(root, path), "utf8"), {
    fileName: path,
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
  const localRequire = (id) => {
    assert.ok(
      Object.hasOwn(imports, id),
      `Unexpected runtime dependency: ${id}`,
    );
    return imports[id];
  };
  new Function("exports", "require", "module", result.outputText)(
    loadedModule.exports,
    localRequire,
    loadedModule,
  );
  return loadedModule.exports;
}

const textCalls = [];
const { LessonSupport } = loadSource(
  "src/components/activities/lesson-support.tsx",
  {
    "react/jsx-runtime": jsx,
    "@/components/learning/text-presentation": {
      LearningText({
        as = "bdi",
        text,
        presentation,
        field,
        textRole,
        ...props
      }) {
        textCalls.push({ presentation, field, textRole, text });
        return React.createElement(as, props, text);
      },
    },
  },
);
const references = loadSource("src/content/assessment-references.ts");
const { assessmentsForLesson } = loadSource("src/lib/assessment-lesson.ts", {
  "@/content/assessment-references": references,
});

function explanation(overrides = {}) {
  return {
    id: "public-content",
    type: "lesson_content",
    title: "Public heading",
    body: "First public paragraph.\n\nSecond public paragraph.",
    highlights: ["Parallel public example"],
    prompt: "PRIVATE_PROMPT",
    explanation: "PRIVATE_EXPLANATION",
    answer: "PRIVATE_ANSWER",
    ...overrides,
  };
}
function lesson(activities = [explanation()]) {
  return { id: "lesson-a", title: "final diagnostic", activities };
}
function render(activities, unavailableActivityIds) {
  return renderToStaticMarkup(
    React.createElement(LessonSupport, {
      lesson: lesson(activities),
      unavailableActivityIds,
    }),
  );
}
function definition(overrides = {}) {
  return {
    id: "assessment-a",
    lessonId: "lesson-a",
    unitId: "unit-a",
    method: "fixed",
    activityIds: ["item-a", "item-b"],
    ...overrides,
  };
}
function find(
  definitions,
  activities = ["item-a", "item-b"],
  lessonOverrides = {},
) {
  return assessmentsForLesson(
    { assessments: definitions },
    { id: "unit-a" },
    { ...lesson(activities.map((id) => ({ id }))), ...lessonOverrides },
  );
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("support renders public explanation text without exercise/private data or grading controls", () => {
  const html = render([
    explanation(),
    {
      id: "item-a",
      type: "fill_blank",
      title: "PRIVATE_EXERCISE_TITLE",
      body: "PRIVATE_EXERCISE_BODY",
      answer: "PRIVATE_ANSWER",
      accepted: ["PRIVATE_ACCEPTED"],
      explanation: "PRIVATE_EXPLANATION",
    },
  ]);
  assert.match(html, /<details/);
  assert.match(html, /<summary[^>]*>Consultar explica\u00e7\u00e3o<\/summary>/);
  assert.match(html, /First public paragraph/);
  assert.match(html, /Second public paragraph/);
  assert.match(html, /Parallel public example/);
  assert.doesNotMatch(html, /PRIVATE_|<(button|input|textarea|form|a)\b/);
});

test("support ignores unavailable explanation activities", () => {
  assert.equal(render([explanation()], ["public-content"]), "");
});

test("support with no public explanation is absent", () => {
  assert.equal(
    render([{ id: "practice", type: "writing", prompt: "SECRET" }]),
    "",
  );
  assert.equal(render([explanation({ body: " \n ", highlights: [" "] })]), "");
});

test("support accepts body-only and highlights-only explanation content", () => {
  assert.match(
    render([explanation({ highlights: [] })]),
    /First public paragraph/,
  );
  assert.match(render([explanation({ body: "" })]), /Parallel public example/);
});

test("public text is escaped, including text that resembles markup", () => {
  const html = render([
    explanation({
      body: "<script>doSomething()</script>",
      highlights: ["<img src=x>"],
    }),
  ]);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<(script|img)\b/);
});

test("support preserves presentation metadata and source/target field roles", () => {
  const presentation = { direction: "rtl" };
  textCalls.length = 0;
  render([explanation({ presentation })]);
  assert.ok(textCalls.length >= 3);
  assert.ok(textCalls.every((call) => call.presentation === presentation));
  assert.ok(
    textCalls.some(
      (call) => call.field === "body" && call.textRole === "source",
    ),
  );
  assert.ok(
    textCalls.some(
      (call) => call.field === "highlights" && call.textRole === undefined,
    ),
  );
});

test("support does not mutate frozen public lesson content", () => {
  const activities = freeze([explanation()]);
  const before = JSON.stringify(activities);
  assert.match(render(activities), /Public heading/);
  assert.equal(JSON.stringify(activities), before);
});

test("declared fixed assessment bank is recognized by IDs", () => {
  const assessment = definition();
  assert.deepEqual(find([assessment]), [assessment]);
});

test("lesson titles and slugs cannot make an undeclared lesson an assessment bank", () => {
  assert.deepEqual(
    find([definition({ lessonId: undefined })], undefined, {
      slug: "final-diagnostic",
    }),
    [],
  );
});

test("a mixed lesson with an uncovered practice activity remains a practice lesson", () => {
  assert.deepEqual(find([definition()], ["item-a", "item-b", "practice"]), []);
});

test("wrong lesson and wrong unit references do not classify a bank", () => {
  assert.deepEqual(find([definition({ lessonId: "lesson-other" })]), []);
  assert.deepEqual(find([definition({ unitId: "unit-other" })]), []);
});

test("optional unit reference accepts an explicitly bound lesson", () => {
  const assessment = definition({ unitId: undefined });
  assert.deepEqual(find([assessment]), [assessment]);
});

test("adaptive assessment banks use declared bank activity IDs", () => {
  const assessment = definition({
    method: "adaptive",
    activityIds: undefined,
    bank: [
      { activityId: "item-a" },
      { activityId: "item-b" },
      { activityId: "item-a" },
    ],
  });
  assert.deepEqual(find([assessment]), [assessment]);
});

test("several scoped assessments may cover the same lesson together", () => {
  const first = definition({ activityIds: ["item-a"] });
  const second = definition({ id: "assessment-b", activityIds: ["item-b"] });
  assert.deepEqual(find([first, second]), [first, second]);
  assert.deepEqual(find([first, { ...second, unitId: "unit-other" }]), []);
});

test("empty lesson is not classified by vacuous activity coverage", () => {
  assert.deepEqual(find([definition()], []), []);
});

test("classification preserves frozen assessment definitions and lesson activities", () => {
  const definitions = freeze([definition()]);
  const before = JSON.stringify(definitions);
  assert.equal(find(definitions)[0], definitions[0]);
  assert.equal(JSON.stringify(definitions), before);
});

// Render the actual page with inert navigation/study dependencies to exercise its route guards.
let pageStudy;
let practiceMounts = 0;
const { default: LessonPage } = loadSource(
  "src/app/course/[courseSlug]/unit/[unitSlug]/lesson/[lessonSlug]/page.tsx",
  {
    react: React,
    "react/jsx-runtime": jsx,
    "next/link": {
      default: ({ children, ...props }) =>
        React.createElement("a", props, children),
    },
    "next/navigation": {
      useParams: () => ({
        courseSlug: "course-a",
        unitSlug: "unit-a",
        lessonSlug: "lesson-a",
      }),
      useRouter: () => ({
        replace() {
          throw new Error("Navigation must not run during render");
        },
      }),
      useSearchParams: () => new URLSearchParams("activity=item-b"),
    },
    "lucide-react": Object.fromEntries(
      [
        "ArrowLeft",
        "ArrowRight",
        "Check",
        "ChevronLeft",
        "ChevronRight",
        "Circle",
      ].map((name) => [name, () => null]),
    ),
    "@/components/study-provider": { useStudy: () => pageStudy },
    "@/components/activities/activity-renderer": {
      ActivityRenderer: () => {
        practiceMounts += 1;
        return React.createElement("article", { "data-practice-card": true });
      },
    },
    "@/components/activities/lesson-support": { LessonSupport },
    "@/components/activities/assessment-result": {
      AssessmentResult: () => null,
    },
    "@/lib/lesson-writing-scope": loadSource("src/lib/lesson-writing-scope.ts"),
    "@/content/assessment-references": references,
    "@/lib/assessment-lesson": { assessmentsForLesson },
  },
);
function renderPage(activities, assessments) {
  const currentLesson = {
    ...lesson(activities),
    slug: "lesson-a",
    description: "A lesson",
  };
  pageStudy = {
    authUserId: "test-user",
    runtime: null,
    state: { completedActivityIds: [], writing: [] },
    course: {
      id: "course-a",
      slug: "course-a",
      contentVersion: "1.0.0",
      assessments,
      units: [
        {
          id: "unit-a",
          slug: "unit-a",
          number: 1,
          lessons: [currentLesson],
          assessmentRefs: {},
        },
      ],
    },
  };
  practiceMounts = 0;
  return renderToStaticMarkup(React.createElement(LessonPage));
}

test("direct assessment bank lesson URL presents official links without mounting practice or support", () => {
  const html = renderPage(
    [
      {
        id: "item-a",
        type: "multiple_choice",
        title: "PRIVATE_ASSESSMENT_ITEM_A",
      },
      { id: "item-b", type: "fill_blank", title: "PRIVATE_ASSESSMENT_ITEM_B" },
    ],
    [definition({ title: "Declared evaluation" })],
  );
  assert.match(html, /href="\/assessment\?assessmentId=assessment-a"/);
  assert.doesNotMatch(
    html,
    /PRIVATE_ASSESSMENT_|data-practice-card|data-lesson-support/,
  );
  assert.equal(practiceMounts, 0);
});

test("ordinary practice lesson still mounts its active card beside public support", () => {
  const html = renderPage(
    [{ id: "item-b", type: "fill_blank", title: "Practice" }, explanation()],
    [],
  );
  assert.match(html, /data-practice-card/);
  assert.match(html, /data-lesson-support/);
  assert.equal(practiceMounts, 1);
});
