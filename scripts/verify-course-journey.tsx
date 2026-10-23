import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { allCourseBundles } from "../src/content/course-registry";
import { runtimeBundle, type CompiledPackage } from "../src/content/runtime-package";
import { publicCourse } from "../src/content/public";
import { readCourseState } from "../src/domain/study/course-state-storage";
import { courseProgress, courseStudyProgress, unitProgress } from "../src/domain/study/progress";
import { checkpointBrowser } from "./checkpoint-browser.mjs";

async function main() {
  const checks: string[] = [];
  const record = (name: string) => {
    checks.push(name);
    console.log("OK " + name);
  };
  const bundles = [...allCourseBundles()];
  const pilotRoot = process.argv.find((arg) => arg.startsWith("--pilot-root="))?.slice(13);
  if (pilotRoot) {
    for (const id of ["espanhol-a1-pessoal", "ingles-a1-pessoal"])
      bundles.push(
        runtimeBundle(
          JSON.parse(
            readFileSync(resolve(pilotRoot, "src/content/generated/packs", id + ".json"), "utf8"),
          ) as CompiledPackage,
        ),
      );
  }
  for (const bundle of bundles) {
    const course = publicCourse(bundle.course, bundle.language);
    const state = readCourseState(null, course.id, course.languageCode);
    const unit = course.units.find((entry) => entry.active)!;
    const activity = unit.lessons.find((entry) => entry.active)!.activities[0];
    assert.equal(courseStudyProgress(course, state), 0);
    state.completedActivityIds = [activity.id];
    assert.ok(courseStudyProgress(course, state) > 0);
    assert.ok(unitProgress(unit, state, [], course).participationPercentage > 0);
    const first = courseStudyProgress(course, state);
    state.completedActivityIds.push(activity.id, "foreign-activity");
    assert.equal(courseStudyProgress(course, state), first);
    assert.equal(courseStudyProgress(course, { ...state, courseId: "other-course" }), 0);
    const all = course.units
      .filter((entry) => entry.active)
      .flatMap((entry) =>
        entry.lessons
          .filter((lesson) => lesson.active)
          .flatMap((lesson) => lesson.activities.map((item) => item.id)),
      );
    state.completedActivityIds = all.slice(0, -1);
    assert.ok(courseStudyProgress(course, state) < 100);
    state.completedActivityIds = all;
    assert.equal(courseStudyProgress(course, state), 100);
    const unchanged = courseProgress(course, state);
    courseStudyProgress(course, state);
    assert.equal(courseProgress(course, state), unchanged);
    record(`content coverage independent of policy, duplicates and foreign course: ${course.id}`);
    if (
      bundle.coursePackage.units.every((entry) =>
        entry.learningPolicy?.completion.requirements.every((rule) => rule.kind === "assessment"),
      )
    ) {
      assert.equal(
        courseProgress(course, state),
        0,
        "Studying content cannot fabricate a passing final assessment",
      );
      record(`final-only completion policy preserved: ${course.id}`);
    }
  }
  const bundle = bundles[0];
  const props = {
    course: publicCourse(bundle.course, bundle.language),
    language: bundle.language,
    resources: bundle.resources,
  };
  const dir = resolve(".tmp/course-journey");
  mkdirSync(dir, { recursive: true });
  const entry = resolve(dir, "entry.tsx");
  const studyMock = `import {createContext,useContext} from 'react'; export const FixtureStudyContext=createContext(null); export const useStudy=()=>useContext(FixtureStudyContext);`;
  writeFileSync(
    entry,
    `
import React,{useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {FixtureStudyContext} from '@/components/study-provider';
import {AppShell} from '@/components/layout/app-shell';
import {StudyProgressSync} from '@/domain/study/study-progress-sync';
import {readCourseState} from '@/domain/study/course-state-storage';
${existsSync("src/lib/learning-generation-client.ts") ? "import {beginLearningGeneration,configureLearningGeneration} from '@/lib/learning-generation-client';configureLearningGeneration(beginLearningGeneration('synthetic-user'),{userId:'synthetic-user',generation:0,resetting:false});" : ""}
const props=${JSON.stringify(props)};
let remote, sync, waiting, sequence=0, calls=0;
window.journey={routes:[],selected:[],failRead:false};
const clone=value=>structuredClone(value);
const cache={read:()=>({state:null,pending:null,recovery:[]}),write:()=>{}};
function fresh(onboarded=false){const s=readCourseState(null,props.course.id,props.course.languageCode);s.profile={...s.profile,onboarded,onboardingStep:7,selfReportedLevel:'beginner',name:'Synthetic learner'};return s;}
const repository={load:async()=>{if(window.journey.failRead)throw Error('Synthetic read failure');return clone(remote)},save:async(state)=>{calls++;await new Promise((resolve,reject)=>{waiting={resolve:()=>{remote=clone(state);resolve()},reject:()=>reject(Error('Synthetic write failure'))}})}};
const root=createRoot(document.getElementById('root'));
function Fixture(){const snap=useSyncExternalStore(sync.subscribe,sync.getSnapshot,sync.getServerSnapshot);return <FixtureStudyContext.Provider value={{...props,state:snap.state,ready:snap.loadStatus!=='loading',authUserId:snap.userId,progressLoadStatus:snap.loadStatus,syncError:snap.loadError||snap.saveError,pendingProgress:snap.dirty?[snap.state]:[],hasRecoveredProgress:false,vocabularyItems:[],updateProfile:patch=>sync.update(s=>({...s,profile:{...s.profile,...patch}})),recordStudyEvent:(type,activityId,metadata)=>sync.update(s=>({...s,events:[...s.events,{id:crypto.randomUUID(),type,activityId,metadata,createdAt:new Date().toISOString()}]})),flushStudyState:()=>sync.flush(),retryProgressSync:()=>{const g=sync.beginLoading();void sync.load(g,'synthetic-user',repository)}}}><AppShell courseOptions={[{id:props.course.id,title:props.course.title,language:'Current'},{id:'another-course',title:'Outro curso',language:'Synthetic'}]}><h1>Conteúdo do curso</h1></AppShell></FixtureStudyContext.Provider>}
window.journey.reset=async(onboarded=false)=>{waiting=null;calls=0;window.journey.failRead=false;window.journey.routes=[];remote=fresh(onboarded);sync=new StudyProgressSync(()=>fresh(),cache);const g=sync.beginLoading();await sync.load(g,'synthetic-user',repository);root.render(<Fixture key={++sequence}/>)};
window.journey.resolve=()=>{const write=waiting;waiting=null;write.resolve()};
window.journey.reject=()=>{const write=waiting;waiting=null;write.reject()};
window.journey.snapshot=()=>({remote:clone(remote),state:clone(sync.getSnapshot().state),status:sync.getSnapshot().loadStatus,dirty:sync.getSnapshot().dirty,calls,routes:[...window.journey.routes]});
window.journey.reload=async()=>{const g=sync.beginLoading();await sync.load(g,'synthetic-user',repository)};
window.journey.otherUser=async()=>{const g=sync.beginLoading();const other=fresh(true);other.profile.name='Other synthetic learner';await sync.load(g,'another-user',{load:async()=>clone(other),save:async()=>{throw Error('No writes expected for other user')}})};
window.journey.resolveSelection=()=>{window.journey.selectionResolve(new Response(JSON.stringify({error:'Synthetic selection failure'}),{status:503,headers:{'Content-Type':'application/json'}}))};
const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>String(input)==='/api/course/active'?new Promise(resolve=>{window.journey.selected.push(JSON.parse(init.body));window.journey.selectionResolve=resolve}):nativeFetch(input,init);
void window.journey.reset();`,
    "utf8",
  );
  const output = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    tsconfig: resolve("tsconfig.json"),
    define: {
      "process.env.NODE_ENV": '"test"',
      "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '""',
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""',
      "process.env.NEXT_PUBLIC_FEATURE_AI_TUTOR": '"false"',
      "process.env.NEXT_PUBLIC_FEATURE_AI_WRITING": '"false"',
      "process.env.NEXT_PUBLIC_FEATURE_SPEAKING": '"true"',
      "process.env.NEXT_PUBLIC_FEATURE_LISTENING": '"true"',
      "process.env.NEXT_PUBLIC_FEATURE_SPACED_REPETITION": '"true"',
    },
    plugins: [
      {
        name: "synthetic-context",
        setup(builder) {
          builder.onResolve({ filter: /study-provider$/ }, () => ({
            path: "study",
            namespace: "fixture",
          }));
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "fixture",
          }));
          builder.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "fixture",
          }));
          builder.onResolve(
            { filter: /(page-tour|whats-new-dialog|tutor-drawer|selection-audio)$/ },
            () => ({ path: "decorations", namespace: "fixture" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents:
              path === "study"
                ? studyMock
                : path === "navigation"
                  ? `export const usePathname=()=>'/dashboard';export const useRouter=()=>({replace:path=>window.journey.routes.push(path)});export const useSearchParams=()=>new URLSearchParams();`
                  : path === "link"
                    ? `import React from 'react'; export default function Link({children,href,...props}){return <a href={href} {...props}>{children}</a>}`
                    : `export const PageTour=()=>null;export const WhatsNewDialog=()=>null;export const TutorDrawer=()=>null;export const SelectionAudio=()=>null;`,
            loader: "jsx",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  const css = ["globals.css", "pages.css"]
    .map((path) => readFileSync(resolve("src/app", path), "utf8"))
    .join("\n");
  const server = createServer((req, res) => {
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(output.outputFiles[0].text);
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n:root{--font-inter:Arial}</style></head><body><div id="root"></div><script>window.fixtureErrors=[];addEventListener('error',event=>fixtureErrors.push(event.message));addEventListener('unhandledrejection',event=>fixtureErrors.push(String(event.reason)))</script><script src="/bundle.js"></script></body></html>`,
    );
  });
  await new Promise<void>((done) => server.listen(3001, "127.0.0.1", done));
  let browser: Awaited<ReturnType<typeof checkpointBrowser>> | undefined;
  try {
    browser = await checkpointBrowser({ appOrigin: "http://127.0.0.1:3001" });
    const evaluate = (source: string) => browser!.evaluate(source);
    const click = (label: string) =>
      evaluate(
        `[...document.querySelectorAll('button')].find(button=>button.textContent.includes(${JSON.stringify(label)}))?.click()`,
      );
    const waitFor = async (expression: string) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await new Promise((done) => setTimeout(done, 50));
      }
      throw Error(`Timeout: ${expression}`);
    };
    await browser.navigate("/");
    await browser.waitText("Ir para meu curso");
    await click("Ir para meu curso");
    await browser.waitText("Salvando sua configuração");
    assert.equal(await evaluate("window.journey.routes.length"), 0);
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('button')].filter(b=>/Ir para meu curso|Fazer diagnóstico/.test(b.textContent)).every(b=>b.disabled)",
      ),
      true,
    );
    await browser.screenshot("course-journey-onboarding-pending.png");
    await evaluate("window.journey.resolve()");
    await waitFor("window.journey.routes.includes('/dashboard')");
    assert.equal(await evaluate("window.journey.snapshot().remote.profile.onboarded"), true);
    await evaluate("window.journey.reload()");
    await browser.waitText("Conteúdo do curso");
    assert.equal(await evaluate("document.body.textContent.includes('Ir para meu curso')"), false);
    record("onboarding remains mounted while saving and survives confirmed remote reload");

    await evaluate("window.journey.reset()");
    await browser.waitText("Fazer diagnóstico");
    await click("Fazer diagnóstico");
    await browser.waitText("Salvando sua configuração");
    await evaluate("window.journey.reject()");
    await browser.waitText("Não foi possível concluir a configuração");
    assert.equal(await evaluate("window.journey.snapshot().state.profile.onboardingStep"), 7);
    assert.equal(
      await evaluate("window.journey.snapshot().state.profile.selfReportedLevel"),
      "beginner",
    );
    assert.equal(await evaluate("window.journey.routes.length"), 0);
    await click("Fazer diagnóstico");
    await browser.waitText("Salvando sua configuração");
    await evaluate("window.journey.resolve()");
    await waitFor("window.journey.routes.includes('/assessment')");
    record(
      "failed save preserves choices, displays retry, and diagnostic navigates only after acknowledgement",
    );

    await evaluate("window.journey.reset()");
    await browser.waitText("Ir para meu curso");
    await click("Ir para meu curso");
    await browser.waitText("Salvando sua configuração");
    await evaluate("void window.journey.otherUser()");
    await browser.waitText("Preparando seu espaço");
    await evaluate("window.journey.resolve()");
    await browser.waitText("Conteúdo do curso");
    assert.equal(
      await evaluate("window.journey.snapshot().state.profile.name"),
      "Other synthetic learner",
    );
    assert.equal(await evaluate("window.journey.snapshot().state.profile.onboarded"), true);
    assert.equal(await evaluate("window.journey.routes.length"), 0);
    record("obsolete onboarding completion cannot change or navigate a later account session");

    await evaluate("window.journey.reset();");
    await browser.waitText("Ir para meu curso");
    await evaluate("window.journey.failRead=true;window.journey.reload()");
    await browser.waitText("Não foi possível carregar seu progresso");
    assert.equal(await evaluate("document.body.textContent.includes('Ir para meu curso')"), false);
    assert.equal(await evaluate("window.journey.snapshot().calls"), 0);
    record("read failure offers recovery instead of a new onboarding and never writes");

    await evaluate("window.journey.reset(true)");
    await browser.waitText("Conteúdo do curso");
    for (const width of [390, 1280]) {
      await browser.viewport(width, 900);
      assert.equal(await evaluate("innerWidth"), width);
      if (width === 390) await click("Abrir menu");
      await evaluate(
        "(()=>{const select=document.querySelector('.course-switcher select');select.value='another-course';select.dispatchEvent(new Event('change',{bubbles:true}))})()",
      );
      await browser.waitText("Abrindo Outro curso");
      assert.equal(
        await evaluate("document.querySelector('.course-switcher select').disabled"),
        true,
      );
      assert.equal(
        await evaluate("document.querySelector('.course-switcher select').value"),
        "another-course",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.course-transition-notice').getBoundingClientRect().right<=innerWidth",
        ),
        true,
      );
      await browser.screenshot(`course-journey-switch-${width}.png`);
      await waitFor("typeof window.journey.selectionResolve==='function'");
      await evaluate("window.journey.resolveSelection()");
      await browser.waitText("Não foi possível trocar de curso");
      assert.equal(
        await evaluate("document.querySelector('.course-switcher select').disabled"),
        false,
      );
      assert.equal(
        await evaluate("document.querySelector('.course-switcher select').value"),
        props.course.id,
      );
    }
    record(
      "course switch immediately announces target on mobile/desktop and recovers from failure",
    );
    const proof = browser.proof();
    assert.equal(proof.runtimeErrors, 0);
    assert.equal(proof.blockedRequests, 0);
    writeFileSync(
      resolve(dir, "results.json"),
      JSON.stringify(
        {
          checks,
          proof,
          syntheticOnly: true,
          databaseOperations: 0,
          paidCalls: 0,
          limitations: [
            "Mocked repository and routing; not a Supabase transaction or production test.",
            "Real React onboarding/shell and sync controller; browser final navigation and providers not certified.",
          ],
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ checks: checks.length, passed: true, proof }));
  } catch (error) {
    if (browser) {
      writeFileSync(
        resolve(dir, "failure.json"),
        JSON.stringify(
          {
            proof: browser.proof(),
            errors: await browser.evaluate("window.fixtureErrors"),
            text: await browser.evaluate("document.body.textContent.slice(0,2000)"),
          },
          null,
          2,
        ),
      );
      await browser.screenshot("course-journey-failure.png");
    }
    throw error;
  } finally {
    await browser?.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
