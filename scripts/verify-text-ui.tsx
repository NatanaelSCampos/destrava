import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { checkpointBrowser } from "./checkpoint-browser.mjs";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse, publicRequirements } from "../src/content/public";
import { gradeActivity } from "../src/domain/activities/grader";

async function main() {
  const raw = structuredClone(loadContent().find((item) => item.language.id === "xx-Test")!);
  const activity = raw.course.units[0].lessons[0].activities[0];
  activity.type = "ordering";
  activity.payload = {
    words: ["que", "a", "que"],
    answer: "que|a|que",
    answerOrder: [2, 1, 0],
    reconstruction: { strategy: "separator", separator: "|" },
  };
  const writing = raw.course.units[0].lessons[1].activities[0];
  writing.type = "writing";
  writing.payload = {
    guidance: [],
    textRequirement: { measure: { strategy: "graphemes" }, minimum: 2, maximum: 2 },
  };
  const bundle = runtimeBundle(raw),
    course = publicCourse(bundle.course, bundle.language);
  const safe = {
    course,
    resources: bundle.resources,
    language: {
      ...bundle.language,
      capabilityRequirements: publicRequirements(bundle.language.capabilityRequirements),
    },
  };
  const question = course.units[0].lessons[0].activities[0],
    written = course.units[0].lessons[1].activities[0];
  assert(!("answerOrder" in question));
  assert(!("answer" in question));
  const folder = resolve(".tmp/text-ui");
  mkdirSync(folder, { recursive: true });
  const entry = resolve(folder, "entry.tsx");
  writeFileSync(
    entry,
    `import {createRoot} from 'react-dom/client';
import {StudyProvider} from ${JSON.stringify(resolve("src/components/study-provider.tsx"))};
import {ExerciseCard} from ${JSON.stringify(resolve("src/components/activities/exercise-card.tsx"))};
import {WritingEditor} from ${JSON.stringify(resolve("src/components/activities/writing-editor.tsx"))};
const props=${JSON.stringify(safe)};
createRoot(document.getElementById('root')!).render(<StudyProvider {...props}><h1>Text fixture</h1><ExerciseCard activity={${JSON.stringify(question)}}/><WritingEditor activity={${JSON.stringify(written)}}/></StudyProvider>);`,
    "utf8",
  );
  const generated = await build({
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
      "process.env.NEXT_PUBLIC_FEATURE_SPEAKING": '"true"',
      "process.env.NEXT_PUBLIC_FEATURE_LISTENING": '"true"',
      "process.env.NEXT_PUBLIC_FEATURE_SPACED_REPETITION": '"true"',
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""',
      "process.env.NEXT_PUBLIC_FEATURE_AI_TUTOR": '"false"',
      "process.env.NEXT_PUBLIC_FEATURE_AI_WRITING": '"false"',
    },
  });
  let gradeCalls = 0;
  const server = createServer(async (req, res) => {
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.end(generated.outputFiles[0].text);
      return;
    }
    if (req.url === "/api/grade") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      gradeCalls++;
      assert.equal(body.activityId, question.id);
      assert.equal(body.courseId, course.id);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          gradeActivity(
            bundle.course.units[0].lessons[0].activities[0],
            body.answer,
            bundle.language.normalization,
          ),
        ),
      );
      return;
    }
    if (req.url !== "/" && req.url !== "/favicon.ico") {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<!doctype html><meta name="viewport" content="width=device-width"><style>body{font:16px sans-serif;padding:12px}button{margin:4px}textarea{width:90%;max-width:480px}</style><div id="root"></div><script src="/bundle.js"></script>',
    );
  });
  await new Promise<void>((done, failed) => {
    server.once("error", failed);
    server.listen(3001, "127.0.0.1", done);
  });
  let browser: Awaited<ReturnType<typeof checkpointBrowser>> | undefined;
  try {
    browser = await checkpointBrowser({ appOrigin: "http://127.0.0.1:3001" });
    await browser.viewport(390, 844);
    await browser.navigate("/");
    await browser.waitText("Text fixture");
    const click = async (index: number) => {
      await browser!.evaluate(
        `document.querySelectorAll('.ordering-words button.word-chip')[${index}].click();new Promise(r=>setTimeout(r,80))`,
      );
    };
    await click(2);
    assert.deepEqual(
      await browser.evaluate(
        "[...document.querySelectorAll('.ordering-words button.word-chip')].map(x=>x.disabled)",
      ),
      [false, false, true],
    );
    await click(1);
    await click(0);
    assert.equal(
      await browser.evaluate("document.querySelectorAll('.ordering-answer button').length"),
      3,
    );
    await browser.evaluate(
      "document.querySelector('.ordering-answer button').click();new Promise(r=>setTimeout(r,80))",
    );
    assert.deepEqual(
      await browser.evaluate(
        "[...document.querySelectorAll('.ordering-words button.word-chip')].map(x=>x.disabled)",
      ),
      [true, true, false],
    );
    await browser.evaluate("document.querySelector('.retry-button')?.click()");
    // Remove the other selected occurrences and build the canonical response from scratch.
    await browser.evaluate(
      "[...document.querySelectorAll('.ordering-answer button')].forEach(x=>x.click());new Promise(r=>setTimeout(r,80))",
    );
    await click(2);
    await click(1);
    await click(0);
    await browser.evaluate("document.querySelector('.exercise-submit').click()");
    await browser.waitText("Resposta correta.");
    assert.equal(gradeCalls, 1);
    await browser.evaluate(
      "document.querySelector('.retry-button').click();new Promise(r=>setTimeout(r,80))",
    );
    assert.deepEqual(
      await browser.evaluate(
        "[...document.querySelectorAll('.ordering-words button.word-chip')].map(x=>x.disabled)",
      ),
      [false, false, false],
    );
    const input = async (text: string) => {
      await browser!.evaluate(
        `(()=>{const x=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(x,${JSON.stringify(text)});x.dispatchEvent(new Event('input',{bubbles:true}));})() ;new Promise(r=>setTimeout(r,80))`,
      );
    };
    const saveDisabled = () =>
      browser!.evaluate(
        "[...document.querySelectorAll('.writing-editor button')].find(x=>x.textContent.includes('Salvar texto')).disabled",
      );
    await input("e\u0301");
    assert.equal(await saveDisabled(), true);
    await input("e\u0301\u{1f468}\u200d\u{1f469}\u200d\u{1f467}");
    assert.equal(await saveDisabled(), false);
    await browser.waitText("2 grafemas");
    await input("e\u0301\u{1f468}\u200d\u{1f469}\u200d\u{1f467}x");
    assert.equal(await saveDisabled(), true);
    await browser.waitText("3 grafemas");
    const proof = browser.proof();
    assert.equal(proof.blockedRequests, 0);
    assert.equal(proof.runtimeErrors, 0);
    assert.deepEqual(proof.allowedOrigins, ["http://127.0.0.1:3001"]);
    console.log(
      JSON.stringify({
        textUI: "passed",
        realReact: true,
        mobileWidth: 390,
        gradeCalls,
        ...proof,
        paidCalls: 0,
        persistenceCalls: 0,
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
