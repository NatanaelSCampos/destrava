import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Installation } from "../src/domain/course-installations/contracts";
import type { CourseInstallationService } from "../src/domain/course-installations/service";
import type { InstalledProgressEnvelope, RuntimeSelectionEnvelope } from "../src/domain/installed-study/contracts";
import { readCourseState } from "../src/domain/study/course-state-storage";
import type { checkpointBrowser } from "./checkpoint-browser.mjs";
import { independentLearningFixtures, jsonFile } from "./installed-runtime-test-fixtures";

type Browser = Awaited<ReturnType<typeof checkpointBrowser>>;
type Student = { id: string; client: SupabaseClient; cookies: Map<string, string> };
type Context = {
  browser: Browser;
  fixture: ReturnType<typeof independentLearningFixtures>;
  service: CourseInstallationService;
  authority: Parameters<CourseInstallationService["activate"]>[1];
  student(): Promise<Student>;
  prepared(files: ReadonlyMap<string, Uint8Array>): Promise<Installation>;
  active(owner: Student): Promise<{ selection: RuntimeSelectionEnvelope }>;
  progress(owner: Student, versionSessionId: string): Promise<InstalledProgressEnvelope>;
  api(owner: Student | null, path: string, method?: string, body?: unknown): Promise<Response>;
  waitUi(expression: string, description: string): Promise<void>;
  clickText(text: string, selector?: string): Promise<void>;
  dismissOverlays(): Promise<void>;
  check(name: string, run: () => Promise<void>): Promise<void>;
};

