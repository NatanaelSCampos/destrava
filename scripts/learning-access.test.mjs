import { evaluateUnitPolicies } from "../src/domain/study/learning-policy-engine.ts";
import { initialStudyState } from "../src/domain/study/study-state.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  unitAccessSchema,
  examPolicySchema,
  learningAccessIssues,
} from "../src/content/learning-access.ts";
import { courseSchema } from "../src/content/schema.ts";
import {
  evaluateLearningAccess,
  protectedExamForActivity,
  resolveLearningTarget,
  hasDuplicateLearningScope,
} from "../src/domain/study/learning-access.ts";
import {
  signLearningEvidence,
  verifyLearningEvidence,
  evidenceHash,
  canonicalLearningTimestamp,
} from "../src/lib/signed-learning-evidence.ts";
import { evaluateAssessment } from "../src/domain/assessments/assessment-engine.ts";
import { createAssessmentApi } from "../src/lib/assessment-api.ts";
const types = ["multiple_choice", "ordering", "fill_blank", "short_answer", "listening"];
const practices = Array.from({ length: 10 }, (_, i) => ({
  id: "p" + i,
  type: "short_answer",
  title: "Pratique",
  prompt: "Diga oi.",
  skill: "reading",
  skills: ["reading"],
  conceptIds: [],
  minutes: 1,
  answer: "hola",
  accepted: ["hola"],
  explanation: "Saudação.",
}));
const items = Array.from({ length: 18 }, (_, i) => ({
  ...practices[0],
  id: "q" + i,
  title: "Situação " + i,
}));
const exam = {
  id: "final1",
  title: "Prova",
  method: "fixed",
  purpose: "summative",
  unitId: "u1",
  lessonId: "bank",
  objectiveIds: [],
  gradingStrategy: "objective_mean",
  passingPolicy: { overall: 0.8 },
  activityIds: items.map((a) => a.id),
  exam: {
    entry: { activityIds: practices.map((a) => a.id), minimumRatio: 0.8 },
    feedback: "after_submission",
  },
};
const course = courseSchema.parse({
  id: "generic",
  slug: "generic",
  title: "Teste",
  languageCode: "es",
  level: "A1",
  description: "",
  contentVersion: "2.0.0",
  assessments: [exam],
  units: [
    {
      id: "u1",
      slug: "one",
      title: "Um",
      number: 1,
      description: "",
      objectives: [],
      active: true,
      assessmentRefs: { final: "final1" },
      lessons: [
        {
          id: "normal",
          slug: "normal",
          title: "Práticas",
          eyebrow: "",
          description: "",
          minutes: 10,
          order: 1,
          active: true,
          activities: practices,
        },
        {
          id: "bank",
          slug: "bank",
          title: "Prova",
          eyebrow: "",
          description: "",
          minutes: 20,
          order: 2,
          active: true,
          activities: items,
        },
      ],
    },
    {
      id: "u2",
      slug: "two",
      title: "Dois",
      number: 2,
      description: "",
      objectives: [],
      active: true,
      access: { assessmentId: "final1", minimumScore: 80 },
      lessons: [],
    },
  ],
});
const empty = { completedActivityIds: [], assessmentResults: [] };
const result = (correct, total = 18, extra = {}) => ({
  id: randomUUID(),
  source: "server",
  courseId: course.id,
  assessmentId: "final1",
  contentVersion: course.contentVersion,
  method: "fixed",
  purpose: "summative",
  status: "completed",
  startedAt: "2026-10-25T10:00:00.000Z",
  finishedAt: "2026-10-25T10:01:00.000Z",
  objectiveScore: Math.round((correct / total) * 100),
  passed: correct / total >= 0.8,
  answers: Array.from({ length: total }, (_, i) => ({
    activityId: "q" + i,
    answer: "hola",
    correct: i < correct,
    skill: "reading",
  })),
  responseKey: "",
  ...extra,
});
test("entry uses unique acknowledged practices and exact 80 percent", () => {
  for (const n of [0, 7, 8, 9, 10]) {
    const d = evaluateLearningAccess(course, {
      ...empty,
      completedActivityIds: practices
        .slice(0, n)
        .flatMap((a) => [a.id, a.id])
        .concat(items.map((a) => a.id)),
    }).assessments.final1;
    assert.equal(d.completed, n);
    assert.equal(d.allowed, n >= 8);
    assert.equal(d.required, 8);
  }
});
test("ceil enforces threshold for uneven denominators", () => {
  const c = structuredClone(course);
  c.assessments[0].exam.entry.activityIds = Array.from({ length: 999 }, (_, i) => "x" + i);
  for (const n of [799, 800, 801])
    assert.equal(
      evaluateLearningAccess(c, {
        ...empty,
        completedActivityIds: Array.from({ length: n }, (_, i) => "x" + i),
      }).assessments.final1.allowed,
      n >= 800,
    );
});
test("next unit requires a current official passing final", () => {
  for (const [r, allowed] of [
    [result(14), false],
    [result(15), true],
    [result(18, 18, { contentVersion: "old" }), false],
    [result(18, 18, { courseId: "foreign" }), false],
    [result(18, 18, { source: "client" }), false],
    [result(35, 44, { passed: true }), false],
  ])
    assert.equal(
      evaluateLearningAccess(course, { ...empty, assessmentResults: [r] }).units.u2.allowed,
      allowed,
    );
});
test("later failed retry does not relock an achieved unit", () =>
  assert.equal(
    evaluateLearningAccess(course, { ...empty, assessmentResults: [result(0), result(15)] }).units
      .u2.allowed,
    true,
  ));
