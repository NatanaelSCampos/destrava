import assert from "node:assert/strict";
import test from "node:test";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";
import { courseSchema } from "../src/content/schema";
import { publicCourse, type PublicCourse } from "../src/content/public";
import { initialStudyState, type StudyState } from "../src/domain/study/study-state";
import { buildLivingTrail } from "../src/domain/study/living-trail";
import { evaluateLearningAccess } from "../src/domain/study/learning-access";
import { unitProgress, courseStudySummary } from "../src/domain/study/progress";
import {
  journeyPresentationSchema,
  parseJourneyPresentation,
  journeyCourseFingerprint,
  type JourneyPresentation,
} from "../src/content/journey-presentation";
import { findJourneyPresentation } from "../src/content/journey-registry";
import type { ServerAssessmentResult } from "../src/content/assessment-results";

function fixture(): PublicCourse {
  const activity = (id: string) => ({
    id,
    title: id,
    type: "lesson_content",
    body: "Observe",
    skill: "reading",
    minutes: 1,
  });
  const lesson = (id: string, ids: string[]) => ({
    id,
    slug: id,
    title: id,
    eyebrow: "Aprender",
    description: "Uma situação",
    minutes: 4,
    order: 1,
    active: true,
    activities: ids.map(activity),
  });
  const course = publicCourse(
    courseSchema.parse({
      id: "synthetic-path",
      slug: "synthetic-path",
      title: "A project",
      level: "A1",
      languageCode: "xx",
      description: "Generic",
      contentVersion: "v2",
      units: [
        {
          id: "first",
          slug: "first",
          number: 1,
          title: "A project begins",
          description: "Generic",
          objectives: ["Apply"],
          active: true,
          learningPolicy: {
            completion: {
              requirements: [
                {
                  id: "study",
                  label: "Study",
                  kind: "participation",
                  activityIds: ["a1", "a2", "a3", "a4"],
                },
              ],
            },
            mastery: { requirements: [] },
          },
          lessons: [
            {
              ...lesson("learn", ["a1", "a2", "a3", "a4"]),
              stages: [1, 2, 3, 4].map((i) => ({
                id: "s" + i,
                title: "Stage " + i,
                activityIds: ["a" + i],
              })),
            },
            lesson("bank", ["q1", "q2"]),
          ],
          assessmentRefs: { final: "exam" },
        },
        {
          id: "second",
          slug: "second",
          number: 2,
          title: "A new project",
          description: "Generic",
          objectives: ["Transfer"],
          active: true,
          access: { assessmentId: "exam", minimumScore: 80 },
          lessons: [lesson("transfer", ["b1"])],
          assessmentRefs: {},
        },
      ],
      assessments: [
        {
          id: "exam",
          title: "A milestone",
          purpose: "summative",
          method: "fixed",
          unitId: "first",
          lessonId: "bank",
          objectiveIds: [],
          gradingStrategy: "objective_mean",
          passingPolicy: { overall: 0.8 },
          activityIds: ["q1", "q2"],
          exam: {
            entry: { activityIds: ["a1", "a2", "a3", "a4"], minimumRatio: 0.75 },
            feedback: "after_submission",
          },
        },
      ],
    }),
  );
  course.availability!.actionStates = {
    "assessment.fixed": { state: "available", reasons: [] },
    "lesson.interactive": { state: "available", reasons: [] },
  };
  return course;
}
function state(course: PublicCourse, ids: string[] = []): StudyState {
  return { ...structuredClone(initialStudyState), courseId: course.id, completedActivityIds: ids };
}
function editorial(course: PublicCourse): JourneyPresentation {
  return journeyPresentationSchema.parse({
    schemaVersion: "1.0.0",
    presentationVersion: "p1",
    courseId: course.id,
    contentVersion: course.contentVersion,
    structureFingerprint: journeyCourseFingerprint(course),
    chapters: [
      {
        id: "ch1",
        unitId: "first",
        title: "Explore",
        moments: [
          {
            id: "observe",
            title: "Observe a new situation",
            icon: "message-circle",
            target: { kind: "lesson", lessonId: "learn", stageIds: ["s1", "s2"] },
          },
          {
            id: "apply",
            title: "Apply in a different setting",
            icon: "target",
            target: { kind: "lesson", lessonId: "learn", stageIds: ["s3", "s4"] },
          },
          {
            id: "milestone",
            title: "Show what you can do",
            target: { kind: "assessment", assessmentId: "exam" },
          },
        ],
      },
      {
        id: "ch2",
        unitId: "second",
        title: "Continue",
        moments: [
          {
            id: "transfer",
            title: "Try a new situation",
            target: { kind: "lesson", lessonId: "transfer" },
          },
        ],
      },
    ],
  });
}
function official(course: PublicCourse, passed: boolean): ServerAssessmentResult {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    courseId: course.id,
    contentVersion: course.contentVersion,
    assessmentId: "exam",
    unitId: "first",
    lessonId: "bank",
    purpose: "summative",
    method: "fixed",
    source: "server",
    status: "completed",
    passed,
    objectiveScore: passed ? 100 : 50,
    startedAt: "2026-10-27T12:00:00.000Z",
    finishedAt: "2026-10-27T12:01:00.000Z",
    responseKey: "test",
    answers: ["q1", "q2"].map((activityId, i) => ({
      activityId,
      answer: "Example",
      correct: passed || i === 0,
      skill: "reading",
    })),
  };
}

