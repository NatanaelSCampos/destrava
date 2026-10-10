import assert from "node:assert/strict";
import { posix } from "node:path";
import { z } from "zod";
import {
  learningGoalSchema,
  learningSkillSchema,
  type LearningGoal,
  type LearningSkill,
} from "../src/content/contract-vocabulary";
import {
  learningGoalSchema as compatibleGoalSchema,
  learningSkillSchema as compatibleSkillSchema,
  type LearningGoal as CompatibleGoal,
  type LearningSkill as CompatibleSkill,
  createLearningPreferences,
  learningPreferencesSchema,
  learningSkills,
} from "../src/domain/study/learning-preferences";
import { coursePackageSchema, skillIdSchema, type CoursePackage } from "../src/content/contracts";
import type { LanguageResources } from "../src/content/language-resources";
import { loadContent } from "./content-loader";
import {
  checkContentContractDependencies,
  inspectContractDependencies,
  formatContractDependencyIssues,
} from "./contract-dependency-check";

const expectedGoals = ["general", "travel", "work", "study", "conversation"] as const;
const expectedSkills = ["speaking", "listening", "reading", "writing"] as const;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
// These assertions must compile under tsc: widening a type or breaking an old export fails.
const typeCompatibility: [
  Expect<Equal<LearningGoal, (typeof expectedGoals)[number]>>,
  Expect<Equal<LearningSkill, (typeof expectedSkills)[number]>>,
  Expect<Equal<CompatibleGoal, LearningGoal>>,
  Expect<Equal<CompatibleSkill, LearningSkill>>,
  Expect<Equal<z.input<typeof learningGoalSchema>, LearningGoal>>,
  Expect<Equal<z.output<typeof learningSkillSchema>, LearningSkill>>,
  Expect<Equal<NonNullable<CoursePackage["supportedGoals"]>[number], LearningGoal>>,
  Expect<Equal<LanguageResources["learningOptions"]["contexts"][number]["goal"], LearningGoal>>,
  Expect<
    Equal<z.infer<typeof learningPreferencesSchema>["skillPriorities"][number], LearningSkill>
  >,
] = [true, true, true, true, true, true, true, true, true];
assert(typeCompatibility.every(Boolean));

assert.deepEqual(learningGoalSchema.options, expectedGoals);
assert.deepEqual(learningSkillSchema.options, expectedSkills);
assert.strictEqual(compatibleGoalSchema, learningGoalSchema);
assert.strictEqual(compatibleSkillSchema, learningSkillSchema);
assert.strictEqual(learningSkills, learningSkillSchema.options);

// Literal snapshots of the original enums: same accepted values and validation errors.
const priorGoalSchema = z.enum(expectedGoals);
const priorSkillSchema = z.enum(expectedSkills);
const invalid: unknown[] = [
  "",
  "other",
  "General",
  " general",
  "work ",
  "grammar",
  "pronunciation",
  null,
  undefined,
  1,
  true,
  [],
  {},
  ["work"],
];
for (const [current, prior, valid] of [
  [learningGoalSchema, priorGoalSchema, expectedGoals],
  [learningSkillSchema, priorSkillSchema, expectedSkills],
] as const) {
  for (const value of [...valid, ...invalid]) {
    const actual = current.safeParse(value);
    const expected = prior.safeParse(value);
    assert.equal(actual.success, expected.success);
    if (actual.success && expected.success) assert.equal(actual.data, expected.data);
    else if (!actual.success && !expected.success)
      assert.deepEqual(actual.error.issues, expected.error.issues);
  }
  for (const value of valid) assert.equal(current.parse(value), value);
  for (const value of invalid) assert.equal(current.safeParse(value).success, false);
}
assert.equal(skillIdSchema.safeParse("grammar").success, true);
assert.equal(
  learningSkillSchema.safeParse("grammar").success,
  false,
  "preference skills are distinct from assessment skills",
);

for (const goal of expectedGoals) {
  const preferences = createLearningPreferences({
    goal,
    contexts: [],
    skillPriorities: ["reading"],
    preferredSessionMinutes: 15,
  });
  assert.equal(preferences.goal, goal);
  assert.equal(preferences.skillWeights.reading, 1);
}
for (const { course } of loadContent()) {
  assert.equal(coursePackageSchema.safeParse(course).success, true);
  assert.equal(
    coursePackageSchema.safeParse({ ...course, supportedGoals: ["not-supported"] }).success,
    false,
  );
  assert.equal(
    coursePackageSchema.safeParse({ ...course, skillFloors: { grammar: 0.5 } }).success,
    false,
  );
}

