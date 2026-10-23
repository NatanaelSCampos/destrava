import assert from "node:assert/strict";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse } from "../src/content/public";
import { activitySeedPayload } from "../src/repositories/activity-content-projection";
import {
  normalizeAnswer,
  strictNormalization,
  gradeActivity,
} from "../src/domain/activities/grader";
import { evaluateAssessment } from "../src/domain/assessments/assessment-engine";
import {
  orderingTokens,
  selectedTokens,
  reconstructText,
  orderingAnswer,
  measureText,
  evaluateWritingText,
  TextRepresentationError,
  textMeasureAvailability,
} from "../src/engine/text/representation";
import {
  negotiateCapabilities,
  CapabilityCompatibilityError,
} from "../src/engine/capabilities/compatibility";
import type { Reconstruction, TextMeasure } from "../src/content/text-strategies";
import { courseWithDeviceAvailability } from "../src/lib/client-capabilities";

let seed = 0x5a17;
const random = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
};
const units = [
  "a",
  "que",
  "e\u0301",
  "\u00e9",
  "\u03a9",
  "\u4f60\u597d",
  "\u{1f600}",
  "\u{1f468}\u200d\u{1f469}\u200d\u{1f467}",
  "x x",
  "_",
  "\r\n",
];
const joins = ["", " ", "|", " / ", "\u202f", "\u{1f600}"];
let checks = 0,
  properties = 0;
function test(name: string, fn: () => void) {
  fn();
  checks++;
  console.log(`OK ${name}`);
}
function shuffle<T>(values: readonly T[]) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const bundles = loadContent(),
  base = bundles.find((item) => item.language.id === "xx-Test")!;
