import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { loadContent } from "./content-loader";
import {
  coursePackageSchema,
  type CoursePackage,
  type FixedAssessmentDefinition,
} from "../src/content/contracts";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse } from "../src/content/public";
import { selectAssessment, resolveAssessment } from "../src/content/assessment-references";
import {
  assessmentRequestSchema,
  sameAssessmentRequest,
  type AssessmentRequest,
  type ServerAssessmentResult,
} from "../src/content/assessment-results";
import { evaluateAssessment } from "../src/domain/assessments/assessment-engine";
import { nextAdaptiveItem } from "../src/domain/study/adaptive-assessment";
import { readCourseState } from "../src/domain/study/course-state-storage";
import {
  markActivityComplete,
  recordServerAssessment,
  restoreServerAssessmentResults,
} from "../src/domain/study/study-state";
import { unitProgress } from "../src/domain/study/progress";
import { assessmentSeedRows } from "../src/repositories/assessment-content-projection";
import { createAssessmentApi, type StoredAssessmentRow } from "../src/lib/assessment-api";
import { StudyProvider } from "../src/components/study-provider";
import { FixedAssessmentRunner } from "../src/components/activities/fixed-assessment-runner";
import { AdaptiveAssessmentRunner } from "../src/components/activities/adaptive-assessment-runner";

