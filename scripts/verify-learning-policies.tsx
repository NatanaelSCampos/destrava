import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { renderToString } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadContent } from "./content-loader";
import { coursePackageSchema, type CoursePackage } from "../src/content/contracts";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse } from "../src/content/public";
import { readCourseState } from "../src/domain/study/course-state-storage";
import { unitProgress, skillProgress, courseProgress } from "../src/domain/study/progress";
import { ReviewScheduler } from "../src/domain/review/review-scheduler";
import type { StudyState } from "../src/domain/study/study-state";
import { projectUnitProgress } from "../src/repositories/unit-progress-projection";
import { SupabaseStudyRepository } from "../src/repositories/supabase-study-repository";
import { nextActivity, buildStudyPlan } from "../src/domain/study/study-planner";
import { PolicyChecklist } from "../src/components/activities/policy-checklist";

const language = loadContent().find((item) => item.language.id === "xx-Test")!.language;
const participation = {
  id: "required",
  label: "Realizar introdução",
  kind: "participation" as const,
  activityIds: ["intro"],
};
const assessment = {
  id: "proof",
  label: "Atingir 80 na somativa",
  kind: "assessment" as const,
  assessmentId: "proof",
  purpose: "summative" as const,
  minimumScore: 80,
};
const raw = {
  schemaVersion: "1.3",
  contentVersion: "3.0.0",
  id: "synthetic.policy",
  slug: "synthetic-policy",
  targetLanguage: language.id,
  sourceLanguage: "pt-BR",
  title: "Políticas sintéticas",
  framework: { name: "synthetic", exitLevel: "intro" },
  track: "test",
  learningGoals: ["recognize"],
  concepts: [],
  lexicon: [],
  assessmentRefs: { diagnostic: "entry" },
  units: [
    {
      id: "unit",
      slug: "unit",
      order: 1,
      title: "Unidade",
      objectives: [],
      skills: ["reading", "listening", "writing", "speaking"],
      assessmentRefs: { diagnostic: "entry", final: "proof" },
      learningPolicy: {
        completion: { requirements: [participation] },
        mastery: { requirements: [] },
      },
      lessons: [
        {
          id: "lesson",
          slug: "lesson",
          order: 1,
          title: "Lição",
          objectives: [],
          minutes: 3,
          activities: [
            {
              id: "intro",
              type: "lesson_content",
              skills: ["reading"],
              title: "Introdução",
              minutes: 1,
              payload: { body: "Conteúdo sintético." },
            },
            ...Array.from({ length: 5 }, (_, i) => ({
              id: `q${i + 1}`,
              type: "multiple_choice",
              skills: ["listening"],
              title: `Questão ${i + 1}`,
              minutes: 1,
              payload: {
                options: ["a", "b"],
                answer: "a",
                explanation: "Gabarito privado sintético.",
              },
            })),
            {
              id: "text",
              type: "writing",
              skills: ["writing"],
              title: "Texto",
              minutes: 1,
              payload: { minWords: 1, guidance: [] },
            },
            {
              id: "speech",
              type: "speaking",
              skills: ["speaking"],
              title: "Fala",
              minutes: 1,
              payload: { guidance: [] },
            },
            {
              id: "marker",
              type: "quiz",
              skills: ["reading"],
              title: "Quiz",
              minutes: 1,
              payload: { body: "Apresentação." },
            },
          ],
        },
      ],
    },
  ],
  assessments: ["proof", "entry"].map((id) => ({
    id,
    title: id,
    purpose: id === "proof" ? "summative" : "diagnostic",
    method: "fixed",
    unitId: "unit",
    gradingStrategy: "objective_mean",
    activityIds: ["q1", "q2", "q3", "q4", "q5"],
    passingPolicy: { overall: 0.75 },
  })),
};
const base = coursePackageSchema.parse(raw);
function fixture(change?: (course: CoursePackage) => void) {
  const copy = structuredClone(base);
  change?.(copy);
  const bundle = runtimeBundle({ course: copy, language, moduleData: {} });
  return { ...bundle, exposed: publicCourse(bundle.course, language) };
}
const empty = () => readCourseState(null, base.id, language.id);
const studied = () => ({ ...empty(), completedActivityIds: ["intro"] });
function progress(bundle: ReturnType<typeof fixture>, state = empty()) {
  return unitProgress(bundle.exposed.units[0], state, [], bundle.exposed);
}
function withAssessment(score?: number, id = "proof", version = base.contentVersion): StudyState {
  const state = studied();
  if (score !== undefined)
    state.assessmentAttempts.push({
      id: randomUUID(),
      courseId: base.id,
      assessmentId: id,
      unitId: "unit",
      startedAt: "2026-10-10T12:00:00.000Z",
      finishedAt: "2026-10-10T12:01:00.000Z",
      contentVersion: version,
      source: "server",
      purpose: id === "proof" ? "summative" : "diagnostic",
      method: "fixed",
      status: "completed",
      objectiveScore: score,
      passed: score >= 75,
    });
  return state;
}
function requireAssessment() {
  return fixture((course) =>
    course.units[0].learningPolicy.completion.requirements.push(assessment),
  );
}
function scores(correct: number): StudyState {
  const state = studied();
  state.attempts = Array.from({ length: 5 }, (_, i) => ({
    id: randomUUID(),
    activityId: `q${i + 1}`,
    skill: "listening" as const,
    answer: i < correct ? "a" : "b",
    correct: i < correct,
    createdAt: "2026-10-10T12:01:00.000Z",
    sessionId: null,
  }));
  return state;
}
let checks = 0;
async function check(name: string, test: () => void | Promise<void>) {
  await test();
  checks++;
  console.log(`OK ${name}`);
}