const modern = () => {
  const raw = structuredClone(base);
  const activity = raw.course.units[0].lessons[0].activities[0];
  activity.type = "ordering";
  activity.payload = {
    words: ["que", "a", "que"],
    answer: "que|a|que",
    reconstruction: { strategy: "separator", separator: "|" },
    answerOrder: [2, 1, 0],
  };
  return raw;
};
test("old text identity disables both repeats; new identities remain independent", () => {
  const words = ["que", "que"],
    old = [words[0]];
  assert(words.every((word) => old.includes(word)));
  const tokens = orderingTokens("activity", words);
  assert.notEqual(tokens[0].id, tokens[1].id);
  assert.equal(selectedTokens(tokens, [tokens[0].id]).length, 1);
  assert.equal(
    orderingAnswer(
      tokens,
      tokens.map((token) => token.id),
    ),
    "que que",
  );
  assert.deepEqual(orderingTokens("activity", words), tokens);
});
test("generated selections preserve occurrence multiplicity, source data and chosen order", () => {
  for (let n = 0; n < 500; n++) {
    const words = Object.freeze(
      Array.from(
        { length: 2 + Math.floor(random() * 7) },
        () => units[Math.floor(random() * units.length)],
      ),
    );
    const before = JSON.stringify(words),
      tokens = orderingTokens(`fixture-${n}`, words);
    const order = shuffle(tokens.map((token) => token.id));
    const chosen = selectedTokens(tokens, order);
    assert.equal(new Set(tokens.map((token) => token.id)).size, words.length);
    assert.deepEqual(
      chosen.map((token) => token.id),
      order,
    );
    assert.deepEqual(chosen.map((token) => token.text).sort(), [...words].sort());
    for (const separator of joins) {
      const strategy: Reconstruction = { strategy: "separator", separator };
      assert.equal(
        orderingAnswer(tokens, order, strategy),
        chosen.map((token) => token.text).join(separator),
      );
      properties++;
    }
    assert.equal(JSON.stringify(words), before);
    assert.deepEqual(orderingTokens(`fixture-${n}`, words), tokens);
    assert.throws(() => selectedTokens(tokens, [order[0], order[0]]), TextRepresentationError);
    assert.throws(() => selectedTokens(tokens, ["unknown"]), TextRepresentationError);
    properties += 5;
  }
});
test("Unicode measures distinguish code points, graphemes and space-delimited units", () => {
  const composed = "e\u0301",
    emoji = "\u{1f468}\u200d\u{1f469}\u200d\u{1f467}";
  assert.equal(measureText(composed, { strategy: "code_points" }), 2);
  assert.equal(measureText(composed, { strategy: "graphemes" }), 1);
  assert.equal(measureText(emoji, { strategy: "graphemes" }), 1);
  assert(measureText(emoji, { strategy: "code_points" }) > 1);
  const noSpaces = "\u4f60\u597d\u4e16\u754c";
  assert.equal(measureText(noSpaces, { strategy: "whitespace_units" }), 1);
  assert.equal(measureText(noSpaces, { strategy: "code_points" }), 4);
  assert(measureText(noSpaces, { strategy: "intl_words", locale: "en" }) > 1);
});
test("generated code-point concatenation and grapheme normalization invariants", () => {
  for (let n = 0; n < 300; n++) {
    const parts = Array.from(
      { length: 1 + Math.floor(random() * 8) },
      () => units[Math.floor(random() * units.length)],
    );
    const text = parts.join("");
    assert.equal(
      measureText(text, { strategy: "code_points" }),
      parts.reduce((sum, p) => sum + Array.from(p).length, 0),
    );
    assert.equal(
      measureText(text, { strategy: "graphemes" }),
      measureText(text.normalize("NFC"), { strategy: "graphemes" }),
    );
    assert.equal(reconstructText(parts, { strategy: "separator", separator: "" }), text);
    properties += 3;
  }
});
test("normalization reaches a fixed point for generated strings under all 32 flag combinations", () => {
  const names = Object.keys(strictNormalization) as (keyof typeof strictNormalization)[];
  for (let mask = 0; mask < 32; mask++)
    for (let n = 0; n < 60; n++) {
      const rules = { ...strictNormalization };
      names.forEach((key, index) => {
        rules[key] = Boolean(mask & (1 << index));
      });
      const text =
        " \u00bf" +
        Array.from(
          { length: 1 + Math.floor(random() * 5) },
          () => units[Math.floor(random() * units.length)],
        ).join(" ") +
        "? . \u0301 ";
      const before = text,
        normalized = normalizeAnswer(text, rules);
      assert.equal(text, before);
      assert.equal(normalizeAnswer(normalized, rules), normalized);
      assert.equal(normalized.normalize("NFC"), normalized);
      properties += 3;
    }
  assert.equal(normalizeAnswer("value? . "), "value");
  assert.equal(
    normalizeAnswer("value!\u0301", {
      ...strictNormalization,
      trimWhitespace: false,
      ignoreDiacritics: true,
    }),
    "value",
  );
});
test("writing thresholds follow exactly the declared measure and both boundaries", () => {
  for (const measure of [
    { strategy: "whitespace_units" },
    { strategy: "code_points" },
    { strategy: "graphemes" },
    { strategy: "intl_words", locale: "en" },
  ] as TextMeasure[])
    for (const text of ["", "a", "a b", "e\u0301", "\u{1f600}", "\u4f60\u597d\u4e16\u754c"]) {
      const count = measureText(text, measure),
        activity = { textRequirement: { measure, minimum: count, maximum: count } };
      assert.equal(evaluateWritingText(text, activity).accepted, true);
      assert.equal(
        evaluateWritingText(text, { textRequirement: { measure, minimum: count + 1 } }).accepted,
        false,
      );
      if (count)
        assert.equal(
          evaluateWritingText(text, {
            textRequirement: { measure, minimum: 0, maximum: count - 1 },
          }).accepted,
          false,
        );
      properties += 3;
    }
  assert.equal(evaluateWritingText("one  two\nthree", { minWords: 3 }).accepted, true);
});
test("invalid strategies, identities, Unicode and ambiguous limit declarations fail closed", () => {
  assert.throws(
    () => reconstructText(["a"], { strategy: "eval" } as unknown as Reconstruction),
    TextRepresentationError,
  );
  assert.throws(
    () => measureText("x", { strategy: "regex", locale: "en" } as unknown as TextMeasure),
    TextRepresentationError,
  );
  for (const text of ["\ud800", "\udc00", "a\ud800b"]) {
    assert.throws(() => measureText(text, { strategy: "code_points" }), TextRepresentationError);
    assert.throws(() => reconstructText([text]), TextRepresentationError);
  }
  assert.throws(
    () =>
      evaluateWritingText("a", {
        minWords: 1,
        textRequirement: { measure: { strategy: "graphemes" }, minimum: 1 },
      }),
    TextRepresentationError,
  );
  assert.throws(() => evaluateWritingText("a", {}), TextRepresentationError);
  assert.throws(
    () =>
      evaluateWritingText("a", {
        textRequirement: { measure: { strategy: "code_points" }, minimum: 2, maximum: 1 },
      }),
    TextRepresentationError,
  );
  assert.throws(
    () => measureText("x", { strategy: "intl_words", locale: "invalid_locale" }),
    TextRepresentationError,
  );
});
test("missing Segmenter and unsupported locale never silently fall back", () => {
  assert.equal(textMeasureAvailability({ strategy: "intl_words", locale: "zz" }).available, false);
  const before = Object.getOwnPropertyDescriptor(Intl, "Segmenter")!;
  try {
    Object.defineProperty(Intl, "Segmenter", { value: undefined, configurable: true });
    assert.throws(
      () => measureText("a", { strategy: "graphemes" }),
      (error) => error instanceof TextRepresentationError && error.code === "UNAVAILABLE",
    );
    assert.equal(measureText("a", { strategy: "code_points" }), 1);
    const report = negotiateCapabilities([
      {
        location: "fixture",
        requirement: {
          id: "text.measurement",
          version: "1.0.0",
          required: true,
          data: { strategy: "graphemes" },
        },
      },
    ]);
    assert.equal(report.compatible, true);
    assert.equal(report.readiness, "unavailable");
  } finally {
    Object.defineProperty(Intl, "Segmenter", before);
  }
});
test("new reconstruction is preserved through authoring, runtime, grading and public projection", () => {
  const raw = modern(),
    bundle = runtimeBundle(raw),
    activity = bundle.course.units[0].lessons[0].activities[0];
  assert(activity.type === "ordering");
  assert.deepEqual(activity.reconstruction, { strategy: "separator", separator: "|" });
  const tokens = orderingTokens(activity.id, activity.words),
    answer = orderingAnswer(
      tokens,
      [tokens[2].id, tokens[1].id, tokens[0].id],
      activity.reconstruction,
    );
  assert.equal(gradeActivity(activity, answer, bundle.language.normalization)?.correct, true);
  assert(
    bundle.course.capabilityReport?.selections.some(
      (item) => item.selectedId === "activity.ordering" && item.selectedVersion === "1.1.0",
    ),
  );
  const exposed = publicCourse(bundle.course, bundle.language),
    published = exposed.units[0].lessons[0].activities[0];
  assert(!("answerOrder" in published));
  assert(!("answer" in published));
  assert(!("answerOrder" in activitySeedPayload(activity)));
  for (const bad of [
    [0, 0, 1],
    [0, 1],
    [0, 1, 9],
  ]) {
    const copy = modern();
    copy.course.units[0].lessons[0].activities[0].payload.answerOrder = bad;
    assert.throws(() => runtimeBundle(copy), CapabilityCompatibilityError);
  }
  const noProof = modern();
  delete noProof.course.units[0].lessons[0].activities[0].payload.answerOrder;
  assert.throws(() => runtimeBundle(noProof), CapabilityCompatibilityError);
  const legacy = negotiateCapabilities([
    {
      location: "fixture",
      requirement: {
        id: "activity.ordering",
        version: "1.0.0",
        required: true,
        data: raw.course.units[0].lessons[0].activities[0].payload,
      },
    },
  ]);
  assert.equal(legacy.compatible, false);
});
test("new writing limits survive runtime and server assessment grading without an objective writing score", () => {
  const raw = structuredClone(bundles.find((item) => item.language.id === "en")!);
  const writing = raw.course.units
    .flatMap((u) => u.lessons.flatMap((l) => l.activities))
    .find((a) => a.type === "writing")!;
  writing.payload = {
    guidance: [],
    textRequirement: { measure: { strategy: "graphemes" }, minimum: 2, maximum: 2 },
  };
  const objective = raw.course.units
    .flatMap((u) => u.lessons.flatMap((l) => l.activities))
    .find((a) => a.type === "multiple_choice")!;
  raw.course.assessments.push({
    id: "fixture-writing",
    title: "Fixture",
    purpose: "formative",
    method: "fixed",
    gradingStrategy: "objective_mean",
    activityIds: [writing.id, objective.id],
    objectiveIds: [],
    passingPolicy: { overall: 0.5 },
  });
  const bundle = runtimeBundle(raw),
    responses = [
      { activityId: writing.id, answer: "e\u0301\u{1f600}" },
      { activityId: objective.id, answer: String(objective.payload.answer) },
    ];
  const result = evaluateAssessment(
    bundle.course,
    "fixture-writing",
    responses,
    bundle.language.normalization,
  );
  const exposed = publicCourse(bundle.course, bundle.language);
  assert(courseWithDeviceAvailability(exposed, 7).availability?.unavailableActivityIds.includes(writing.id));
  assert(!courseWithDeviceAvailability(exposed, 15).availability?.unavailableActivityIds.includes(writing.id));
  assert.equal(result.answers.find((item) => item.activityId === writing.id)?.correct, null);
  assert.throws(() =>
    evaluateAssessment(
      bundle.course,
      "fixture-writing",
      [{ ...responses[0], answer: "abc" }, responses[1]],
      bundle.language.normalization,
    ),
  );
});
test("ES/EN legacy defaults and literal normalization stay compatible", () => {
  for (const raw of bundles) {
    const bundle = runtimeBundle(raw);
    for (const activity of bundle.course.units.flatMap((u) =>
      u.lessons.flatMap((l) => l.activities),
    )) {
      if (activity.type === "ordering")
        assert.equal(reconstructText(activity.words), activity.words.join(" "));
      if (activity.type === "writing")
        assert.equal(evaluateWritingText(" a  b\nc ", activity).count, 3);
    }
  }
  const noRules = {
    trimWhitespace: false,
    collapseWhitespace: false,
    caseInsensitive: false,
    ignoreTerminalPunctuation: false,
    ignoreDiacritics: false,
  };
  assert.equal(normalizeAnswer("  A?  ", noRules), "  A?  ");
});
console.log(
  JSON.stringify({
    textProperties: "passed",
    checks,
    propertyAssertions: properties,
    seed: "0x5a17",
    node: process.version,
    icu: process.versions.icu,
    unicode: process.versions.unicode,
    paidCalls: 0,
    remoteOperations: 0,
  }),
);
