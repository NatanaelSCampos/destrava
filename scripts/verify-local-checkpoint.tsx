import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { renderToString } from "react-dom/server";
import {
  localEnvironment,
  localFetch,
  localApp,
  localApi,
  assertLocalDocker,
  assertLocalUrl,
} from "./local-environment.mjs";
import { checkpointBrowser } from "./checkpoint-browser.mjs";
import { allCourseBundles } from "../src/content/course-registry";
import { publicCourse } from "../src/content/public";
import {
  serverAssessmentResultSchema,
  type ServerAssessmentResult,
} from "../src/content/assessment-results";
import type { AssessmentDefinition } from "../src/content/contracts";
import { gradeActivity } from "../src/domain/activities/grader";
import { nextAdaptiveItem, type AdaptiveAnswer } from "../src/domain/study/adaptive-assessment";
import { readCourseState } from "../src/domain/study/course-state-storage";
import {
  recordAttempt,
  recordServerAssessment,
  type StudyState,
} from "../src/domain/study/study-state";
import {
  StudyProgressSync,
  type StudySyncCacheEntry,
} from "../src/domain/study/study-progress-sync";
import { ReviewScheduler } from "../src/domain/review/review-scheduler";
import { SupabaseStudyRepository } from "../src/repositories/supabase-study-repository";
import { projectUnitProgress } from "../src/repositories/unit-progress-projection";
import { unitProgress } from "../src/domain/study/progress";
import { PolicyChecklist } from "../src/components/activities/policy-checklist";

