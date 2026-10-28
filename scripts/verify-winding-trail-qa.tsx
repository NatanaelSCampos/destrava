/** QA independente: trilha contínua, roteamento de popup e limites do momento. Não altera o verificador anterior. */
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";

async function main() {
  const candidate = resolve(process.env.WINDING_TRAIL_CANDIDATE ?? process.cwd());
  assert.ok(
    isAbsolute(candidate) && !/^[\\/]{2}/.test(candidate),
    "Candidate must be a local absolute directory",
  );
  assert.ok(!/^[\\/]{2}/.test(realpathSync(candidate)), "Candidate must not resolve to UNC");
  const load = (path: string) => import(pathToFileURL(resolve(candidate, path)).href);
  const { trailRouteMoment, trailReturnHref } = await load("src/lib/trail-location.ts");
  const { buildLivingTrail } = await load("src/domain/study/living-trail.ts");
  const { journeyText } = await load("src/lib/journey-text.ts");
  const { findJourneyPresentation } = await load("src/content/journey-registry.ts");
  const { requireCourseBundle } = await load("src/content/course-registry.ts");
  const { publicCourse } = await load("src/content/public.ts");
  const { initialStudyState } = await load("src/domain/study/study-state.ts");
  const { evaluateLearningAccess } = await load("src/domain/study/learning-access.ts");
  const { resolveLessonStages } = await load("src/engine/presentation/lesson-stages.ts");
  const paths = [
    "src/lib/trail-location.ts",
    "src/lib/journey-text.ts",
    "src/domain/study/living-trail.ts",
    "src/domain/study/learning-access.ts",
    "src/components/trail/trail-experience-frame.tsx",
    "src/components/trail/living-trail-view.tsx",
    "src/components/trail/living-trail.css",
    "src/components/trail/living-trail-path.css",
    "src/components/activities/lesson-experience.tsx",
    "src/components/layout/app-shell.tsx",
    "content/journeys/espanol-a-tu-paso-a1.json",
  ];
  const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  for (const path of paths)
    assert.ok(existsSync(resolve(candidate, path)), "Candidate file required: " + path);
  const manifest = paths.map((path) => ({ path, sha256: hash(resolve(candidate, path)) }));
  const digest = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  console.log(
    "QA_WINDING_CANDIDATE " +
      JSON.stringify({
        baseline: "731045e47a96fc1231baacd4deda675a569b987b",
        candidate,
        digest,
        files: manifest,
        node: process.version,
        environment:
          "pure local tests and SSR with explicit mocks; no env files/browser/ports/DB/services/provider calls",
      }),
  );
  const bundle = requireCourseBundle("espanol-a-tu-paso-a1");
  const course = publicCourse(bundle.course, bundle.language);
  const state = { ...structuredClone(initialStudyState), courseId: course.id };
  const learningAccess = evaluateLearningAccess(course, {
    completedActivityIds: [],
    assessmentResults: [],
  });
  const trail = buildLivingTrail(course, state, {
    presentation: findJourneyPresentation(course),
    learningAccess,
    actionContext: { source: "compiled", permitted: true },
  });
  const moments = trail.chapters.flatMap(
    (chapter: { moments: Record<string, unknown>[] }) => chapter.moments,
  );
  const first = moments.find(
    (m: { kind: string; activityIds: string[] }) => m.kind === "lesson" && m.activityIds.length > 1,
  );
  assert.ok(first, "Need ordinary multi-activity moment");
  const second = moments.find(
    (m: { kind: string; lessonId: string; id: string }) =>
      m.kind === "lesson" && m.lessonId === first.lessonId && m.id !== first.id,
  );
  const guided = moments.find((m: { kind: string }) => m.kind === "guided");
  const exam = moments.find((m: { isExam: boolean }) => m.isExam);
  const foreignChapter = trail.chapters.find(
    (c: { access: { allowed: boolean } }) => !c.access.allowed,
  );
  assert.ok(
    second && guided && exam && foreignChapter,
    "Fixture must cover same-lesson partition, guided, exam and blocked continuation",
  );
  const url = (moment: { href: string }) => new URL(moment.href, "https://local.invalid");
  const route = (moment: { href: string }, query?: string) => {
    const u = url(moment);
    return trailRouteMoment(trail, u.pathname, new URLSearchParams(query ?? u.search));
  };
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const freeze = (value: unknown) => {
    if (value && typeof value === "object") {
      Object.freeze(value);
      Object.values(value).forEach(freeze);
    }
    return value;
  };

  for (const [input, expected] of [
    ["Unidade 2: Uma pausa no bairro", "Uma pausa no bairro"],
    ["Cap\u00edtulo3 \u2014 Encontre a outra pessoa", "Encontre a outra pessoa"],
    ["Unidade12 \u00b7 Outro encontro", "Outro encontro"],
    [
      "A aprova\u00e7\u00e3o com80% libera a Unidade2.",
      "A aprova\u00e7\u00e3o com80% libera a parte do caminho.",
    ],
    ["Retome o Cap\u00edtulo 12 e avance.", "Retome o trecho do caminho e avance."],
    [
      "Compre duas unidades por 3 euros; uma unidade custa 2 euros.",
      "Compre duas unidades por 3 euros; uma unidade custa 2 euros.",
    ],
  ])
    test("unit-free narrative copy preserves meaning/quantities: " + input, () =>
      assert.equal(journeyText(input), expected),
    );

  for (const moment of [first, second, guided, exam])
    test("declared real route resolves exact moment: " + moment.id, () =>
      assert.equal(route(moment)?.moment.id, moment.id),
    );
  for (const pathname of [
    "/dashboard",
    "/study",
    "/review",
    "/assessment-history",
    "/course/" + course.slug,
    "/course/foreign/unit/1/lesson/foreign",
    "https://attacker.invalid" + url(first).pathname,
    url(first).pathname + "/foreign",
    url(first).pathname + "/",
    url(first).pathname.replace("/unit/1/", "/unit/999/"),
    url(first).pathname.replace("/lesson/", "/lesson/foreign-"),
  ])
    test("undeclared/foreign route does not become a popup: " + pathname, () =>
      assert.equal(
        trailRouteMoment(trail, pathname, new URLSearchParams("moment=" + first.id)),
        undefined,
      ),
    );
  test("guided popup resolves only its declared guided path", () => {
    const u = url(guided);
    assert.ok(u.pathname.endsWith("/guided"));
    assert.equal(
      trailRouteMoment(trail, u.pathname.slice(0, -7), new URLSearchParams("moment=" + guided.id)),
      undefined,
    );
  });
  for (const assessmentId of [null, "foreign-assessment", ""])
    test("assessment popup requires exact declared assessmentId: " + String(assessmentId), () => {
      const q = new URLSearchParams({ moment: exam.id, activity: exam.activityIds[0] });
      if (assessmentId !== null) q.set("assessmentId", assessmentId);
      assert.equal(trailRouteMoment(trail, "/assessment", q), undefined);
    });
  test("a valid activity takes precedence over a conflicting same-route moment", () =>
    assert.equal(
      route(
        first,
        new URLSearchParams({ activity: second.activityIds[0], moment: first.id }).toString(),
      )?.moment.id,
      second.id,
    ));
  test("foreign activity is ignored and valid same-route moment determines location", () =>
    assert.equal(
      route(first, new URLSearchParams({ activity: "foreign", moment: second.id }).toString())
        ?.moment.id,
      second.id,
    ));
  test("foreign activity and foreign moment cannot select another route owner", () => {
    const other = foreignChapter.moments[0];
    assert.equal(
      route(
        first,
        new URLSearchParams({ activity: other.activityIds[0], moment: other.id }).toString(),
      )?.moment.id,
      first.id,
    );
  });
  test("valid activity defeats forged moment and unrelated access parameters", () => {
    assert.equal(
      route(
        first,
        new URLSearchParams({
          activity: second.activityIds[0],
          moment: "foreign",
          allowed: "true",
          passed: "true",
          unitId: foreignChapter.unitId,
        }).toString(),
      )?.moment.id,
      second.id,
    );
  });
  test("without a valid query the first declared moment on that path is deterministic", () => {
    for (const q of [
      "",
      "moment=foreign",
      "activity=foreign",
      "activity=foreign&activity=" + second.activityIds[0],
    ])
      assert.equal(route(first, q)?.moment.id, first.id);
  });
  test("an assessmentId for another real assessment selects only that assessment, not a forged moment", () => {
    const other = moments.find(
      (m: { kind: string; id: string }) => m.kind === "assessment" && m.id !== exam.id,
    );
    assert.ok(other);
    const q = url(other).searchParams;
    q.set("moment", exam.id);
    q.set("activity", exam.activityIds[0]);
    assert.equal(trailRouteMoment(trail, "/assessment", q)?.moment.id, other.id);
  });
  test("route resolution identifies locked content without granting access or modifying evidence", () => {
    const frozen = structuredClone(trail),
      before = JSON.stringify([frozen, state, learningAccess]);
    freeze(frozen);
    freeze(state);
    freeze(learningAccess);
    const locked = foreignChapter.moments[0],
      u = url(locked),
      q = new URLSearchParams(u.search);
    q.set("allowed", "true");
    q.set("passed", "true");
    const resolved = trailRouteMoment(frozen, u.pathname, q);
    assert.ok(resolved);
    assert.equal(resolved.moment.status, "locked");
    assert.equal(resolved.moment.access.allowed, false);
    assert.equal(JSON.stringify([frozen, state, learningAccess]), before);
  });
  test("reload reconstruction and query key order preserve exact resolved location", () => {
    const u = url(second);
    const rebuilt = new URL(u.href);
    assert.equal(
      trailRouteMoment(trail, rebuilt.pathname, rebuilt.searchParams)?.moment.id,
      second.id,
    );
    const reordered = new URLSearchParams([...u.searchParams.entries()].reverse());
    assert.equal(trailRouteMoment(trail, u.pathname, reordered)?.moment.id, second.id);
  });
  for (const number of [1, 2, 99])
    test("return removes unit navigation while preserving moment anchor: " + number, () =>
      assert.equal(
        trailReturnHref(course.slug, number, second.id),
        "/course/" + encodeURIComponent(course.slug) + "#moment-" + encodeURIComponent(second.id),
      ),
    );
  test("return without moment is the continuous course path and cannot open redirect", () => {
    assert.equal(trailReturnHref(course.slug, 2), "/course/" + encodeURIComponent(course.slug));
    assert.equal(
      trailReturnHref("//attacker.invalid/a", 2, "m#?&/"),
      "/course/%2F%2Fattacker.invalid%2Fa#moment-m%23%3F%26%2F",
    );
  });

  const require = createRequire(resolve(process.cwd(), "package.json"));
  type Components = Record<string, React.ComponentType<Record<string, unknown>>>;
  const mockContext: Record<string, unknown> = {};
  (globalThis as unknown as Record<string, unknown>).__windingQa = mockContext;
  const compile = async (entry: string, kind: "frame" | "view" | "lesson"): Promise<Components> => {
    const modules: Record<string, string> = {
      "@/components/study-provider": "export const useStudy=()=>globalThis.__windingQa.study;",
      "./use-living-trail": "export const useLivingTrail=()=>globalThis.__windingQa.journey;",
      "@/components/trail/use-living-trail":
        "export const useLivingTrail=()=>globalThis.__windingQa.journey;",
      "next/navigation":
        'export const usePathname=()=>globalThis.__windingQa.pathname;export const useSearchParams=()=>globalThis.__windingQa.search;export const useRouter=()=>({push:(...args)=>{if(!globalThis.__windingQa.allowNavigation)throw Error("SSR must not navigate");globalThis.__windingQa.pushes.push(args);}});',
      "@/components/navigation-link":
        'import React from "react";export default function Link({children,prefetch,scroll,...props}){return React.createElement("a",props,children)}',
      "next/image":
        'import React from "react";export default function Image(props){return React.createElement("img",props)}',
    };
    if (kind === "frame")
      modules["./living-trail-view"] =
        'import React from "react";export const LivingTrailView=()=>React.createElement("section",{"data-qa-background":"trail"},"TRAIL_BACKGROUND");';
    if (kind === "frame")
      modules["react/jsx-runtime"] =
        'import React from "react";const make=(type,props,key)=>{if(type==="dialog"&&props.className==="tv-lesson-dialog"){globalThis.__windingQa.cancelHandler=props.onCancel;}return React.createElement(type,{...props,key});};export const jsx=make;export const jsxs=make;export const Fragment=React.Fragment;';
    if (kind === "view")
      modules["./trail-memory"] =
        'import React from "react";export const TrailMemory=()=>React.createElement("aside",null,"MEMORY_PLACEHOLDER");';
    if (kind === "lesson") {
      modules["./activity-renderer"] =
        'import React from "react";export const activityEligibility=()=>({eligible:true});export const ActivityRenderer=({activity,onActivityComplete})=>{globalThis.__windingQa.activityComplete=onActivityComplete;return React.createElement("div",{"data-qa-real-activity-id":activity.id},activity.title);};';
      modules["./lesson-support"] = "export const LessonSupport=()=>null;";
      modules["@/components/trail/trail-return"] =
        'import React from "react";export const TrailReturn=()=>React.createElement("a",{href:"/course/qa#moment-current"},"Voltar à minha trilha");';
    }
    const built = await build({
      entryPoints: [resolve(candidate, entry)],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      packages: "external",
      loader: { ".css": "empty" },
      tsconfig: resolve(candidate, "tsconfig.json"),
      plugins: [
        {
          name: "independent-winding-qa",
          setup(builder) {
            builder.onResolve({ filter: /.*/ }, (args) =>
              Object.hasOwn(modules, args.path)
                ? { path: args.path, namespace: "winding-qa" }
                : undefined,
            );
            builder.onLoad({ filter: /.*/, namespace: "winding-qa" }, (args) => ({
              contents: modules[args.path],
              loader: "js",
              resolveDir: candidate,
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
    return compiled.exports as Components;
  };
  const frame = await compile("src/components/trail/trail-experience-frame.tsx", "frame");
  const view = await compile("src/components/trail/living-trail-view.tsx", "view");
  const lesson = await compile("src/components/activities/lesson-experience.tsx", "lesson");
  const reset = () => {
    mockContext.allowNavigation = false;
    mockContext.pushes = [];
    mockContext.cancelHandler = undefined;
    mockContext.study = {
      course,
      state,
      language: bundle.language,
      completeActivity: () => {
        throw Error("SSR must not record completion");
      },
      resources: bundle.resources,
      vocabularyItems: [],
      runtime: null,
    };
    mockContext.journey = { trail, ready: true, continuation: null };
    mockContext.pathname = url(first).pathname;
    mockContext.search = url(first).searchParams;
  };
  const render = (
    component: React.ComponentType<Record<string, unknown>>,
    props: Record<string, unknown> = {},
  ) => renderToStaticMarkup(React.createElement(component, props));
  for (const moment of [first, guided, exam])
    test("popup frame preserves routed guarded child exactly once: " + moment.id, () => {
      reset();
      mockContext.pathname = url(moment).pathname;
      mockContext.search = url(moment).searchParams;
      const html = render(frame.TrailExperienceFrame, {
        children: React.createElement(
          "section",
          { "data-qa-child": "guarded" },
          "GUARDED_ORIGINAL_SURFACE",
        ),
      });
      assert.equal((html.match(/GUARDED_ORIGINAL_SURFACE/g) ?? []).length, 1);
      assert.ok(html.includes('aria-labelledby="tv-lesson-title"'));
      assert.ok(html.includes('aria-label="Fechar aula e voltar à trilha"'));
      assert.ok(html.indexOf("GUARDED_ORIGINAL_SURFACE") > html.indexOf("<dialog"));
      assert.ok(html.includes(escape(moment.title)));
      assert.ok(html.includes('aria-hidden="true"'));
    });
  test("an undeclared route keeps its original child without adding popup or background", () => {
    reset();
    mockContext.pathname = "/dashboard";
    const html = render(frame.TrailExperienceFrame, {
      children: React.createElement("section", null, "ORIGINAL_PAGE"),
    });
    assert.ok(html.includes("ORIGINAL_PAGE"));
    assert.ok(!html.includes("<dialog"));
    assert.ok(!html.includes("TRAIL_BACKGROUND"));
  });
  test("locked popup still receives the existing access-block child, never fabricating learning content", () => {
    reset();
    const m = foreignChapter.moments[0];
    mockContext.pathname = url(m).pathname;
    mockContext.search = url(m).searchParams;
    const before = JSON.stringify([state, learningAccess]);
    const html = render(frame.TrailExperienceFrame, {
      children: React.createElement(
        "section",
        { "data-qa-access": "denied" },
        "OFFICIAL_ACCESS_BLOCK",
      ),
    });
    assert.ok(html.includes("OFFICIAL_ACCESS_BLOCK"));
    assert.ok(!html.includes("data-qa-real-activity-id"));
    assert.equal(JSON.stringify([state, learningAccess]), before);
  });
  test("continuous winding view renders every real moment even when a legacy unit route is supplied", () => {
    reset();
    const html = render(view.LivingTrailView, { unitSlug: "1" });
    for (const m of moments) assert.ok(html.includes('id="moment-' + m.id + '"'), m.id);
    assert.ok(html.includes("tv-winding-path"));
    assert.ok(!html.includes("tv-chapter-choice"));
    assert.ok(!html.includes('href="/course/' + course.slug + '/unit/2"'));
  });
  test("available path nodes are real dialog links and locked path nodes are explanation buttons", () => {
    reset();
    const html = render(view.LivingTrailView);
    for (const m of moments) {
      const marker = 'id="moment-' + m.id + '"',
        start = html.indexOf(marker);
      assert.ok(start >= 0, m.id);
      const section = html.slice(start, html.indexOf("</li>", start));
      if (["locked", "unavailable"].includes(m.status)) {
        assert.ok(section.includes("<button"), m.id);
        assert.ok(!section.includes("<a "), m.id);
      } else {
        assert.ok(section.includes('href="' + escape(m.href) + '"'), m.id);
        assert.ok(section.includes('aria-haspopup="dialog"'), m.id);
      }
    }
  });
  test("winding path visible text has no numbered unit/chapter navigation", () => {
    reset();
    const html = render(view.LivingTrailView);
    const visible = html.replace(/<[^>]*>/g, " ");
    assert.doesNotMatch(visible, /\b(?:unidade|cap[ií]tulo)\s*0?[1-9]/i);
    assert.ok(!html.includes("Escolher capítulo"));
  });
  const owner = course.units.find((u: { lessons: { id: string }[] }) =>
    u.lessons.some((l) => l.id === second.lessonId),
  );
  const realLesson = owner.lessons.find((l: { id: string }) => l.id === second.lessonId);
  const stages = resolveLessonStages(realLesson);
  const selectedStages = stages.filter((s: { id: string }) => second.stageIds.includes(s.id));
  const firstIndex = realLesson.activities.findIndex(
    (a: { id: string }) => a.id === second.activityIds[0],
  );
  const lastIndex = Math.max(
    ...second.activityIds.map((id: string) =>
      realLesson.activities.findIndex((a: { id: string }) => a.id === id),
    ),
  );
  const lessonProps = (index: number, withMoment = true) => ({
    lesson: realLesson,
    unit: owner,
    index,
    onSelect: () => {
      throw Error("SSR must not navigate activities");
    },
    previousLesson: { ...realLesson, slug: "previous-neighbor", title: "PREVIOUS_NEIGHBOR" },
    nextLesson: { ...realLesson, slug: "next-neighbor", title: "NEXT_NEIGHBOR" },
    ...(withMoment ? { trailMoment: second } : {}),
  });
  test("a noninitial moment renders only its actual declared stages, with absolute activity indexing preserved", () => {
    reset();
    assert.ok(firstIndex > 0);
    const html = render(lesson.LessonExperience, lessonProps(firstIndex));
    const nav = html.match(/<nav aria-label="Etapas desta lição">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav);
    assert.equal((nav.match(/<button/g) ?? []).length, selectedStages.length);
    for (const s of selectedStages) assert.ok(nav.includes(escape(s.title)), s.id);
    const selectedTitles = new Set(selectedStages.map((s: { title: string }) => s.title));
    for (const s of stages.filter(
      (s: { id: string; title: string }) =>
        !second.stageIds.includes(s.id) && !selectedTitles.has(s.title),
    ))
      assert.ok(!nav.includes(escape(s.title)), s.id);
    assert.ok(html.includes('data-qa-real-activity-id="' + second.activityIds[0] + '"'));
  });
  test("previous button is disabled at the first activity of a noninitial moment", () => {
    reset();
    const html = render(lesson.LessonExperience, lessonProps(firstIndex));
    const footer = html.match(/<footer class="le-controls">([\s\S]*?)<\/footer>/)?.[1];
    assert.ok(footer);
    assert.match(footer, /<button[^>]*disabled=""[^>]*>/);
  });
  test("previous button remains usable within the selected moment", () => {
    reset();
    const html = render(lesson.LessonExperience, lessonProps(firstIndex + 1));
    const footer = html.match(/<footer class="le-controls">([\s\S]*?)<\/footer>/)?.[1];
    assert.ok(footer);
    const previous = footer.match(/<button[^>]*>/)?.[0];
    assert.ok(previous);
    assert.ok(!previous.includes("disabled"));
  });
  test("last activity returns to the exact path anchor and exposes no next activity/lesson escape", () => {
    reset();
    const html = render(lesson.LessonExperience, lessonProps(lastIndex));
    const footer = html.match(/<footer class="le-controls">([\s\S]*?)<\/footer>/)?.[1];
    assert.ok(footer);
    assert.ok(
      footer.includes(
        'href="' + escape(trailReturnHref(course.slug, owner.number, second.id)) + '"',
      ),
    );
    assert.ok(footer.includes("Voltar ao percurso"));
    assert.ok(!html.includes("PREVIOUS_NEIGHBOR"));
    assert.ok(!html.includes("NEXT_NEIGHBOR"));
  });
  test("legacy lesson without moment context preserves its full stage list", () => {
    reset();
    const html = render(lesson.LessonExperience, lessonProps(0, false));
    const nav = html.match(/<nav aria-label="Etapas desta lição">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav);
    assert.equal((nav.match(/<button/g) ?? []).length, stages.length);
    assert.ok(html.includes("PREVIOUS_NEIGHBOR"));
    assert.ok(html.includes("NEXT_NEIGHBOR"));
  });
  test("pure/SSR examination preserves every observed candidate source byte", () => {
    for (const file of manifest)
      assert.equal(hash(resolve(candidate, file.path)), file.sha256, file.path);
  });
  const completionNavigation = (index: number, emittedActivity: string) => {
    reset();
    const changes: number[] = [];
    render(lesson.LessonExperience, {
      ...lessonProps(index),
      onSelect: (next: number) => {
        changes.push(next);
      },
    });
    const callback = mockContext.activityComplete;
    assert.equal(typeof callback, "function");
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { requestAnimationFrame: () => 0 },
    });
    try {
      (callback as (id: string) => void)(emittedActivity);
    } finally {
      if (previous) Object.defineProperty(globalThis, "window", previous);
      else delete (globalThis as unknown as Record<string, unknown>).window;
    }
    return changes;
  };
  test("real lesson completion callback advances only inside its current moment", () =>
    assert.deepEqual(completionNavigation(firstIndex, second.activityIds[0]), [firstIndex + 1]));
  test("stale or foreign completion event cannot navigate the current moment", () =>
    assert.deepEqual(completionNavigation(firstIndex, "foreign-activity"), []));
  test("completion callback at the final moment activity cannot advance into its neighbor", () =>
    assert.deepEqual(completionNavigation(lastIndex, second.activityIds.at(-1)), []));
  type CapturedCancel = (event: {
    target: object;
    currentTarget: object;
    preventDefault: () => void;
  }) => void;
  const cancelHandler = () => {
    reset();
    render(frame.TrailExperienceFrame, {
      children: React.createElement("section", null, "GUARDED_CHILD"),
    });
    assert.equal(typeof mockContext.cancelHandler, "function");
    mockContext.allowNavigation = true;
    return mockContext.cancelHandler as CapturedCancel;
  };
  test("R3 cancel from a nested context dialog never closes or navigates the outer lesson", () => {
    const cancel = cancelHandler();
    let prevented = 0;
    cancel({
      target: { id: "nested-context" },
      currentTarget: { id: "outer-lesson" },
      preventDefault: () => {
        prevented++;
      },
    });
    assert.deepEqual(mockContext.pushes, []);
    assert.equal(prevented, 0, "Outer frame must leave the nested native cancel untouched");
  });
  test("R3 cancel on the outer lesson still closes toward its exact path anchor", () => {
    const cancel = cancelHandler();
    const outer = { id: "outer-lesson" };
    let prevented = 0;
    cancel({
      target: outer,
      currentTarget: outer,
      preventDefault: () => {
        prevented++;
      },
    });
    assert.equal(prevented, 1);
    assert.deepEqual(mockContext.pushes, [
      [trailReturnHref(course.slug, trail.chapters[0].number, first.id), { scroll: false }],
    ]);
  });
  test("R4 a null official objective score never becomes a naked or fabricated percentage on the path node", () => {
    reset();
    const withoutScore = structuredClone(trail);
    const moment = withoutScore.chapters
      .flatMap((c: { moments: Record<string, unknown>[] }) => c.moments)
      .find((m: { id: string }) => m.id === exam.id);
    assert.ok(moment);
    moment.result = { source: "server", status: "completed", objectiveScore: null, passed: null };
    moment.label = "Concluído";
    moment.historyCount = 1;
    mockContext.journey = { trail: withoutScore, ready: true, continuation: null };
    const html = render(view.LivingTrailView),
      start = html.indexOf('id="moment-' + moment.id + '"');
    assert.ok(start >= 0);
    const visible = html
      .slice(html.lastIndexOf("<li", start), html.indexOf("</li>", start))
      .replace(/<[^>]*>/g, " ");
    assert.ok(!visible.includes("%"));
    assert.ok(visible.includes("Sem nota"));
    assert.ok(visible.includes("tentativa"));
  });
  test("R4 official insufficient null-score attempt remains in progress and never claims completion or percentage", () => {
    reset();
    const assessment = course.assessments.find((a: { id: string }) => a.id === exam.assessmentId);
    assert.ok(assessment);
    const insufficientState = { ...structuredClone(initialStudyState), courseId: course.id };
    insufficientState.assessmentAttempts = [
      {
        id: "qa-insufficient-attempt",
        assessmentId: assessment.id,
        unitId: assessment.unitId,
        courseId: course.id,
        contentVersion: course.contentVersion,
        source: "server",
        method: assessment.method,
        purpose: assessment.purpose,
        status: "insufficient",
        objectiveScore: null,
        passed: null,
        startedAt: "2026-10-28T12:00:00.000Z",
        finishedAt: "2026-10-28T12:01:00.000Z",
        answers: [],
      },
    ];
    const scopedAccess = structuredClone(learningAccess);
    scopedAccess.units[assessment.unitId] = { allowed: true, message: "QA supplied access" };
    scopedAccess.assessments[assessment.id] = { allowed: true, message: "QA supplied access" };
    const operationalCourse = structuredClone(course);
    operationalCourse.availability = {
      ...operationalCourse.availability,
      unavailableAssessmentIds: (
        operationalCourse.availability?.unavailableAssessmentIds ?? []
      ).filter((id: string) => id !== assessment.id),
      actionStates: {
        ...operationalCourse.availability?.actionStates,
        ["assessment." + assessment.method]: { state: "available", reasons: [] },
      },
    };
    const projected = buildLivingTrail(operationalCourse, insufficientState, {
      presentation: findJourneyPresentation(course),
      learningAccess: scopedAccess,
      actionContext: { source: "compiled", permitted: true },
    });
    const moment = projected.chapters
      .flatMap((c: { moments: Record<string, unknown>[] }) => c.moments)
      .find((m: { id: string }) => m.id === exam.id);
    assert.ok(moment);
    assert.equal(moment.result.status, "insufficient");
    assert.equal(moment.result.objectiveScore, null);
    assert.equal(moment.status, "in_progress", JSON.stringify(moment.reasons));
    assert.equal(moment.label, "Em andamento");
    assert.equal(moment.historyCount, 1);
    mockContext.journey = { trail: projected, ready: true, continuation: null };
    const html = render(view.LivingTrailView),
      start = html.indexOf('id="moment-' + moment.id + '"');
    assert.ok(start >= 0);
    const node = html.slice(html.lastIndexOf("<li", start), html.indexOf("</li>", start));
    const visible = node.replace(/<[^>]*>/g, " ");
    assert.ok(visible.includes("Sem nota"));
    assert.ok(visible.includes("tentativa"));
    assert.ok(!visible.includes("%"));
    assert.ok(!visible.includes("Conclu\u00eddo"));
    assert.ok(!node.includes("is-completed"));
  });
  class FakeNativeDialog {
    closed = 0;
    close() {
      this.closed++;
    }
  }
  const capture = (event: object, owner: FakeNativeDialog) => {
    assert.equal(typeof frame.closeNestedTrailDialog, "function");
    const handler = frame.closeNestedTrailDialog as unknown as (
      event: Event,
      owner: HTMLDialogElement,
    ) => void;
    handler(event as Event, owner as unknown as HTMLDialogElement);
  };
  const withDialogConstructor = (action: () => void) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "HTMLDialogElement");
    Object.defineProperty(globalThis, "HTMLDialogElement", {
      configurable: true,
      value: FakeNativeDialog,
    });
    try {
      action();
    } finally {
      if (previous) Object.defineProperty(globalThis, "HTMLDialogElement", previous);
      else delete (globalThis as unknown as Record<string, unknown>).HTMLDialogElement;
    }
  };
  test("R3 capture closes only the child native dialog and consumes its cancel without outer navigation", () =>
    withDialogConstructor(() => {
      cancelHandler();
      const child = new FakeNativeDialog(),
        outer = new FakeNativeDialog();
      let prevented = 0,
        stopped = 0;
      capture(
        {
          target: child,
          currentTarget: outer,
          preventDefault: () => {
            prevented++;
          },
          stopPropagation: () => {
            stopped++;
          },
        },
        outer,
      );
      assert.equal(child.closed, 1);
      assert.equal(outer.closed, 0);
      assert.equal(prevented, 1);
      assert.equal(stopped, 1);
      assert.deepEqual(mockContext.pushes, []);
    }));
  test("R3 capture leaves an outer-dialog cancel to the existing outer handler", () =>
    withDialogConstructor(() => {
      const bubble = cancelHandler();
      const outer = new FakeNativeDialog();
      let prevented = 0,
        stopped = 0;
      const event = {
        target: outer,
        currentTarget: outer,
        preventDefault: () => {
          prevented++;
        },
        stopPropagation: () => {
          stopped++;
        },
      };
      capture(event, outer);
      assert.equal(prevented, 0);
      assert.equal(stopped, 0);
      assert.equal(outer.closed, 0);
      assert.deepEqual(mockContext.pushes, []);
      bubble(event);
      assert.equal(prevented, 1);
      assert.equal(stopped, 0);
      assert.deepEqual(mockContext.pushes, [
        [trailReturnHref(course.slug, trail.chapters[0].number, first.id), { scroll: false }],
      ]);
    }));
  test("R3 capture ignores a foreign non-dialog target without synthetic close or navigation", () =>
    withDialogConstructor(() => {
      cancelHandler();
      const outer = new FakeNativeDialog();
      let prevented = 0,
        stopped = 0;
      capture(
        {
          target: { id: "not-dialog" },
          currentTarget: outer,
          preventDefault: () => {
            prevented++;
          },
          stopPropagation: () => {
            stopped++;
          },
        },
        outer,
      );
      assert.equal(prevented, 0);
      assert.equal(stopped, 0);
      assert.equal(outer.closed, 0);
      assert.deepEqual(mockContext.pushes, []);
    }));
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
