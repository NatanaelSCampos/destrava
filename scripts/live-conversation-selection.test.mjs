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
  { groupLiveTopics, toggleLiveTopics, topicSelectionState, LIVE_MAX_TOPICS } = load(
    "@/domain/conversation/live-topic-selection",
  );
const { selectedLiveTopicContext } = load("@/domain/conversation/live-topic-context");
const { liveStartSchema } = load("@/domain/conversation/live-contract");
const topic = (id, unit = 1) => ({
  id,
  title: "Etapa " + id,
  description: "Um encontro na praça",
  unitId: "u" + unit,
  unitNumber: unit,
  unitTitle: "Encontros " + unit,
  studiedActivities: 1,
  examples: [{ text: "Example " + id, translation: "Exemplo " + id }],
  objectives: ["Communicate " + id],
});
const topics = [topic("a"), topic("b"), topic("c", 2)];
const base = {
  courseId: "course",
  operationId: "49d2fb00-1f99-4f00-9daa-5d56aa045682",
  sdp: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
  level: "beginner",
  correction: "end",
  voice: "female",
};
test("hierarchy: unit groups preserve canonical stage order without mutating input", () => {
  const original = JSON.stringify(topics);
  const groups = groupLiveTopics(topics);
  assert.deepEqual(
    groups.map((g) => g.topics.map((t) => t.id)),
    [["a", "b"], ["c"]],
  );
  assert.equal(JSON.stringify(topics), original);
});
test("search: accents, multiple terms, unit filter and zero matches", () => {
  assert.equal(groupLiveTopics(topics, "praca encontro")[0].matches.length, 2);
  assert.deepEqual(
    groupLiveTopics(topics, "", "u2")[0].topics.map((t) => t.id),
    ["c"],
  );
  assert.equal(groupLiveTopics(topics, "absent").length, 0);
});
test("search never shrinks whole-unit selection to visible matching stages", () => {
  const group = groupLiveTopics(
    topics.map((t) => (t.id === "a" ? { ...t, title: "UniqueNeedle" } : t)),
    "UniqueNeedle",
  )[0];
  assert.equal(group.matches.length, 1);
  assert.equal(group.topics.length, 2);
  assert.deepEqual(
    toggleLiveTopics(
      [],
      group.topics.map((t) => t.id),
    ),
    ["a", "b"],
  );
});
test("multiple stages, deselection and cross-unit additions preserve other choices", () => {
  const initial = ["a"];
  const second = toggleLiveTopics(initial, ["b", "c"]);
  assert.deepEqual(second, ["a", "b", "c"]);
  assert.deepEqual(initial, ["a"]);
  assert.deepEqual(toggleLiveTopics(second, ["b"]), ["a", "c"]);
  assert.deepEqual(toggleLiveTopics(second, ["a", "b"]), ["c"]);
});
test("unit checkbox computes unchecked, mixed and all; mixed adds remainder", () => {
  assert.deepEqual(topicSelectionState([], ["a", "b"]), { count: 0, all: false, partial: false });
  assert.deepEqual(topicSelectionState(["a"], ["a", "b"]), { count: 1, all: false, partial: true });
  assert.deepEqual(topicSelectionState(["a", "b"], ["a", "b"]), {
    count: 2,
    all: true,
    partial: false,
  });
  assert.deepEqual(toggleLiveTopics(["a"], ["a", "b"]), ["a", "b"]);
});
test("selection limit is atomic, never silently truncates unit; removal still works at limit", () => {
  const ids = Array.from({ length: LIVE_MAX_TOPICS }, (_, i) => String(i));
  assert.equal(toggleLiveTopics(ids, ["new"]), null);
  assert.equal(toggleLiveTopics([], ids).length, LIVE_MAX_TOPICS);
  assert.equal(toggleLiveTopics(ids, [ids[0]]).length, LIVE_MAX_TOPICS - 1);
});
test("request schema supports exactly one legacy ID or bounded unique list", () => {
  assert(liveStartSchema.safeParse({ ...base, topicId: "a" }).success);
  assert(liveStartSchema.safeParse({ ...base, topicIds: ["a", "b"] }).success);
  for (const fields of [
    {},
    { topicIds: [] },
    { topicIds: ["a", "a"] },
    { topicId: "a", topicIds: ["b"] },
    {
      topicIds: Array(65)
        .fill(0)
        .map((_, i) => String(i)),
    },
    { topicIds: ["x".repeat(141)] },
  ])
    assert.equal(liveStartSchema.safeParse({ ...base, ...fields }).success, false);
});
test("single topic retains original context and ID, preserving existing records", () => {
  assert.strictEqual(selectedLiveTopicContext(topics, ["a"]), topics[0]);
});
test("combined context retains every selected stage and deterministic identity regardless of click order", () => {
  const one = selectedLiveTopicContext(topics, ["c", "a"]),
    two = selectedLiveTopicContext(topics, ["a", "c"]);
  assert.deepEqual(one, two);
  assert.deepEqual(
    one.selectedTopics.map((t) => t.id),
    ["a", "c"],
  );
  assert.notEqual(one.id, selectedLiveTopicContext(topics, ["a", "b"]).id);
  assert(one.id.length <= 140);
  assert.equal(one.studiedActivities, 2);
  assert.equal(one.unitNumber, 0);
});
test("combined context: unknown/unavailable ID rejects whole selection without fallback", () => {
  for (const ids of [
    [],
    ["missing"],
    ["a", "missing"],
    ["a", "a"],
    Array.from({ length: 65 }, (_, i) => String(i)),
  ])
    assert.equal(selectedLiveTopicContext(topics, ids), null);
});
test("combined examples are sampled across stages, not exhausted by the first one", () => {
  const full = topics.map((t) => ({
    ...t,
    examples: Array.from({ length: 8 }, (_, i) => ({ text: t.id + i, translation: t.id + i })),
  }));
  const context = selectedLiveTopicContext(full, ["a", "b", "c"]);
  assert.deepEqual(
    context.examples.slice(0, 3).map((x) => x.text),
    ["a0", "b0", "c0"],
  );
  assert.equal(context.examples.length, 16);
});
test("context byte budget rejects oversized selection instead of losing IDs or exceeding storage", () => {
  const long = Array.from({ length: 64 }, (_, i) => ({
    ...topic("id" + i),
    title: "á".repeat(180),
    unitTitle: "é".repeat(180),
  }));
  assert.equal(
    selectedLiveTopicContext(
      long,
      long.map((t) => t.id),
    ),
    null,
  );
});
test("unit context identifies only that unit and stores exact selected stage metadata", () => {
  const context = selectedLiveTopicContext(topics, ["b", "a"]);
  assert.equal(context.unitId, "u1");
  assert.equal(context.unitNumber, 1);
  assert.match(context.title, /2 etapas/);
  assert.deepEqual(
    context.selectedTopics.map((t) => t.title),
    ["Etapa a", "Etapa b"],
  );
  assert(Buffer.byteLength(JSON.stringify(context)) < 12000);
});
test("session route validates ALL selected server topics before provider/quota; injected metadata rejected", async () => {
  class LiveFailure extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const starts = [];
  const loadRoute = loader({
    "next/server": {
      NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) },
    },
    "@/lib/live-conversation-store": {
      LiveFailure,
      liveUser: async () => ({ id: "owner" }),
      liveCourseContext: async () => ({
        topics,
        bundle: { course: { contentVersion: "v1" } },
        client: {},
        language: "X",
        sourceLanguage: "pt",
        variant: "test",
      }),
    },
    "@/lib/live-conversation-http": {
      liveHeaders: { "Cache-Control": "private, no-store" },
      liveBody: async (request, schema) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) throw new LiveFailure(400, "Invalid");
        return parsed.data;
      },
      liveError: (e) => new Response("Rejected", { status: e.status || 503 }),
    },
    "@/lib/live-conversation-server": {
      startLiveConversation: async (...args) => {
        starts.push(args);
        return { id: "ok" };
      },
    },
  });
  const route = loadRoute("@/app/api/ai/live-conversation/session/route");
  const post = (fields) =>
    route.POST(
      new Request("https://test.invalid", {
        method: "POST",
        body: JSON.stringify({ ...base, ...fields }),
      }),
    );
  for (const fields of [
    { topicIds: ["a", "locked"] },
    { topicIds: ["a", "a"] },
    { topicIds: ["a"], topic: { title: "injected" } },
  ])
    assert([400, 403].includes((await post(fields)).status));
  assert.equal(starts.length, 0);
  assert.equal((await post({ topicIds: ["c", "a"] })).status, 200);
  assert.equal(starts.length, 1);
  assert.deepEqual(
    starts[0][2].topic.selectedTopics.map((t) => t.id),
    ["a", "c"],
  );
});