const languageFixture = loadContent().find((item) => item.language.id === "xx-Test")!;
const language = languageFixture.language;
const raw = {
  schemaVersion: "1.3",
  contentVersion: "2.0.0",
  id: "synthetic.assessment",
  slug: "synthetic-assessment",
  sourceLanguage: "pt-BR",
  targetLanguage: language.id,
  title: "Avaliações sintéticas",
  framework: { name: "synthetic", exitLevel: "intro" },
  track: "test",
  learningGoals: ["recognize"],
  assessmentRefs: { diagnostic: "entry-41" },
  concepts: [],
  lexicon: [],
  units: [
    {
      id: "unit-a",
      slug: "unit-a",
      order: 1,
      title: "Unidade A",
      objectives: [],
      skills: ["vocabulary", "writing"],
      assessmentRefs: { diagnostic: "entry-41", formative: ["practice-2"], final: "result-89" },
      learningPolicy: { completion: { requirements: [] }, mastery: { requirements: [] } },
      lessons: [
        {
          id: "lesson-a",
          slug: "lesson-a",
          order: 1,
          title: "Lição A",
          objectives: [],
          minutes: 3,
          activities: [
            {
              id: "question-a",
              type: "multiple_choice",
              skills: ["vocabulary"],
              title: "Símbolo A",
              prompt: "Escolha tok-a",
              minutes: 1,
              payload: {
                options: ["tok-a", "tok-b"],
                answer: "tok-a",
                explanation: "Referência sintética A.",
              },
            },
            {
              id: "question-b",
              type: "multiple_choice",
              skills: ["vocabulary"],
              title: "Símbolo B",
              prompt: "Escolha tok-b",
              minutes: 1,
              payload: {
                options: ["tok-a", "tok-b"],
                answer: "tok-b",
                explanation: "Referência sintética B.",
              },
            },
            {
              id: "text-a",
              type: "writing",
              skills: ["writing"],
              title: "Entrega",
              minutes: 1,
              payload: { minWords: 1, guidance: [] },
            },
            {
              id: "visual-marker",
              type: "quiz",
              skills: ["reading"],
              title: "Marcador visual",
              minutes: 1,
              payload: { body: "Um bloco de apresentação." },
            },
          ],
        },
      ],
    },
  ],
  assessments: [
    {
      id: "result-89",
      title: "Diagnóstico no nome, somativa no contrato",
      purpose: "summative",
      method: "fixed",
      unitId: "unit-a",
      lessonId: "lesson-a",
      gradingStrategy: "objective_mean",
      activityIds: ["question-b", "text-a"],
      passingPolicy: { overall: 0.8 },
    },
    {
      id: "practice-2",
      title: "Acompanhamento",
      purpose: "formative",
      method: "fixed",
      unitId: "unit-a",
      gradingStrategy: "objective_mean",
      activityIds: ["question-a"],
      passingPolicy: { overall: 0.5 },
    },
    {
      id: "entry-41",
      title: "Entrada",
      purpose: "diagnostic",
      method: "adaptive",
      unitId: "unit-a",
      passingPolicy: { overall: 0.5 },
      skillWeights: { vocabulary: 1 },
      skillPlan: ["vocabulary", "vocabulary"],
      bank: [
        { activityId: "question-a", skill: "vocabulary", difficulty: 1 },
        { activityId: "question-b", skill: "vocabulary", difficulty: 3 },
      ],
    },
    {
      id: "other-result",
      title: "Outra somativa",
      purpose: "summative",
      method: "fixed",
      unitId: "unit-a",
      gradingStrategy: "objective_mean",
      activityIds: ["question-a"],
      passingPolicy: { overall: 1 },
    },
  ],
};
const base = coursePackageSchema.parse(raw);
function bundle(change?: (course: CoursePackage) => void) {
  const copy = structuredClone(base);
  change?.(copy);
  return runtimeBundle({ course: copy, language, moduleData: languageFixture.moduleData });
}
const current = bundle();
const exposed = publicCourse(current.course, language);
const state = () => readCourseState(null, current.course.id, language.id);
const request = (
  assessmentId = "result-89",
  responses = [
    { activityId: "question-b", answer: "tok-b" },
    { activityId: "text-a", answer: "texto" },
  ],
): AssessmentRequest => ({
  courseId: current.course.id,
  assessmentId,
  attemptId: randomUUID(),
  startedAt: "2026-10-10T12:00:00.000Z",
  responses,
});
const post = (value: unknown) =>
  new Request("http://local.test/api/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
let checked = 0;
async function check(name: string, test: () => void | Promise<void>) {
  await test();
  checked++;
  console.log(`OK ${name}`);
}
let user: { id: string } | null = { id: "synthetic-user" };
const rows: StoredAssessmentRow[] = [];
let writes = 0;
const api = createAssessmentApi({
  resolveCourse: (id) => (id === current.course.id ? current : undefined),
  authenticatedUser: async () => user,
  requiresAuth: () => true,
  now: () => new Date("2026-10-10T12:01:00.000Z"),
  save: async (owner, input, result) => {
    assert.equal(owner, "synthetic-user");
    writes++;
    rows.push({
      id: result.id,
      assessment_id: result.assessmentId,
      started_at: result.startedAt,
      finished_at: result.finishedAt,
      objective_score: result.objectiveScore,
      result: {
        courseId: result.courseId,
        contentVersion: result.contentVersion,
        input: structuredClone(input),
      },
    });
    return result.finishedAt;
  },
  read: async (owner, ids) => {
    assert.equal(owner, "synthetic-user");
    return rows.filter((row) => ids.includes(row.assessment_id));
  },
});
let result!: ServerAssessmentResult;

async function main() {
  await check("diagnostic and summative have distinct explicit references", () => {
    assert.equal(selectAssessment(exposed)?.id, "entry-41");
    assert.equal(
      resolveAssessment(exposed.assessments, exposed.units[0].assessmentRefs.final, "summative")
        ?.id,
      "result-89",
    );
    assert.equal(selectAssessment(exposed, "practice-2")?.purpose, "formative");
  });
  await check("reordering units/definitions never selects a different assessment", () => {
    const reordered = bundle((course) => course.assessments.reverse());
    assert.equal(selectAssessment(reordered.course)?.id, "entry-41");
    delete reordered.course.assessmentRefs.diagnostic;
    assert.equal(selectAssessment(reordered.course), undefined);
    assert.equal(selectAssessment(reordered.course, "other-result")?.id, "other-result");
  });
  await check("summative executes without quiz and uses declared score threshold", () => {
    const noQuiz = bundle((course) => {
      course.units[0].lessons[0].activities = course.units[0].lessons[0].activities.filter(
        (item) => item.type !== "quiz",
      );
    });
    const grade = evaluateAssessment(
      noQuiz.course,
      "result-89",
      request().responses,
      language.normalization,
    );
    assert.equal(grade.definition.purpose, "summative");
    assert.equal(grade.objectiveScore, 100);
    assert.equal(grade.passed, true);
    assert.equal(grade.answers.find((item) => item.activityId === "text-a")?.correct, null);
    assert.equal(
      assessmentSeedRows(noQuiz.coursePackage).find((item) => item.id === "result-89")
        ?.passing_score,
      80,
    );
  });
  await check("quiz marker never generates a final result", () => {
    const complete = markActivityComplete(state(), "visual-marker");
    assert.equal(complete.assessmentAttempts.length, 0);
    assert.equal(unitProgress(exposed.units[0], complete, [], exposed).assessmentScore, null);
  });
  await check("75 percent is not approved when the declared threshold is 80 percent", () => {
    const fourQuestions = bundle((course) => {
      const lesson = course.units[0].lessons[0];
      for (const id of ["question-c", "question-d"]) {
        lesson.activities.push({ ...structuredClone(lesson.activities[0]), id });
      }
      const definition = course.assessments.find((item) => item.id === "result-89")!;
      if (definition.method !== "fixed") throw new Error("wrong method");
      definition.activityIds = ["question-a", "question-b", "question-c", "question-d"];
    });
    coursePackageSchema.parse(fourQuestions.coursePackage);
    const responses = [
      { activityId: "question-a", answer: "tok-a" },
      { activityId: "question-b", answer: "tok-b" },
      { activityId: "question-c", answer: "tok-a" },
      { activityId: "question-d", answer: "tok-b" },
    ];
    const grade = evaluateAssessment(
      fourQuestions.course,
      "result-89",
      responses,
      language.normalization,
    );
    assert.equal(grade.objectiveScore, 75);
    assert.equal(grade.passed, false);
    fourQuestions.course.assessments.find(
      (item) => item.id === "result-89",
    )!.passingPolicy.overall = 0.7;
    assert.equal(
      evaluateAssessment(fourQuestions.course, "result-89", responses, language.normalization)
        .passed,
      true,
    );
  });
  await check("no summative is valid and absence is not a failing zero", () => {
    const noFinal = bundle((course) => {
      delete course.units[0].assessmentRefs.final;
      course.assessments = course.assessments.filter((item) => item.purpose !== "summative");
    });
    const pub = publicCourse(noFinal.course, language);
    const progress = unitProgress(pub.units[0], state(), [], pub);
    assert.equal(progress.assessmentDefined, false);
    assert.equal(progress.assessmentScore, null);
    assert.equal(progress.assessmentPassed, null);
    assert.equal(progress.assessmentStatus, "not_defined");
  });
  await check("invalid/missing/duplicated references and incompatible scopes are rejected", () => {
    const mutations: Array<(course: CoursePackage) => void> = [
      (course) => {
        course.units[0].assessmentRefs.final = "missing";
      },
      (course) => {
        course.units[0].assessmentRefs.final = "entry-41";
      },
      (course) => {
        course.units[0].assessmentRefs.formative = ["practice-2", "practice-2"];
      },
      (course) => {
        course.assessments.push(structuredClone(course.assessments[0]));
      },
      (course) => {
        course.assessments[0].unitId = "missing";
      },
      (course) => {
        course.assessments[0].lessonId = "missing";
      },
      (course) => {
        const def = course.assessments[0];
        if (def.method === "fixed") def.activityIds = ["missing"];
      },
      (course) => {
        const def = course.assessments[0];
        if (def.method === "fixed") def.activityIds = ["visual-marker"];
      },
    ];
    for (const mutate of mutations) assert.throws(() => bundle(mutate));
    const old = structuredClone(raw);
    Object.assign(old.units[0], { assessmentId: "entry-41" });
    assert.equal(coursePackageSchema.safeParse(old).success, false);
  });
  await check("unknown purpose and legacy schema are rejected", () => {
    const unknown = structuredClone(raw);
    unknown.assessments[0].purpose = "not-known";
    assert.equal(coursePackageSchema.safeParse(unknown).success, false);
    assert.equal(coursePackageSchema.safeParse({ ...raw, schemaVersion: "1.1" }).success, false);
  });
  await check("runtime preserves roles, associations, items and passing policy", () => {
    assert.deepEqual(current.course.assessments, current.coursePackage.assessments);
    assert.deepEqual(
      current.course.units[0].assessmentRefs,
      current.coursePackage.units[0].assessmentRefs,
    );
    assert.equal(
      current.course.assessments.find((item) => item.id === "result-89")?.passingPolicy.overall,
      0.8,
    );
  });
  await check("adaptive selection and scoring are replayed from canonical answers", () => {
    const definition = selectAssessment(current.course)!;
    assert.equal(definition.method, "adaptive");
    if (definition.method !== "adaptive") throw new Error("wrong method");
    assert.equal(
      nextAdaptiveItem(definition.bank, [], definition.skillPlan)?.activityId,
      "question-a",
    );
    const grade = evaluateAssessment(
      current.course,
      "entry-41",
      [
        { activityId: "question-a", answer: "tok-a" },
        { activityId: "question-b", answer: "tok-b" },
      ],
      language.normalization,
    );
    assert.equal(grade.objectiveScore, 100);
    assert.equal(grade.passed, true);
    assert.throws(() =>
      evaluateAssessment(
        current.course,
        "entry-41",
        [
          { activityId: "question-b", answer: "tok-b" },
          { activityId: "question-a", answer: "tok-a" },
        ],
        language.normalization,
      ),
    );
  });
  await check("previous results survive without automatic reclassification", () => {
    const legacy = {
      id: randomUUID(),
      assessmentId: "result-89",
      unitId: "unit-a",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:01:00.000Z",
      objectiveScore: 67,
    };
    const previous = { ...state(), assessmentAttempts: [legacy] };
    const restored = restoreServerAssessmentResults(previous, exposed, []);
    assert.deepEqual(restored.assessmentAttempts[0], legacy);
    const progress = unitProgress(exposed.units[0], restored, [], exposed);
    assert.equal(progress.assessmentStatus, "historical");
    assert.equal(progress.assessmentScore, null);
    assert.equal(progress.assessmentPassed, null);
  });
  await check("unfinished assessment has no numeric score", () => {
    const progress = unitProgress(exposed.units[0], state(), [], exposed);
    assert.equal(progress.assessmentStatus, "not_taken");
    assert.equal(progress.assessmentScore, null);
    assert.equal(progress.assessmentPassed, null);
  });
  await check("public projection exposes no answer keys", () => {
    function inspect(value: unknown) {
      if (!value || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        assert(
          !["answer", "accepted", "fullAnswers", "explanation"].includes(key),
          `private field: ${key}`,
        );
        inspect(item);
      }
    }
    inspect(exposed);
    assert.equal(JSON.stringify(exposed).includes("Referência sintética A."), false);
  });
  await check("API rejects client purpose/score/correct flags", async () => {
    const bad = request();
    assert.equal(
      assessmentRequestSchema.safeParse({ ...bad, purpose: "diagnostic", objectiveScore: 100 })
        .success,
      false,
    );
    assert.equal((await api.POST(post({ ...bad, purpose: "diagnostic" }))).status, 400);
    assert.equal(
      (await api.POST(post({ ...bad, responses: [{ ...bad.responses[0], correct: true }] })))
        .status,
      400,
    );
    assert.equal(writes, 0);
  });
  await check(
    "authenticated server execution persists the declared identity and result",
    async () => {
      const response = await api.POST(post(request()));
      assert.equal(response.status, 200);
      result = (await response.json()) as ServerAssessmentResult;
      assert.equal(result.assessmentId, "result-89");
      assert.equal(result.purpose, "summative");
      assert.equal(result.method, "fixed");
      assert.equal(result.objectiveScore, 100);
      assert.equal(result.passed, true);
      assert.equal(rows[0].assessment_id, result.assessmentId);
      const recorded = recordServerAssessment(state(), exposed, result);
      const progress = unitProgress(exposed.units[0], recorded, [], exposed);
      assert.equal(progress.assessmentFinished, true);
      assert.equal(progress.assessmentPassed, true);
      assert.equal(progress.assessmentScore, 100);
      assert.strictEqual(
        recordServerAssessment(recorded, exposed, { ...result, purpose: "diagnostic" }),
        recorded,
      );
    },
  );
  await check("database/client cached scores cannot determine official reads", async () => {
    rows[0].objective_score = 0;
    const read = await api.GET(
      new Request(`http://local.test/api/assessments?courseId=${current.course.id}`),
    );
    const body = await read.json();
    assert.equal(body.results[0].objectiveScore, 100);
    const wrongInput = request("result-89", [
      { activityId: "question-b", answer: "tok-a" },
      { activityId: "text-a", answer: "texto" },
    ]);
    const wrong = await api.POST(post(wrongInput));
    assert.equal(wrong.status, 200);
    assert.equal(
      (await wrong.json()).objectiveScore,
      0,
      "zero is legitimate for actually incorrect answers",
    );
    rows[1].objective_score = 100;
    const reread = await api.GET(
      new Request(`http://local.test/api/assessments?courseId=${current.course.id}`),
    );
    assert.equal(
      (await reread.json()).results.find(
        (item: ServerAssessmentResult) => item.id === wrongInput.attemptId,
      ).objectiveScore,
      0,
    );
    const older = { ...result, contentVersion: "old-version" };
    const history = { ...state(), assessmentAttempts: [older] };
    assert.equal(
      restoreServerAssessmentResults(history, exposed, []).assessmentAttempts[0].source,
      "historical",
    );
  });
  await check("retry preserves saved timestamp and JSONB key order is immaterial", async () => {
    const input = request();
    const reordered = {
      responses: input.responses.map((item) => ({
        answer: item.answer,
        activityId: item.activityId,
      })),
      startedAt: input.startedAt,
      attemptId: input.attemptId,
      assessmentId: input.assessmentId,
      courseId: input.courseId,
    };
    assert.equal(sameAssessmentRequest(reordered, input), true);
    assert.equal(
      sameAssessmentRequest({ ...reordered, responses: [...input.responses].reverse() }, input),
      false,
    );
    assert.equal(sameAssessmentRequest({ ...reordered, purpose: "summative" }, input), false);
    const retryApi = createAssessmentApi({
      resolveCourse: () => current,
      authenticatedUser: async () => user,
      requiresAuth: () => true,
      now: () => new Date("2026-10-10T13:00:00.000Z"),
      save: async () => "2026-10-10T12:01:00+00:00",
      read: async () => [],
    });
    const response = await retryApi.POST(post(input));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).finishedAt, "2026-10-10T12:01:00.000Z");
  });
  await check("persistence failure never produces an official result or empty read", async () => {
    const unavailable = createAssessmentApi({
      resolveCourse: () => current,
      authenticatedUser: async () => user,
      requiresAuth: () => true,
      save: async () => {
        throw new Error("simulated write failure");
      },
      read: async () => {
        throw new Error("simulated read failure");
      },
    });
    const response = await unavailable.POST(post(request()));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).source, undefined);
    assert.equal(
      (
        await unavailable.GET(
          new Request(`http://local.test/api/assessments?courseId=${current.course.id}`),
        )
      ).status,
      503,
    );
  });
  await check("auth, course isolation and incomplete responses fail closed", async () => {
    user = null;
    assert.equal((await api.POST(post(request()))).status, 401);
    assert.equal(
      (
        await api.GET(
          new Request(`http://local.test/api/assessments?courseId=${current.course.id}`),
        )
      ).status,
      401,
    );
    user = { id: "synthetic-user" };
    assert.equal(
      (await api.POST(post({ ...request(), assessmentId: "outside-course" }))).status,
      404,
    );
    assert.equal(
      (await api.POST(post(request("result-89", [{ activityId: "question-b", answer: "tok-b" }]))))
        .status,
      422,
    );
  });
  await check("course-level summative and formative evaluations are not unit finals", () => {
    const scoped = bundle((course) => {
      const additional = course.assessments.find((item) => item.id === "other-result")!;
      delete additional.unitId;
      additional.objectiveIds = ["recognize"];
    });
    assert.equal(
      assessmentSeedRows(scoped.coursePackage).find((item) => item.id === "other-result")?.unit_id,
      null,
    );
    assert.equal(
      resolveAssessment(scoped.course.assessments, scoped.course.units[0].assessmentRefs.final)?.id,
      "result-89",
    );
  });
  await check("fixed runner renders from metadata without external services", () => {
    const fixed = resolveAssessment(
      current.course.assessments,
      "result-89",
    ) as FixedAssessmentDefinition;
    const html = renderToString(
      <StudyProvider course={exposed} resources={current.resources} language={language}>
        <FixedAssessmentRunner assessment={fixed} />
      </StudyProvider>,
    );
    assert(html.includes("Para concluir"));
    assert(html.includes("Começar avaliação"));
  });
  await check(
    "adaptive runner displays declared purpose instead of assuming diagnostic",
    async () => {
      for (const purpose of ["formative", "summative"] as const) {
        const scoped = bundle((course) => {
          delete course.assessmentRefs.diagnostic;
          delete course.units[0].assessmentRefs.diagnostic;
          course.assessments.find((item) => item.id === "entry-41")!.purpose = purpose;
        });
        coursePackageSchema.parse(scoped.coursePackage);
        const adaptive = resolveAssessment(scoped.course.assessments, "entry-41")!;
        if (adaptive.method !== "adaptive") throw new Error("wrong method");
        const html = renderToString(
          <StudyProvider
            course={publicCourse(scoped.course, language)}
            resources={scoped.resources}
            language={language}
          >
            <AdaptiveAssessmentRunner assessment={adaptive} />
          </StudyProvider>,
        );
        assert(html.includes(purpose === "formative" ? "Para praticar" : "Para concluir"));
        assert(!html.includes("DIAGNÓSTICO ADAPTATIVO"));
        const grade = evaluateAssessment(
          scoped.course,
          adaptive.id,
          [
            { activityId: "question-a", answer: "tok-b" },
            { activityId: "question-b", answer: "tok-b" },
          ],
          language.normalization,
        );
        const apiForPurpose = createAssessmentApi({
          resolveCourse: () => scoped,
          authenticatedUser: async () => user,
          requiresAuth: () => true,
          save: async (_owner, _input, result) => result.finishedAt,
          read: async () => [],
        });
        const response = await apiForPurpose.POST(
          post(
            request(
              adaptive.id,
              grade.answers.map(({ activityId, answer }) => ({ activityId, answer })),
            ),
          ),
        );
        assert.equal(response.status, 200);
        const result = (await response.json()) as ServerAssessmentResult;
        const recorded = recordServerAssessment(
          state(),
          publicCourse(scoped.course, language),
          result,
        );
        assert.strictEqual(
          recordServerAssessment(recorded, publicCourse(scoped.course, language), result),
          recorded,
        );
      }
    },
  );
  await check("seed/migration do not guess purpose from IDs or markers", () => {
    const projected = assessmentSeedRows(base);
    assert.deepEqual(
      projected.map((item) => item.id),
      base.assessments.map((item) => item.id),
    );
    assert.equal(projected.find((item) => item.id === "practice-2")?.purpose, "formative");
    assert.equal(projected.find((item) => item.id === "result-89")?.passing_score, 80);
    const sql = readFileSync("supabase/migrations/20261010000100_assessment_semantics.sql", "utf8");
    assert(sql.includes("objective_score drop not null"));
    assert(!/delete from|truncate|like.*final|drop table/i.test(sql));
  });
  console.log(
    `Assessment semantics: ${checked} synthetic scenarios passed; server/API/SSR mocks only, no network.`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
