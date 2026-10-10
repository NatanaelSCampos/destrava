import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { checkpointBrowser } from "./checkpoint-browser.mjs";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse } from "../src/content/public";

async function main() {
  const raw = structuredClone(loadContent().find((item) => item.language.id === "en")!);
  raw.course.schemaVersion = "1.4";
  raw.course.defaultVariant = "en-GB";
  const activity = raw.course.units
    .flatMap((u) => u.lessons.flatMap((l) => l.activities))
    .find((a) => a.type === "listening")!;
  activity.variant = { requiredVariant: "en-GB" };
  const speaking = raw.course.units
    .flatMap((u) => u.lessons.flatMap((l) => l.activities))
    .find((a) => a.type === "speaking")!;
  speaking.variant = { requiredVariant: "en-GB" };
  raw.language.speech.providers.azure["en-GB"].assessmentLocale = null;
  const bundle = runtimeBundle(raw);
  const safe = {
    course: publicCourse(bundle.course, bundle.language),
    resources: bundle.resources,
    language: bundle.language,
  };
  const publicActivity = safe.course.units
    .flatMap((u) => u.lessons.flatMap((l) => l.activities))
    .find((a) => a.id === activity.id)!;
  assert(!("answer" in publicActivity));
  assert(!("answerPolicy" in publicActivity));
  const publicSpeaking = safe.course.units
    .flatMap((u) => u.lessons.flatMap((l) => l.activities))
    .find((a) => a.id === speaking.id)!;
  const dir = resolve(".tmp/variants-ui");
  mkdirSync(dir, { recursive: true });
  const entry = resolve(dir, "entry.tsx");
  writeFileSync(
    entry,
    `import {createRoot} from 'react-dom/client';
import {StudyProvider, useStudy} from ${JSON.stringify(resolve("src/components/study-provider.tsx"))};
import {SpeakButton} from ${JSON.stringify(resolve("src/components/audio/speak-button.tsx"))};
import {ActivityRenderer} from ${JSON.stringify(resolve("src/components/activities/activity-renderer.tsx"))};
const props=${JSON.stringify(safe)};
function Fixture(){const {state,updateProfile}=useStudy();return <><h1>Variant fixture</h1><p id="preference">{state.profile.variantId||'course default'}</p><button id="prefer-us" onClick={()=>updateProfile({variantId:'en-US'})}>Choose preference</button><section id="normal"><SpeakButton text="Synthetic sentence" withLabel/></section><section id="strict"><SpeakButton text="Synthetic sentence" withLabel variant={{requiredVariant:'en-GB'}}/></section><ActivityRenderer activity={${JSON.stringify(publicActivity)}}/><ActivityRenderer activity={${JSON.stringify(publicSpeaking)}}/></>}
createRoot(document.getElementById('root')!).render(<StudyProvider {...props}><Fixture/></StudyProvider>);`,
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
  let apiCalls = 0;
  const server = createServer((req, res) => {
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.end(output.outputFiles[0].text);
      return;
    }
    if (req.url?.startsWith("/api/")) {
      apiCalls++;
      res.statusCode = 500;
      res.end();
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><meta name="viewport" content="width=device-width"><style>body{font:16px sans-serif;margin:12px}.panel{padding:12px}button{margin:4px}</style><div id="root"></div><script>
window.mockVoices=[{lang:'en-US',voiceURI:'voice-us',name:'Test US'}];window.spoken=[];
const synthesis=new EventTarget();synthesis.getVoices=()=>window.mockVoices;synthesis.cancel=()=>{};synthesis.speak=(utterance)=>window.spoken.push({lang:utterance.lang,text:utterance.text});
Object.defineProperty(window,'speechSynthesis',{value:synthesis,configurable:true});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text}},configurable:true});
</script><script src="/bundle.js"></script>`);
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(3001, "127.0.0.1", done);
  });
  let browser: Awaited<ReturnType<typeof checkpointBrowser>> | undefined;
  try {
    browser = await checkpointBrowser({ appOrigin: "http://127.0.0.1:3001" });
    await browser.viewport(390, 844);
    await browser.navigate("/");
    await browser.waitText("Variant fixture");
    await browser.waitText("A avaliação de pronúncia não está disponível");
    assert.equal(
      await browser.evaluate(
        "document.querySelector('.speaking-recorder .primary-button').disabled",
      ),
      false,
    );
    await browser.waitText("ATIVIDADE INDISPONÍVEL");
    await browser.evaluate(
      "document.querySelector('#normal button').click();new Promise(r=>setTimeout(r,80))",
    );
    await browser.waitText("outra variante");
    assert.equal(await browser.evaluate("window.spoken.length"), 1);
    assert.equal(await browser.evaluate("window.spoken[0].lang"), "en-US");
    await browser.evaluate(
      "document.querySelector('#strict button').click();new Promise(r=>setTimeout(r,80))",
    );
    await browser.waitText("Não há voz compatível");
    assert.equal(await browser.evaluate("window.spoken.length"), 1);
    await browser.evaluate(
      "window.mockVoices.push({lang:'en-GB',voiceURI:'voice-gb',name:'Test GB'});window.speechSynthesis.dispatchEvent(new Event('voiceschanged'));new Promise(r=>setTimeout(r,100))",
    );
    assert.equal(
      await browser.evaluate("document.body.textContent.includes('ATIVIDADE INDISPONÍVEL')"),
      false,
    );
    await browser.evaluate(
      "document.querySelector('#prefer-us').click();new Promise(r=>setTimeout(r,100))",
    );
    assert.equal(
      await browser.evaluate("document.querySelector('#preference').textContent"),
      "en-US",
    );
    await browser.waitText("Sua preferência geral permanece salva");
    await browser.evaluate(
      "document.querySelector('#strict button').click();new Promise(r=>setTimeout(r,80))",
    );
    assert.equal(await browser.evaluate("window.spoken.at(-1).lang"), "en-GB");
    assert.equal(
      await browser.evaluate("document.querySelector('#preference').textContent"),
      "en-US",
    );
    assert.equal(apiCalls, 0);
    const proof = browser.proof();
    assert.equal(proof.blockedRequests, 0);
    assert.equal(proof.runtimeErrors, 0);
    assert.deepEqual(proof.allowedOrigins, ["http://127.0.0.1:3001"]);
    console.log(
      JSON.stringify({
        variantUI: "passed",
        realReact: true,
        mobileWidth: 390,
        speechProvider: "mock",
        paidCalls: 0,
        persistenceCalls: 0,
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
