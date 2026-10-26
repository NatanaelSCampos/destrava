import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dependencies = process.env.DESTRAVA_TEST_NODE_MODULES;
if (!dependencies) throw Error("Provide DESTRAVA_TEST_NODE_MODULES pointing to installed readonly tooling");
const React = require(resolve(dependencies, "react"));
const jsxRuntime = require(resolve(dependencies, "react/jsx-runtime"));
const { renderToStaticMarkup } = require(resolve(dependencies, "react-dom/server"));
const ts = require(resolve(dependencies, "typescript"));
const componentPath = "src/components/activities/flashcard-practice.tsx";
const rendererPath = "src/components/activities/activity-renderer.tsx";

// Execute the actual TSX in a VM. Context-dependent text/audio leaves are isolated;
// their unchanged production behavior is outside this component's state controls.
function LearningText({ as = "bdi", text }) {
  return React.createElement(as, null, text);
}
function SpeakButton({ label }) {
  return React.createElement("button", { type: "button", "aria-label": label }, label);
}
const leaves = {
  "@/components/learning/text-presentation": { LearningText },
  "@/components/audio/speak-button": { SpeakButton },
};
function load(relative, bindings = {}) {
  const transpiled = ts.transpileModule(readFileSync(resolve(sourceRoot, relative), "utf8"), {
    fileName: relative,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  });
  assert.equal(transpiled.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  const loadedModule = { exports: {} };
  const dependenciesForModule = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    ...leaves,
    ...bindings,
  };
  new Script("(function(require,module,exports){\n" + transpiled.outputText + "\n})", {
    filename: relative,
  }).runInThisContext()((id) => {
    if (!Object.hasOwn(dependenciesForModule, id)) throw Error("Unexpected dependency: " + id);
    return dependenciesForModule[id];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
function nodes(element) {
  if (!element || typeof element !== "object") return [];
  const children = element.props?.children;
  return [element, ...(Array.isArray(children) ? children : [children]).flatMap(nodes)];
}
function control(tree, kind) {
  const found = nodes(tree).filter((element) =>
    element.type === "button" &&
    (kind === "reveal" ? Object.hasOwn(element.props, "aria-expanded") : element.props.className === "primary-button"));
  assert.equal(found.length, 1);
  return found[0];
}
const card = {
  id: "synthetic.card.one",
  type: "flashcard",
  title: "Recall",
  prompt: "Recall before turning",
  minutes: 1,
  front: "front-only",
  back: "back-answer-unique",
  example: "example-unique",
  presentation: { fields: { back: { language: "pt", direction: "ltr" } } },
  variant: { requiredVariant: "synthetic-variant" },
};
const { FlashcardPractice } = load(componentPath);

// A mounted hook slot models only React's state/id plumbing; events and markup
// below come from the actual component. Real React SSR separately checks first render.
function mount(activity = card, onComplete = () => {}) {
  let value = false;
  const hooks = {
    ...React,
    useState(initial) {
      assert.equal(initial, false);
      return [value, (next) => { value = typeof next === "function" ? next(value) : next; }];
    },
    useId: () => "test-answer-panel",
  };
  const Component = load(componentPath, { react: hooks }).FlashcardPractice;
  return { render: () => Component({ activity, onComplete }) };
}

test("real React SSR starts with front only and no answer/example/audio disclosure", () => {
  const html = renderToStaticMarkup(React.createElement(FlashcardPractice, { activity: card, onComplete() {} }));
  assert.ok(html.includes(card.front));
  assert.ok(!html.includes(card.back));
  assert.ok(!html.includes(card.example));
  assert.ok(!html.includes("Ouvir frase de exemplo"));
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /hidden=""/);
});

test("native reveal/hide controls disclose without completing; completion requires visible answer", () => {
  let completed = 0;
  const instance = mount(card, () => completed++);
  let tree = instance.render();
  assert.equal(control(tree, "complete").props.disabled, true);
  control(tree, "complete").props.onClick(); // defense even if invoked without browser disabled semantics
  assert.equal(completed, 0);
  const reveal = control(tree, "reveal");
  assert.equal(reveal.type, "button");
  assert.equal(reveal.props.type, "button");
  assert.equal(reveal.props.onKeyDown, undefined); // native Enter/Space behavior
  assert.equal(reveal.props["aria-expanded"], false);
  assert.equal(nodes(tree).find((node) => node.props?.id === reveal.props["aria-controls"]).props.hidden, true);
  reveal.props.onClick();
  tree = instance.render();
  assert.equal(completed, 0);
  assert.equal(control(tree, "reveal").props["aria-expanded"], true);
  assert.equal(control(tree, "complete").props.disabled, false);
  const html = renderToStaticMarkup(tree);
  assert.ok(html.includes(card.back));
  assert.ok(html.includes(card.example));
  control(tree, "complete").props.onClick();
  assert.equal(completed, 1);
  control(tree, "reveal").props.onClick();
  tree = instance.render();
  assert.equal(completed, 1);
  assert.equal(control(tree, "complete").props.disabled, true);
  assert.ok(!renderToStaticMarkup(tree).includes(card.back));
  assert.ok(!renderToStaticMarkup(tree).includes(card.example));
  control(tree, "complete").props.onClick();
  assert.equal(completed, 1);
});

test("same mounted card preserves reveal across sibling help rerenders; fresh card starts hidden", () => {
  const mounted = mount();
  control(mounted.render(), "reveal").props.onClick();
  const before = mounted.render();
  const controls = control(before, "reveal").props["aria-controls"];
  // A native sibling disclosure does not unmount or change this keyed component.
  for (const helpOpen of [true, false]) {
    const tree = React.createElement(React.Fragment, null,
      React.createElement("details", { open: helpOpen }, "public explanation"),
      mounted.render());
    const actual = control(tree, "reveal");
    assert.equal(actual.props["aria-expanded"], true);
    assert.equal(actual.props["aria-controls"], controls);
    assert.ok(renderToStaticMarkup(tree).includes(card.back));
  }
  const another = mount({ ...card, id: "synthetic.card.two", back: "other-answer" });
  const html = renderToStaticMarkup(another.render());
  assert.ok(!html.includes("other-answer"));
  assert.equal(control(another.render(), "reveal").props["aria-expanded"], false);
});

test("front/back/example keep presentation fields, roles and existing optional audio boundaries", () => {
  const mounted = mount();
  let tree = mounted.render();
  let text = nodes(tree).filter((node) => node.type === LearningText);
  assert.deepEqual(text.map((node) => node.props.field), ["front"]);
  assert.equal(text[0].props.presentation, card.presentation);
  assert.deepEqual(nodes(tree).filter((node) => node.type === SpeakButton).map((node) => node.props.text), [card.front]);
  control(tree, "reveal").props.onClick();
  tree = mounted.render();
  text = nodes(tree).filter((node) => node.type === LearningText);
  assert.deepEqual(text.map((node) => node.props.field), ["front", "back", "example"]);
  assert.ok(text.every((node) => node.props.presentation === card.presentation));
  assert.equal(text.find((node) => node.props.field === "back").props.textRole, "source");
  assert.equal(text.find((node) => node.props.field === "front").props.textRole, undefined);
  assert.equal(text.find((node) => node.props.field === "example").props.textRole, undefined);
  assert.deepEqual(nodes(tree).filter((node) => node.type === SpeakButton).map((node) => node.props.text), [card.front, card.example]);
});

test("revealed strings remain escaped text; no HTML or hidden answer attributes", () => {
  const escapedCard = { ...card, back: '<img src=x onerror="back-sentinel">', example: "<script>example-sentinel</script>" };
  const mounted = mount(escapedCard);
  const hidden = renderToStaticMarkup(mounted.render());
  assert.ok(!hidden.includes("back-sentinel"));
  assert.ok(!hidden.includes("example-sentinel"));
  control(mounted.render(), "reveal").props.onClick();
  const revealed = renderToStaticMarkup(mounted.render());
  assert.ok(revealed.includes("&lt;img"));
  assert.ok(revealed.includes("&lt;script&gt;"));
  assert.ok(!revealed.includes("<img"));
  assert.ok(!revealed.includes("<script"));
});

test("actual renderer keys new cards by activity.id and keeps historical completion front-only", () => {
  const completions = [];
  let completedActivityIds = [];
  const empty = () => null;
  const { ActivityRenderer } = load(rendererPath, {
    "@/components/study-provider": {
      useStudy: () => ({
        course: {},
        language: { speech: { support: { textToSpeech: false } } },
        state: { completedActivityIds, profile: {} },
        completeActivity: (id) => completions.push(id),
      }),
    },
    "lucide-react": { BookOpen: empty, Check: empty, Clock3: empty },
    "@/lib/feature-flags": { featureFlags: { SPEAKING: true } },
    "./exercise-card": { ExerciseCard: empty },
    "./writing-editor": { WritingEditor: empty },
    "./speaking-recorder": { SpeakingRecorder: empty },
    "./flashcard-practice": { FlashcardPractice },
    "@/engine/variants/resolution": { resolveLearningVariant: () => ({ status: "valid", diagnostics: [] }) },
    "@/content/language-variant": { variantLabel: () => "Synthetic" },
  });
  function renderedCard(activity) {
    const found = nodes(ActivityRenderer({ activity })).filter((node) => node.type === FlashcardPractice);
    assert.equal(found.length, 1);
    return found[0];
  }
  const first = renderedCard(card);
  assert.equal(first.key, card.id);
  assert.deepEqual(completions, []);
  completedActivityIds = [card.id];
  const historical = renderedCard(card);
  assert.ok(!renderToStaticMarkup(historical).includes(card.back));
  assert.ok(!renderToStaticMarkup(historical).includes(card.example));
  assert.equal(historical.key, first.key);
  const next = renderedCard({ ...card, id: "synthetic.card.two" });
  assert.equal(next.key, "synthetic.card.two");
  assert.notEqual(next.key, first.key);
  const mounted = mount(card, historical.props.onComplete);
  control(mounted.render(), "reveal").props.onClick();
  assert.deepEqual(completions, []);
  control(mounted.render(), "complete").props.onClick();
  assert.deepEqual(completions, [card.id]);
});
