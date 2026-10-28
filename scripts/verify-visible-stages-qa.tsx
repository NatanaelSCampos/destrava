/** Independent QA for visible curricular stages. Prior verifiers remain historical and unchanged. */
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import type { PublicCourse } from "../src/content/public";

type Stage = { id: string; title: string; activityIds: string[] };
type Moment = {
  id: string;
  title: string;
  kind: string;
  lessonId?: string;
  assessmentId?: string;
  stageIds: string[];
  activityIds: string[];
  availableActivityIds: string[];
  originMomentId?: string;
  originMomentTitle?: string;
  href: string;
  status: string;
  entryActivityId?: string;
  result: unknown;
  character?: string;
  setting?: string;
  illustration?: unknown;
  access: { allowed: boolean };
};
type Trail = {
  chapters: { unitId: string; number: number; moments: Moment[] }[];
  currentMomentId: string | null;
};
const flatten = (trail: Trail) => trail.chapters.flatMap((chapter) => chapter.moments);
const stageId = (lessonId: string, id: string) =>
  "stage:" + encodeURIComponent(lessonId) + ":" + encodeURIComponent(id);
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const sourceRoot = resolve(process.env.VISIBLE_STAGES_CANDIDATE ?? process.cwd());
  assert.ok(
    isAbsolute(sourceRoot) && !/^[\\/]{2}/.test(realpathSync(sourceRoot)),
    "Local absolute candidate required",
  );
  const load = (path: string) => import(pathToFileURL(resolve(sourceRoot, path)).href);
  const { buildLivingTrail } = await load("src/domain/study/living-trail.ts");
  const { requireCourseBundle } = await load("src/content/course-registry.ts");
  const { publicCourse } = await load("src/content/public.ts");
  const { findJourneyPresentation } = await load("src/content/journey-registry.ts");
  const { initialStudyState } = await load("src/domain/study/study-state.ts");
  const { resolveLessonStages } = await load("src/engine/presentation/lesson-stages.ts");
  const { assessmentActivityIds } = await load("src/content/assessment-references.ts");
  const { evaluateLearningAccess } = await load("src/domain/study/learning-access.ts");
  const { trailRouteMoment, trailContinuation, trailReturnHref } = await load(
    "src/lib/trail-location.ts",
  );
  const { trailScrollDirection, resolveTrailAnchor } = await load("src/lib/trail-scroll.ts");
  const sourceFiles = [
    "src/domain/study/living-trail.ts",
    "src/lib/trail-location.ts",
    "src/lib/trail-scroll.ts",
    "src/components/trail/living-trail-view.tsx",
    "src/components/trail/use-trail-position.ts",
    "src/components/trail/trail-experience-frame.tsx",
    "src/components/trail/living-trail-path.css",
    "src/components/activities/lesson-experience.tsx",
    "content/journeys/espanol-a-tu-paso-a1.json",
  ];
  const manifest = sourceFiles.map((path) => ({
    path,
    sha256: sha(readFileSync(resolve(sourceRoot, path))),
  }));
  console.log(
    "QA_VISIBLE_STAGES_CANDIDATE " +
      JSON.stringify({
        baseline: "8ce285251bbc3e8109d27ab2bdac3a94d0e4691d",
        sourceRoot,
        digest: sha(JSON.stringify(manifest)),
        files: manifest,
        node: process.version,
        environment:
          "pure local/SSR QA with explicit mocks; no env files/browser/ports/DB/build/provider calls",
      }),
  );
  const stateFor = (course: PublicCourse) => ({
    ...structuredClone(initialStudyState),
    courseId: course.id,
  });
  const project = (
    course: PublicCourse,
    state = stateFor(course),
    presentation: unknown = findJourneyPresentation(course),
  ) =>
    buildLivingTrail(course, state, {
      presentation,
      learningAccess: evaluateLearningAccess(course, {
        completedActivityIds: state.completedActivityIds,
        assessmentResults: state.assessmentAttempts,
      }),
      actionContext: { source: "compiled", permitted: true },
    }) as Trail;
  const fixture = (id: string) => {
    const b = requireCourseBundle(id);
    return publicCourse(b.course, b.language) as PublicCourse;
  };
  const es = fixture("espanol-a-tu-paso-a1");
  const en = fixture("ingles-a1-pessoal");
  const ordinary = (course: PublicCourse) =>
    course.units
      .filter((u) => u.active)
      .flatMap((unit) =>
        unit.lessons
          .filter(
            (lesson) =>
              lesson.active &&
              !lesson.interactiveLessonRef &&
              !course.assessments.some((a) => a.lessonId === lesson.id),
          )
          .map((lesson) => ({ unit, lesson })),
      );
  const activeLessons = (course: PublicCourse) =>
    course.units.filter((u) => u.active).flatMap((u) => u.lessons.filter((l) => l.active));

  for (const course of [es, en]) {
    const trail = project(course),
      points = flatten(trail),
      ordinaryPoints = points.filter((m) => m.kind === "lesson");
    const expected = ordinary(course).flatMap(({ lesson }) =>
      (resolveLessonStages(lesson) as Stage[]).map((stage) => ({ lesson, stage })),
    );
    test(
      course.id + ": every ordinary stage is exactly one external point in curricular order",
      () => {
        assert.ok(
          expected.length > ordinary(course).length,
          "Fixture must distinguish stages from whole lessons",
        );
        assert.deepEqual(
          ordinaryPoints.map((m) => m.id),
          expected.map(({ lesson, stage }) => stageId(lesson.id, stage.id)),
        );
      },
    );
    test(
      course.id + ": each stage point preserves its exact title, owner, stage and activities",
      () => {
        for (const { lesson, stage } of expected) {
          const matches = ordinaryPoints.filter((m) => m.id === stageId(lesson.id, stage.id));
          assert.equal(matches.length, 1, stage.id);
          const m = matches[0];
          assert.equal(m.lessonId, lesson.id);
          assert.equal(m.title, stage.title);
          assert.deepEqual(m.stageIds, [stage.id]);
          assert.deepEqual(m.activityIds, stage.activityIds);
        }
      },
    );
    test(course.id + ": ordinary activity coverage is complete, unique and ordered", () => {
      const actual = ordinaryPoints.flatMap((m) => m.activityIds),
        ids = expected.flatMap((x) => x.stage.activityIds);
      assert.deepEqual(actual, ids);
      assert.equal(new Set(actual).size, actual.length);
      assert.equal(new Set(points.map((m) => m.id)).size, points.length);
    });
    test(
      course.id + ": guided lessons remain one atomic point with their full real activities",
      () => {
        const lessons = activeLessons(course).filter((l) => l.interactiveLessonRef);
        for (const lesson of lessons) {
          const actual = points.filter((m) => m.kind === "guided" && m.lessonId === lesson.id);
          assert.equal(actual.length, 1, lesson.id);
          assert.deepEqual(
            actual[0].activityIds,
            lesson.activities.map((a) => a.id),
          );
          assert.equal(actual[0].id, "guided:" + encodeURIComponent(lesson.id));
          assert.ok(!actual[0].id.startsWith("stage:"));
        }
      },
    );
    test(
      course.id +
        ": each real assessment stays atomic and exposes only official assessment activities",
      () => {
        for (const a of course.assessments.filter((a) =>
          activeLessons(course).some((l) => l.id === a.lessonId),
        )) {
          const actual = points.filter((m) => m.assessmentId === a.id);
          assert.equal(actual.length, 1, a.id);
          assert.equal(actual[0].kind, "assessment");
          assert.equal(actual[0].id, "assessment:" + encodeURIComponent(a.id));
          assert.deepEqual(actual[0].activityIds, assessmentActivityIds(a));
          assert.deepEqual(actual[0].stageIds, []);
          assert.ok(!actual[0].id.startsWith("stage:"));
        }
      },
    );
    test(
      course.id + ": changing progress cannot renumber points or manufacture an official result",
      () => {
        const state = stateFor(course);
        state.completedActivityIds = ordinaryPoints[0].activityIds.slice();
        const changed = flatten(project(course, state));
        assert.deepEqual(
          changed.map((m) => m.id),
          points.map((m) => m.id),
        );
        assert.ok(changed.filter((m) => m.kind === "assessment").every((m) => m.result === null));
      },
    );
    test(
      course.id + ": generic fallback and installed presentation context preserve stage identities",
      () => {
        const fallback = flatten(project(course, stateFor(course), null));
        assert.deepEqual(
          fallback.filter((m) => m.kind === "lesson").map((m) => m.id),
          ordinaryPoints.map((m) => m.id),
        );
        const installed = buildLivingTrail(course, stateFor(course), {
          presentation: null,
          learningAccess: null,
          actionContext: { source: "installed", permitted: true },
        }) as Trail;
        assert.deepEqual(
          flatten(installed)
            .filter((m) => m.kind === "lesson")
            .map((m) => m.id),
          ordinaryPoints.map((m) => m.id),
        );
      },
    );
  }
  const esTrail = project(es),
    esPoints = flatten(esTrail),
    presentation = findJourneyPresentation(es);
  test("stage expansion keeps the declared editorial origin and contextual metadata", () => {
    assert.ok(presentation);
    const origins = presentation.chapters.flatMap(
      (c: {
        moments: {
          id: string;
          title: string;
          target: { kind: string; lessonId?: string; stageIds?: string[] };
          character?: string;
          setting?: string;
          illustration?: unknown;
        }[];
      }) => c.moments,
    );
    for (const point of esPoints.filter((m) => m.kind === "lesson")) {
      const origin = origins.find(
        (o: { target: { kind: string; lessonId?: string; stageIds?: string[] } }) =>
          o.target.kind === "lesson" &&
          o.target.lessonId === point.lessonId &&
          (!o.target.stageIds || o.target.stageIds.includes(point.stageIds[0])),
      );
      assert.ok(origin, point.id);
      assert.equal(point.originMomentId, origin.id);
      assert.equal(point.originMomentTitle, origin.title);
      for (const key of ["character", "setting", "illustration"] as const)
        if (origin[key] !== undefined) assert.deepEqual(point[key], origin[key]);
    }
  });

  for (const kind of ["guided", "assessment"])
    test(
      "legacy atomic " + kind + " route checkpoint and hash preserve its canonical owner",
      () => {
        const point = esPoints.find((m) => m.kind === kind);
        assert.ok(point && point.originMomentId);
        assert.notEqual(point.id, point.originMomentId);
        const href = new URL(point.href, "https://local.invalid");
        href.searchParams.set("moment", point.originMomentId);
        assert.equal(
          trailRouteMoment(esTrail, href.pathname, href.searchParams)?.moment.id,
          point.id,
        );
        assert.equal(
          resolveTrailAnchor(
            esTrail,
            "#moment-" + encodeURIComponent(point.originMomentId),
            esTrail.currentMomentId ?? undefined,
          ),
          point.id,
        );
        // Isolate checkpoint compatibility on an explicitly available model; this grants no production access.
        const available = structuredClone(esTrail),
          atomic = flatten(available).find((m) => m.id === point.id);
        assert.ok(atomic);
        atomic.status = "available";
        atomic.access = { allowed: true };
        atomic.availableActivityIds = atomic.activityIds.slice();
        const result = trailContinuation(
          available,
          {
            version: 1,
            momentId: point.originMomentId,
            activityId: point.activityIds[0],
            updatedAt: "2026-10-28T12:00:00Z",
          },
          [],
        );
        assert.equal(result?.moment.id, point.id);
        assert.equal(
          new URL(result.href, "https://local.invalid").searchParams.get("moment"),
          point.id,
        );
      },
    );

  test("canonical guided checkpoint beats an earlier ordinary legacy alias with the same ID", () => {
    const projected = structuredClone(esTrail),
      points = flatten(projected);
    const guided = points.find((m) => m.kind === "guided"),
      earlier = points.find((m) => m.kind === "lesson");
    assert.ok(guided && earlier && points.indexOf(earlier) < points.indexOf(guided));
    earlier.originMomentId = guided.id;
    for (const point of [earlier, guided]) {
      point.status = "available";
      point.access = { allowed: true };
      point.availableActivityIds = point.activityIds.slice();
    }
    const found = trailContinuation(
      projected,
      { version: 1, momentId: guided.id, updatedAt: "2026-10-28T12:00:00Z" },
      [],
    );
    assert.equal(found?.moment.id, guided.id);
    assert.equal(found?.moment.kind, "guided");
  });
  test("completed exact checkpoint cannot revive an earlier alias and falls back to official current point", () => {
    const projected = structuredClone(esTrail),
      points = flatten(projected);
    const guided = points.find((m) => m.kind === "guided"),
      earlier = points.find((m) => m.kind === "lesson");
    const current = points.find((m) => m.kind === "lesson" && m.id !== earlier?.id);
    assert.ok(guided && earlier && current && points.indexOf(earlier) < points.indexOf(guided));
    earlier.originMomentId = guided.id;
    earlier.status = "available";
    earlier.access = { allowed: true };
    earlier.availableActivityIds = earlier.activityIds.slice();
    guided.status = "completed";
    current.status = "available";
    current.access = { allowed: true };
    current.availableActivityIds = current.activityIds.slice();
    projected.currentMomentId = current.id;
    const found = trailContinuation(
      projected,
      { version: 1, momentId: guided.id, updatedAt: "2026-10-28T12:00:00Z" },
      [],
    );
    assert.equal(found?.moment.id, current.id);
    assert.notEqual(found?.moment.id, earlier.id);
    assert.notEqual(found?.moment.id, guided.id);
  });
  test("adversarial editorial atomic IDs cannot collide with generated stage DOM identities", () => {
    const altered = structuredClone(presentation);
    assert.ok(altered);
    const sources = altered.chapters.flatMap(
      (c: {
        moments: {
          id: string;
          target: { kind: string; lessonId?: string; assessmentId?: string };
        }[];
      }) => c.moments,
    );
    const guided = esPoints.find((m) => m.kind === "guided"),
      assessment = esPoints.find((m) => m.kind === "assessment");
    const ordinaryPoints = esPoints.filter((m) => m.kind === "lesson");
    assert.ok(guided && assessment && ordinaryPoints.length > 1);
    const guidedSource = sources.find(
      (m: { target: { kind: string; lessonId?: string } }) =>
        m.target.kind === "lesson" && m.target.lessonId === guided.lessonId,
    );
    const assessmentSource = sources.find(
      (m: { target: { kind: string; assessmentId?: string } }) =>
        m.target.kind === "assessment" && m.target.assessmentId === assessment.assessmentId,
    );
    assert.ok(guidedSource && assessmentSource);
    guidedSource.id = ordinaryPoints[0].id;
    assessmentSource.id = ordinaryPoints[1].id;
    const projected = project(es, stateFor(es), altered),
      points = flatten(projected);
    assert.equal(new Set(points.map((m) => m.id)).size, points.length);
    assert.equal(points.find((m) => m.id === ordinaryPoints[0].id)?.kind, "lesson");
    assert.equal(points.find((m) => m.id === ordinaryPoints[1].id)?.kind, "lesson");
    assert.equal(points.find((m) => m.id === guided.id)?.originMomentId, guidedSource.id);
    assert.equal(points.find((m) => m.id === assessment.id)?.originMomentId, assessmentSource.id);
    const guidedUrl = new URL(guided.href, "https://local.invalid");
    guidedUrl.searchParams.set("moment", guidedSource.id);
    assert.equal(
      trailRouteMoment(projected, guidedUrl.pathname, guidedUrl.searchParams)?.moment.id,
      guided.id,
    );
  });
  test("invalid presentation falls back without losing any ordinary stage", () => {
    const actual = flatten(project(es, stateFor(es), { invalid: true })).filter(
      (m) => m.kind === "lesson",
    );
    assert.deepEqual(
      actual.map((m) => m.id),
      esPoints.filter((m) => m.kind === "lesson").map((m) => m.id),
    );
  });
  const ordinaryOwner = ordinary(es).find(
    ({ lesson }) => (resolveLessonStages(lesson) as Stage[]).length >= 3,
  );
  assert.ok(ordinaryOwner);
  const synthetic = structuredClone(es);
  synthetic.units = [structuredClone(ordinaryOwner.unit)];
  synthetic.units[0].lessons = [structuredClone(ordinaryOwner.lesson)];
  synthetic.assessments = [];
  synthetic.units[0].assessmentRefs = { formative: [] };
  synthetic.units[0].learningPolicy = {
    completion: { requirements: [] },
    mastery: { requirements: [] },
  };
  synthetic.units[0].access = undefined;
  const baseSynthetic = project(synthetic, stateFor(synthetic), null),
    baseIds = flatten(baseSynthetic).map((m) => m.id);
  test("inserting an earlier stage does not renumber existing point IDs", () => {
    const altered = structuredClone(synthetic),
      lesson = altered.units[0].lessons[0];
    const activity = { ...structuredClone(lesson.activities[0]), id: "qa-prepended-activity" };
    lesson.activities.unshift(activity);
    // Build stages from the original valid declaration, not the newly changed activity layout.
    lesson.stages = [
      { id: "qa-prepended-stage", title: "Before existing stages", activityIds: [activity.id] },
      ...(resolveLessonStages(synthetic.units[0].lessons[0]) as Stage[]).map(
        ({ id, title, activityIds }) => ({ id, title, activityIds }),
      ),
    ];
    assert.deepEqual(
      flatten(project(altered, stateFor(altered), null))
        .map((m) => m.id)
        .slice(1),
      baseIds,
    );
  });
  test("stage IDs encode special characters without collisions or positional indexes", () => {
    const altered = structuredClone(synthetic),
      lesson = altered.units[0].lessons[0];
    lesson.id = "lesson:/? #\u00f1";
    lesson.stages = (resolveLessonStages(lesson) as Stage[]).map((s, index) => ({
      id: index === 0 ? "a:b" : index === 1 ? "a/b" : s.id,
      title: s.title,
      activityIds: s.activityIds,
    }));
    const points = flatten(project(altered, stateFor(altered), null));
    assert.equal(points[0].id, stageId(lesson.id, "a:b"));
    assert.equal(points[1].id, stageId(lesson.id, "a/b"));
    assert.notEqual(points[0].id, points[1].id);
  });
  test("projection is read only for curriculum, state and sidecar", () => {
    const course = structuredClone(es),
      state = stateFor(course),
      sidecar = structuredClone(presentation);
    const before = JSON.stringify([course, state, sidecar]);
    project(course, state, sidecar);
    assert.equal(JSON.stringify([course, state, sidecar]), before);
  });
  const first = esPoints.find((m) => m.kind === "lesson" && m.activityIds.length > 1);
  assert.ok(first && first.originMomentId);
  const sibling = esPoints.find(
    (m) => m.kind === "lesson" && m.originMomentId === first.originMomentId && m.id !== first.id,
  );
  assert.ok(sibling);
  const route = (point: Moment, query: URLSearchParams) =>
    trailRouteMoment(esTrail, new URL(point.href, "https://local.invalid").pathname, query);
  test("new stage URL resolves exactly its own stage point", () => {
    for (const p of [first, sibling])
      assert.equal(
        route(p, new URL(p.href, "https://local.invalid").searchParams)?.moment.id,
        p.id,
      );
  });
  test("legacy editorial URL plus real activity selects the containing stage", () => {
    assert.equal(
      route(
        first,
        new URLSearchParams({ moment: first.originMomentId!, activity: sibling.activityIds[0] }),
      )?.moment.id,
      sibling.id,
    );
  });
  test("legacy origin without activity deterministically selects its first stage", () => {
    assert.equal(
      route(first, new URLSearchParams({ moment: first.originMomentId! }))?.moment.id,
      first.id,
    );
  });
  test("exact new stage query wins over a legacy origin on the same real route", () => {
    assert.equal(route(first, new URLSearchParams({ moment: sibling.id }))?.moment.id, sibling.id);
  });
  test("foreign activity cannot escape the declared real route", () => {
    const other = esPoints.find((m) => m.lessonId !== first.lessonId && m.kind === "lesson");
    assert.ok(other);
    const result = route(
      first,
      new URLSearchParams({ moment: sibling.id, activity: other.activityIds[0] }),
    );
    assert.equal(result?.moment.id, sibling.id);
    assert.equal(result?.moment.lessonId, first.lessonId);
  });
  test("assessment stage expansion does not weaken exact assessmentId route matching", () => {
    const exam = esPoints.find((m) => m.kind === "assessment");
    assert.ok(exam);
    assert.equal(
      trailRouteMoment(
        esTrail,
        "/assessment",
        new URLSearchParams({ moment: exam.id, assessmentId: "foreign" }),
      ),
      undefined,
    );
  });
  test("legacy resume activity is scoped to the saved origin and stage", () => {
    const found = trailContinuation(
      esTrail,
      {
        version: 1,
        momentId: first.originMomentId,
        activityId: sibling.activityIds[0],
        updatedAt: "2026-10-28T12:00:00Z",
      },
      [],
    );
    assert.equal(found?.moment.id, sibling.id);
    assert.equal(
      new URL(found.href, "https://local.invalid").searchParams.get("activity"),
      sibling.activityIds[0],
    );
  });
  test("exact return encodes the whole stage ID without adding unit navigation", () =>
    assert.equal(
      trailReturnHref(es.slug, 1, sibling.id),
      "/course/" + encodeURIComponent(es.slug) + "#moment-" + encodeURIComponent(sibling.id),
    ));
  test("exact return hash takes precedence over a different continuation", () =>
    assert.equal(
      resolveTrailAnchor(esTrail, "#moment-" + encodeURIComponent(sibling.id), first.id),
      sibling.id,
    ));
  test("legacy hash selects a stage within its declared origin", () => {
    const id = resolveTrailAnchor(
      esTrail,
      "#moment-" + encodeURIComponent(first.originMomentId!),
      sibling.id,
    );
    assert.ok(esPoints.some((m) => m.id === id && m.originMomentId === first.originMomentId));
  });
  for (const hash of ["", "#unrelated", "#moment-%E0%A4%A", "#moment-foreign"])
    test("invalid or absent return hash safely falls back to the real continuation: " + hash, () =>
      assert.equal(resolveTrailAnchor(esTrail, hash, sibling.id), sibling.id),
    );
  for (const [rect, expected] of [
    [{ top: -300, bottom: -100 }, "up"],
    [{ top: 1100, bottom: 1200 }, "down"],
    [{ top: 120, bottom: 190 }, null],
    [{ top: -5, bottom: 80 }, null],
  ] as const)
    test("floating return direction covers both scroll directions: " + JSON.stringify(rect), () =>
      assert.equal(trailScrollDirection(rect, { top: 50, bottom: 900 }), expected),
    );
  test("floating return margin has exact symmetric boundaries", () => {
    assert.equal(
      trailScrollDirection({ top: -80, bottom: -22 }, { top: 50, bottom: 900 }, 72),
      null,
    );
    assert.equal(
      trailScrollDirection({ top: -80, bottom: -23 }, { top: 50, bottom: 900 }, 72),
      "up",
    );
    assert.equal(
      trailScrollDirection({ top: 972, bottom: 1040 }, { top: 50, bottom: 900 }, 72),
      null,
    );
    assert.equal(
      trailScrollDirection({ top: 973, bottom: 1040 }, { top: 50, bottom: 900 }, 72),
      "down",
    );
  });

  const require = createRequire(resolve(process.cwd(), "package.json"));
  const context: Record<string, unknown> = {};
  (globalThis as unknown as Record<string, unknown>).__visibleStagesQa = context;
  const compile = async (entry: string, kind: "view" | "lesson" | "frame") => {
    const mocks: Record<string, string> = {
      "@/components/study-provider":
        "export const useStudy=()=>globalThis.__visibleStagesQa.study;",
      "./use-living-trail": "export const useLivingTrail=()=>globalThis.__visibleStagesQa.journey;",
      "@/components/trail/use-living-trail":
        "export const useLivingTrail=()=>globalThis.__visibleStagesQa.journey;",
      "@/components/navigation-link":
        'import React from "react";export default function Link({children,prefetch,scroll,...props}){return React.createElement("a",props,children)}',
      "next/image":
        'import React from "react";export default function Image(props){return React.createElement("img",props)}',
      "next/navigation":
        'export const usePathname=()=>globalThis.__visibleStagesQa.pathname;export const useSearchParams=()=>globalThis.__visibleStagesQa.search;export const useRouter=()=>({push:()=>{throw Error("SSR must not navigate")}});',
    };
    if (kind === "view") {
      mocks["./trail-memory"] = "export const TrailMemory=()=>null;";
      mocks["./use-trail-position"] =
        "export const useTrailPosition=(...args)=>{globalThis.__visibleStagesQa.positionArgs=args;return{direction:globalThis.__visibleStagesQa.direction,returnToCurrent:()=>{}}};";
    }
    if (kind === "frame")
      mocks["./living-trail-view"] =
        'import React from "react";export const LivingTrailView=({background})=>React.createElement("section",{"data-qa-inert-background":String(background)},"ORIGINAL_TRAIL");';
    if (kind === "lesson") {
      mocks["./activity-renderer"] =
        'import React from "react";export const activityEligibility=()=>({eligible:true});export const ActivityRenderer=({activity})=>React.createElement("div",{"data-qa-activity-id":activity.id},activity.title);';
      mocks["./lesson-support"] = "export const LessonSupport=()=>null;";
      mocks["@/components/trail/trail-return"] = "export const TrailReturn=()=>null;";
    }
    const built = await build({
      entryPoints: [resolve(sourceRoot, entry)],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      packages: "external",
      loader: { ".css": "empty" },
      tsconfig: resolve(sourceRoot, "tsconfig.json"),
      plugins: [
        {
          name: "independent-visible-stages-qa",
          setup(builder) {
            builder.onResolve({ filter: /.*/ }, (args) =>
              Object.hasOwn(mocks, args.path)
                ? { path: args.path, namespace: "visible-stages-qa" }
                : undefined,
            );
            builder.onLoad({ filter: /.*/, namespace: "visible-stages-qa" }, (args) => ({
              contents: mocks[args.path],
              loader: "js",
              resolveDir: sourceRoot,
            }));
          },
        },
      ],
    });
    const compiled = { exports: {} };
    new Function("require", "module", "exports", built.outputFiles[0].text)(
      require,
      compiled,
      compiled.exports,
    );
    return compiled.exports as Record<string, React.ComponentType<Record<string, unknown>>>;
  };
  const view = await compile("src/components/trail/living-trail-view.tsx", "view");
  const lessonComponent = await compile(
    "src/components/activities/lesson-experience.tsx",
    "lesson",
  );
  const frame = await compile("src/components/trail/trail-experience-frame.tsx", "frame");
  const bundle = requireCourseBundle(es.id),
    realOwner = es.units.find((u) => u.lessons.some((l) => l.id === sibling.lessonId));
  assert.ok(realOwner);
  const realLesson = realOwner.lessons.find((l) => l.id === sibling.lessonId);
  assert.ok(realLesson);
  const startIndex = realLesson.activities.findIndex((a) => a.id === sibling.activityIds[0]);
  const endIndex = realLesson.activities.findIndex((a) => a.id === sibling.activityIds.at(-1));
  const reset = () => {
    context.study = {
      course: es,
      language: bundle.language,
      resources: bundle.resources,
      state: stateFor(es),
      runtime: null,
      vocabularyItems: [],
      completeActivity: () => {
        throw Error("SSR must not complete activities");
      },
    };
    context.journey = {
      trail: esTrail,
      ready: true,
      continuation: trailContinuation(esTrail, null, []),
    };
    context.direction = null;
    const url = new URL(sibling.href, "https://local.invalid");
    context.pathname = url.pathname;
    context.search = url.searchParams;
  };
  const render = (
    component: React.ComponentType<Record<string, unknown>>,
    props: Record<string, unknown> = {},
  ) => renderToStaticMarkup(React.createElement(component, props));
  const lessonProps = (index: number, withContext = true) => ({
    lesson: realLesson,
    unit: realOwner,
    index,
    onSelect: () => {
      throw Error("SSR must not change activities");
    },
    ...(withContext ? { trailMoment: sibling } : {}),
  });
  test("one continuous external list and curve contains all real stage points across chapters", () => {
    reset();
    const html = render(view.LivingTrailView);
    assert.equal((html.match(/<ol[^>]*class="tv-winding-path"/g) ?? []).length, 1);
    assert.equal((html.match(/class="tv-route-svg"/g) ?? []).length, 1);
    assert.equal((html.match(/id="moment-/g) ?? []).length, esPoints.length);
    let previous = -1;
    for (const point of esPoints) {
      const index = html.indexOf('id="moment-' + point.id + '"');
      assert.ok(index > previous, point.id);
      previous = index;
    }
  });
  test("legacy unit URL still renders the same full continuous path", () => {
    reset();
    const html = render(view.LivingTrailView, { unitSlug: "1" });
    assert.equal((html.match(/<ol[^>]*class="tv-winding-path"/g) ?? []).length, 1);
    assert.equal((html.match(/id="moment-/g) ?? []).length, esPoints.length);
  });
  test("trail view removes per-moment activity and group counters", () => {
    reset();
    const visible = render(view.LivingTrailView).replace(/<[^>]*>/g, " ");
    assert.ok(!/\b\d+\s+(?:atividades|momentos)\b/u.test(visible));
  });
  test("stage popup renders its original activity without an internal path or parts card", () => {
    reset();
    const html = render(lessonComponent.LessonExperience, lessonProps(startIndex));
    assert.ok(html.includes('data-qa-activity-id="' + sibling.activityIds[0] + '"'));
    assert.ok(!/class="[^"]*\ble-path\b/.test(html));
    assert.ok(!/class="[^"]*\ble-stage-parts\b/.test(html));
    assert.ok(!/Parte \d+ de \d+/.test(html));
  });
  test("legacy ordinary lesson retains its internal path without trail-stage context", () => {
    reset();
    const html = render(lessonComponent.LessonExperience, lessonProps(startIndex, false));
    assert.ok(/class="[^"]*\ble-path\b/.test(html));
  });
  test("the first activity of a noninitial stage cannot go backward into another point", () => {
    reset();
    assert.ok(startIndex > 0);
    const html = render(lessonComponent.LessonExperience, lessonProps(startIndex));
    const footer = html.match(/<footer class="le-controls">([\s\S]*?)<\/footer>/)?.[1];
    assert.ok(footer);
    assert.match(footer, /<button[^>]*disabled=""/);
  });
  test("the last activity returns to its exact external stage anchor", () => {
    reset();
    const html = render(lessonComponent.LessonExperience, lessonProps(endIndex));
    const footer = html.match(/<footer class="le-controls">([\s\S]*?)<\/footer>/)?.[1];
    assert.ok(footer);
    assert.ok(
      footer.includes('href="' + trailReturnHref(es.slug, realOwner.number, sibling.id) + '"'),
    );
  });
  for (const direction of ["up", "down"])
    test("floating return button supports " + direction + " direction", () => {
      reset();
      context.direction = direction;
      const html = render(view.LivingTrailView);
      assert.ok(html.includes('class="tv-return-current points-' + direction + '"'));
      assert.ok(html.includes('aria-label="Voltar ao ponto para continuar"'));
    });
  test("inert background does not position the page or expose a floating return control", () => {
    reset();
    context.direction = "up";
    const html = render(view.LivingTrailView, { background: true });
    assert.ok(!html.includes('class="tv-return-current'));
    assert.equal((context.positionArgs as unknown[])[2], false);
  });
  test("stage frame retains the original guarded child exactly once and requests inert background", () => {
    reset();
    const html = render(frame.TrailExperienceFrame, {
      children: React.createElement(
        "section",
        { "data-qa-existing-guard": true },
        "EXISTING_GUARD",
      ),
    });
    assert.equal((html.match(/EXISTING_GUARD/g) ?? []).length, 1);
    assert.ok(html.includes("<dialog"));
    assert.ok(html.includes('data-qa-inert-background="true"'));
  });
  test("popup CSS declares full dynamic viewport and square edges", () => {
    const css = readFileSync(
      resolve(sourceRoot, "src/components/trail/living-trail-path.css"),
      "utf8",
    );
    const block = css.match(/\.tv-lesson-dialog\s*\{([^}]+)\}/)?.[1];
    assert.ok(block);
    assert.match(block, /\bwidth:\s*100vw\s*;/);
    assert.match(block, /\bheight:\s*100dvh\s*;/);
    assert.match(block, /\bborder-radius:\s*0\s*;/);
  });
  test("pure verification preserves every observed candidate source byte", () => {
    for (const file of manifest)
      assert.equal(sha(readFileSync(resolve(sourceRoot, file.path))), file.sha256, file.path);
  });
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
