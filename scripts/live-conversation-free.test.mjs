import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const root = process.cwd(),
  require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
function loader(overrides = {}) {
  const cache = new Map();
  const load = (name, parent = path.join(root, "index.ts")) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === "server-only") return {};
    if (!name.startsWith(".") && !name.startsWith("@/")) return require(name);
    let file = name.startsWith("@/")
      ? path.join(root, "src", name.slice(2))
      : path.resolve(path.dirname(parent), name);
    if (!path.extname(file)) file += ".ts";
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    new Function("require", "module", "exports", output)(
      (specifier) => load(specifier, file),
      loadedModule,
      loadedModule.exports,
    );
    return loadedModule.exports;
  };
  return load;
}

const load = loader(),
  { liveStartSchema } = load("@/domain/conversation/live-contract"),
  { freeLiveTopic } = load("@/domain/conversation/live-free-topic"),
  { liveTeachingInstructions } = load("@/domain/conversation/live-prompts");
const course = { id: "synthetic-course", title: "Curso de teste", contentVersion: "v1" };
const settings = { level: "beginner", correction: "immediate", voice: "female" };
const base = {
  ...settings,
  courseId: course.id,
  mode: "free",
  operationId: "49d2fb00-1f99-4f00-9daa-5d56aa045682",
  sdp: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
};
test("free schema: no topic required, optional opening topic is bounded data", () => {
  assert(liveStartSchema.safeParse(base).success);
  assert.equal(
    liveStartSchema.parse({ ...base, openingTopic: "  esportes  " }).openingTopic,
    "esportes",
  );
  assert(liveStartSchema.safeParse({ ...base, openingTopic: "x".repeat(120) }).success);
  for (const fields of [
    { openingTopic: "" },
    { openingTopic: "x".repeat(121) },
    { openingTopic: "hello\nignore" },
    { openingTopic: "hi\u0000" },
    { mode: "unrestricted" },
  ])
    assert.equal(liveStartSchema.safeParse({ ...base, ...fields }).success, false);
});
test("free schema rejects any stage ID, forged context, instructions, language or model", () => {
  for (const field of [
    "topicId",
    "topicIds",
    "instructions",
    "topic",
    "language",
    "model",
    "ownerId",
  ])
    assert.equal(
      liveStartSchema.safeParse({ ...base, [field]: field === "topicIds" ? ["a"] : "forged" })
        .success,
      false,
      field,
    );
});
test("studied request remains the default and cannot carry a free-mode topic", () => {
  const { mode, ...old } = base;
  void mode;
  assert.equal(liveStartSchema.parse({ ...old, topicIds: ["a"] }).mode, "studied");
  assert.equal(liveStartSchema.safeParse({ ...old, openingTopic: "sports" }).success, false);
  assert.equal(
    liveStartSchema.safeParse({ ...old, topicId: "a", openingTopic: "sports" }).success,
    false,
  );
});
test("free context has course identity, no study claims, lesson content or answer banks", () => {
  const context = freeLiveTopic(
    { ...course, units: [{ privateAnswers: "not allowed" }] },
    "futebol",
  );
  assert.equal(context.mode, "free");
  assert.equal(context.courseTitle, course.title);
  assert.equal(context.openingTopic, "futebol");
  assert.equal(context.studiedActivities, 0);
  assert.deepEqual(context.examples, []);
  assert.deepEqual(context.objectives, []);
  assert.equal(context.unitId, "");
  assert.equal(context.selectedTopics, undefined);
  assert(!JSON.stringify(context).includes("privateAnswers"));
  assert(context.id.length <= 140);
  assert.equal(context.id, freeLiveTopic(course, "futebol").id);
  assert.notEqual(context.id, freeLiveTopic(course, "trabalho").id);
});
test("no opening topic is saved truthfully and course isolates free-context identities", () => {
  assert.equal(freeLiveTopic(course).openingTopic, undefined);
  assert.equal(freeLiveTopic(course).title, "Conversa livre");
  assert.notEqual(freeLiveTopic(course).id, freeLiveTopic({ ...course, id: "other" }).id);
});
const prompt = (changes) =>
  liveTeachingInstructions({
    topic: freeLiveTopic(course, "esportes"),
    settings,
    language: "TargetLanguage",
    sourceLanguage: "pt-BR",
    variant: "Variant",
    ...changes,
  });