test("synthetic metadata partitions multiple real stages into compact moments", () => {
  const c = fixture(),
    s = state(c, ["a1"]),
    p = editorial(c);
  const before = structuredClone({ c, s, p });
  const t = buildLivingTrail(c, s, { presentation: p });
  assert.equal(t.presentationVersion, "p1");
  assert.deepEqual(t.chapters[0].moments[0].activityIds, ["a1", "a2"]);
  assert.equal(t.chapters[0].moments[0].completed, 1);
  assert.equal(t.currentMomentId, "observe");
  assert.equal(
    new URL(t.chapters[0].moments[0].href, "http://localhost").searchParams.get("activity"),
    "a2",
  );
  assert.deepEqual({ c, s, p }, before);
  assert.deepEqual(t, buildLivingTrail(c, s, { presentation: p }));
});
test("completed moment revisits its own first activity and cannot complete a new activity", () => {
  const c = fixture(),
    t = buildLivingTrail(c, state(c, ["a1", "a2"]), { presentation: editorial(c) });
  assert.equal(t.chapters[0].moments[0].status, "completed");
  assert.equal(t.chapters[0].moments[0].entryActivityId, "a1");
  assert.deepEqual(t.chapters[0].moments[0].availableActivityIds, ["a1", "a2"]);
  assert.equal(t.chapters[0].moments[1].completed, 0);
  assert.equal(t.currentMomentId, "apply");
});
test("fallback groups whole lessons and routes banks through official assessment entry", () => {
  const c = fixture(),
    t = buildLivingTrail(c, state(c));
  assert.equal(t.chapters[0].moments.length, 2);
  assert.equal(t.chapters[0].moments[1].kind, "assessment");
  assert.match(t.chapters[0].moments[1].href, /^\/assessment\?assessmentId=exam&moment=/);
});
test("official chapter and course progress are reused exactly", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2", "q1"]),
    t = buildLivingTrail(c, s);
  assert.deepEqual(t.chapters[0].progress, unitProgress(c.units[0], s, [], c));
  assert.deepEqual(t.summary, courseStudySummary(c, s));
});
test("no access snapshot fails closed even when every exercise was completed locally", () => {
  const c = fixture(),
    t = buildLivingTrail(c, state(c, ["a1", "a2", "a3", "a4", "q1", "q2"]));
  assert.equal(t.chapters[0].moments[1].status, "locked");
  assert.equal(t.chapters[0].moments[1].result, null);
  assert.equal(t.chapters[1].access.allowed, false);
});
test("stale access version fails closed", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2", "a3"]);
  const snapshot = evaluateLearningAccess(c, {
    completedActivityIds: s.completedActivityIds,
    assessmentResults: [],
  });
  snapshot.contentVersion = "old";
  assert.equal(
    buildLivingTrail(c, s, { learningAccess: snapshot }).chapters[0].moments[1].status,
    "locked",
  );
});
test("official threshold unlocks the exam and exposes exact participation counts", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2", "a3"]),
    access = evaluateLearningAccess(c, {
      completedActivityIds: s.completedActivityIds,
      assessmentResults: [],
    });
  const exam = buildLivingTrail(c, s, { learningAccess: access }).chapters[0].moments[1];
  assert.equal(exam.access.allowed, true);
  assert.equal(exam.status, "available");
  assert.equal(exam.access.completed, 3);
  assert.equal(exam.access.required, 3);
});
test("failed canonical exam preserves failure and never opens the next chapter", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2", "a3", "a4"]),
    r = official(c, false);
  s.assessmentAttempts = [r];
  const access = evaluateLearningAccess(c, {
    completedActivityIds: s.completedActivityIds,
    assessmentResults: [r],
  });
  const t = buildLivingTrail(c, s, { learningAccess: access });
  assert.equal(t.chapters[0].moments[1].result?.passed, false);
  assert.equal(t.chapters[0].moments[1].label, "Tente a prova novamente");
  assert.equal(t.chapters[1].access.allowed, false);
  assert.equal(t.currentMomentId, t.chapters[0].moments[1].id);
});
test("passed canonical exam opens chapter two only via the access snapshot", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2", "a3", "a4"]),
    r = official(c, true);
  s.assessmentAttempts = [r];
  const access = evaluateLearningAccess(c, {
    completedActivityIds: s.completedActivityIds,
    assessmentResults: [r],
  });
  const t = buildLivingTrail(c, s, { learningAccess: access });
  assert.equal(t.chapters[0].moments[1].historyCount, 1);
  assert.equal(t.chapters[1].access.allowed, true);
  assert.equal(t.currentChapterId, t.chapters[1].id);
});
test("wrong version, historical and foreign course results are never presented as canonical", () => {
  for (const change of [
    { contentVersion: "v1" },
    { source: "historical" as const },
    { courseId: "other" },
  ]) {
    const c = fixture(),
      s = state(c);
    s.assessmentAttempts = [{ ...official(c, true), ...change }];
    const t = buildLivingTrail(c, s);
    assert.equal(t.chapters[0].moments[1].result, null);
    assert.equal(t.chapters[0].moments[1].historyCount, 0);
  }
});
test("foreign course study evidence does not leak through matching activity IDs", () => {
  const c = fixture(),
    s = state(c, ["a1", "a2", "a3", "a4"]);
  s.courseId = "other";
  const t = buildLivingTrail(c, s);
  assert.equal(t.summary.completed, 0);
  assert.equal(t.chapters[0].moments[0].completed, 0);
  assert(t.presentationIssues.length);
});
test("unavailable parts remain pending while other real parts stay navigable", () => {
  const c = fixture();
  c.availability!.unavailableActivityIds = ["a2"];
  c.availability!.reasons = { a2: ["Capability offline"] };
  const t = buildLivingTrail(c, state(c), { presentation: editorial(c) });
  assert.equal(t.chapters[0].moments[0].status, "available");
  assert.equal(t.chapters[0].moments[0].entryActivityId, "a1");
  assert.deepEqual(t.chapters[0].moments[0].availableActivityIds, ["a1"]);
  const pending = buildLivingTrail(c, state(c, ["a1"]), { presentation: editorial(c) }).chapters[0]
    .moments[0];
  assert.equal(pending.status, "unavailable");
  assert.equal(pending.completed, 1);
  assert.equal(pending.total, 2);
  assert.equal(pending.blockedReason, "Capability offline");
});
test("specific guided availability is checked even if another guided lesson is operational", () => {
  const c = fixture();
  c.units[0].lessons[0].interactiveLessonRef = "board1";
  c.units[1].lessons[0].interactiveLessonRef = "board2";
  c.availability!.unavailableInteractiveLessonIds = ["board1"];
  const t = buildLivingTrail(c, state(c));
  assert.equal(t.chapters[0].moments[0].status, "unavailable");
  assert.match(t.chapters[0].moments[0].href, /\/guided\?moment=/);
  assert.equal(
    new URL(t.chapters[0].moments[0].href, "http://localhost").searchParams.has("activity"),
    false,
  );
});
test("installed context does not claim operational guided or review execution", () => {
  const c = fixture();
  c.units[0].lessons[0].interactiveLessonRef = "board";
  const t = buildLivingTrail(c, state(c), {
    actionContext: { source: "installed", permitted: true },
  });
  assert.equal(t.chapters[0].moments[0].status, "unavailable");
  assert.equal(findJourneyPresentation(c, "installed"), null);
});
for (const change of [
  "duplicate",
  "reorder",
  "omit",
  "cross-unit",
  "version",
  "fingerprint",
  "bank-as-lesson",
  "new-activity",
]) {
  test("invalid editorial composition falls back without dropping content: " + change, () => {
    const c = fixture(),
      p = editorial(c),
      target = p.chapters[0].moments[0].target;
    assert.equal(target.kind, "lesson");
    if (target.kind !== "lesson") throw new Error("fixture");
    if (change === "duplicate") p.chapters[0].moments[1].id = p.chapters[0].moments[0].id;
    if (change === "reorder") target.stageIds = ["s2", "s1"];
    if (change === "omit") target.stageIds = ["s1"];
    if (change === "cross-unit") target.lessonId = "transfer";
    if (change === "version") p.contentVersion = "old";
    if (change === "fingerprint") p.structureFingerprint = "stale";
    if (change === "bank-as-lesson")
      p.chapters[0].moments[2].target = { kind: "lesson", lessonId: "bank" };
    if (change === "new-activity")
      c.units[0].lessons[0].activities.push({
        ...c.units[0].lessons[0].activities[0],
        id: "new-activity",
      });
    assert.equal(parseJourneyPresentation(p, c).presentation, null);
    // A malformed curriculum itself remains the existing stage validator's responsibility.
    if (change !== "new-activity") {
      const t = buildLivingTrail(c, state(c), { presentation: p });
      assert.equal(t.presentationVersion, null);
      assert.equal(t.chapters[0].moments.length, 2);
      assert(t.presentationIssues.length);
    }
  });
}
test("markup, executable fields and unsafe image sources are rejected", () => {
  const c = fixture(),
    p = editorial(c);
  for (const patch of [
    { title: "<script>alert(1)</script>" },
    { html: "<b>Hi</b>" },
    { onClick: "run()" },
    { illustration: { src: "https://remote/image.webp", alt: "Remote" } },
    { illustration: { src: "/journeys/../secret.webp", alt: "Traversal" } },
    { illustration: { src: "/journeys/executable.svg", alt: "SVG" } },
    { illustration: { src: "/journeys/safe.webp", alt: "" } },
  ]) {
    const candidate = structuredClone(p);
    Object.assign(candidate.chapters[0].moments[0], patch);
    assert.equal(parseJourneyPresentation(candidate, c).presentation, null);
  }
  p.chapters[0].moments[0].illustration = { src: "/journeys/project.webp", alt: "A project" };
  assert(parseJourneyPresentation(p, c).presentation);
});
test("audio references cannot point outside the moment", () => {
  const c = fixture(),
    p = editorial(c);
  p.chapters[0].moments[0].audioActivityIds = ["a3"];
  assert.equal(parseJourneyPresentation(p, c).presentation, null);
});
test("operational availability never changes structural metadata fingerprint", () => {
  const c = fixture(),
    fingerprint = journeyCourseFingerprint(c);
  c.availability!.unavailableActivityIds = ["a1", "a2"];
  c.availability!.lockedUnitIds = ["second"];
  assert.equal(journeyCourseFingerprint(c), fingerprint);
});
test("real ES sidecar covers every current lesson and keeps curricular identities unchanged", () => {
  const bundle = runtimeBundle(loadContent().find((p) => p.course.id === "espanol-a-tu-paso-a1")!);
  const c = publicCourse(bundle.course, bundle.language),
    before = JSON.stringify(c),
    p = findJourneyPresentation(c);
  assert(p);
  assert.equal(p.contentVersion, c.contentVersion);
  const t = buildLivingTrail(c, state(c), { presentation: p });
  assert.deepEqual(t.presentationIssues, []);
  assert.deepEqual(
    t.chapters.map((ch) => ch.moments.length),
    [13, 11],
  );
  const expected = c.units.flatMap((u) => u.lessons.filter((l) => l.active).map((l) => l.id));
  assert.deepEqual(
    [...new Set(t.chapters.flatMap((ch) => ch.moments.map((m) => m.lessonId)))],
    expected,
  );
  assert(t.chapters[0].moments.some((m) => m.assessmentPurpose === "diagnostic"));
  assert(t.chapters[0].moments.some((m) => m.lessonId === "atp-u1-live-demo"));
  assert(t.chapters.every((ch) => ch.moments.some((m) => m.isExam)));
  assert.equal(t.chapters[0].moments[0].title, "Avise onde você está");
  assert.equal(JSON.stringify(c), before);
  assert.equal(findJourneyPresentation(c, "installed"), null);
});
test("English and unknown language courses remain navigable through generic fallback", () => {
  for (const raw of loadContent().filter((p) => p.course.id !== "espanol-a-tu-paso-a1")) {
    const bundle = runtimeBundle(raw),
      c = publicCourse(bundle.course, bundle.language);
    const t = buildLivingTrail(c, state(c), { presentation: findJourneyPresentation(c) });
    assert.equal(t.presentationVersion, null);
    assert(t.chapters.length);
    assert(t.chapters.every((ch) => ch.moments.length > 0));
    assert(
      t.chapters
        .flatMap((ch) => ch.moments)
        .every((m) => m.href.startsWith("/course/") || m.href.startsWith("/assessment?")),
    );
  }
});