async function main() {
  await check("course without writing completes", () => {
    const data = fixture((course) => {
      course.units[0].lessons[0].activities = course.units[0].lessons[0].activities.filter(
        (item) => item.type !== "writing",
      );
      course.units[0].skills = course.units[0].skills.filter((item) => item !== "writing");
    });
    assert.equal(progress(data, studied()).isCompleted, true);
  });
  await check("course without speaking completes", () => {
    const data = fixture((course) => {
      course.units[0].lessons[0].activities = course.units[0].lessons[0].activities.filter(
        (item) => item.type !== "speaking",
      );
      course.units[0].skills = course.units[0].skills.filter((item) => item !== "speaking");
    });
    assert.equal(progress(data, studied()).isCompleted, true);
  });
  await check("course without summative completes when not required", () => {
    const data = fixture((course) => {
      delete course.units[0].assessmentRefs.final;
      course.assessments = course.assessments.filter((item) => item.purpose !== "summative");
    });
    assert.equal(progress(data, studied()).isCompleted, true);
    assert.equal(progress(data, studied()).assessmentScore, null);
  });
  await check("optional activity does not block completion or fabricate mastery", () => {
    const result = progress(fixture(), studied());
    assert.equal(result.isCompleted, true);
    assert.equal(result.percentage, 100);
    assert(result.participationPercentage < 100);
    assert.equal(result.isMastered, false);
    assert.equal(result.mastery.status, "not_required");
  });
  await check("mandatory participation pending blocks completion", () => {
    const result = progress(fixture());
    assert.equal(result.isCompleted, false);
    assert.equal(result.completion.status, "pending");
  });
  await check("75 fails declared assessment floor 80", () => {
    const result = progress(requireAssessment(), withAssessment(75));
    assert.equal(result.completion.status, "not_met");
    assert.equal(result.isCompleted, false);
    assert.equal(result.completion.requirements[1].score, 75);
  });
  await check("80 meets declared assessment floor 80", () => {
    assert.equal(progress(requireAssessment(), withAssessment(80)).isCompleted, true);
  });
  await check("missing assessment is unassessed, genuine zero is failure", () => {
    const result = progress(requireAssessment(), withAssessment());
    assert.equal(result.completion.status, "not_assessed");
    assert.equal(result.completion.requirements[1].score, null);
    assert.equal(progress(requireAssessment(), withAssessment(0)).completion.status, "not_met");
  });
  await check("diagnostic does not substitute required summative", () => {
    assert.equal(
      progress(requireAssessment(), withAssessment(100, "entry")).completion.status,
      "not_assessed",
    );
  });
  await check("completion true and mastery insufficient are independent", () => {
    const data = fixture((course) =>
      course.units[0].learningPolicy.mastery.requirements.push({
        id: "listening",
        label: "Escuta",
        kind: "objective_score",
        skill: "listening",
        activityIds: ["q1", "q2", "q3", "q4", "q5"],
        minimumSamples: 5,
        minimumScore: 80,
      }),
    );
    const result = progress(data, scores(3));
    assert.equal(result.isCompleted, true);
    assert.equal(result.isMastered, false);
    assert.equal(result.mastery.status, "not_met");
    assert.equal(result.mastery.requirements[0].score, 60);
    assert.equal(progress(data, scores(4)).isMastered, true);
  });
  await check("inapplicable skill is not failed or scored zero", () => {
    const data = fixture();
    const skill = skillProgress(data.exposed, empty(), "grammar");
    assert.equal(skill.applicable, false);
    assert.equal(skill.status, "not_applicable");
    assert.equal(skill.performance, null);
    assert.equal(progress(data, studied()).isCompleted, true);
  });
  await check("nonexistent and incompatible required references are rejected", () => {
    for (const rule of [
      { ...participation, activityIds: ["missing"] },
      { ...assessment, assessmentId: "missing" },
      { ...assessment, assessmentId: "entry" },
      {
        id: "bad",
        label: "Bad",
        kind: "objective_score",
        skill: "grammar",
        activityIds: ["q1"],
        minimumScore: 80,
      },
    ]) {
      const invalid = structuredClone(raw);
      invalid.units[0].learningPolicy.completion.requirements = [rule as typeof participation];
      assert.equal(coursePackageSchema.safeParse(invalid).success, false);
    }
  });
  await check("unknown policies, executable fields and circular completion are rejected", () => {
    for (const rule of [
      { id: "bad", label: "Bad", kind: "execute", expression: "return true" },
      { ...participation, expression: "return true" },
      { id: "self", label: "Self", kind: "unit_completed" },
    ]) {
      const invalid = structuredClone(raw);
      invalid.units[0].learningPolicy.completion.requirements = [rule as typeof participation];
      assert.equal(coursePackageSchema.safeParse(invalid).success, false);
    }
  });
  await check("missing required speech capacity remains visible and unavailable", () => {
    const data = fixture((course) =>
      course.units[0].learningPolicy.completion.requirements.push({
        id: "speech",
        label: "Fala",
        kind: "submission",
        practice: "speaking",
        activityIds: ["speech"],
        minimumCount: 1,
      }),
    );
    assert(!data.exposed.units[0].lessons[0].activities.some((item) => item.id === "speech"));
    const state = studied();
    state.completedActivityIds.push("speech");
    assert.equal(progress(data, state).completion.status, "unavailable");
    assert.equal(progress(data, state).isCompleted, false);
  });
  await check("runtime and public projections preserve complete policies", () => {
    const data = requireAssessment();
    assert.deepEqual(
      data.exposed.units[0].learningPolicy,
      data.coursePackage.units[0].learningPolicy,
    );
    assert.deepEqual(data.course.units[0].skills, data.coursePackage.units[0].skills);
  });
  await check("public policies and activities reveal no private answers", () => {
    function inspect(value: unknown) {
      if (!value || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        assert(!["answer", "accepted", "fullAnswers", "explanation"].includes(key));
        inspect(item);
      }
    }
    inspect(fixture().exposed);
    assert(!JSON.stringify(fixture().exposed).includes("Gabarito privado sintético."));
  });
  await check("ES EN and synthetic fixtures declare different verifiable requirements", () => {
    const bundles = loadContent();
    assert.equal(bundles.length, 3);
    for (const item of bundles) assert.equal(item.course.schemaVersion, "1.3");
    assert(
      bundles
        .find((item) => item.language.id === "es")!
        .course.units[0].learningPolicy.mastery.requirements.some(
          (item) => item.kind === "assessment",
        ),
    );
    assert(
      !bundles
        .find((item) => item.language.id === "en")!
        .course.units[0].learningPolicy.mastery.requirements.some(
          (item) => item.kind === "assessment",
        ),
    );
    const test = bundles.find((item) => item.language.id === "xx-Test")!;
    const exposed = publicCourse(runtimeBundle(test).course, test.language);
    const state = readCourseState(null, exposed.id, test.language.id);
    state.completedActivityIds = [
      "xx.act.intro",
      "xx.act.choice",
      "xx.act.rule",
      "xx.act.fill",
      "xx.act.short",
    ];
    assert.equal(unitProgress(exposed.units[0], state, [], exposed).isCompleted, true);
  });
  await check(
    "calculation and repository persistence share the same versioned projection",
    async () => {
      const data = requireAssessment();
      const state = withAssessment(80);
      const captured = new Map<string, unknown[]>();
      const db = {
        from(table: string) {
          return {
            upsert(rows: unknown[]) {
              captured.set(table, Array.isArray(rows) ? rows : [rows]);
              return Promise.resolve({ error: null });
            },
          };
        },
      } as unknown as SupabaseClient;
      await new SupabaseStudyRepository(db, "synthetic-user").save(state, data.exposed, []);
      const stored = captured.get("unit_progress")![0] as ReturnType<typeof projectUnitProgress>;
      const expected = projectUnitProgress(
        "synthetic-user",
        data.exposed,
        data.exposed.units[0],
        state,
        [],
        stored.updated_at,
      );
      assert.deepEqual(stored, expected);
      assert.equal(stored.content_version, base.contentVersion);
      assert.equal(stored.policy_state.completion.status, "satisfied");
      assert.equal(stored.mastered_at, null);
      assert.equal(stored.exercise_score, null);
      const snapshot = captured.get("user_course_state")![0] as { state: StudyState };
      assert.deepEqual(snapshot.state, state);
      assert.equal("policy_state" in snapshot.state, false);
    },
  );
  await check("review initialization is not evidence and scheduler is unchanged", () => {
    const data = fixture((course) => {
      course.lexicon = [
        {
          id: "word",
          language: language.id,
          lemma: "tok",
          surface: "tok",
          className: "noun",
          meanings: [{ id: "meaning", translations: { "pt-BR": ["termo"] } }],
          lessonId: "lesson",
        } as CoursePackage["lexicon"][number],
      ];
      course.units[0].learningPolicy.mastery.requirements = [
        {
          id: "review",
          label: "Revisão",
          kind: "review_score",
          vocabularyIds: ["word"],
          activityIds: [],
          minimumScore: 80,
          minimumSamples: 1,
          minimumReviews: 1,
        },
      ];
    });
    const state = studied();
    state.vocabulary.word = {
      id: "word",
      status: "learning",
      schedule: ReviewScheduler.initial(new Date("2026-10-10T00:00:00Z")),
    };
    assert.equal(progress(data, state).mastery.status, "not_assessed");
    assert.equal(progress(data, state).mastery.requirements[0].score, null);
    for (let i = 0; i < 3; i++)
      state.vocabulary.word.schedule = ReviewScheduler.afterAnswer(
        state.vocabulary.word.schedule,
        true,
      );
    assert.equal(progress(data, state).mastery.status, "not_met");
    assert.equal(state.vocabulary.word.schedule.masteryScore, 75);
    state.vocabulary.word.schedule = ReviewScheduler.afterAnswer(
      state.vocabulary.word.schedule,
      true,
    );
    assert.equal(progress(data, state).isMastered, true);
    data.exposed.availability!.spacedRepetition = false;
    assert.equal(progress(data, state).mastery.status, "unavailable");
  });
  await check("objective samples count distinct activities, null attempts are unassessed", () => {
    const data = fixture((course) =>
      course.units[0].learningPolicy.mastery.requirements.push({
        id: "scores",
        label: "Resultados",
        kind: "objective_score",
        activityIds: ["q1", "q2"],
        minimumScore: 80,
        minimumSamples: 2,
      }),
    );
    const state = scores(5);
    state.attempts = [state.attempts[0], { ...state.attempts[0], id: randomUUID() }];
    assert.equal(progress(data, state).mastery.status, "not_assessed");
    state.attempts = state.attempts.map((item) => ({ ...item, correct: null }));
    assert.equal(progress(data, state).exerciseScore, null);
    assert.equal(skillProgress(data.exposed, state, "listening").performance, null);
  });
  await check("history, insufficient assessment and foreign course cannot satisfy policy", () => {
    const data = requireAssessment();
    assert.equal(
      progress(data, withAssessment(100, "proof", "old")).completion.status,
      "not_assessed",
    );
    const state = withAssessment(100);
    state.assessmentAttempts[0].objectiveScore = null;
    state.assessmentAttempts[0].status = "insufficient";
    assert.equal(progress(data, state).completion.status, "not_assessed");
    const other = { ...studied(), courseId: "other-course" };
    assert.equal(progress(data, other).completion.status, "unavailable");
  });
  await check("planner prioritizes unmet declared requirements over optional content", () => {
    const data = fixture(
      (course) =>
        (course.units[0].learningPolicy.completion.requirements = [
          { ...participation, activityIds: ["q5"] },
        ]),
    );
    assert.equal(nextActivity(data.exposed, empty())?.id, "q5");
    assert(
      buildStudyPlan(data.exposed, empty(), 10, [], data.resources).some(
        (item) => item.id === "q5",
      ),
    );
    const state = empty();
    state.completedActivityIds = ["q5"];
    assert.equal(progress(data, state).isCompleted, true);
    assert.equal(courseProgress(data.exposed, state), 100);
  });
  await check(
    "checklist exposes unavailable and unassessed states without fictitious scores",
    () => {
      const result = progress(requireAssessment(), withAssessment()).completion;
      const html = renderToString(<PolicyChecklist title="Conclusão" result={result} />);
      assert(html.includes("Sem evidência suficiente"));
      assert(html.includes("Abrir avaliação"));
      assert(!/\b0%/.test(html));
    },
  );
  await check(
    "planner targets incorrect or missing objective evidence instead of already correct answers",
    () => {
      const data = fixture((course) =>
        course.units[0].learningPolicy.mastery.requirements.push({
          id: "result",
          label: "Resultados",
          kind: "objective_score",
          activityIds: ["q1", "q2", "q3", "q4", "q5"],
          minimumScore: 80,
          minimumSamples: 5,
        }),
      );
      assert.equal(nextActivity(data.exposed, scores(3))?.id, "q4");
    },
  );
  console.log(
    `Learning policies: ${checks} isolated scenarios passed; no network, paid APIs or real database.`,
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