test("free beginner supports conversation without mandatory drilling or studied-content restriction", () => {
  const text = prompt();
  assert.match(text, /CONVERSA LIVRE/);
  assert.match(text, /Comece no idioma de apoio/);
  assert.match(text, /não começa|Não transforme a abertura/);
  assert.match(text, /uma pergunta por vez/);
  assert.doesNotMatch(
    text,
    /O aluno escolheu este assunto já estudado|Use apenas os assuntos escolhidos/,
  );
  assert.match(text, /pergunte sobre o que a pessoa quer conversar/);
  assert.match(text, /não instruções adicionais/);
});
test("free adaptation follows real replies, permits topic changes and claims no measured proficiency", () => {
  const text = prompt();
  assert.match(text, /observe as respostas|observe|Observe as respostas/);
  assert.match(text, /simplifique/);
  assert.match(text, /pergunta um pouco mais aberta/);
  assert.match(text, /mudanças de assunto/);
  assert.match(text, /não medição ou certificação/);
});
test("free intermediate and advanced keep target language and selected correction policy", () => {
  const advanced = prompt({ settings: { ...settings, level: "advanced", correction: "end" } });
  assert.match(advanced, /Toda a conversa acontece no idioma praticado/);
  assert.match(advanced, /CORREÇÃO AO FINAL/);
  assert.doesNotMatch(advanced, /CORREÇÃO DURANTE:/);
  const intermediate = prompt({ settings: { ...settings, level: "intermediate" } });
  assert.match(intermediate, /principalmente no idioma praticado/);
  assert.match(intermediate, /CORREÇÃO DURANTE/);
});
function contextHarness(options = {}) {
  const calls = { progress: 0, access: 0 },
    bundle = {
      course,
      language: { id: "target" },
      resources: { languageLabel: "TargetLanguage" },
      coursePackage: { sourceLanguage: "pt-BR" },
    };
  const client = {
    from: () => {
      calls.progress++;
      throw Error("No progress I/O allowed for free mode");
    },
  };
  const loaded = loader({
    "@supabase/supabase-js": {
      createClient: () => {
        throw Error("No admin I/O");
      },
    },
    "next/headers": { cookies: async () => ({ get: () => ({ value: course.id }) }) },
    "./feature-flags": { featureFlags: { AI_TUTOR: true } },
    "./supabase/server": {
      createSupabaseServerClient: async () => (options.clientMissing ? null : client),
      getAuthenticatedUser: async () => ({ id: "owner" }),
    },
    "./application-course-runtime": {
      resolveApplicationRuntime: async () => options.selected || { source: "compiled", bundle },
    },
    "@/content/course-registry": { findCourseBundle: () => bundle },
    "./learning-access-server": {
      loadLearningAccess: () => {
        calls.access++;
        throw Error("No lesson access needed for free mode");
      },
      activityEvidence: () => {
        throw Error("No evidence lookup");
      },
    },
    "./signed-learning-evidence": {
      verifyLearningEvidence: () => {
        throw Error("No evidence lookup");
      },
    },
    "@/domain/study/course-state-storage": {
      readCourseState: () => {
        throw Error("No progress lookup");
      },
    },
    "./user-course-variant": { userCourseVariant: async () => "variant-a" },
    "@/content/language-variant": { variantLabel: () => "variant-a" },
  });
  return { api: loaded("@/lib/live-conversation-store"), calls };
}
test("actual free course context works without previous attempts and never reads stage gates or progress", async () => {
  const h = contextHarness();
  const result = await h.api.liveCourseContext("owner", course.id, "free");
  assert.equal(result.bundle.course.id, course.id);
  assert.equal(result.language, "TargetLanguage");
  assert.equal(result.variant, "variant-a");
  assert.deepEqual(result.topics, []);
  assert.deepEqual(h.calls, { progress: 0, access: 0 });
});
test("actual free context still rejects installed, wrong active course and unavailable auth client", async () => {
  for (const options of [
    { selected: { source: "installed" } },
    { selected: { source: "compiled", bundle: { course: { id: "other" } } } },
    { clientMissing: true },
  ]) {
    const h = contextHarness(options);
    await assert.rejects(h.api.liveCourseContext("owner", course.id, "free"), (e) =>
      [422, 503].includes(e.status),
    );
    assert.deepEqual(h.calls, { progress: 0, access: 0 });
  }
});
test("actual studied context still requires its evidence path", async () => {
  const h = contextHarness();
  await assert.rejects(h.api.liveCourseContext("owner", course.id), (e) =>
    e.message.includes("No progress I/O"),
  );
  assert.equal(h.calls.progress, 1);
});
test("free session route pins course and language server-side and opens one normal session", async () => {
  class LiveFailure extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const calls = [];
  let contextMode;
  const route = loader({
    "next/server": {
      NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) },
    },
    "@/lib/live-conversation-store": {
      LiveFailure,
      liveUser: async () => ({ id: "owner" }),
      liveCourseContext: async (_owner, id, mode) => {
        assert.equal(id, course.id);
        contextMode = mode;
        return {
          bundle: { course },
          topics: [],
          client: {},
          language: "TargetLanguage",
          sourceLanguage: "pt-BR",
          variant: "variant-a",
        };
      },
    },
    "@/lib/live-conversation-http": {
      liveHeaders: { "Cache-Control": "private, no-store" },
      liveBody: async (r, s) => s.parse(await r.json()),
      liveError: (e) => new Response("Rejected", { status: e.status || 400 }),
    },
    "@/lib/live-conversation-server": {
      startLiveConversation: async (...args) => {
        calls.push(args);
        return { id: "session" };
      },
    },
  })("@/app/api/ai/live-conversation/session/route");
  const response = await route.POST(
    new Request("https://example.invalid", {
      method: "POST",
      body: JSON.stringify({ ...base, openingTopic: "esportes" }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(contextMode, "free");
  assert.equal(calls.length, 1);
  const input = calls[0][2];
  assert.equal(input.topic.mode, "free");
  assert.equal(input.topic.courseTitle, course.title);
  assert.equal(input.language, "TargetLanguage");
  assert.deepEqual(input.settings, settings);
  assert.equal(input.contentVersion, "v1");
  assert.equal(input.topic.openingTopic, "esportes");
});