test("final banks are explicitly protected; ordinary practice unchanged", () => {
  assert.equal(protectedExamForActivity(course, "q0")?.id, "final1");
  assert.equal(protectedExamForActivity(course, "p0"), undefined);
});
test("strict public gates reject unknown fields, duplicates and invalid scales", () => {
  assert.equal(unitAccessSchema.safeParse({ assessmentId: "x", minimumScore: 101 }).success, false);
  assert.equal(
    examPolicySchema.safeParse({
      ...exam.exam,
      entry: { activityIds: ["a", "a"], minimumRatio: 0.8 },
    }).success,
    false,
  );
  assert.equal(examPolicySchema.safeParse({ ...exam.exam, feedback: "immediate" }).success, false);
});
test("HMAC is domain/scoped, canonical, fails closed and cannot be edited", () => {
  const value = {
    kind: "participation",
    owner: "one",
    courseId: "generic",
    contentVersion: "2",
    definitionHash: "hash",
    activityId: "a",
  };
  const token = signLearningEvidence(value, "test-only-key");
  assert.ok(verifyLearningEvidence(token, { ...value }, "test-only-key"));
  assert.ok(!verifyLearningEvidence(token + "x", value, "test-only-key"));
  for (const field of Object.keys(value))
    assert.ok(!verifyLearningEvidence(token, { ...value, [field]: "changed" }, "test-only-key"));
  assert.ok(!verifyLearningEvidence(token, value, "wrong"));
  assert.ok(!verifyLearningEvidence(token, value, ""));
  assert.ok(!verifyLearningEvidence("x".repeat(20000), value, "test-only-key"));
  assert.equal(evidenceHash({ a: 1, b: 2 }), evidenceHash({ b: 2, a: 1 }));
});
test("fixed grading compares ratios, not rounded score", () => {
  const c = structuredClone(course);
  const a = c.assessments[0];
  const bank = c.units[0].lessons[1];
  bank.activities = Array.from({ length: 44 }, (_, i) => ({ ...items[0], id: "r" + i }));
  a.activityIds = bank.activities.map((x) => x.id);
  const grade = evaluateAssessment(
    c,
    a.id,
    bank.activities.map((x, i) => ({ activityId: x.id, answer: i < 35 ? "hola" : "adios" })),
  );
  assert.equal(grade.objectiveScore, 80);
  assert.equal(grade.passed, false);
});
test("exam submission demands the complete exact set before grading", () => {
  assert.throws(() => evaluateAssessment(course, "final1", [{ activityId: "q0", answer: "hola" }]));
  assert.throws(() =>
    evaluateAssessment(
      course,
      "final1",
      items.map(() => ({ activityId: "q0", answer: "hola" })),
    ),
  );
});
test("assessment API denies locked exam without grading/saving; read failure fails closed", async () => {
  let saves = 0;
  const api = createAssessmentApi({
    resolveCourse: () => ({ course, language: { normalization: {} } }),
    authenticatedUser: async () => ({ id: "owner" }),
    requiresAuth: () => true,
    authorize: async () => ({ allowed: false, message: "Pratique antes." }),
    save: async () => {
      saves++;
      return new Date().toISOString();
    },
    read: async () => [],
  });
  const body = {
    courseId: course.id,
    assessmentId: "final1",
    attemptId: randomUUID(),
    startedAt: new Date().toISOString(),
    responses: [{ activityId: "q0", answer: "x" }],
  };
  const response = await api.POST(
    new Request("http://localhost/api/assessments", { method: "POST", body: JSON.stringify(body) }),
  );
  assert.equal(response.status, 403);
  assert.equal(saves, 0);
  assert.ok(!("answers" in (await response.json())));
});
test("stored fabricated exam rows are ignored before regrading/disclosure", async () => {
  const r = result(18);
  const input = {
    courseId: course.id,
    assessmentId: "final1",
    attemptId: r.id,
    startedAt: r.startedAt,
    responses: items.map((a) => ({ activityId: a.id, answer: "hola" })),
  };
  const api = createAssessmentApi({
    resolveCourse: () => ({ course, language: { normalization: {} } }),
    authenticatedUser: async () => ({ id: "owner" }),
    requiresAuth: () => true,
    save: async () => r.finishedAt,
    read: async () => [
      {
        id: r.id,
        assessment_id: "final1",
        started_at: r.startedAt,
        finished_at: r.finishedAt,
        objective_score: 100,
        result: { contentVersion: course.contentVersion, input },
      },
    ],
  });
  const response = await api.GET(new Request("http://localhost/api/assessments?courseId=generic"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { results: [] });
});
test("producer validates references, variety, minimum items and support", () => {
  const raw = {
    schemaVersion: "1.10",
    assessments: [structuredClone(exam)],
    units: course.units.map((u) => ({
      id: u.id,
      order: u.number,
      access: u.access,
      assessmentRefs: u.assessmentRefs,
      lessons: u.lessons.map((l) => ({
        id: l.id,
        activities: l.activities.map((a, i) => ({
          id: a.id,
          type: l.id === "bank" ? types[i % 5] : a.type,
          payload: {},
        })),
      })),
    })),
  };
  assert.deepEqual(learningAccessIssues(raw), []);
  const old = structuredClone(raw);
  old.schemaVersion = "1.9";
  assert.ok(learningAccessIssues(old).length);
  const circular = structuredClone(raw);
  circular.assessments[0].exam.entry.activityIds = ["q0"];
  assert.ok(learningAccessIssues(circular).length);
  const short = structuredClone(raw);
  short.assessments[0].activityIds = ["q0"];
  assert.ok(learningAccessIssues(short).length);
  const hints = structuredClone(raw);
  hints.units[0].lessons[1].activities[0].payload = { supportActivityIds: ["p0"] };
  assert.ok(learningAccessIssues(hints).length);
  const future = structuredClone(raw);
  future.units[1].access.assessmentId = "missing";
  assert.ok(learningAccessIssues(future).length);
});

test("unit completion and mastery use exact exam scores and keep an achieved pass", () => {
  const c = structuredClone(course),
    u = c.units[0];
  const policy = {
    id: "final-evidence",
    kind: "assessment",
    label: "Concluir a prova",
    assessmentId: "final1",
    purpose: "summative",
    minimumScore: 80,
  };
  u.learningPolicy = {
    completion: { requirements: [policy] },
    mastery: { requirements: [policy] },
  };
  const state = structuredClone(initialStudyState);
  state.courseId = c.id;
  state.assessmentAttempts = [result(14)];
  assert.equal(evaluateUnitPolicies(u, state, c).mastery.status, "not_met");
  state.assessmentAttempts = [
    result(15),
    result(0, 18, { finishedAt: "2026-10-25T10:02:00.000Z" }),
  ];
  assert.equal(evaluateUnitPolicies(u, state, c).completion.status, "satisfied");
  assert.equal(evaluateUnitPolicies(u, state, c).mastery.status, "satisfied");
  state.assessmentAttempts = [result(35, 44, { passed: true })];
  assert.equal(evaluateUnitPolicies(u, state, c).mastery.status, "not_met");
});
test("access store read failures return no grade or official result", async () => {
  const api = createAssessmentApi({
    resolveCourse: () => ({ course, language: { normalization: {} } }),
    authenticatedUser: async () => ({ id: "owner" }),
    requiresAuth: () => true,
    authorize: async () => {
      throw Error("store unavailable");
    },
    save: async () => {
      throw Error("should not save");
    },
    read: async () => {
      throw Error("store unavailable");
    },
  });
  const r = await api.POST(
    new Request("http://localhost/api/assessments", {
      method: "POST",
      body: JSON.stringify({
        courseId: course.id,
        assessmentId: "final1",
        attemptId: randomUUID(),
        startedAt: new Date().toISOString(),
        responses: items.map((a) => ({ activityId: a.id, answer: "hola" })),
      }),
    }),
  );
  assert.equal(r.status, 503);
  assert.ok(!(await r.json()).answers);
  const get = await api.GET(new Request("http://localhost/api/assessments?courseId=generic"));
  assert.equal(get.status, 503);
  assert.ok(!(await get.json()).results);
});

test("all supplied target scopes must exist and agree, including inverse activity/lesson conflicts", () => {
  const c = {
    units: [
      { id: "u1", lessons: [{ id: "l1", activities: [{ id: "a1" }] }] },
      { id: "u2", lessons: [{ id: "l2", activities: [{ id: "a2" }] }] },
    ],
    assessments: [{ id: "e2", unitId: "u2" }],
  };
  for (const target of [
    { activityId: "a2", lessonId: "l1" },
    { activityId: "a1", lessonId: "l2" },
    { unitId: "u1", assessmentId: "e2" },
    { activityId: "missing" },
    { lessonId: "missing" },
    { unitId: "missing" },
    { assessmentId: "missing" },
  ])
    assert.equal(resolveLearningTarget(c, target).valid, false);
  assert.equal(
    resolveLearningTarget(c, { activityId: "a2", lessonId: "l2", unitId: "u2", assessmentId: "e2" })
      .unit.id,
    "u2",
  );
  assert.equal(resolveLearningTarget(c, {}).valid, true);
});

test("legacy global assessment stays valid alone and cannot mask another target", () => {
  const c = {
    units: [{ id: "u", lessons: [] }],
    assessments: [{ id: "global", method: "adaptive" }],
  };
  assert.equal(resolveLearningTarget(c, { assessmentId: "global" }).valid, true);
  assert.equal(resolveLearningTarget(c, { assessmentId: "global", unitId: "u" }).valid, false);
  assert.equal(resolveLearningTarget(c, { assessmentId: "missing" }).valid, false);
});

test("multipart duplicated scope is rejected in both orders before choosing a target", () => {
  for (const field of [
    "courseId",
    "activityId",
    "lessonId",
    "unitId",
    "assessmentId",
    "contentVersion",
    "numberPromptId",
  ]) {
    for (const values of [
      ["open", "locked"],
      ["locked", "open"],
      ["same", "same"],
    ]) {
      const form = new FormData();
      for (const value of values) form.append(field, value);
      assert.equal(hasDuplicateLearningScope(form), true);
    }
  }
  const form = new FormData();
  form.set("courseId", "course");
  form.set("activityId", "activity");
  assert.equal(hasDuplicateLearningScope(form), false);
});

test("timestamp evidence survives PostgreSQL UTC representation without accepting a different instant", () => {
  const instant = "2026-10-26T02:28:07.493Z";
  const canonical = canonicalLearningTimestamp(instant);
  for (const value of [
    "2026-10-26T02:28:07.493+00:00",
    "2026-10-26T02:28:07.493000+00:00",
    "2026-10-25T23:28:07.493-03:00",
  ]) {
    assert.equal(canonicalLearningTimestamp(value), canonical);
    const token = signLearningEvidence({ finishedAt: canonical }, "test");
    assert.equal(
      verifyLearningEvidence(token, { finishedAt: canonicalLearningTimestamp(value) }, "test"),
      true,
    );
  }
  for (const value of [
    null,
    "invalid",
    "2026-10-26T02:28:07.493001+00:00",
    "2026-02-29T10:30:00.493Z",
    "2026-02-30T10:30:00.493Z",
    "2026-04-31T10:30:00.493Z",
    "2026-01-01T24:00:00Z",
    "2026-10-26T02:28:07.493",
  ])
    assert.equal(canonicalLearningTimestamp(value), null);
  const token = signLearningEvidence({ finishedAt: canonical }, "test");
  assert.equal(
    verifyLearningEvidence(
      token,
      { finishedAt: canonicalLearningTimestamp("2026-10-26T02:28:07.494+00:00") },
      "test",
    ),
    false,
  );
});
