import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildLivingTrail } from "../src/domain/study/living-trail.ts";
import { requireCourseBundle } from "../src/content/course-registry.ts";
import { publicCourse } from "../src/content/public.ts";
import { initialStudyState } from "../src/domain/study/study-state.ts";
import { trailContinuation, trailLocationKey } from "../src/lib/trail-location.ts";
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const built = await esbuild.build({
  entryPoints: ["src/components/trail/living-trail-view.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "independent-ui-context",
      setup(build) {
        const modules = {
          "@/components/study-provider":
            "export const useStudy=()=>globalThis.__destravaTrailTestContext.study;",
          "./use-living-trail":
            "export const useLivingTrail=()=>globalThis.__destravaTrailTestContext.journey;",
          "next/navigation": "export const useSearchParams=()=>new URLSearchParams();",
          "@/components/navigation-link":
            'import React from "react";export default function Link({children,prefetch,scroll,...props}){return React.createElement("a",props,children)}',
          "next/image":
            'import React from "react";export default function Image(props){return React.createElement("img",props)}',
        };
        build.onResolve({ filter: /.*/ }, (args) =>
          Object.hasOwn(modules, args.path)
            ? { path: args.path, namespace: "trail-test-context" }
            : undefined,
        );
        build.onLoad({ filter: /.*/, namespace: "trail-test-context" }, (args) => ({
          contents: modules[args.path],
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const compiledModule = { exports: {} };
new Function("require", "module", "exports", built.outputFiles[0].text)(
  require,
  compiledModule,
  compiledModule.exports,
);
const { LivingTrailView } = compiledModule.exports;
const bundle = requireCourseBundle("espanol-a-tu-paso-a1");
function context(noExam = true) {
  const course = structuredClone(publicCourse(bundle.course, bundle.language));
  if (noExam) {
    course.assessments = [];
    course.units = [course.units[0]];
    course.units[0].lessons = [course.units[0].lessons[0]];
    course.units[0].assessmentRefs = { formative: [] };
    delete course.units[0].learningPolicy;
    delete course.units[0].access;
  }
  const state = { ...structuredClone(initialStudyState), courseId: course.id };
  const trail = buildLivingTrail(course, state, {
    actionContext: { source: "compiled", permitted: true },
  });
  globalThis.__destravaTrailTestContext = {
    study: { course, state, resources: { structures: [] }, vocabularyItems: [], runtime: null },
    journey: { trail, ready: true, continuation: null },
  };
  return { course, state, trail };
}
test("a generic chapter without an exam describes its real final moment", () => {
  const { trail } = context();
  const html = renderToStaticMarkup(React.createElement(LivingTrailView));
  assert(html.includes(trail.chapters[0].moments.at(-1).title));
  assert(!html.includes("A prova reúne"));
  assert(html.includes("MAIS ADIANTE"));
});
test("an editorial brain icon never creates a retrieval recommendation", () => {
  const { trail } = context();
  trail.chapters[0].moments[0].icon = "brain";
  const html = renderToStaticMarkup(React.createElement(LivingTrailView));
  assert(!html.includes("Abrir uma retomada"));
  assert(!html.includes("revisões disponíveis agora"));
});
test("an official exam retains its entry and access explanation", () => {
  const { trail } = context(false);
  const html = renderToStaticMarkup(React.createElement(LivingTrailView));
  const exam = trail.chapters[0].moments.find((moment) => moment.isExam);
  assert(exam);
  assert(html.includes(exam.title));
  assert(html.includes("MAIS ADIANTE"));
  assert(html.includes("Entender o acesso"));
});
test("a failed official exam remains the next attempt without declaring a pass", () => {
  const { trail } = context(false);
  const exam = trail.chapters[0].moments.find((m) => m.isExam);
  assert(exam);
  exam.status = "completed";
  exam.access = { allowed: true, message: "Available" };
  exam.result = { passed: false, status: "completed", source: "server" };
  trail.currentMomentId = exam.id;
  const next = trailContinuation(trail, null, []);
  assert.equal(next?.moment.id, exam.id);
  assert(next.href.startsWith("/assessment?assessmentId="));
  assert.equal(next.moment.result.passed, false);
});
test("navigation checkpoints stay separate across owner version source and installation", () => {
  const scope = {
    userId: "synthetic-a",
    courseId: "course",
    contentVersion: "1",
    source: "compiled",
  };
  const original = trailLocationKey(scope);
  for (const changed of [
    { userId: "synthetic-b" },
    { contentVersion: "2" },
    { source: "installed" },
    { source: "installed", installationId: "installation", artifactHash: "a".repeat(64) },
  ])
    assert.notEqual(trailLocationKey({ ...scope, ...changed }), original);
});
