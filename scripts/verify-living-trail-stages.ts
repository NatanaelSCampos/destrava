import assert from "node:assert/strict";
import test from "node:test";
import { courseSchema } from "../src/content/schema";
import { publicCourse, type PublicCourse } from "../src/content/public";
import { buildLivingTrail, livingTrailStageId } from "../src/domain/study/living-trail";
import { initialStudyState, type StudyState } from "../src/domain/study/study-state";
import { courseStudySummary, unitProgress } from "../src/domain/study/progress";
import { evaluateLearningAccess } from "../src/domain/study/learning-access";
import {
  journeyPresentationSchema,
  type JourneyPresentation,
} from "../src/content/journey-presentation";
import { findJourneyPresentation } from "../src/content/journey-registry";
import { requireCourseBundle } from "../src/content/course-registry";
import { resolveLessonStages } from "../src/engine/presentation/lesson-stages";

function fixture(): PublicCourse {
  const content = (id: string) => ({
    id,
    type: "lesson_content",
    title: "Content " + id,
    body: "Observe",
    skill: "reading",
    minutes: 1,
  });
  const lesson = (id: string, activities: unknown[]) => ({
    id,
    slug: id,
    title: "Lesson " + id,
    eyebrow: "Study",
    description: "A situation",
    minutes: 5,
    order: 1,
    active: true,
    activities,
  });
  const course = publicCourse(
    courseSchema.parse({
      id: "synthetic-project",
      slug: "synthetic-project",
      title: "A project",
      languageCode: "xx",
      level: "A1",
      contentVersion: "v1",
      description: "Generic stages",
      units: [
        {
          id: "u1",
          slug: "u1",
          number: 1,
          title: "Project begins",
          description: "Situation",
          objectives: [],
          active: true,
          assessmentRefs: { final: "final" },
          lessons: [
            {
              ...lesson("ordinary", [
                content("a1"),
                content("a2"),
                {
                  id: "a3",
                  type: "listening",
                  title: "Hear",
                  transcript: "Example",
                  options: ["A", "B"],
                  answer: "A",
                  skill: "listening",
                  minutes: 1,
                },
                content("a4"),
                {
                  id: "a5",
                  type: "ordering",
                  title: "Build",
                  words: ["one", "two"],
                  answer: "one two",
                  skill: "writing",
                  minutes: 1,
                },
              ]),
              stages: [
                { id: "first", title: "Observe a message", activityIds: ["a1", "a2"] },
                { id: "second", title: "Listen in another situation", activityIds: ["a3", "a4"] },
                { id: "third", title: "Build a reply", activityIds: ["a5"] },
              ],
            },
            { ...lesson("guided", [content("g1"), content("g2")]), interactiveLessonRef: "board" },
            lesson("bank", [content("q1"), content("q2")]),
          ],
          learningPolicy: {
            completion: {
              requirements: [
                {
                  id: "study",
                  label: "Study",
                  kind: "participation",
                  activityIds: ["a1", "a2", "a3", "a4", "a5"],
                },
              ],
            },
            mastery: { requirements: [] },
          },
        },
        {
          id: "u2",
          slug: "u2",
          number: 2,
          title: "Continue",
          description: "Transfer",
          objectives: [],
          active: true,
          access: { assessmentId: "final", minimumScore: 80 },
          lessons: [lesson("legacy-single", [content("b1")])],
        },
      ],
      assessments: [
        {
          id: "final",
          title: "Milestone",
          method: "fixed",
          purpose: "summative",
          objectiveIds: [],
          unitId: "u1",
          lessonId: "bank",
          gradingStrategy: "objective_mean",
          passingPolicy: { overall: 0.8 },
          activityIds: ["q1", "q2"],
          exam: {
            entry: { activityIds: ["a1", "a2", "a3", "a4", "a5"], minimumRatio: 0.8 },
            feedback: "after_submission",
          },
        },
      ],
    }),
  );
  course.availability!.actionStates = Object.fromEntries(
    ["activity.listening", "assessment.fixed", "lesson.interactive"].map((id) => [
      id,
      { state: "available" as const, reasons: [] },
    ]),
  );
  return course;
}
function state(course: PublicCourse, completedActivityIds: string[] = []): StudyState {
  return { ...structuredClone(initialStudyState), courseId: course.id, completedActivityIds };
}
function editorial(course: PublicCourse): JourneyPresentation {
  return journeyPresentationSchema.parse({
    schemaVersion: "1.0.0",
    presentationVersion: "p1",
    courseId: course.id,
    contentVersion: course.contentVersion,
    chapters: [
      {
        id: "chapter-one",
        unitId: "u1",
        title: "Explore",
        moments: [
          {
            id: "editorial-early",
            title: "Enter the story",
            description: "Shared context",
            objective: "Understand a message",
            character: "A colleague",
            setting: "A project",
            tone: "rose",
            icon: "coffee",
            audioActivityIds: ["a3"],
            target: { kind: "lesson", lessonId: "ordinary", stageIds: ["first", "second"] },
          },
          {
            id: "editorial-late",
            title: "Apply the idea",
            target: { kind: "lesson", lessonId: "ordinary", stageIds: ["third"] },
          },
          {
            id: "editorial-guided",
            title: "A guided conversation",
            target: { kind: "lesson", lessonId: "guided" },
          },
          {
            id: "editorial-final",
            title: "A milestone",
            target: { kind: "assessment", assessmentId: "final" },
          },
        ],
      },
      {
        id: "chapter-two",
        unitId: "u2",
        title: "Continue",
        moments: [
          {
            id: "editorial-single",
            title: "A new chapter",
            target: { kind: "lesson", lessonId: "legacy-single" },
          },
        ],
      },
    ],
  });
}