function inspect(files: Record<string, string>) {
  return inspectContractDependencies({
    roots: ["src/content/contracts.ts"],
    read: (file) => {
      assert(Object.hasOwn(files, file), `unexpected read: ${file}`);
      return files[file];
    },
    resolve: (from, specifier) => {
      if (!specifier.startsWith(".") && !specifier.startsWith("@/"))
        return { file: `node_modules/${specifier}/index.d.ts`, external: true };
      const base = specifier.startsWith("@/")
        ? `src/${specifier.slice(2)}`
        : posix.join(posix.dirname(from), specifier);
      const file = [base, `${base}.ts`, `${base}/index.ts`].find((candidate) =>
        Object.hasOwn(files, candidate),
      );
      return file ? { file, external: false } : null;
    },
    allowedFile: (file) => file.startsWith("src/content/"),
  });
}
let rejectedCases = 0;
const reject = (files: Record<string, string>, reason: RegExp) => {
  const report = inspect(files);
  assert(report.issues.length > 0);
  assert.match(formatContractDependencyIssues(report), reason);
  rejectedCases++;
};
for (const forbidden of [
  "domain/study/learning-preferences",
  "components/example",
  "repositories/example",
  "lib/config",
  "domain/ai/provider",
  "app/api/example",
]) {
  reject(
    {
      "src/content/contracts.ts": `import type { Value } from "@/${forbidden}";`,
      [`src/${forbidden}.ts`]: "export type Value = string;",
    },
    /outside the content contract boundary/,
  );
}
reject(
  {
    "src/content/contracts.ts": 'export * from "./barrel";',
    "src/content/barrel.ts": 'export type { Value } from "@/domain/study/learning-preferences";',
    "src/domain/study/learning-preferences.ts": "export type Value = string;",
  },
  /outside the content contract boundary/,
);
reject(
  {
    "src/content/contracts.ts": 'type Value = import("@/lib/config").Value;',
    "src/lib/config.ts": "export type Value = string;",
  },
  /outside the content contract boundary/,
);
reject(
  {
    "src/content/contracts.ts": 'const load = () => import("@/domain/ai/provider");',
    "src/domain/ai/provider.ts": "export const Value = 1;",
  },
  /outside the content contract boundary/,
);
reject(
  {
    "src/content/contracts.ts": 'const config = require("@/lib/config");',
    "src/lib/config.ts": "export const config = {};",
  },
  /outside the content contract boundary/,
);
reject(
  {
    "src/content/contracts.ts": 'import config = require("@/lib/config");',
    "src/lib/config.ts": "export const config = {};",
  },
  /outside the content contract boundary/,
);
for (const external of ["react", "next", "openai", "@supabase/supabase-js", "node:fs"])
  reject(
    { "src/content/contracts.ts": `import "${external}";` },
    /External dependency is not allowed/,
  );
reject(
  {
    "src/content/contracts.ts": 'export * from "./helper";',
    "src/content/helper.ts": 'export * from "./contracts";',
  },
  /Circular contract dependency/,
);
reject(
  { "src/content/contracts.ts": 'const source = "./helper"; const load = () => import(source);' },
  /Computed module dependencies/,
);
reject({ "src/content/contracts.ts": 'import "./missing";' }, /Unresolved dependency/);
reject(
  { "src/content/contracts.ts": "const config = process.env.PROVIDER_KEY;" },
  /Host environment access/,
);
reject(
  { "src/content/contracts.ts": 'const config = process["env"].PROVIDER_KEY;' },
  /Host environment access/,
);
reject({ "src/content/contracts.ts": "const config = import.meta.env;" }, /Host module metadata/);
reject(
  { "src/content/contracts.ts": 'const getData = () => fetch("https://example.invalid");' },
  /Network access/,
);
reject({ "src/content/contracts.ts": '"use client";' }, /Client UI directives/);
const allowed = inspect({
  "src/content/contracts.ts":
    'import { z } from "zod"; export * from "./vocabulary"; const example = "import from @/domain/study/learning-preferences";',
  "src/content/vocabulary.ts":
    'import { z } from "zod"; export const value = z.string(); // process.env is just a comment',
});
assert.deepEqual(allowed.issues, []);
assert.equal(allowed.files.length, 2);

const actual = checkContentContractDependencies();
assert.equal(actual.issues.length, 0, formatContractDependencyIssues(actual));
assert(actual.files.includes("src/content/contract-vocabulary.ts"));
console.log(
  `Contract vocabulary: values, errors, public exports and consumers verified; ${rejectedCases} dependency regressions rejected.`,
);
console.log(
  `Content contract graph: ${actual.files.length} local modules, Zod only, no cycles. Type compatibility is checked by tsc.`,
);