const env = localEnvironment();
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, localApi);
assertLocalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!);
const proof = assertLocalDocker();
const admin = createClient(localApi, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: localFetch },
});
const bundles = allCourseBundles();
type Bundle = (typeof bundles)[number];
type Student = {
  id: string;
  client: SupabaseClient;
  cookies: Map<string, string>;
  fault: { read: boolean };
  writes: { count: number };
};
const users: string[] = [];
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of secret.toUpperCase().replace(/=+$/, "")) {
    const value = alphabet.indexOf(character);
    assert(value >= 0);
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
      buffer &= (1 << bits) - 1;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  return ((digest.readUInt32BE(digest[digest.length - 1] & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const assets: string[] = [];
let browser: Awaited<ReturnType<typeof checkpointBrowser>> | undefined;
let checks = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  checks++;
  console.log(`OK ${name}`);
}
async function student(): Promise<Student> {
  const email = `checkpoint-${randomUUID()}@example.test`;
  const password = `Checkpoint-${randomUUID()}!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(error, null);
  assert(data.user);
  users.push(data.user.id);
  const cookies = new Map<string, string>();
  const fault = { read: false };
  const writes = { count: 0 };
  const client = createServerClient(localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach((item) => cookies.set(item.name, item.value)),
    },
    global: {
      fetch: async (input, init) => {
        const url = assertLocalUrl(
          typeof input === "string" || input instanceof URL ? input : input.url,
        );
        const method = init?.method ?? "GET";
        if (url.pathname.includes("user_course_state") && method !== "GET") writes.count++;
        if (fault.read && url.pathname.includes("user_course_state") && method === "GET")
          return new Response(JSON.stringify({ message: "Synthetic local read outage" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        return localFetch(input, init);
      },
    },
  });
  const login = await client.auth.signInWithPassword({ email, password });
  assert.equal(login.error, null);
  return { id: data.user.id, client, cookies, fault, writes };
}
async function api(owner: Student | null, path: string, method = "GET", body?: unknown) {
  return localFetch(new URL(path, localApp), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(owner
        ? { Cookie: [...owner.cookies].map(([name, value]) => `${name}=${value}`).join("; ") }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function results(owner: Student, bundle: Bundle) {
  const response = await api(
    owner,
    `/api/assessments?courseId=${encodeURIComponent(bundle.course.id)}`,
  );
  assert.equal(response.status, 200, "Authenticated assessment reload failed");
  const data = await response.json();
  return data.results.map((item: unknown) =>
    serverAssessmentResultSchema.parse(item),
  ) as ServerAssessmentResult[];
}
function repository(owner: Student, bundle: Bundle) {
  const course = publicCourse(bundle.course, bundle.language);
  return new SupabaseStudyRepository(owner.client, owner.id, {
    course,
    load: () => results(owner, bundle),
  });
}
function responses(bundle: Bundle, definition: AssessmentDefinition) {
  const activities = new Map(
    bundle.course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) => lesson.activities.map((a) => [a.id, a] as const)),
    ),
  );
  const answer = (id: string) => {
    const activity = activities.get(id)!;
    return activity.type === "writing"
      ? Array((activity.minWords ?? 0) + 10)
          .fill("synthetic")
          .join(" ")
      : "answer" in activity
        ? activity.answer
        : "";
  };
  if (definition.method === "fixed")
    return definition.activityIds.map((activityId) => ({ activityId, answer: answer(activityId) }));
  const answers: AdaptiveAnswer[] = [];
  while (answers.length < definition.skillPlan.length) {
    const next = nextAdaptiveItem(definition.bank, answers, definition.skillPlan);
    assert(next);
    const response = answer(next.activityId);
    const grade = gradeActivity(
      activities.get(next.activityId)!,
      response,
      bundle.language.normalization,
    );
    assert(grade);
    answers.push({ ...next, answer: response, correct: grade.correct });
  }
  return answers.map(({ activityId, answer }) => ({ activityId, answer }));
}
async function execute(owner: Student, bundle: Bundle, definition: AssessmentDefinition) {
  const input = {
    courseId: bundle.course.id,
    assessmentId: definition.id,
    attemptId: randomUUID(),
    startedAt: new Date().toISOString(),
    responses: responses(bundle, definition),
  };
  const response = await api(owner, "/api/assessments", "POST", input);
  assert.equal(response.status, 200, "Canonical assessment execution failed");
  const result = serverAssessmentResultSchema.parse(await response.json());
  const retry = await api(owner, "/api/assessments", "POST", input);
  assert.equal(retry.status, 200);
  assert.equal(
    (await retry.json()).finishedAt,
    result.finishedAt,
    "Idempotent retry changed saved timestamp",
  );
  return result;
}
function completedState(bundle: Bundle) {
  const course = publicCourse(bundle.course, bundle.language);
  let state = readCourseState(null, course.id, course.languageCode);
  state.profile = {
    ...state.profile,
    onboarded: true,
    onboardingStep: 0,
    variantId: bundle.language.speech.defaultVariant,
  };
  for (const activity of bundle.course.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => lesson.activities),
  )) {
    if ("answer" in activity) {
      const grade = gradeActivity(activity, activity.answer, bundle.language.normalization);
      assert(grade);
      state = recordAttempt(state, activity, activity.answer, grade);
    }
    if (activity.type === "writing")
      state.writing.push({
        id: randomUUID(),
        activityId: activity.id,
        text: Array((activity.minWords ?? 0) + 10)
          .fill("synthetic")
          .join(" "),
        createdAt: new Date().toISOString(),
      });
    if (activity.type === "speaking")
      state.speaking.push({
        id: randomUUID(),
        activityId: activity.id,
        transcription: "Synthetic speaking delivery; no speech provider called.",
        audioUrl: null,
        createdAt: new Date().toISOString(),
      });
  }
  state.completedActivityIds = course.units.flatMap((unit) =>
    unit.learningPolicy!.completion.requirements.flatMap((rule) =>
      rule.kind === "participation" ? rule.activityIds : [],
    ),
  );
  for (const word of bundle.resources.vocabulary) {
    let schedule = ReviewScheduler.initial();
    for (let i = 0; i < 4; i++) schedule = ReviewScheduler.afterAnswer(schedule, true);
    state.vocabulary[word.id] = { id: randomUUID(), status: "known", schedule };
  }
  return state;
}
function sync(owner: Student, bundle: Bundle, cached: StudyState | null = null) {
  const values = new Map<string | null, StudySyncCacheEntry>();
  values.set(owner.id, { state: cached, pending: null, recovery: [] });
  return new StudyProgressSync(() => readCourseState(null, bundle.course.id, bundle.language.id), {
    read: (id) => structuredClone(values.get(id) ?? { state: null, pending: null, recovery: [] }),
    write: (id, entry) => {
      values.set(id, structuredClone(entry));
    },
  });
}
async function main() {
  const a = await student();
  const b = await student();
  const es = bundles.find((item) => item.language.id === "es")!;
  const en = bundles.find((item) => item.language.id === "en")!;
  const test = bundles.find((item) => item.language.id === "xx-Test")!;
  const saved = new Map<string, StudyState>();
  await check("local isolation guard and real password authentication", async () => {
    assert.throws(() => assertLocalUrl("https://example.supabase.co"));
    assert.throws(() => assertLocalUrl("http://localhost:54321"));
    const user = await a.client.auth.getUser();
    assert.equal(user.data.user?.id, a.id);
    const access = await a.client.rpc("mfa_access_allowed");
    assert.equal(access.error, null);
    assert.equal(access.data, true);
    assert.equal((await api(null, "/api/assessments?courseId=" + es.course.id)).status, 401);
  });
  await check(
    "seeded contracts/policies are accessible and private answer keys are denied",
    async () => {
      for (const bundle of bundles) {
        const row = await a.client
          .from("courses")
          .select("content_version")
          .eq("id", bundle.course.id)
          .single();
        assert.equal(row.error, null);
        assert.equal(row.data.content_version, bundle.course.contentVersion);
        for (const unit of bundle.course.units) {
          const policy = await a.client
            .from("units")
            .select("learning_policy")
            .eq("id", unit.id)
            .single();
          assert.equal(policy.error, null);
          assert.deepEqual(policy.data.learning_policy, unit.learningPolicy);
        }
      }
      const privateKeys = await a.client.from("activity_answers").select("activity_id");
      assert.equal(privateKeys.data?.length ?? 0, 0);
    },
  );
  await check("confirmed absence authorizes valid initial save and reload", async () => {
    const repo = repository(a, test);
    assert.equal(await repo.load(test.course.id, test.language.id), null);
    const controller = sync(a, test);
    const adapter = {
      load: () => repo.load(test.course.id, test.language.id),
      save: (state: StudyState) =>
        repo.save(state, publicCourse(test.course, test.language), test.resources.vocabulary),
    };
    await controller.load(controller.beginLoading(), a.id, adapter);
    assert.equal(controller.getSnapshot().loadStatus, "absent");
    await controller.flush();
    assert((await repo.load(test.course.id, test.language.id))?.courseId === test.course.id);
  });
  await check("authenticated objective correction rejects result spoofing", async () => {
    const objective = es.course.units
      .flatMap((u) => u.lessons.flatMap((l) => l.activities))
      .find((a) => "answer" in a)!;
    const response = await api(a, "/api/grade", "POST", {
      courseId: es.course.id,
      activityId: objective.id,
      answer: "answer" in objective ? objective.answer : "",
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).correct, true);
    const bad = await api(a, "/api/assessments", "POST", {
      courseId: es.course.id,
      assessmentId: es.course.assessmentRefs.diagnostic,
      attemptId: randomUUID(),
      startedAt: new Date().toISOString(),
      responses: [{ activityId: objective.id, answer: "a", correct: true }],
      purpose: "summative",
      objectiveScore: 100,
    });
    assert.equal(bad.status, 400);
  });
  await check(
    "diagnostic, summative and insufficient outcomes survive database reload",
    async () => {
      for (const bundle of bundles) {
        let state = completedState(bundle);
        const course = publicCourse(bundle.course, bundle.language);
        for (const definition of bundle.course.assessments) {
          const result = await execute(a, bundle, definition);
          assert.equal(result.purpose, definition.purpose);
          assert.equal(result.method, definition.method);
          const row = await a.client
            .from("assessment_attempts")
            .select("objective_score,result")
            .eq("id", result.id)
            .single();
          assert.equal(row.error, null);
          assert.equal(row.data.objective_score, result.objectiveScore);
          assert.equal(row.data.result.purpose, definition.purpose);
          state = recordServerAssessment(state, course, result);
          if (bundle.language.id === "xx-Test") {
            assert.equal(result.objectiveScore, null);
            assert.equal(result.status, "insufficient");
          }
        }
        const repo = repository(a, bundle);
        await repo.save(state, course, bundle.resources.vocabulary);
        const loaded = await repo.load(course.id, bundle.language.id);
        assert(loaded);
        saved.set(course.id, loaded);
        for (const result of await results(a, bundle)) {
          assert(
            [...loaded.assessmentAttempts, ...loaded.adaptiveAssessments].some(
              (item) => item.id === result.id && item.source === "server",
            ),
          );
        }
        assert.equal(
          unitProgress(course.units[0], loaded, bundle.resources.vocabulary, course).isCompleted,
          true,
        );
      }
    },
  );
  await check(
    "persisted evidence and policy projection match recalculated and rendered states",
    async () => {
      for (const bundle of bundles) {
        const course = publicCourse(bundle.course, bundle.language);
        const state = saved.get(course.id)!;
        const row = await a.client
          .from("unit_progress")
          .select("*")
          .eq("user_id", a.id)
          .eq("unit_id", course.units[0].id)
          .single();
        assert.equal(row.error, null);
        const expected = projectUnitProgress(
          a.id,
          course,
          course.units[0],
          state,
          bundle.resources.vocabulary,
          row.data.updated_at,
        );
        assert.deepEqual(row.data.policy_state, JSON.parse(JSON.stringify(expected.policy_state)));
        assert.equal(row.data.content_version, course.contentVersion);
        assert.equal(row.data.completion_percent, expected.completion_percent);
        assert.equal(Boolean(row.data.mastered_at), Boolean(expected.mastered_at));
        const html = renderToString(
          <PolicyChecklist title="Domínio" result={expected.policy_state.mastery} />,
        );
        assert(html.includes("Cumprido"));
      }
    },
  );
  await check(
    "5B preference persists locally and changing it does not reinterpret assessment evidence",
    async () => {
      const bundle = bundles.find((item) => item.language.id === "en")!;
      const repo = repository(a, bundle);
      const before = await results(a, bundle);
      assert(before.length > 0);
      assert(before.every((result) => result.variantId));
      const state = structuredClone(saved.get(bundle.course.id)!);
      state.profile.variantId = "en-GB";
      await repo.save(
        state,
        publicCourse(bundle.course, bundle.language),
        bundle.resources.vocabulary,
      );
      const loaded = await repo.load(bundle.course.id, bundle.language.id);
      assert.equal(loaded?.profile.variantId, "en-GB");
      const profile = await a.client
        .from("user_course_profiles")
        .select("variant_id")
        .eq("user_id", a.id)
        .eq("course_id", bundle.course.id)
        .single();
      assert.equal(profile.error, null);
      assert.equal(profile.data?.variant_id, "en-GB");
      const after = await results(a, bundle);
      assert.deepEqual(
        after.map((result) => [result.id, result.variantId, result.objectiveScore]),
        before.map((result) => [result.id, result.variantId, result.objectiveScore]),
      );
      const activity = bundle.course.units
        .flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
        .find((item) => "answer" in item)!;
      const graded = await api(a, "/api/grade", "POST", {
        courseId: bundle.course.id,
        activityId: activity.id,
        answer: "answer" in activity ? activity.answer : "",
      });
      assert.equal(graded.status, 200);
      assert.equal((await graded.json()).variantId, "en-GB");
      saved.set(bundle.course.id, loaded!);
    },
  );
  await check("accounts/course isolation and forbidden cross-owner writes", async () => {
    const other = await b.client.from("user_course_state").select("state").eq("user_id", a.id);
    assert.equal(other.error, null);
    assert.equal(other.data.length, 0);
    const denied = await b.client.from("user_course_state").upsert({
      user_id: a.id,
      course_id: test.course.id,
      language_code: test.language.id,
      state: readCourseState(null, test.course.id, test.language.id),
    });
    assert(denied.error);
    const foreign = await results(b, es);
    assert.equal(foreign.length, 0);
    const testState = saved.get(test.course.id)!;
    assert(!testState.completedActivityIds.some((id) => id.startsWith("en.")));
    assert.equal(await repository(b, test).load(test.course.id, test.language.id), null);
  });
  await check(
    "verified TOTP upgrades access and stale AAL1 cannot read progress or assessments",
    async () => {
      const session = await a.client.auth.getSession();
      assert(session.data.session);
      const oldCookies = new Map(a.cookies);
      const enrolled = await a.client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Local checkpoint",
      });
      assert.equal(enrolled.error, null);
      assert(enrolled.data?.totp);
      const verified = await a.client.auth.mfa.challengeAndVerify({
        factorId: enrolled.data.id,
        code: totp(enrolled.data.totp.secret),
      });
      assert.equal(verified.error, null);
      const assurance = await a.client.auth.mfa.getAuthenticatorAssuranceLevel();
      assert.equal(assurance.data?.currentLevel, "aal2");
      const stale = createClient(localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: localFetch,
          headers: { Authorization: `Bearer ${session.data.session.access_token}` },
        },
      });
      const blocked = await stale.rpc("mfa_access_allowed");
      assert.equal(blocked.error, null);
      assert.equal(blocked.data, false);
      const denied = await stale.from("user_course_state").select("state").eq("user_id", a.id);
      assert.equal(denied.data?.length ?? 0, 0);
      assert.equal(
        (await api({ ...a, cookies: oldCookies }, "/api/assessments?courseId=" + es.course.id))
          .status,
        401,
      );
      assert((await results(a, es)).length > 0);
    },
  );
  await check(
    "failed real read with stale cache permits zero database writes; recovery restores server first",
    async () => {
      const repo = repository(a, test);
      const stale = readCourseState(null, test.course.id, test.language.id);
      const controller = sync(a, test, stale);
      const adapter = {
        load: () => repo.load(test.course.id, test.language.id),
        save: (state: StudyState) =>
          repo.save(state, publicCourse(test.course, test.language), test.resources.vocabulary),
      };
      a.fault.read = true;
      const before = a.writes.count;
      await controller.load(controller.beginLoading(), a.id, adapter);
      assert.equal(controller.getSnapshot().loadStatus, "failed");
      await assert.rejects(controller.flush());
      assert.equal(a.writes.count, before);
      controller.update((state) => ({
        ...state,
        profile: { ...state.profile, goal: "Pending synthetic draft" },
      }));
      a.fault.read = false;
      await controller.load(controller.beginLoading(), a.id, adapter);
      assert.equal(controller.getSnapshot().loadStatus, "loaded");
      assert.deepEqual(
        controller.getSnapshot().state.completedActivityIds,
        saved.get(test.course.id)!.completedActivityIds,
      );
      assert(
        controller
          .getSnapshot()
          .recovery.some((state) => state.profile.goal === "Pending synthetic draft"),
      );
    },
  );
  await check(
    "real database constraint failure retains pending edits and retry completes projection",
    async () => {
      const repo = repository(a, test);
      const controller = sync(a, test);
      const course = publicCourse(test.course, test.language);
      await controller.load(controller.beginLoading(), a.id, {
        load: () => repo.load(course.id, test.language.id),
        save: (state: StudyState) => repo.save(state, course, test.resources.vocabulary),
      });
      controller.update((state) => ({ ...state, profile: { ...state.profile, dailyMinutes: -1 } }));
      await assert.rejects(controller.flush());
      assert.equal(controller.getSnapshot().dirty, true);
      assert(controller.getSnapshot().saveError);
      controller.update((state) => ({ ...state, profile: { ...state.profile, dailyMinutes: 45 } }));
      await controller.flush();
      assert.equal(controller.getSnapshot().dirty, false);
      const profile = await a.client
        .from("user_course_profiles")
        .select("daily_minutes")
        .eq("user_id", a.id)
        .eq("course_id", course.id)
        .single();
      assert.equal(profile.data?.daily_minutes, 45);
      assert.equal((await repo.load(course.id, test.language.id))?.profile.dailyMinutes, 45);
    },
  );
  await check("delayed real response cannot replace a later account session", async () => {
    const repoA = repository(a, test);
    const repoB = repository(b, test);
    const controller = sync(a, test);
    let release!: () => void;
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const old = controller.load(controller.beginLoading(), a.id, {
      load: async () => {
        const state = await repoA.load(test.course.id, test.language.id);
        entered();
        await gate;
        return state;
      },
      save: async () => {
        throw new Error("Unexpected stale write");
      },
    });
    await ready;
    await controller.load(controller.beginLoading(), b.id, {
      load: () => repoB.load(test.course.id, test.language.id),
      save: async () => {
        throw new Error("Unexpected write");
      },
    });
    release();
    await old;
    assert.equal(controller.getSnapshot().userId, b.id);
    assert.equal(controller.getSnapshot().loadStatus, "absent");
    assert.equal(controller.getSnapshot().state.completedActivityIds.length, 0);
  });
  await check("private synthetic storage obeys ownership", async () => {
    const path = `${a.id}/checkpoint-${randomUUID()}.txt`;
    const upload = await a.client.storage
      .from("speaking-audio")
      .upload(path, new Blob(["synthetic checkpoint"]));
    assert.equal(upload.error, null);
    assets.push(path);
    const download = await b.client.storage.from("speaking-audio").download(path);
    assert(download.error);
  });
  await check(
    "real browser hydrates persisted progress, assessments and course switch",
    async () => {
      browser = await checkpointBrowser();
      await browser.cookies([...a.cookies].map(([name, value]) => ({ name, value })));
      await browser.cookies([{ name: "destrava-active-course", value: en.course.id }]);
      await browser.navigate("/progress");
      await browser.waitText("Você cumpriu");
      await browser.waitText("100%");
      await browser.waitText("Compreensão auditiva de pelo menos 80%");
      await browser.waitText("Cumprido");
      await browser.evaluate("document.querySelector('.page-tour-close')?.click()");
      await browser.navigate(
        "/assessment?assessmentId=" + encodeURIComponent(en.course.assessmentRefs.diagnostic!),
      );
      await browser.waitText("100%");
      await browser.cookies([{ name: "destrava-active-course", value: test.course.id }]);
      await browser.navigate("/progress");
      await browser.waitText("Leitura objetiva de pelo menos 80%");
      await browser.waitText("Cumprido");
      await browser.waitText("5 de 7 atividades realizadas");
      const body = await browser.evaluate("document.body.innerText");
      assert.equal(typeof body, "string");
      assert(!(body as string).includes("Compreensão auditiva de pelo menos 80%"));
      await browser.viewport(390, 844);
      assert(
        await browser.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"),
      );
      await browser.screenshot("checkpoint-mobile-smoke.png");
      await browser.viewport(360, 800);
      assert(
        await browser.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"),
      );
      const browserProof = browser.proof();
      assert.equal(browserProof.blockedRequests, 0);
      assert.equal(browserProof.runtimeErrors, 0);
      console.log(JSON.stringify({ browser: browserProof, mobileWidths: [390, 360] }));
    },
  );
  console.log(
    JSON.stringify({ checkpoint: "passed", checks, ...proof, remoteOperations: 0, paidCalls: 0 }),
  );
}
async function run() {
  try {
    await main();
  } finally {
    const cleanupFailures: string[] = [];
    if (browser) {
      try {
        await browser.close();
      } catch {
        cleanupFailures.push("browser");
      }
    }
    if (assets.length) {
      const removed = await admin.storage.from("speaking-audio").remove(assets);
      if (removed.error) cleanupFailures.push("owned assets");
    }
    for (const id of users) {
      const deleted = await admin.auth.admin.deleteUser(id);
      if (deleted.error) cleanupFailures.push("synthetic account");
    }
    assert.equal(
      cleanupFailures.length,
      0,
      `Local cleanup incomplete: ${cleanupFailures.join(", ")}`,
    );
    console.log(`Cleaned ${users.length} synthetic accounts and ${assets.length} owned assets.`);
  }
}
void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
