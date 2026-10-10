import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { checkpointBrowser } from "./checkpoint-browser.mjs";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse } from "../src/content/public";
import { allActivities } from "../src/content/schema";
import { gradeActivity } from "../src/domain/activities/grader";
import { emptyBoard, applyBoardAction } from "../src/domain/interactive-lesson/runtime";

async function main() {
  const raw = structuredClone(loadContent().find((item) => item.language.id === "xx-Test")!);
  raw.language.writingSystem.direction = "rtl";
  raw.language.writingSystem.scripts = ["Hebr", "Arab", "Latn"];
  raw.course.schemaVersion = "1.5";
  const owner = raw.course.units[0].lessons[0],
    base = owner.activities[0];
  const ordering = {
    ...structuredClone(base),
    id: "synthetic.rtl.ordering",
    title: "Ordenação RTL",
    type: "ordering" as const,
    payload: {
      words: ["שלום", "ABC-12", "שלום"],
      answer: "שלום / ABC-12 / שלום",
      answerOrder: [0, 1, 2],
      reconstruction: { strategy: "separator", separator: " / " },
    },
    presentation: {
      fields: {
        prompt: { language: "pt-BR", direction: "ltr" as const },
        tokens: { direction: "auto" as const },
      },
    },
  };
  const short = {
    ...structuredClone(base),
    id: "synthetic.rtl.short",
    title: "Resposta RTL",
    type: "short_answer" as const,
    payload: { answer: "سلام 42", accepted: [] },
    presentation: { fields: { input: { direction: "rtl" as const } } },
  };
  const writing = {
    ...structuredClone(base),
    id: "synthetic.rtl.writing",
    title: "Escrita RTL",
    type: "writing" as const,
    payload: {
      guidance: ["Digite e revise antes de salvar."],
      textRequirement: { measure: { strategy: "graphemes" }, minimum: 2, maximum: 300 },
    },
  };
  owner.activities.push(ordering, short, writing);
  const bundle = runtimeBundle(raw),
    course = publicCourse(bundle.course, bundle.language);
  const safeActivities = course.units.flatMap((u) => u.lessons.flatMap((l) => l.activities));
  const find = (id: string) => safeActivities.find((a) => a.id === id)!;
  let board = applyBoardAction(emptyBoard, {
    type: "board.show",
    element: {
      kind: "comparison",
      id: "mixed",
      left: "ABC-12 (42)",
      right: "שלום (42)",
      leftPresentation: { language: "en", direction: "ltr" },
      rightPresentation: { direction: "rtl" },
    },
  });
  board = applyBoardAction(board, {
    type: "board.show",
    element: {
      kind: "example",
      id: "rtl-example",
      text: "مرحبا ABC-12 (42)",
      translation: "Tradução em português.",
    },
  });
  board = applyBoardAction(board, {
    type: "caption.show",
    text: "שלום ABC (42)",
    textPresentation: { direction: "rtl" },
  });
  const dir = resolve(".tmp/presentation-ui");
  mkdirSync(dir, { recursive: true });
  const entry = resolve(dir, "entry.tsx");
  const props = { course, language: bundle.language, resources: bundle.resources };
  const unavailable = {
    ...publicCourse(bundle.course, bundle.language, {
      capabilities: {
        "presentation.bidi": { state: "unavailable", reason: "Synthetic renderer failure" },
      },
    }),
    id: "synthetic.unavailable",
  };
  writeFileSync(
    entry,
    `import {createRoot} from 'react-dom/client';
import {StudyProvider,useStudy} from ${JSON.stringify(resolve("src/components/study-provider.tsx"))};
import {ActivityRenderer} from ${JSON.stringify(resolve("src/components/activities/activity-renderer.tsx"))};
import {LearningText} from ${JSON.stringify(resolve("src/components/learning/text-presentation.tsx"))};
import {LearningBoard} from ${JSON.stringify(resolve("src/components/interactive-lesson/learning-board.tsx"))};
function Probe(){const {state}=useStudy();return <output id="saved-value">{JSON.stringify(state.writing.map(x=>x.text))}</output>}
function App(){return <StudyProvider {...${JSON.stringify(props)}}><div className="fixture"><header id="ui-controls" lang="pt-BR" dir="ltr"><h1>Apresentação multilíngue</h1><button id="ui-action">Próxima atividade</button></header><section id="samples" className="panel"><LearningText as="p" id="rtl-sample" text="שלום ABC-12 (42)"/><LearningText as="p" id="ltr-in-rtl" presentation={{content:{language:'en',direction:'ltr'}}} text="English ABC-12 (42)"/><LearningText as="p" id="unknown" textRole="user" text="مرحبا ABC"/><div id="external"><span id="before">Antes:</span><LearningText id="suspicious" text={'ABC\\u202E12'.replace('\\u202E','\u202E')}/><span id="after">Depois.</span></div><LearningText as="p" id="escaped" text={'<img src=x onerror=alert(1)>'}/></section><section id="ordering"><ActivityRenderer activity={${JSON.stringify(find(ordering.id))}}/></section><section id="short"><ActivityRenderer activity={${JSON.stringify(find(short.id))}}/></section><section id="writing"><ActivityRenderer activity={${JSON.stringify(find(writing.id))}}/></section><section id="board" className="live-board"><LearningBoard board={${JSON.stringify(board)}} showTranslation/></section><section id="ltr-parent" dir="rtl"><LearningText as="p" id="explicit-ltr" presentation={{content:{language:'en',direction:'ltr'}}} text="ABC 12 (34)"/></section><section id="unavailable"><StudyProvider {...${JSON.stringify({ ...props, course: unavailable })}}><ActivityRenderer activity={${JSON.stringify(find(short.id))}}/></StudyProvider></section><Probe/></div></StudyProvider>}
createRoot(document.getElementById('root')!).render(<App/>);`,
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
      "process.env.NEXT_PUBLIC_FEATURE_SPEAKING": '"true"',
      "process.env.NEXT_PUBLIC_FEATURE_LISTENING": '"true"',
      "process.env.NEXT_PUBLIC_FEATURE_SPACED_REPETITION": '"true"',
      "process.env.NEXT_PUBLIC_FEATURE_AI_TUTOR": '"false"',
      "process.env.NEXT_PUBLIC_FEATURE_AI_WRITING": '"false"',
    },
  });
  const css = [
    "globals.css",
    "pages.css",
    "activities.css",
    "learning-text.css",
    "live-classes/live-classes.css",
  ]
    .map((p) => readFileSync(resolve("src/app", p), "utf8"))
    .join("\n");
  let gradeCalls = 0;
  const server = createServer(async (req, res) => {
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.end(output.outputFiles[0].text);
      return;
    }
    if (req.url === "/style.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(
        css +
          "\n:root{--font-inter:Arial}.fixture{padding:12px;max-width:900px;margin:auto}.fixture>section{margin-block:12px}output{display:block;overflow-wrap:anywhere}#samples{padding:12px}",
      );
      return;
    }
    if (req.url === "/api/grade") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const input = JSON.parse(Buffer.concat(chunks).toString());
      assert.equal(input.courseId, course.id);
      const activity = allActivities(bundle.course).find((a) => a.id === input.activityId)!;
      gradeCalls++;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          gradeActivity(activity, input.answer, bundle.language.normalization, {
            language: bundle.language,
            course: bundle.course,
          }),
        ),
      );
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<!doctype html><html lang="pt-BR" dir="ltr"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
    );
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(3001, "127.0.0.1", done);
  });
  let browser: Awaited<ReturnType<typeof checkpointBrowser>> | undefined;
  const findings: string[] = [];
  try {
    browser = await checkpointBrowser({ appOrigin: "http://127.0.0.1:3001" });
    await browser.viewport(390, 844);
    await browser.navigate("/");
    await browser.waitText("Apresentação multilíngue");
    const dom = await browser.evaluate(
      "(()=>{const x=id=>document.getElementById(id);return {interface:document.documentElement.dir,rtl:x('rtl-sample').dir,ltr:x('ltr-in-rtl').dir,explicit:x('explicit-ltr').dir,unknown:x('unknown').dir,lang:x('ltr-in-rtl').lang,bidi:getComputedStyle(x('rtl-sample')).unicodeBidi,escaped:x('escaped').querySelectorAll('img').length,before:x('before').textContent,after:x('after').textContent,controls:x('suspicious').textContent.includes('U+202E')};})()",
    );
    assert.deepEqual(dom, {
      interface: "ltr",
      rtl: "rtl",
      ltr: "ltr",
      explicit: "ltr",
      unknown: "auto",
      lang: "en",
      bidi: "isolate",
      escaped: 0,
      before: "Antes:",
      after: "Depois.",
      controls: true,
    });
    findings.push("directions, isolation, mixed text and safe HTML");
    assert.equal(
      await browser.evaluate(
        "document.querySelector('#unavailable').textContent.includes('ATIVIDADE INDISPONÍVEL')",
      ),
      true,
    );
    assert.equal(
      await browser.evaluate("document.querySelectorAll('#unavailable .exercise-submit').length"),
      0,
    );
    assert.equal(await browser.evaluate("document.querySelector('#short input').dir"), "rtl");
    assert.equal(
      await browser.evaluate("document.querySelector('#short input').hasAttribute('placeholder')"),
      false,
    );
    assert.equal(
      await browser.evaluate("document.querySelector('#short [data-input-hint]').dir"),
      "ltr",
    );
    assert.equal(
      await browser.evaluate(
        "document.querySelector('#short input').getAttribute('aria-describedby').includes(document.querySelector('#short [data-input-hint]').id)",
      ),
      true,
    );
    const edit = async (selector: string, text: string) => {
      await browser!.evaluate(
        `(()=>{const x=document.querySelector(${JSON.stringify(selector)});x.focus();Object.getOwnPropertyDescriptor(x instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(x,${JSON.stringify(text)});x.dispatchEvent(new Event('input',{bubbles:true}));})() ;new Promise(r=>setTimeout(r,80))`,
      );
    };
    await edit("#short input", "سلام 42");
    await browser.evaluate(
      "document.querySelector('#short input').dispatchEvent(new CompositionEvent('compositionstart',{data:'س',bubbles:true}));new Promise(r=>setTimeout(r,80))",
    );
    assert.equal(
      await browser.evaluate("document.querySelector('#short .exercise-submit').disabled"),
      true,
    );
    await browser.evaluate(
      "document.querySelector('#short input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true,cancelable:true}));new Promise(r=>setTimeout(r,80))",
    );
    assert.equal(gradeCalls, 0);
    await browser.evaluate(
      "document.querySelector('#short input').dispatchEvent(new CompositionEvent('compositionend',{data:'سلام',bubbles:true}));new Promise(r=>setTimeout(r,80))",
    );
    await browser.key("Enter", "Enter", { windowsVirtualKeyCode: 13 });
    await browser.waitText("Resposta correta.");
    assert.equal(gradeCalls, 1);
    findings.push("IME guard and native Enter after composition");
    await edit("#writing textarea", "שלום ABC-12 (42)\ne\u0301你好");
    const original = await browser.evaluate("document.querySelector('#writing textarea').value");
    assert.equal(original, "שלום ABC-12 (42)\ne\u0301你好");
    assert.equal(await browser.evaluate("document.querySelector('#writing textarea').dir"), "auto");
    assert.equal(
      await browser.evaluate(
        "getComputedStyle(document.querySelector('#writing textarea')).unicodeBidi",
      ),
      "plaintext",
    );
    await browser.evaluate(
      "document.querySelector('#writing textarea').setSelectionRange(0,4,'forward')",
    );
    assert.deepEqual(
      await browser.evaluate(
        "(()=>{const x=document.querySelector('#writing textarea');return [x.selectionStart,x.selectionEnd,x.value.slice(x.selectionStart,x.selectionEnd)];})()",
      ),
      [0, 4, "שלום"],
    );
    await browser.insertText("مرحبا");
    assert.equal(
      await browser.evaluate("document.querySelector('#writing textarea').value"),
      "مرحبا ABC-12 (42)\ne\u0301你好",
    );
    const caret = await browser.evaluate(
      "document.querySelector('#writing textarea').selectionStart",
    );
    await browser.key("ArrowLeft", "ArrowLeft", { windowsVirtualKeyCode: 37 });
    assert.notEqual(
      await browser.evaluate("document.querySelector('#writing textarea').selectionStart"),
      caret,
    );
    findings.push("real browser selection, caret and insertion preserve logical text");
    await browser.evaluate(
      "[...document.querySelectorAll('#writing button')].find(x=>x.textContent.includes('Salvar texto')).click();new Promise(r=>setTimeout(r,100))",
    );
    assert.deepEqual(
      JSON.parse(
        (await browser.evaluate("document.getElementById('saved-value').textContent")) as string,
      ),
      ["مرحبا ABC-12 (42)\ne\u0301你好"],
    );
    findings.push("raw Unicode save and 5A measurement");
    await browser.evaluate(
      "document.querySelector('#ordering .ordering-words button.word-chip').focus()",
    );
    await browser.key("Tab", "Tab", { windowsVirtualKeyCode: 9 });
    assert.equal(
      await browser.evaluate("document.activeElement.getAttribute('data-token-id')"),
      JSON.stringify([ordering.id, 1]),
    );
    for (const index of [0, 1, 2]) {
      await browser.evaluate(
        `document.querySelectorAll('#ordering .ordering-words button.word-chip')[${index}].focus()`,
      );
      await browser.key("Enter", "Enter", { windowsVirtualKeyCode: 13 });
      await browser.evaluate("new Promise(r=>setTimeout(r,80))");
    }
    assert.deepEqual(
      await browser.evaluate(
        "[...document.querySelectorAll('#ordering .ordering-answer button')].map(x=>x.getAttribute('data-token-id'))",
      ),
      [0, 1, 2].map((i) => JSON.stringify([ordering.id, i])),
    );
    const rects = (await browser.evaluate(
      "[...document.querySelectorAll('#ordering .ordering-answer button')].map(x=>({x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y}))",
    )) as Array<{ x: number; y: number }>;
    assert(rects[0].x > rects[1].x && rects[1].x > rects[2].x);
    assert.equal(rects[0].y, rects[2].y);
    assert.equal(
      await browser.evaluate(
        "getComputedStyle(document.querySelector('#ordering .ordering-answer')).flexDirection",
      ),
      "row",
    );
    await browser.evaluate("document.querySelector('#ordering .exercise-submit').click()");
    await browser.waitText("Muito bem! Resposta correta.");
    assert.equal(gradeCalls, 2);
    findings.push("keyboard ordering, repeated IDs and RTL geometry without reversed data");
    assert.deepEqual(
      await browser.evaluate(
        "[...document.querySelectorAll('#board [data-learning-text]')].map(x=>x.dir)",
      ),
      ["ltr", "rtl", "rtl", "auto", "rtl"],
    );
    for (const width of [360, 390, 768]) {
      await browser.viewport(width, 844);
      const metrics = await browser.evaluate(
        "({inner:window.innerWidth,scroll:document.documentElement.scrollWidth,visual:window.visualViewport.width,height:window.innerHeight})",
      );
      console.log(JSON.stringify({ requestedWidth: width, metrics }));
      assert.equal((metrics as { inner: number }).inner, width);
      assert.equal(
        await browser.evaluate("document.documentElement.scrollWidth<=window.innerWidth"),
        true,
      );
    }
    await browser.viewport(390, 844);
    await browser.evaluate(
      "document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)",
    );
    await browser.screenshot("presentation-rtl-390.png");
    await browser.evaluate("document.getElementById('ordering').scrollIntoView()");
    await browser.screenshot("presentation-ordering-390.png");
    await browser.evaluate(
      "document.getElementById('writing').scrollIntoView({block:'start'});new Promise(r=>setTimeout(r,80))",
    );
    await browser.screenshot("presentation-writing-390.png");
    const proof = browser.proof();
    assert.equal(proof.blockedRequests, 0);
    assert.equal(proof.runtimeErrors, 0);
    assert.deepEqual(proof.allowedOrigins, ["http://127.0.0.1:3001"]);
    console.log(
      JSON.stringify({
        presentationUI: "passed",
        findings,
        mobileWidths: [360, 390, 768],
        composition: "synthetic events; native system IME not certified",
        gradeCalls,
        paidCalls: 0,
        persistence: "local memory/cache only",
        ...proof,
      }),
    );
  } finally {
    if (browser) await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
