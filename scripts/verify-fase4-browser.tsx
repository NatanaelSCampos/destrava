import { writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { runNarrationBrowser, syntheticSpeechSetup } from "./ciclo2-narration-browser";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { allCourseBundles } from "../src/content/course-registry";
import { publicCourse } from "../src/content/public";
import { readCourseState } from "../src/domain/study/course-state-storage";
import { SupabaseStudyRepository } from "../src/repositories/supabase-study-repository";
import { checkpointBrowser } from "./checkpoint-browser.mjs";
import {
  assertLocalDocker,
  localEnvironment,
  localApi,
  localApp,
  localFetch,
  workspace,
} from "./local-environment.mjs";

async function main() {
  const env = localEnvironment();
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, localApi);
  const isolation = assertLocalDocker();
  assert(!process.env.OPENAI_API_KEY && !process.env.AZURE_SPEECH_KEY);
  const admin = createClient(localApi, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: localFetch },
  });
  const bundle = allCourseBundles().find((entry) => entry.coursePackage.interactiveLessons.length);
  assert(bundle, "Compiled classroom fixture required");
  const definition = bundle.coursePackage.interactiveLessons[0];
  const email = `fase4-browser-${randomUUID()}@example.test`;
  const password = `Synthetic-${randomUUID()}!`;
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(account.error, null);
  assert(account.data.user);
  const cookies = new Map<string, string>();
  const client = createServerClient(localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach(({ name, value }) => cookies.set(name, value)),
    },
    global: { fetch: localFetch },
  });
  assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
  const state = readCourseState(null, bundle.course.id, bundle.course.languageCode);
  state.profile = { ...state.profile, onboarded: true, onboardingStep: 0 };
  await new SupabaseStudyRepository(client, account.data.user.id).save(
    state,
    publicCourse(bundle.course, bundle.language),
    bundle.resources.vocabulary,
  );
  const browser = await checkpointBrowser();
  await browser.viewport(1280,900);
  let checks = 0;
  let syntheticMedia: string | null = null;
  if(process.env.C2_LOCAL_JOURNEY === "1") {
    syntheticMedia=`c2-synthetic-${randomUUID()}.wav`;
    const wav=Buffer.alloc(320044);wav.write("RIFF",0);wav.writeUInt32LE(wav.length-8,4);wav.write("WAVEfmt ",8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write("data",36);wav.writeUInt32LE(wav.length-44,40);
    writeFileSync(resolve(workspace,"public",syntheticMedia),wav);
  }
  async function until(expression: string, label: string, attempts = 180, dismiss = false) {
    for (let count = 0; count < attempts; count++) {
      if (dismiss) await dismissOverlays();
      const value = await browser.evaluate(expression);
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    console.error(
      JSON.stringify(
        await browser.evaluate(`({visibility:document.visibilityState,
    sliders:[...document.querySelectorAll('input[type=range]')].map(e=>({value:e.value,max:e.max})),
    alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent),
    buttons:[...document.querySelectorAll('.live-page button')].map(e=>({text:e.textContent.trim(),disabled:e.disabled}))})`),
      ),
    );
    await browser.screenshot("fase4-browser-failure.png");
    throw new Error(`Browser condition not reached: ${label}`);
  }
  async function click(text: string) {
    await dismissOverlays();
    const expression = `(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)return false;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return x>0&&x<innerWidth&&y>0&&y<innerHeight&&b.contains(document.elementFromPoint(x,y))?{x,y}:false})()`;
    const point = (await until(expression, `reachable enabled ${text}`, 180, true)) as {
      x: number;
      y: number;
    };
    await browser.pointerClick(point.x, point.y);
  }
  async function dismissOverlays() {
    // Follow the actual first-visit controls instead of clicking through a dialog.
    await browser.key("Escape");
    await browser.evaluate(
      "document.querySelector('.page-tour-close')?.click();document.querySelector('button[aria-label=\"Fechar menu\"]')?.click()",
    );
  }
  try {
    if (process.env.C2_LOCAL_JOURNEY === "1") await browser.initScript(syntheticSpeechSetup);
    await browser.cookies([...cookies].map(([name, value]) => ({ name, value })));
    await browser.cookies([{ name: "destrava-active-course", value: bundle.course.id }]);
    await browser.navigate(`/live-classes?lesson=${encodeURIComponent(definition.id)}`);
    await browser.waitText(definition.title);
    await browser.evaluate("document.querySelector('.page-tour-close')?.click()");
    await click("Iniciar aula");
    await browser.waitText("Próxima etapa");
    if (process.env.C2_LOCAL_JOURNEY === "1") checks += await runNarrationBrowser(browser, click, until, "/"+syntheticMedia!);
    for (const segment of definition.segments) {
      if (segment.type === "checkpoint") break;
      if (segment.presentation) {
        await until(
          `document.querySelector('input[aria-label="Posição da apresentação"]')?.getAttribute('max') === ${JSON.stringify(String(segment.presentation.durationMs))}`,
          "current authored presentation loaded",
        );
        // Each authored presentation starts paused after NEXT; use its actual play control.
        await browser.evaluate(
          "document.querySelector('button[aria-label=\"Reproduzir aula\"]')?.click()",
        );
      }
      await click("Próxima etapa");
    }
    await browser.waitText("Confira o que aprendeu");
    await until(
      "[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Próxima etapa')&&b.disabled)",
      "checkpoint blocks progression before evidence",
    );
    checks++;
    for (const width of [390, 360]) {
      await browser.viewport(width, 844);
      await dismissOverlays();
      await until(
        "!document.querySelector('.whats-new-dialog,[role=dialog]')",
        "first-visit overlays dismissed",
      );
      await until(
        "(document.querySelector('.sidebar')?.getBoundingClientRect().right ?? 0) <= 1",
        "mobile menu transition finished",
      );
      await browser.evaluate(
        "document.getElementById('live-activity')?.scrollIntoView({block:'start'})",
      );
      const dimensions = (await browser.evaluate(
        "({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})",
      )) as { width: number; scrollWidth: number };
      if (dimensions.width !== width)
        console.error(
          JSON.stringify(
            await browser.evaluate(
              `Array.from(document.querySelectorAll('.live-page *')).filter(e=>e.getBoundingClientRect().right>${width}+1).slice(0,16).map(e=>({className:e.className,width:e.getBoundingClientRect().width,grid:getComputedStyle(e).gridTemplateColumns}))`,
            ),
          ),
        );
      assert.equal(
        dimensions.width,
        width,
        `Mobile layout must retain the requested ${width}px viewport: ${JSON.stringify(dimensions)}`,
      );
      assert(await browser.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"));
      await browser.screenshot(`fase4-classroom-${width}.png`);
      checks++;
    }
    await browser.navigate(`/live-classes?lesson=${encodeURIComponent(definition.id)}`);
    await browser.waitText("Confira o que aprendeu");
    assert(
      await browser.evaluate(
        "[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Próxima etapa')&&b.disabled)",
      ),
    );
    checks++;
    const response = await localFetch(
      `${localApp}/api/interactive-lessons/session?courseId=${encodeURIComponent(bundle.course.id)}&lessonId=${encodeURIComponent(definition.lessonId)}`,
      {
        headers: { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") },
      },
    );
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert(saved.session);
    assert.equal(saved.session.runtime_state.phase, "checkpoint");
    checks++;
    const checkpoint = definition.segments.find((segment) => segment.type === "checkpoint");
    const activity = bundle.course.units
      .flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
      .find((item) => item.id === checkpoint?.activityRef);
    assert(
      activity?.type === "fill_blank" || activity?.type === "short_answer",
      "This browser gate requires the compiled text checkpoint fixture",
    );
    await until(
      `Boolean(document.getElementById(${JSON.stringify(`answer-${activity.id}`)}))`,
      "answer input",
    );
    await browser.evaluate(
      `document.getElementById(${JSON.stringify(`answer-${activity.id}`)}).focus()`,
    );
    await browser.insertText(activity.answer);
    await click("Verificar resposta");
    await until(
      "[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Próxima etapa')&&!b.disabled)",
      "server-acknowledged checkpoint allows progression",
    );
    checks++;
    await browser.navigate(`/live-classes?lesson=${encodeURIComponent(definition.id)}`);
    await browser.waitText("Confira o que aprendeu");
    await until(
      "[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Próxima etapa')&&!b.disabled)",
      "checkpoint approval survives reload",
    );
    checks++;
    const anonymous = await localFetch(
      `${localApp}/api/interactive-lessons/session?courseId=${encodeURIComponent(bundle.course.id)}&lessonId=${encodeURIComponent(definition.lessonId)}`,
    );
    assert.equal(anonymous.status, 401);
    checks++;
    const proof = browser.proof();
    assert.equal(proof.blockedRequests, 0);
    assert.equal(proof.runtimeErrors, 0);
    console.log(
      JSON.stringify({
        checks,
        isolation,
        browser: proof,
        mobileWidths: [390, 360],
        syntheticUsersPreserved: 1,
        paidCalls: 0,
        limitations: [
          "No real microphone or acoustic evaluation; multi-checkpoint fixture is covered separately by independent QA.",
        ],
      }),
    );
  } catch(error) {
    await browser.screenshot("ciclo2-narration-failure.png");
    console.error(JSON.stringify(await browser.evaluate("({path:location.pathname,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent),buttons:[...document.querySelectorAll('.live-page button')].map(e=>({text:e.textContent.trim(),disabled:e.disabled}))})")));
    throw error;
  } finally {
    await browser.close();
    if(syntheticMedia) {
      assert(/^c2-synthetic-[a-f0-9-]+\.wav$/.test(syntheticMedia));
      renameSync(resolve(workspace,"public",syntheticMedia),resolve(workspace,".tmp",syntheticMedia));
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