const ordinary = (trail: ReturnType<typeof buildLivingTrail>) =>
  trail.chapters[0].moments.filter((m) => m.kind === "lesson");
test("first three internal stages become three consecutive external nodes", () => {
  const c = fixture(),
    trail = buildLivingTrail(c, state(c), { presentation: editorial(c) }),
    nodes = ordinary(trail);
  assert.deepEqual(
    nodes.map((n) => n.stageIds),
    [["first"], ["second"], ["third"]],
  );
  assert.deepEqual(
    nodes.map((n) => n.title),
    c.units[0].lessons[0].stages!.map((s) => s.title),
  );
  assert.deepEqual(
    nodes.map((n) => n.activityIds),
    [["a1", "a2"], ["a3", "a4"], ["a5"]],
  );
  assert.deepEqual(
    trail.chapters[0].moments.map((n) => n.kind),
    ["lesson", "lesson", "lesson", "guided", "assessment"],
  );
});
test("stage identity is independent of editorial grouping and title changes", () => {
  const c = fixture(),
    p = editorial(c),
    original = ordinary(buildLivingTrail(c, state(c), { presentation: p }));
  p.chapters[0].moments.splice(0, 2, {
    id: "new-group",
    title: "A completely new title",
    icon: "trophy",
    target: { kind: "lesson", lessonId: "ordinary" },
  });
  const regrouped = ordinary(buildLivingTrail(c, state(c), { presentation: p }));
  const fallback = ordinary(buildLivingTrail(c, state(c)));
  assert.deepEqual(
    original.map((n) => n.id),
    regrouped.map((n) => n.id),
  );
  assert.deepEqual(
    original.map((n) => n.id),
    fallback.map((n) => n.id),
  );
  assert.deepEqual(
    original.map((n) => n.title),
    regrouped.map((n) => n.title),
  );
  assert.equal(regrouped[0].originMomentId, "new-group");
});
test("the encoded curricular tuple cannot collide at delimiters", () => {
  const pairs = [
    ["a:b", "c"],
    ["a", "b:c"],
    ["a%3Ab", "c"],
    ["a--b", "c"],
    ["a", "b--c"],
    ["a/b", "c#d?x"],
    ["a", "c"],
    ["á", "日:本"],
  ];
  const ids = pairs.map(([lesson, stage]) => livingTrailStageId(lesson, stage));
  assert.equal(new Set(ids).size, pairs.length);
  for (const [i, id] of ids.entries()) {
    const parts = id.split(":");
    assert.equal(parts.length, 3);
    assert.deepEqual(parts.slice(1).map(decodeURIComponent), pairs[i]);
  }
});
test("editorial context and origin survive while stage title and icon remain primary", () => {
  const c = fixture(),
    nodes = ordinary(buildLivingTrail(c, state(c), { presentation: editorial(c) }));
  assert.deepEqual(
    nodes.slice(0, 2).map((n) => n.originMomentId),
    ["editorial-early", "editorial-early"],
  );
  assert.equal(nodes[0].originMomentTitle, "Enter the story");
  assert.equal(nodes[0].description, "Shared context");
  assert.equal(nodes[0].objective, "Understand a message");
  assert.equal(nodes[0].character, "A colleague");
  assert.equal(nodes[0].setting, "A project");
  assert.equal(nodes[0].tone, "rose");
  assert.deepEqual(
    nodes.map((n) => n.icon),
    ["book-open", "headphones", "target"],
  );
  assert.deepEqual(nodes[0].audioActivityIds, []);
  assert.deepEqual(nodes[1].audioActivityIds, ["a3"]);
});
test("completion and resume are confined to each real stage", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2", "a3"]),
    t = buildLivingTrail(c, s, { presentation: editorial(c) }),
    nodes = ordinary(t);
  assert.equal(nodes[0].status, "completed");
  assert.equal(nodes[0].entryActivityId, "a1");
  assert.equal(nodes[1].status, "in_progress");
  assert.equal(nodes[1].entryActivityId, "a4");
  assert.equal(nodes[2].completed, 0);
  assert.equal(t.currentMomentId, nodes[1].id);
  const url = new URL(nodes[1].href, "https://local.invalid");
  assert.equal(url.searchParams.get("moment"), nodes[1].id);
  assert.equal(url.searchParams.get("activity"), "a4");
});
test("singleton and unstaged lessons also use stage identity and stage title", () => {
  const c = fixture(),
    t = buildLivingTrail(c, state(c), { presentation: editorial(c) }),
    node = t.chapters[1].moments[0];
  assert.equal(node.id, livingTrailStageId("legacy-single", "b1"));
  assert.equal(node.title, "Content b1");
  assert.equal(node.originMomentId, "editorial-single");
  delete c.units[0].lessons[0].stages;
  const fallback = ordinary(buildLivingTrail(c, state(c)));
  assert.equal(fallback.length, 5);
  assert(fallback.every((n) => n.stageIds.length === 1 && n.activityIds.length === 1));
});
test("guided and assessment execution remain atomic with their existing IDs", () => {
  const c = fixture(),
    t = buildLivingTrail(c, state(c), { presentation: editorial(c) }),
    guided = t.chapters[0].moments.find((n) => n.kind === "guided")!,
    exam = t.chapters[0].moments.find((n) => n.kind === "assessment")!;
  assert.equal(guided.id, "guided:guided");
  assert.equal(guided.originMomentId, "editorial-guided");
  assert.equal(guided.originMomentTitle, "A guided conversation");
  assert.deepEqual(guided.activityIds, ["g1", "g2"]);
  assert.equal(new URL(guided.href, "https://local.invalid").searchParams.has("activity"), false);
  assert.equal(exam.id, "assessment:final");
  assert.equal(exam.originMomentId, "editorial-final");
  assert.equal(exam.originMomentTitle, "A milestone");
  assert.deepEqual(exam.activityIds, ["q1", "q2"]);
  assert.equal(t.chapters[0].moments.filter((n) => n.assessmentId === "final").length, 1);
  assert(
    !t.chapters.flatMap((ch) => ch.moments).some((n) => n.id === livingTrailStageId("bank", "q1")),
  );
  assert.equal(exam.result, null);
  assert.equal(exam.status, "locked");
});
test("access still requires official snapshots after stage expansion", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2", "a3", "a4"]);
  const snapshot = evaluateLearningAccess(c, {
    completedActivityIds: s.completedActivityIds,
    assessmentResults: [],
  });
  const t = buildLivingTrail(c, s, { presentation: editorial(c), learningAccess: snapshot });
  assert.equal(t.chapters[0].moments.find((n) => n.isExam)!.access.allowed, true);
  assert.equal(t.chapters[1].moments[0].status, "locked");
  snapshot.contentVersion = "stale";
  assert.equal(
    buildLivingTrail(c, s, { learningAccess: snapshot }).chapters[0].moments.find((n) => n.isExam)!
      .status,
    "locked",
  );
});
test("an unavailable stage does not claim completion or executable activities", () => {
  const c = fixture();
  c.availability!.unavailableActivityIds = ["a3", "a4"];
  const nodes = ordinary(buildLivingTrail(c, state(c, ["a1", "a2"])));
  assert.equal(nodes[1].status, "unavailable");
  assert.equal(nodes[1].completed, 0);
  assert.deepEqual(nodes[1].availableActivityIds, []);
  assert.equal(nodes[2].status, "available");
});
test("official summaries and evidence remain unchanged by expansion", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2", "g1"]),
    p = editorial(c),
    before = structuredClone({ c, s, p });
  const t = buildLivingTrail(c, s, { presentation: p });
  assert.deepEqual(t.summary, courseStudySummary(c, s));
  assert.deepEqual(t.chapters[0].progress, unitProgress(c.units[0], s, [], c));
  assert.deepEqual({ c, s, p }, before);
  assert.deepEqual(t, buildLivingTrail(c, s, { presentation: p }));
});
test("foreign state and invalid editorial metadata never leak coverage", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2"]),
    p = editorial(c);
  s.courseId = "other";
  p.contentVersion = "wrong";
  const t = buildLivingTrail(c, s, { presentation: p });
  assert.equal(t.summary.completed, 0);
  assert.equal(t.presentationVersion, null);
  assert.equal(ordinary(t).length, 3);
  assert(ordinary(t).every((n) => n.completed === 0));
});
test("current ES and EN expose every ordinary real stage while banks stay atomic", () => {
  for (const id of ["espanol-a-tu-paso-a1", "ingles-a1-pessoal"]) {
    const bundle = requireCourseBundle(id),
      c = publicCourse(bundle.course, bundle.language),
      p = findJourneyPresentation(c),
      s = state(c),
      before = JSON.stringify(c);
    const t = buildLivingTrail(c, s, { presentation: p });
    for (const unit of c.units)
      for (const lesson of unit.lessons) {
        const nodes = t.chapters
          .flatMap((ch) => ch.moments)
          .filter((n) => n.lessonId === lesson.id);
        if (nodes.some((n) => n.kind === "assessment")) {
          assert(nodes.every((n) => n.kind === "assessment"));
          continue;
        }
        if (lesson.interactiveLessonRef) {
          assert.equal(nodes.length, 1);
          continue;
        }
        const stages = resolveLessonStages(lesson);
        assert.deepEqual(
          nodes.map((n) => n.stageIds),
          stages.map((stage) => [stage.id]),
        );
        assert.deepEqual(
          nodes.map((n) => n.title),
          stages.map((stage) => stage.title),
        );
        assert.deepEqual(
          nodes.flatMap((n) => n.activityIds),
          lesson.activities.map((a) => a.id),
        );
        assert(nodes.every((n) => n.id === livingTrailStageId(lesson.id, n.stageIds[0])));
      }
    assert.equal(JSON.stringify(c), before);
  }
});

