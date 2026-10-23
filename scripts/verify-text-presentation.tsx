import assert from "node:assert/strict";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse } from "../src/content/public";
import { resolveTextPresentation, inspectBidiControls } from "../src/engine/presentation/text";
import { activityPresentationSchema } from "../src/content/text-presentation";
import {
  orderingTokens,
  orderingAnswer,
  measureText,
  evaluateWritingText,
} from "../src/engine/text/representation";
import { gradeActivity, normalizeAnswer } from "../src/domain/activities/grader";
import { requireLearningVariant } from "../src/engine/variants/resolution";
import { capabilityRegistry, capabilityCatalog } from "../src/engine/capabilities/registry";
import { negotiateCapabilities } from "../src/engine/capabilities/compatibility";
import { checkCapabilityImplementations } from "./capability-implementation-check";
import {
  applyBoardAction,
  emptyBoard,
  TimelineEngine,
} from "../src/domain/interactive-lesson/runtime";
import { lessonActionSchema } from "../src/content/contracts";
import { activitySeedPayload } from "../src/repositories/activity-content-projection";

const packages = loadContent();
const raw = structuredClone(packages.find((item) => item.language.id === "xx-Test")!);
raw.language.writingSystem.direction = "rtl";
raw.language.writingSystem.scripts = ["Arab", "Hebr", "Latn"];
raw.course.schemaVersion = "1.5";
const authored = raw.course.units[0].lessons[0].activities[0];
authored.type = "ordering";
authored.payload = {
  words: ["שלום", "ABC-12", "שלום"],
  answer: "שלום / ABC-12 / שלום",
  reconstruction: { strategy: "separator", separator: " / " },
  answerOrder: [0, 1, 2],
};
authored.presentation = {
  fields: { prompt: { language: "pt-BR", direction: "ltr" }, tokens: { direction: "auto" } },
};
const bundle = runtimeBundle(raw),
  { language, course } = bundle;
const activity = course.units[0].lessons[0].activities[0];
let checks = 0,
  properties = 0;
function check(name: string, run: () => void) {
  run();
  checks++;
  console.log(`OK ${name}`);
}