/** Real local Auth/Storage/SQL/HTTP/browser, with narrowly declared browser fault injection. */
export async function runCiclo2Journey(ctx: Context) {
  const { browser, fixture, service, student, prepared, active, progress, api, waitUi, clickText, dismissOverlays, check } = ctx;
  const owner = await student();
  const other = await student();
  const courseId = "qa.c2." + randomUUID();
  const v1 = fixture.produce("c2-v1", "1.0.0", ["--diagnostic"], courseId);
  const v2 = fixture.produce("c2-v2", "2.0.0", ["--diagnostic"], courseId);
  const first = await prepared(v1.files);
  await service.activate({ courseId, installationId: first.reference.installationId, expectedRevision: 0, operationId: randomUUID() }, ctx.authority);
  const before = await active(owner);
  const selectedResponse = await api(owner, "/api/course/active", "POST", { source: "installed", courseId, expectedRevision: before.selection.revision, operationId: randomUUID() });
  assert.equal(selectedResponse.status, 200);
  const selected = (await active(owner)).selection.selection;
  assert(selected?.source === "installed");
  const versionSessionId = selected.versionSessionId;
  const state = readCourseState(null, courseId, "xx-I8");
  state.profile = { ...state.profile, onboarded: true, onboardingStep: 0 };
  assert.equal((await api(owner, "/api/course-installations/progress", "POST", { versionSessionId, expectedRevision: 0, operationId: randomUUID(), state })).status, 200);
  await browser.cookies([...owner.cookies].map(([name, value]) => ({ name, value })));
  // Only this synthetic browser profile receives fault injection. Actual successful
  // POSTs reach the local server before the deliberate ACK-loss error is raised.
  await browser.initScript(`(() => { const original=window.fetch.bind(window); window.fetch=async(...args)=>{ const input=args[0], init=args[1]||{}, url=new URL(typeof input==='string'?input:input.url,location.origin), method=(init.method||'GET').toUpperCase(); if(url.pathname!=='/api/course-installations/progress')return original(...args); const key='c2-count-'+method;sessionStorage.setItem(key,String(Number(sessionStorage.getItem(key)||0)+1));const mode=sessionStorage.getItem('c2-network');if(mode==='readfail'&&method==='GET')return new Response(JSON.stringify({error:'Synthetic local read failure'}),{status:503,headers:{'Content-Type':'application/json'}});if(mode==='postfail'&&method==='POST')throw new TypeError('Synthetic local write failure');const response=await original(...args);if(mode==='acklost'&&method==='POST'&&response.ok){sessionStorage.setItem('c2-network','');throw new TypeError('Synthetic ACK loss after real local commit');}return response;}; })()`);
  const navigate = async (path: string) => { await browser.navigate(path); await dismissOverlays(); };
  const saved = async (predicate: (value: InstalledProgressEnvelope) => boolean, label: string) => {
    for (let count = 0; count < 180; count++) { const value = await progress(owner, versionSessionId); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 150)); }
    throw Error("Confirmed local progress missing: " + label);
  };
  let sessionId = "";
  let learningBefore: unknown;
  await check("C2 A2 start, confirmed cursor and explicit pause survive real reload", async () => {
    await navigate("/study");
    await waitUi("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Começar sessão'&&!b.disabled)","start control available");
    await dismissOverlays();
    assert.equal(await browser.evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Começar sessão');if(!b||b.disabled)return 0;b.click();b.click();return 2})()"),2);
    const started = await saved(value => Boolean(value.state?.sessions.some(item => !item.finishedAt)), "session start");
    const session = started.state!.sessions.find(item => !item.finishedAt)!;
    sessionId = session.id;
    assert.equal(started.state!.sessions.length,1,"Two start attempts must produce one total session");
    learningBefore={completed:started.state!.completedActivityIds,objective:started.state!.assessmentAttempts,adaptive:started.state!.adaptiveAssessments};
    assert(session.plan.length > 1);
    assert.equal(started.versionSessionId, versionSessionId);
    assert.deepEqual(started.reference, first.reference);
    await clickText("Próxima etapa");
    await clickText("Pausar sessão");
    const paused = await saved(value => Boolean(value.state?.sessions.find(item => item.id === sessionId)?.paused), "explicit pause");
    assert.equal(paused.state!.sessions.find(item => item.id === sessionId)!.cursor, 1);
    const seconds = paused.state!.sessions.find(item => item.id === sessionId)!.durationSeconds;
    const clock=await browser.evaluate("document.querySelector('.study-timer')?.textContent");
    await browser.evaluate("new Promise(resolve=>setTimeout(resolve,4500))");
    assert.equal(await browser.evaluate("document.querySelector('.study-timer')?.textContent"),clock,"Visible paused clock must freeze independently of 30s remote checkpoint");
    assert.equal((await progress(owner, versionSessionId)).state!.sessions.find(item => item.id === sessionId)!.durationSeconds, seconds);
    const resumedAt=Date.now();await clickText("Retomar sessão");await browser.evaluate("new Promise(resolve=>setTimeout(resolve,1100))");await clickText("Pausar sessão");
    const resumed=await saved(value=>value.state!.sessions.find(item=>item.id===sessionId)?.paused===true,"second confirmed pause");
    assert(resumed.state!.sessions.find(item=>item.id===sessionId)!.durationSeconds<=seconds+Math.ceil((Date.now()-resumedAt)/1000)+1,"Confirmed duration cannot include preceding inactive window");
    await navigate("/study");
    await browser.waitText("Retomar sessão");
    await waitUi("document.querySelector('.study-step-line')?.textContent.includes('ETAPA 2')", "restored confirmed step");
    assert.equal((await progress(owner, versionSessionId)).state!.sessions.filter(item => item.id === sessionId).length, 1);
  });
  await check("C2 A2 real read failure cannot write and recovery restores remote state", async () => {
    const before = await progress(owner, versionSessionId);
    await browser.evaluate("sessionStorage.setItem('c2-network','readfail');sessionStorage.setItem('c2-count-POST','0')");
    await navigate("/study");
    await waitUi("Boolean(document.querySelector('[role=alert]'))", "read failure alert");
    await browser.evaluate("new Promise(resolve=>setTimeout(resolve,600))");
    assert.equal(await browser.evaluate("Number(sessionStorage.getItem('c2-count-POST'))"), 0);
    assert.equal((await progress(owner, versionSessionId)).revision, before.revision);
    await browser.evaluate("sessionStorage.setItem('c2-network','')");
    await navigate("/study");
    await browser.waitText("Retomar sessão");
    assert.equal((await progress(owner, versionSessionId)).state!.sessions.find(item => item.id === sessionId)!.cursor, 1);
  });
  await check("C2 A2 ACK loss keeps pending command and real SQL recovery without duplication", async () => {
    await clickText("Retomar sessão");
    await saved(value => value.state!.sessions.find(item => item.id === sessionId)?.paused === false, "resume");
    await browser.evaluate("(async()=>{await new Promise(resolve=>setTimeout(resolve,1500));sessionStorage.setItem('c2-network','acklost')})()");
    await clickText("Pausar sessão");
    await saved(value => value.state!.sessions.find(item => item.id === sessionId)?.paused === true, "server received lost ACK write");
    await waitUi("Boolean(document.querySelector('[role=alert]'))", "lost ACK displayed");
    await navigate("/study");
    await browser.waitText("Retomar sessão");
    const recovered = await progress(owner, versionSessionId);
    assert.equal(recovered.state!.sessions.filter(item => item.id === sessionId).length, 1);
    assert.equal(recovered.state!.sessions.find(item => item.id === sessionId)!.cursor, 1);
  });
  await check("C2 A2 automatic visibility pause and single finish with no forged mastery", async () => {
    await clickText("Retomar sessão");
    await browser.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))");
    await saved(value => value.state!.sessions.find(item => item.id === sessionId)?.paused === true, "automatic pause");
    await browser.evaluate("delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))");
    await clickText("Encerrar sessão agora");
    const ended = await saved(value => Boolean(value.state!.sessions.find(item => item.id === sessionId)?.finishedAt), "single finish");
    const eventIds = ended.state!.events.map(item => item.id);
    assert.equal(new Set(eventIds).size, eventIds.length);
    assert.equal(ended.state!.events.filter(item=>item.type==="lesson_finished"&&item.itemId===sessionId).length,1);
    assert.deepEqual({completed:ended.state!.completedActivityIds,objective:ended.state!.assessmentAttempts,adaptive:ended.state!.adaptiveAssessments},learningBefore,"Finishing study cannot forge learning results");
    assert.equal(ended.state!.sessions.filter(item => item.id === sessionId).length, 1);
    await navigate("/study");
    assert.equal((await progress(owner, versionSessionId)).state!.sessions.filter(item => item.id === sessionId && item.finishedAt).length, 1);
  });
  await check("C2 A2 adaptive submitted responses survive reload; official result requires server confirmation", async () => {
    await navigate("/assessment?assessmentId=c2-adaptive-diagnostic");
    await browser.waitText("Diagnóstico adaptativo C2");
    await clickText("Começar avaliação");
    for (let answer = 0; answer < 3; answer++) {
      await waitUi("Boolean(document.querySelector('.adaptive-question button[role=radio]:not([disabled])'))", "adaptive question");
      await clickText("", ".adaptive-question button[role=radio]:not([disabled])");
      await waitUi("Boolean(document.querySelector('.adaptive-question button[role=radio][aria-checked=true]'))", "selected adaptive response");
      await clickText("Verificar resposta");
      await saved(value => (value.state?.adaptiveProgress?.find(item => item.assessmentId === "c2-adaptive-diagnostic")?.responses.length ?? 0) === answer + 1, "submitted diagnostic prefix");
      assert.equal((await progress(owner, versionSessionId)).state!.adaptiveAssessments.filter(item => item.assessmentId === "c2-adaptive-diagnostic").length, 0);
      if (answer === 0) {
        await navigate("/assessment?assessmentId=c2-adaptive-diagnostic");
        await browser.waitText("QUESTÃO 2 DE 3");
      }
    }
    await navigate("/assessment?assessmentId=c2-adaptive-diagnostic");
    await browser.waitText("Confirmar resultado");
    await clickText("Confirmar resultado");
    const confirmed = await saved(value => value.state!.adaptiveAssessments.some(item => item.assessmentId === "c2-adaptive-diagnostic" && item.source === "server"), "canonical diagnostic result");
    const result = confirmed.state!.adaptiveAssessments.find(item => item.assessmentId === "c2-adaptive-diagnostic")!;
    assert.deepEqual(confirmed.reference,first.reference);assert.equal(confirmed.versionSessionId,versionSessionId);
    assert.equal(result.answers.length,3);assert(result.answers.every(answer=>answer.correct));assert.equal(result.objectiveScore,100);
    assert.equal(result.purpose, "diagnostic");
    assert.equal(result.method, "adaptive");
    assert.equal(result.contentVersion, "1.0.0");
    await navigate("/assessment?assessmentId=c2-adaptive-diagnostic");
    assert.equal((await progress(owner, versionSessionId)).state!.adaptiveAssessments.filter(item => item.id === result.id).length, 1);
  });
  await check("C2 A2 wrong owner denied and activation cannot alter the pinned V1", async () => {
    assert([403,404].includes((await api(other, "/api/course-installations/progress?versionSessionId=" + versionSessionId)).status));
    const snapshot = await progress(owner, versionSessionId);
    const second = await prepared(v2.files);
    await service.activate({ courseId, installationId: second.reference.installationId, expectedRevision: 1, operationId: randomUUID() }, ctx.authority);
    await navigate("/study");
    assert.equal((await progress(owner, versionSessionId)).reference.contentVersion, "1.0.0");
    assert.equal((await progress(owner, versionSessionId)).state!.sessions.find(item => item.id === sessionId)!.id, sessionId);
    await clickText("Começar sessão");
    await waitUi("document.body.getAttribute('data-content-version')==='2.0.0'", "new start selects active V2");
    const v2Selection = (await active(owner)).selection.selection;
    assert(v2Selection?.source === "installed");
    assert.notEqual(v2Selection.versionSessionId, versionSessionId);
    assert.deepEqual((await progress(owner, versionSessionId)).state!.adaptiveAssessments, snapshot.state!.adaptiveAssessments);
  });
  await check("C2 A2 mobile journey has exact viewport and reachable controls", async () => {
    const v2Selection = (await active(owner)).selection.selection;
    assert(v2Selection?.source === "installed");
    const current = await progress(owner, v2Selection.versionSessionId);
    const v2State = current.state ?? readCourseState(null, courseId, "xx-I8");
    v2State.profile = { ...v2State.profile, onboarded: true, onboardingStep: 0 };
    assert.equal((await api(owner, "/api/course-installations/progress", "POST", { versionSessionId: v2Selection.versionSessionId, expectedRevision: current.revision, operationId: randomUUID(), state: v2State })).status, 200);
    for (const width of [390, 360]) {
      await browser.viewport(width, 844);
      await navigate("/study");
      await browser.waitText("Começar sessão");
      assert(await browser.evaluate(`innerWidth===${width}&&document.documentElement.scrollWidth<=innerWidth+1`));
      await dismissOverlays();
      const visible = await browser.evaluate("(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Começar sessão'));b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44&&!b.disabled})()");
      assert.equal(visible, true);
      await browser.screenshot("ciclo2-study-" + width + ".png");
    }
  });
  await check("C2 A2 failed write blocks course switch; retry restores and isolates the next course", async () => {
    await browser.viewport(1280,900);
    await clickText("Começar sessão");
    const selection=(await active(owner)).selection.selection;assert(selection?.source==="installed");
    await waitUi("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Pausar sessão')", "new V2 study controls");
    await browser.evaluate("sessionStorage.setItem('c2-network','postfail')");
    await clickText("Pausar sessão");
    await waitUi("Boolean(document.querySelector('[role=alert]'))", "failed write feedback");
    const destination=await browser.evaluate("(()=>{const s=document.querySelector('[data-course-selector]');return [...s.options].find(o=>o.value!==s.value)?.value})()") as string;
    assert(destination);
    const switchTo=async()=>{await browser.evaluate(`(()=>{const s=document.querySelector('[data-course-selector]');s.value=${JSON.stringify(destination)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
    await switchTo();
    await waitUi("Boolean(document.querySelector('.course-switcher [role=alert]'))", "flush failure blocks switch");
    assert.equal((await active(owner)).selection.selection?.courseId,courseId);
    assert.equal(await browser.evaluate("document.querySelector('[data-course-selector]')?.value"),courseId);
    await browser.evaluate("sessionStorage.setItem('c2-network','')");
    await clickText("Retomar sessão");
    await switchTo();
    await waitUi(`location.pathname==='/dashboard'&&((document.querySelector('[data-course-selector]')?.value===${JSON.stringify(destination)}&&!document.querySelector('[data-course-selector]')?.disabled)||Boolean(document.querySelector('.pedagogical-onboarding')))`, "confirmed course switch");
    assert.equal((await active(owner)).selection.selection?.courseId,destination);
    assert.notEqual(await browser.evaluate("document.body.getAttribute('data-version-session')"),selection.versionSessionId,"Destination must not mount the previous course session");
    assert((await progress(owner,selection.versionSessionId)).state?.sessions.length);
    assert([403,404].includes((await api(other,"/api/course-installations/progress?versionSessionId="+selection.versionSessionId)).status));
  });
  console.log(JSON.stringify({ ciclo2: { courseId, retainedUsers: [owner.id, other.id], versionSessionId, fixture: jsonFile(v1.files, "manifest.json").id, realHTTP: true, realSQL: true, syntheticBrowserVisibilityAndFetch: true, migrated: false, paidCalls: 0 } }));
}