test("valid adversarial sidecar IDs cannot collide across projected kinds", () => {
  const c = fixture(),
    p = editorial(c);
  p.chapters[0].moments[2].id = livingTrailStageId("ordinary", "first");
  p.chapters[0].moments[3].id = livingTrailStageId("ordinary", "second");
  const t = buildLivingTrail(c, state(c), { presentation: p });
  assert.deepEqual(t.presentationIssues, []);
  assert.equal(t.presentationVersion, "p1");
  const all = t.chapters.flatMap((chapter) => chapter.moments);
  assert.equal(new Set(all.map((moment) => moment.id)).size, all.length);
  const guided = all.find((moment) => moment.kind === "guided")!;
  const exam = all.find((moment) => moment.kind === "assessment")!;
  assert.equal(guided.id, "guided:guided");
  assert.equal(exam.id, "assessment:final");
  assert.equal(guided.originMomentId, livingTrailStageId("ordinary", "first"));
  assert.equal(exam.originMomentId, livingTrailStageId("ordinary", "second"));
  assert.equal(
    new URL(exam.href, "https://local.invalid").searchParams.get("assessmentId"),
    "final",
  );
  assert.equal(exam.assessmentId, "final");
  assert.equal(guided.lessonId, "guided");
  assert.deepEqual(exam.activityIds, ["q1", "q2"]);
});