check("content direction follows declared traits and never reverses the interface", () => {
  assert.deepEqual(resolveTextPresentation(language, course), { lang: "xx-Test", dir: "rtl" });
  assert.deepEqual(
    resolveTextPresentation(language, course, "interface", { content: { direction: "rtl" } }),
    { lang: "pt-BR", dir: "ltr" },
  );
  assert.deepEqual(
    resolveTextPresentation({ ...language, writingSystem: { direction: "ltr" } }, course),
    { lang: "xx-Test", dir: "ltr" },
  );
});
check(
  "opposite and mixed fragments override the profile explicitly; unknown learner text is auto",
  () => {
    assert.deepEqual(
      resolveTextPresentation(
        language,
        course,
        "target",
        { fields: { example: { language: "en", direction: "ltr" } } },
        "example",
      ),
      { lang: "en", dir: "ltr" },
    );
    assert.equal(resolveTextPresentation(language, course, "fragment").dir, "auto");
    assert.equal(resolveTextPresentation(language, course, "user").dir, "auto");
    assert.equal(
      resolveTextPresentation(language, { sourceLanguage: "source-test" }, "source").dir,
      "auto",
    );
    assert.equal(
      resolveTextPresentation(language, course, "target", activity.presentation, "prompt").dir,
      "ltr",
    );
  },
);
check("metadata is strict, versioned and preserved across runtime/public projections", () => {
  const safe = publicCourse(course, language).units[0].lessons[0].activities[0];
  assert.deepEqual(safe.presentation, authored.presentation);
  assert.deepEqual(activitySeedPayload(activity).presentation, authored.presentation);
  for (const value of [
    { content: { direction: "vertical" } },
    { fields: { unknown: { direction: "rtl" } } },
    { content: { style: "direction:rtl" } },
  ])
    assert(!activityPresentationSchema.safeParse(value).success);
  for (const version of ["1.3", "1.4"]) {
    const older = structuredClone(raw);
    older.course.schemaVersion = version;
    assert.throws(() => runtimeBundle(older));
  }
});
check("tokens retain independent identity and logical reconstruction under RTL", () => {
  assert(activity.type === "ordering");
  const tokens = orderingTokens(activity.id, activity.words);
  assert.notEqual(tokens[0].id, tokens[2].id);
  const answer = orderingAnswer(
    tokens,
    [tokens[0].id, tokens[1].id, tokens[2].id],
    activity.reconstruction,
  );
  assert.equal(answer, activity.answer);
  assert(gradeActivity(activity, answer, language.normalization, { language, course })!.correct);
  const reversed = orderingAnswer(
    tokens,
    [tokens[1].id, tokens[0].id, tokens[2].id],
    activity.reconstruction,
  );
  assert(!gradeActivity(activity, reversed, language.normalization, { language, course })!.correct);
});
check("Unicode composition, no-space text and 5A measures do not depend on direction", () => {
  const text = "e\u0301שלום你好\u{1f469}\u200d\u{1f4bb}";
  assert.equal(measureText("你好", { strategy: "code_points" }), 2);
  assert.equal(measureText("e\u0301", { strategy: "graphemes" }), 1);
  assert.equal(measureText("e\u0301", { strategy: "code_points" }), 2);
  assert(
    evaluateWritingText(text, {
      textRequirement: { measure: { strategy: "graphemes" }, minimum: 1 },
    }).accepted,
  );
  assert.equal(
    orderingAnswer(
      orderingTokens("compact", ["你", "好"]),
      orderingTokens("compact", ["你", "好"]).map((x) => x.id),
      { strategy: "separator", separator: "" },
    ),
    "你好",
  );
  assert.equal(normalizeAnswer(normalizeAnswer(text)), normalizeAnswer(text));
});
check(
  "controls are diagnosed without erasing legitimate characters or changing logical values",
  () => {
    for (const text of ["שלום", "ا\u200cب", "e\u0301", "\u{1f469}\u200d\u{1f4bb}"])
      assert.equal(inspectBidiControls(text).controls.length, 0);
    assert(!inspectBidiControls("\u2067שלום\u2069").suspicious);
    assert(!inspectBidiControls("שלום\u200f").suspicious);
    for (const text of ["\u202EABC", "\u2067שלום", "\u2069ABC", "\u202AABC\u202C"]) {
      const before = text;
      assert(inspectBidiControls(text).suspicious);
      assert.equal(text, before);
    }
  },
);
check("board, comparisons and timed captions retain declared metadata through replay", () => {
  const action = lessonActionSchema.parse({
    type: "board.show",
    element: {
      kind: "comparison",
      id: "mixed",
      left: "ABC-12",
      right: "שלום (42)",
      leftPresentation: { language: "en", direction: "ltr" },
      rightPresentation: { direction: "rtl" },
    },
  });
  const board = applyBoardAction(emptyBoard, action);
  assert.equal(board.elements[0].kind, "comparison");
  const caption = lessonActionSchema.parse({
    type: "caption.show",
    text: "שלום ABC",
    textPresentation: { direction: "rtl" },
  });
  const timeline = new TimelineEngine();
  timeline.load([
    { id: "1", atMs: 0, action },
    { id: "2", atMs: 10, action: caption },
  ]);
  assert.deepEqual(timeline.getStateAt(10), applyBoardAction(board, caption));
  assert.deepEqual(JSON.parse(JSON.stringify(timeline.getStateAt(10))).captionPresentation, {
    direction: "rtl",
  });
  assert(
    !(
      "captionPresentation" in
      applyBoardAction(timeline.getStateAt(10), { type: "caption.show", text: "new" })
    ),
  );
});
check("missing mandatory presentation blocks activities without score or completion", () => {
  const unavailable = publicCourse(course, language, {
    capabilities: {
      "presentation.bidi": { state: "unavailable", reason: "synthetic rendering failure" },
    },
  });
  assert(unavailable.availability!.unavailableActivityIds.includes(activity.id));
  assert.equal(unavailable.capabilityReport!.readiness, "unavailable");
  const unsupported = negotiateCapabilities([
    {
      location: "course.capabilityRequirements[0]",
      requirement: { id: "writing.handwriting", version: "1.0.0", required: true, data: {} },
    },
  ]);
  assert(!unsupported.compatible);
  assert(!capabilityRegistry.has("writing.handwriting"));
});
check("registered support matches actual bindings and scoped limitations", () => {
  for (const id of ["presentation.direction", "presentation.bidi", "text.input"]) {
    const cap = capabilityRegistry.get(id)!;
    assert.equal(cap.support, "implemented");
    assert(cap.restrictions!.length > 0);
  }
  assert.deepEqual(checkCapabilityImplementations(), []);
  assert(!JSON.stringify(capabilityCatalog()).includes('"שלום"'));
});
check(
  "public and seeded text metadata never expose canonical answers or private variant policies",
  () => {
    const safe = publicCourse(course, language).units[0].lessons[0].activities[0];
    for (const key of ["answer", "answerOrder", "accepted", "fullAnswers", "answerPolicy"])
      assert(!(key in safe));
    const serialized = JSON.stringify(safe);
    assert(!serialized.includes('"answerOrder"'));
    assert(!serialized.includes('"answerPolicy"'));
  },
);
check(
  "generated invariants preserve logical strings under all presentation directions (seed 0x5c17)",
  () => {
    let seed = 0x5c17;
    const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    const fragments = [
      "שלום",
      "مرحبا",
      "ABC-12",
      "42",
      "e\u0301",
      "你好",
      "(test)",
      "\u{1f469}\u200d\u{1f4bb}",
    ];
    for (let i = 0; i < 1000; i++) {
      const parts = Array.from(
        { length: 2 + (rand() % 5) },
        () => fragments[rand() % fragments.length],
      );
      const tokens = orderingTokens(`fixture-${i}`, parts),
        ids = tokens.map((x) => x.id),
        separator = ["", " ", " / "][rand() % 3];
      const original = JSON.stringify({ parts, tokens });
      for (const direction of ["ltr", "rtl", "auto"] as const) {
        const presentation = { content: { direction } };
        const before = JSON.stringify(presentation);
        assert.equal(
          resolveTextPresentation(language, course, "target", presentation).dir,
          direction,
        );
        properties++;
        assert.equal(
          orderingAnswer(tokens, ids, { strategy: "separator", separator }),
          parts.join(separator),
        );
        properties++;
        assert.equal(JSON.stringify(presentation), before);
        properties++;
        assert.equal(JSON.stringify({ parts, tokens }), original);
        properties++;
      }
    }
  },
);
check("existing LTR packages and 5B variant resolution stay compatible", () => {
  for (const item of packages) {
    const b = runtimeBundle(item);
    assert.equal(
      resolveTextPresentation(b.language, b.course).dir,
      b.language.writingSystem.direction,
    );
    assert.equal(
      requireLearningVariant(b.language, b.course).variantId,
      item.course.defaultVariant ?? b.language.speech.defaultVariant,
    );
  }
});
console.log(
  JSON.stringify({
    presentationGroups: checks,
    generatedAssertions: properties,
    seed: "0x5c17",
    paidCalls: 0,
    remoteOperations: 0,
    linguisticCertification: false,
  }),
);
