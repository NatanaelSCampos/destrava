import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { canonicalJson } from "../src/domain/interactive-lesson/evidence";
import { coursePackageSchema } from "../src/content/contracts";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";
import { initialRuntime, reduceRuntime } from "../src/domain/interactive-lesson/runtime";
import { multiSegmentLesson, type QaScope, type QaEvidence } from "./fase4-qa-fixtures";
import { assertLocalDocker, assertLocalUrl, localApi, localApp, localEnvironment, workspace } from "./release-clean-environment.mjs";

type Runtime = ReturnType<typeof initialRuntime> & { evidenceScope?: QaScope | null; segmentEvidence?: Record<string, QaEvidence> };
type Saved = { sessionId: string; revision: number; runtime: Runtime; evidence?: Record<string, unknown>; grade?: { correct: boolean } };
type Handlers = { GET?: (request: Request) => Promise<Response>; POST: (request: Request) => Promise<Response> };
type Student = { id: string; client: SupabaseClient; email: string; password: string };
/** LEAD ONLY: the public local wrapper supplies the isolated environment. No migration/deletion here. */
async function main() {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.equal(resolve(process.cwd()).toLowerCase(), resolve(workspace).toLowerCase());
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, localApi);
  const isolation = assertLocalDocker(), env = localEnvironment();
  assert.equal(env.APP_ORIGIN, localApp);
  const originalFetch = globalThis.fetch;
  let externalAttempts = 0;
  globalThis.fetch = (input, init) => {
    try { assertLocalUrl(typeof input === "string" || input instanceof URL ? input : input.url, [localApi, localApp]); }
    catch { externalAttempts++; throw Error("External destination rejected in F4 QA"); }
    return originalFetch(input, { ...init, redirect: "manual" });
  };
  const retainedSyntheticUsers: string[] = [], checks: string[] = [];
  const paths = ["src/domain/interactive-lesson/runtime.ts", "src/domain/interactive-lesson/integrity.ts",
    "src/domain/interactive-lesson/server.ts", "src/domain/interactive-lesson/session-state.ts",
    "src/app/api/interactive-lessons/session/route.ts", "src/app/api/interactive-lessons/segment/route.ts",
    "supabase/migrations/20261022000100_interactive_segment_evidence.sql", "scripts/verify-release-clean-update.tsx"];
  const hashes = () => paths.map((path) => ({ path, sha256: createHash("sha256").update(readFileSync(resolve(path))).digest("hex") }));
  const before = hashes();
  const check = async (name: string, run: () => Promise<void>) => { await run(); checks.push(name); console.log("PASS " + name); };
  try {
    const admin = createClient(localApi, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const student = async (): Promise<Student> => {
      const email = "fase4-qa-" + randomUUID() + "@example.test", password = "Fase4-QA-" + randomUUID() + "!";
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert(!created.error && created.data.user, "Synthetic local account creation failed");
      retainedSyntheticUsers.push(created.data.user.id);
      const client = createClient(localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const login = await client.auth.signInWithPassword({ email, password }); assert(!login.error);
      return { id: created.data.user.id, client, email, password };
    };

    const raw = structuredClone(loadContent().find((item) => item.course.interactiveLessons.length)!);
    assert(raw, "Seeded compiled interactive fixture required");
    const definition = multiSegmentLesson(), existing = raw.course.interactiveLessons[0];
    const ownerUnitData = raw.course.units.find((unit) => unit.id === existing.unitId)!;
    const all = ownerUnitData.lessons.flatMap((lesson) => lesson.activities);
    const objectives = all.filter((item) => item.type === "multiple_choice").slice(0, 2);
    const speeches = all.filter((item) => item.type === "speaking").slice(0, 2);
    const writing = structuredClone(all.find((item) => item.type === "writing")!);
    assert.equal(objectives.length, 2); assert.equal(speeches.length, 2); assert(writing);
    if (writing.type === "writing") { writing.payload = { ...writing.payload, minWords: 1 }; delete writing.payload.textRequirement; }
    const activities = [...objectives, ...speeches, writing];
    definition.id = existing.id; definition.courseId = raw.course.id; definition.unitId = existing.unitId; definition.lessonId = existing.lessonId;
    definition.segments.forEach((segment, index) => { segment.activityRef = activities[index].id; });
    const container = raw.course.units.flatMap((unit) => unit.lessons).find((lesson) => lesson.id === existing.lessonId)!;
    const selectedIds = new Set(activities.map((activity) => activity.id));
    for (const lesson of raw.course.units.flatMap((unit) => unit.lessons)) {
      lesson.activities = lesson.activities.filter((activity) => !selectedIds.has(activity.id));
    }
    container.activities.push(...activities); raw.course.interactiveLessons = [definition];
    for (const unit of raw.course.units) unit.lessons = unit.lessons.filter((lesson) => lesson.activities.length > 0);
    const u2=structuredClone(raw.course.units[0]);u2.id='f2c.u2';u2.slug='f2c-u2';u2.order=2;u2.title='Synthetic U2 first edition';u2.assessmentRefs={formative:[]};u2.learningPolicy={completion:{requirements:[{id:'f2c.u2.complete',label:'Synthetic U2 participation',kind:'participation',activityIds:['f2c.u2.activity'],minimumCount:1}]},mastery:{requirements:[{id:'f2c.u2.master',label:'Synthetic U2 objective',kind:'objective_score',activityIds:['f2c.u2.activity'],minimumScore:100,minimumSamples:1}]}};
    const l2=structuredClone(u2.lessons[0]);l2.id='f2c.u2.lesson';l2.slug='f2c-u2-lesson';delete l2.interactiveLessonRef;l2.activities=[{...structuredClone(objectives[0]),id:'f2c.u2.activity'}];u2.lessons=[l2];raw.course.units.push(u2);
    assert.equal(coursePackageSchema.safeParse(raw.course).success,true,'U1/U2 fixture must satisfy the course contract');
    const bundle = runtimeBundle(raw);
    bundle.course = structuredClone(bundle.course);
    for (const [table, ids] of [["courses", [raw.course.id]], ["lessons", [existing.lessonId]], ["activities", activities.map((activity) => activity.id)]] as const) {
      const rows = await admin.from(table).select("id").in("id", [...ids]); assert(!rows.error);
      assert.equal(rows.data.length, ids.length, "Synthetic VM catalog requires existing FK rows: " + table);
    }
    // Only the catalog is synthetic. Identity and MFA below call real LOCAL Auth/RPC;
    // reads/writes and the service-only transactional RPC use real LOCAL Supabase.
    const owner = await student();
    const fixture = { bundle, client: owner.client };
    const vm = { __fase4Qa: fixture, module: { exports: {} }, exports: {}, require: createRequire(import.meta.url),
      process: { ...process, env: { ...process.env, ...env, DESTRAVA_LOCAL_ONLY: "0" } }, console, Buffer, Request, Response, Headers,
      FormData, File, Blob, URL, TextEncoder, TextDecoder, setTimeout, clearTimeout, fetch: globalThis.fetch };
    async function handlers(path: string): Promise<Handlers> {
      const output = await build({ entryPoints: [resolve(path)], bundle: true, write: false, format: "cjs",
        platform: "node", packages: "external", tsconfig: resolve("tsconfig.json"), plugins: [{
          name: "qa-local-catalog-auth",
          setup(builder) {
            builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "qa" }));
            builder.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, () => ({ path: "auth", namespace: "qa" }));
            builder.onResolve({ filter: /^@\/content\/course-registry$/ }, () => ({ path: "catalog", namespace: "qa" }));
            builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path: name }) => ({ loader: "js", contents:
              name === "empty" ? "" : name === "catalog" ?
              "export const defaultCourseId=globalThis.__fase4Qa.bundle.course.id;export const allCourseBundles=()=>[globalThis.__fase4Qa.bundle];export const findCourseBundle=id=>id===defaultCourseId?globalThis.__fase4Qa.bundle:undefined;export const requireCourseBundle=id=>{const b=findCourseBundle(id);if(!b)throw Error('No synthetic bundle');return b;};" :
              "export const createSupabaseServerClient=async()=>globalThis.__fase4Qa.client;export const getAuthenticatedUser=async()=>{const client=globalThis.__fase4Qa.client;const {data,error}=await client.auth.getUser();if(error||!data.user)return null;const access=await client.rpc('mfa_access_allowed');return !access.error&&access.data===true?data.user:null;};"
            }));
          }
        }] });
      const context = { ...vm, module: { exports: {} }, exports: {} };
      runInNewContext(output.outputFiles[0].text, context, { filename: path });
      return context.module.exports as Handlers;
    }
    const sessions = await handlers("src/app/api/interactive-lessons/session/route.ts");
    const segments = await handlers("src/app/api/interactive-lessons/segment/route.ts");
    const endpoint = "/api/interactive-lessons/session";
    const request = (path: string, body?: unknown) => new Request(localApp + path, body === undefined ? undefined : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const sessionBody = (runtime: Runtime, revision: number | null) => ({ courseId: raw.course.id,
      lessonId: existing.lessonId, contentVersion: raw.course.contentVersion, runtime, revision });
    const submit = async (body: unknown) => segments.POST(request("/api/interactive-lessons/segment", body));
    const snapshot = async (userId = owner.id) => {
      const result = await admin.from("interactive_lesson_sessions").select("*").eq("user_id", userId)
        .eq("course_id", raw.course.id).eq("lesson_id", existing.lessonId).maybeSingle(); assert(!result.error); return result.data;
    };
    let saved!: Saved;
    await check("VM+SQL creates session with authenticated owner and server scope", async () => {
      const response = await sessions.POST(request(endpoint, sessionBody(initialRuntime(definition), null)));
      assert.equal(response.status, 200); saved = await response.json() as Saved;
      assert.equal(saved.runtime.evidenceScope?.userId, owner.id);
      assert.equal(saved.runtime.evidenceScope?.sessionId, saved.sessionId);
      const begun = reduceRuntime(definition, saved.runtime, { type: "START" });
      const started = await sessions.POST(request(endpoint, sessionBody(begun, saved.revision)));
      assert.equal(started.status, 200); saved = await started.json() as Saved;
    });

    const first=bundle.course.units.flatMap(u=>u.lessons).flatMap(l=>l.activities).find(a=>a.id===objectives[0].id)!;assert.equal(first.type,'multiple_choice');
    const attempt={courseId:raw.course.id,lessonId:existing.lessonId,contentVersion:raw.course.contentVersion,sessionId:saved.sessionId,revision:saved.revision,segmentId:definition.segments[0].id,activityId:first.id,attemptId:randomUUID(),answer:first.type==='multiple_choice'?first.answer:''};
    const receipts=async()=>{const r=await admin.from('interactive_lesson_receipts').select('*').eq('session_id',saved.sessionId).order('attempt_id');assert.equal(r.error,null);return r.data;};
    let committed:unknown,oldReceipts:unknown;
    await check('ACK lost after real commit: identical retry recovers one receipt without second write',async()=>{
      const dropped=await submit(attempt);assert.equal(dropped.status,200);
      committed=await snapshot();oldReceipts=await receipts();assert.equal((oldReceipts as unknown[]).length,1);
      const rows=await receipts(),proof=rows![0].result.evidence;
      assert.equal(proof.accepted,true);assert.equal(rows![0].result.grade.correct,true);
      assert.equal(proof.userId,owner.id);assert.equal(proof.sessionId,saved.sessionId);assert.equal(proof.courseId,raw.course.id);assert.equal(proof.lessonId,existing.lessonId);assert.equal(proof.segmentId,definition.segments[0].id);assert.equal(proof.activityId,first.id);assert.equal(proof.attemptId,attempt.attemptId);assert.equal(proof.contentVersion,raw.course.contentVersion);
      const row=await snapshot();assert.match(row.definition_hash,/^[a-f0-9]{64}$/);assert.equal(proof.definitionHash,row.definition_hash);assert.deepEqual(row.runtime_state.segmentEvidence[definition.segments[0].id],proof);
      // Simulate loss only AFTER the server commit; do not deliver its result to the client.
      const retry=await submit(attempt);assert.equal(retry.status,200);const recovered=await retry.json();assert.equal(recovered.revision,(await snapshot()).revision);saved=recovered as Saved;
      assert.equal(recovered.evidence.attemptId,attempt.attemptId);assert.deepEqual(await snapshot(),committed);assert.deepEqual(await receipts(),oldReceipts);
    });
    const original=structuredClone(bundle.coursePackage),u1=JSON.stringify(bundle.coursePackage.units[0]);
    const hashV1=(await snapshot()).definition_hash;
    let hashV2="";
    await check('only U2 edit with unchanged version rejects U1 resume and never promotes old proof',async()=>{
      bundle.coursePackage.units[1].title+=' changed U2 only';hashV2=createHash('sha256').update(canonicalJson({definition,course:bundle.coursePackage,language:bundle.language})).digest('hex');assert.notEqual(hashV2,hashV1);assert.equal(JSON.stringify(bundle.coursePackage.units[0]),u1);
      const expected=structuredClone(original);expected.units[1].title+=' changed U2 only';assert.deepEqual(bundle.coursePackage,expected);assert(coursePackageSchema.safeParse(bundle.coursePackage).success);assert.match(hashV2,/^[a-f0-9]{64}$/);
      assert.equal(bundle.coursePackage.contentVersion,original.contentVersion);
      const response=await sessions.GET!(request(endpoint+'?courseId='+raw.course.id+'&lessonId='+existing.lessonId));assert.equal(response.status,409);assert.equal((await response.json()).error,'LESSON_VERSION_CONFLICT');
      for(const denied of [await submit(attempt),await sessions.POST(request(endpoint,sessionBody(saved.runtime,saved.revision)))]){assert.equal(denied.status,409);assert.equal((await denied.json()).error,'LESSON_VERSION_CONFLICT');}
      const projected=await sessions.GET!(request(endpoint+'?courseId='+raw.course.id+'&receipts=1'));assert.equal(projected.status,200);assert.deepEqual((await projected.json()).receipts,[]);
      assert.deepEqual(await snapshot(),committed);assert.deepEqual(await receipts(),oldReceipts);
    });
    await check('second contentVersion rejects old U1 session without reinterpreting its receipt',async()=>{
      bundle.coursePackage.contentVersion='2.0.0';assert(coursePackageSchema.safeParse(bundle.coursePackage).success);
      const response=await sessions.GET!(request(endpoint+'?courseId='+raw.course.id+'&lessonId='+existing.lessonId));assert.equal(response.status,409);
      const replay=await submit(attempt);assert.equal(replay.status,409);
      assert.deepEqual(await snapshot(),committed);assert.deepEqual(await receipts(),oldReceipts);
    });
    await check('restoring original immutable edition resumes original U1 and preserves receipt',async()=>{
      bundle.coursePackage=original;const response=await sessions.GET!(request(endpoint+'?courseId='+raw.course.id+'&lessonId='+existing.lessonId));assert.equal(response.status,200);const body=await response.json();assert.equal(body.session.id,saved.sessionId);assert.equal(body.session.runtime_state.evidenceScope.definitionHash,hashV1);
      assert.deepEqual(await snapshot(),committed);assert.deepEqual(await receipts(),oldReceipts);
    });
    assert.deepEqual(hashes(),before);assert.equal(externalAttempts,0);
    writeFileSync('.tmp/f2-c/update-result.json',JSON.stringify({passed:true,checks,isolation,retainedSyntheticUsers,sessionId:saved.sessionId,contentVersion:original.contentVersion,definitionHashV1:hashV1,definitionHashU2Edit:hashV2,contentVersionV2:"2.0.0",u1Unchanged:true,u2OnlyEditRejected:true,oldReceiptPreserved:true,courseUnits:2,limitations:['VM handlers with real Auth/SQL; no installed runtime or HTTP update switch.','Compiled whole-course hash intentionally rejects U1 after U2 edit.']},null,2));
  }catch(e){console.error(JSON.stringify({passed:false,checks,retainedSyntheticUsers}));throw e;}finally{globalThis.fetch=originalFetch;}
}
main().catch(e=>{console.error(e);process.exitCode=1});
