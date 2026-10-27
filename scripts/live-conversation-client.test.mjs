import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const root = process.env.DESTRAVA_TEST_SOURCE_ROOT ?? process.cwd();
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const loaded = { exports: {} };
new Function(
  "exports",
  "module",
  ts.transpileModule(
    fs.readFileSync(path.join(root, "src/domain/conversation/live-client.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
)(loaded.exports, loaded);
const { LiveConversationClient, LiveEventAccumulator } = loaded.exports;
const settings = {
  courseId: "synthetic-course",
  topicId: "studied-topic",
  level: "advanced",
  correction: "immediate",
  voice: "male",
};
const turn = { id: "server-turn", role: "student", text: "Persisted transcript." };
const report = {
  summary: "Practice summary",
  strengths: ["One strength"],
  improvements: [],
  nextPractice: ["Keep practising"],
  limits: "No formal score.",
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  for (let index = 0; index < 15; index++) await Promise.resolve();
};
class Clock {
  time = 1000;
  next = 1;
  jobs = new Map();
  callbacks = new Map();
  set = (callback, ms) => {
    const id = this.next++;
    this.jobs.set(id, { at: this.time + ms, callback });
    this.callbacks.set(id, callback);
    return id;
  };
  clear = (id) => this.jobs.delete(id);
  advance(ms) {
    const until = this.time + ms;
    for (;;) {
      const first = [...this.jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!first || first[1].at > until) break;
      this.time = first[1].at;
      this.jobs.delete(first[0]);
      first[1].callback();
    }
    this.time = until;
  }
}
function fixture(options = {}) {
  const clock = new Clock(),
    calls = [],
    snapshots = [],
    tracks = [],
    peers = [],
    energies = [],
    abandoned = [];
  let meterSample = null,
    meterStops = 0,
    closes = 0,
    count = 0;
  const audio = {
    srcObject: null,
    muted: true,
    pauses: 0,
    play: () => (options.playReject ? Promise.reject(new Error("autoplay")) : Promise.resolve()),
    pause() {
      this.pauses++;
    },
  };
  function makeMedia() {
    const track = {
      enabled: true,
      stopped: 0,
      stop() {
        this.stopped++;
      },
    };
    tracks.push(track);
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  }
  const media = makeMedia();
  const env = {
    now: () => clock.time,
    uuid: () => "11111111-1111-4111-8111-111111111111",
    set: clock.set,
    clear: clock.clear,
    audio,
    unlockAudio: () => options.unlockDeferred?.promise ?? Promise.resolve(),
    getMicrophone: () =>
      options.micDeferred?.promise ??
      (options.denied
        ? Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }))
        : Promise.resolve(peers.length ? makeMedia() : media)),
    createPeer: () => {
      const channel = {
        readyState: "open",
        sent: [],
        closed: 0,
        onmessage: null,
        onclose: null,
        onerror: null,
        send(text) {
          this.sent.push(JSON.parse(text));
        },
        close() {
          this.closed++;
        },
      };
      const peer = {
        channel,
        localDescription: null,
        remoteDescription: null,
        connectionState: "new",
        closed: 0,
        ontrack: null,
        onconnectionstatechange: null,
        createDataChannel(name, config) {
          assert.equal(name, "oai-events");
          assert.equal(config.ordered, true);
          return channel;
        },
        addTrack() {},
        createOffer: () => Promise.resolve({ type: "offer", sdp: "local-offer" }),
        setLocalDescription(value) {
          this.localDescription = value;
          return Promise.resolve();
        },
        setRemoteDescription(value) {
          this.remoteDescription = value;
          if (options.sdpReject) return Promise.reject(new Error("bad sdp"));
          return options.sdpDeferred?.promise ?? Promise.resolve();
        },
        close() {
          this.closed++;
          this.connectionState = "closed";
        },
      };
      peers.push(peer);
      return peer;
    },
    meter: (_stream, sample) => {
      meterSample = sample;
      return () => {
        meterStops++;
        sample(0);
      };
    },
    closeAudio: () => {
      closes++;
    },
    abandon: (id) => abandoned.push(id),
    post: async (endpoint, body) => {
      calls.push({ endpoint, body: structuredClone(body) });
      if (endpoint === "/session") {
        if (options.sessionDeferred) return options.sessionDeferred.promise;
        if (options.sessionReject) throw new Error("private transport error");
        count++;
        return {
          id: "22222222-2222-4222-8222-" + String(count).padStart(12, "0"),
          answerSdp: "remote-answer",
          expiresAt: new Date(clock.time + (options.expiresIn ?? 480000)).toISOString(),
          maxSeconds: options.maxSeconds ?? 480,
          model: "gpt-live-1",
          topic: { id: settings.topicId, title: "Studied topic" },
          languageLabel: "Synthetic language",
        };
      }
      if (endpoint === "/finish") {
        if (options.finishDeferred) return options.finishDeferred.promise;
        if (options.finishReject) throw new Error("private report error");
        return {
          id: body.id,
          status: "completed",
          report: options.reportNull ? null : report,
          transcript: [turn],
          ...(options.reportNull ? { reportError: "Summary unavailable." } : {}),
        };
      }
      if (body.action === "heartbeat" && options.heartbeatDeferred)
        return options.heartbeatDeferred.promise;
      if (body.action !== "heartbeat" && options.controlDeferred)
        return options.controlDeferred.promise;
      if (options.controlReject) throw new Error("control failed");
      return { ok: true, status: body.action === "pause" ? "paused" : "active" };
    },
  };
  const controller = new LiveConversationClient(
    env,
    (snapshot) => snapshots.push(structuredClone(snapshot)),
    (energy) => energies.push(energy),
  );
  const send = (value, peer = peers.at(-1)) =>
    peer.channel.onmessage?.({ data: JSON.stringify(value) });
  const started = () =>
    send({ type: "session.started", event_id: "started-" + peers.length, session: {} });
  return {
    controller,
    env,
    clock,
    calls,
    snapshots,
    tracks,
    peers,
    audio,
    media,
    abandoned,
    energies,
    started,
    send,
    meterSample: (value) => meterSample?.(value),
    meterStops: () => meterStops,
    closes: () => closes,
  };
}
const event = (id, type, delta, start_ms = 0, end_ms = 10) => ({
  event_id: id,
  type,
  delta,
  start_ms,
  end_ms,
});
test("deltas preserve delivery order and repeated words, deduplicate IDs, and do not invent complete or interrupted turns", () => {
  const state = new LiveEventAccumulator();
  state.accept(event("1", "session.input_transcript.delta", "I "));
  state.accept(event("2", "session.input_transcript.delta", "I ", 11, 20));
  state.accept(event("2", "session.input_transcript.delta", "duplicate", 11, 20));
  state.accept(event("3", "session.output_transcript.delta", "Hello.", 21, 40));
  state.accept(event("4", "session.input_transcript.delta", "Again.", 5, 15));
  assert.deepEqual(
    state.turns.map((t) => [t.role, t.text]),
    [
      ["student", "I I "],
      ["partner", "Hello."],
      ["student", "Again."],
    ],
  );
  assert.equal(state.turns[0].startMs, 0);
  assert.equal(state.turns[0].endMs, 20);
  assert.equal(state.turns[1].interrupted, undefined);
});
test("malformed/unknown events do not mutate transcripts; usage is cumulative, never summed", () => {
  const state = new LiveEventAccumulator();
  for (const value of [
    null,
    [],
    "x",
    { type: "session.started" },
    event("bad", "session.input_transcript.delta", "bad", 10, 0),
    event("old-api", "conversation.item.input_audio_transcription.completed", "bad"),
  ])
    assert.equal(state.accept(value), null);
  assert.equal(state.turns.length, 0);
  for (const [event_id, seconds] of [
    ["a", 2],
    ["b", 4],
    ["c", 3],
    ["d", NaN],
  ])
    state.accept({ type: "session.usage.updated", event_id, usage: { seconds } });
  assert.equal(state.usageSeconds, 4);
});
test("session settings are sent unchanged and microphone stays disabled until SDP plus session.started", async () => {
  const f = fixture();
  await f.controller.start(settings);
  assert.equal(f.controller.current.phase, "connecting");
  assert.equal(f.tracks[0].enabled, false);
  assert.deepEqual(f.calls[0].body, { ...settings, sdp: "local-offer", operationId: f.env.uuid() });
  f.started();
  assert.equal(f.controller.current.phase, "listening");
  assert.equal(f.tracks[0].enabled, true);
  f.controller.dispose();
});
test("early started event cannot enable the microphone before setRemoteDescription resolves", async () => {
  const pending = deferred(),
    f = fixture({ sdpDeferred: pending });
  const start = f.controller.start(settings);
  await settle();
  f.started();
  assert.equal(f.controller.current.phase, "connecting");
  assert.equal(f.tracks[0].enabled, false);
  pending.resolve();
  await start;
  assert.equal(f.controller.current.phase, "listening");
  f.controller.dispose();
});
test("absence of session.started times out, closes every resource and never pretends audio connected", async () => {
  const f = fixture();
  await f.controller.start(settings);
  f.clock.advance(30000);
  await settle();
  assert.ok(f.tracks.every((track) => track.stopped > 0));
  assert.equal(f.peers[0].closed, 1);
  assert.equal(f.peers[0].channel.closed, 1);
  assert.ok(!f.snapshots.some((s) => s.phase === "listening"));
  assert.equal(f.calls.filter((c) => c.endpoint === "/finish").length, 1);
  assert.equal(f.clock.jobs.size, 0);
});
test("permission denial and failed SDP stop resources and do not expose transport messages", async () => {
  for (const options of [{ denied: true }, { sdpReject: true }, { sessionReject: true }]) {
    const f = fixture(options);
    await f.controller.start(settings);
    await settle();
    assert.equal(f.audio.srcObject, null);
    assert.ok(f.closes() > 0);
    assert.equal(f.clock.jobs.size, 0);
    assert.ok(!f.snapshots.some((s) => s.phase === "listening"));
    assert.ok(!f.controller.current.message.includes("private"));
    if (!options.denied) assert.ok(f.tracks.every((t) => t.stopped > 0));
    f.controller.dispose();
  }
});
test("a microphone granted after dispose is immediately stopped without creating a peer", async () => {
  const pending = deferred(),
    f = fixture({ micDeferred: pending });
  const start = f.controller.start(settings);
  await settle();
  f.controller.dispose();
  pending.resolve(f.media);
  await start;
  assert.equal(f.tracks[0].stopped, 1);
  assert.equal(f.peers.length, 0);
});
test("session creation resolved after exit finalizes the late application ID without publishing to another owner", async () => {
  const pending = deferred(),
    f = fixture({ sessionDeferred: pending });
  const start = f.controller.start(settings);
  await settle();
  f.controller.dispose();
  const count = f.snapshots.length;
  pending.resolve({ id: "late-app-id" });
  await start;
  assert.deepEqual(f.abandoned, ["late-app-id"]);
  assert.equal(f.snapshots.length, count);
  assert.ok(f.tracks[0].stopped > 0);
});
test("an exit while awaiting remote SDP cannot activate a late session", async () => {
  const pending = deferred(),
    f = fixture({ sdpDeferred: pending });
  const start = f.controller.start(settings);
  await settle();
  f.controller.dispose();
  const count = f.snapshots.length;
  pending.resolve();
  await start;
  assert.equal(f.snapshots.length, count);
  assert.ok(f.abandoned.length === 1);
  assert.equal(f.tracks[0].enabled, false);
});
test("real remote energy alone changes speaking state; transcript deltas cannot animate imaginary speech", async () => {
  const f = fixture();
  await f.controller.start(settings);
  f.started();
  f.send(event("text", "session.output_transcript.delta", "Hello."));
  assert.equal(f.controller.current.phase, "listening");
  const remote = { getTracks: () => [{ stop() {} }] };
  f.peers[0].ontrack({ streams: [remote], track: { stop() {} } });
  assert.equal(f.audio.srcObject, remote);
  f.meterSample(0.5);
  assert.equal(f.controller.current.phase, "speaking");
  f.clock.advance(251);
  f.meterSample(0);
  assert.equal(f.controller.current.phase, "listening");
  f.controller.dispose();
  assert.equal(f.meterStops(), 1);
  assert.equal(f.audio.srcObject, null);
  assert.equal(f.energies.at(-1), 0);
});
test("autoplay failure ends the call and closes the analyser instead of displaying a silent success", async () => {
  const f = fixture({ playReject: true });
  await f.controller.start(settings);
  f.started();
  f.peers[0].ontrack({ streams: [{ getTracks: () => [{ stop() {} }] }], track: { stop() {} } });
  await settle();
  assert.ok(f.tracks[0].stopped > 0);
  assert.equal(f.meterStops(), 1);
  assert.ok(f.controller.current.message.length > 0);
});
test("pause mutes locally immediately and resume waits for control ACK; only permitted SDK events are sent", async () => {
  const pending = deferred(),
    f = fixture({ controlDeferred: pending });
  await f.controller.start(settings);
  f.started();
  const pause = f.controller.pause(true);
  assert.equal(f.tracks[0].enabled, false);
  assert.equal(f.audio.muted, true);
  assert.equal(f.controller.current.pending, true);
  assert.deepEqual(f.peers[0].channel.sent, [{ type: "session.input_audio.mute" }]);
  pending.resolve({ ok: true, status: "paused" });
  await pause;
  // The following fake response deliberately rejects resume; local audio must remain muted.
  await f.controller.pause(false);
  await settle();
  assert.equal(f.tracks[0].enabled, false);
  assert.equal(f.audio.muted, true);
  assert.ok(
    f.peers[0].channel.sent.every((e) =>
      ["session.input_audio.mute", "session.input_audio.unmute", "session.close"].includes(e.type),
    ),
  );
});
test("successful resume restores both audio directions after the server confirms active", async () => {
  const f = fixture();
  await f.controller.start(settings);
  f.started();
  await f.controller.pause(true);
  assert.equal(f.controller.current.phase, "paused");
  await f.controller.pause(false);
  assert.equal(f.controller.current.phase, "listening");
  assert.equal(f.tracks[0].enabled, true);
  assert.equal(f.audio.muted, false);
  assert.deepEqual(f.peers[0].channel.sent, [
    { type: "session.input_audio.mute" },
    { type: "session.input_audio.unmute" },
  ]);
  f.controller.dispose();
});
test("late resume ACK after finish cannot reopen the microphone or publish success", async () => {
  const f = fixture();
  await f.controller.start(settings);
  f.started();
  await f.controller.pause(true);
  const pending = deferred();
  f.env.post = (endpoint, body) =>
    endpoint === "/control"
      ? pending.promise
      : Promise.resolve({ id: body.id, status: "completed", report: null, transcript: [] });
  const resume = f.controller.pause(false);
  await f.controller.finish();
  const count = f.snapshots.length;
  pending.resolve({ ok: true, status: "active" });
  await resume;
  assert.equal(f.tracks[0].enabled, false);
  assert.equal(f.snapshots.length, count);
});
test("typed questions use the control API and never send old realtime session updates or response creation", async () => {
  const f = fixture();
  await f.controller.start(settings);
  f.started();
  assert.equal(await f.controller.message("  Please explain.  "), true);
  assert.deepEqual(f.calls.at(-1).body, {
    id: f.controller.current.session.id,
    action: "message",
    text: "Please explain.",
  });
  assert.equal(f.peers[0].channel.sent.length, 0);
  f.controller.dispose();
});
test("wall clock cutoff still stops mic while paused and final report stays pending until finish ACK", async () => {
  const pending = deferred(),
    f = fixture({ finishDeferred: pending });
  await f.controller.start(settings);
  f.started();
  await f.controller.pause(true);
  const id = f.controller.current.session.id;
  f.clock.advance(480000);
  await settle();
  assert.equal(f.controller.current.phase, "ending");
  assert.equal(f.controller.current.report, null);
  assert.equal(f.tracks[0].enabled, false);
  assert.ok(f.tracks[0].stopped > 0);
  assert.equal(f.clock.jobs.size, 0);
  pending.resolve({ id, status: "completed", report, transcript: [turn] });
  await settle();
  assert.equal(f.controller.current.phase, "completed");
  assert.deepEqual(f.controller.current.turns, [turn]);
});
test("server expiry earlier than eight minutes wins, and a larger server limit cannot exceed eight minutes", async () => {
  for (const options of [{ expiresIn: 120000 }, { expiresIn: 900000, maxSeconds: 900 }]) {
    const f = fixture(options);
    await f.controller.start(settings);
    f.started();
    f.clock.advance(options.expiresIn === 120000 ? 120000 : 480000);
    await settle();
    assert.ok(f.tracks[0].stopped > 0);
    assert.equal(f.calls.filter((c) => c.endpoint === "/finish").length, 1);
  }
});
test("heartbeat occurs after 15 seconds and its failure closes audio explicitly", async () => {
  const pending = deferred(),
    f = fixture({ heartbeatDeferred: pending });
  await f.controller.start(settings);
  f.started();
  f.clock.advance(14999);
  assert.equal(f.calls.filter((c) => c.body.action === "heartbeat").length, 0);
  f.clock.advance(1);
  assert.equal(f.calls.filter((c) => c.body.action === "heartbeat").length, 1);
  pending.reject(new Error("network"));
  await settle();
  assert.ok(f.tracks[0].stopped > 0);
  assert.ok(f.controller.current.message.length > 0);
});
test("late heartbeat resolution/rejection and dispatched old timers cannot mutate a new generation", async () => {
  for (const reject of [false, true]) {
    const pending = deferred(),
      f = fixture({ heartbeatDeferred: pending });
    await f.controller.start(settings);
    f.started();
    const oldTimers = [...f.clock.callbacks.values()];
    f.clock.advance(15000);
    await f.controller.finish();
    await f.controller.start(settings);
    f.started();
    const id = f.controller.current.session.id,
      count = f.snapshots.length,
      jobs = f.clock.jobs.size;
    if (reject) pending.reject(new Error("old failure"));
    else pending.resolve({ ok: true });
    await settle();
    for (const callback of oldTimers) callback();
    await settle();
    assert.equal(f.controller.current.session.id, id);
    assert.equal(f.controller.current.phase, "listening");
    assert.equal(f.snapshots.length, count);
    assert.equal(f.clock.jobs.size, jobs);
    f.controller.dispose();
  }
});
test("finish is shared while pending, never reports success before ACK, and preserves explicit missing-report result", async () => {
  const pending = deferred(),
    f = fixture({ finishDeferred: pending });
  await f.controller.start(settings);
  f.started();
  const id = f.controller.current.session.id,
    a = f.controller.finish(),
    b = f.controller.finish();
  assert.equal(a, b);
  assert.equal(f.controller.current.phase, "ending");
  assert.equal(f.calls.filter((c) => c.endpoint === "/finish").length, 1);
  pending.resolve({
    id,
    status: "completed",
    report: null,
    reportError: "Not available.",
    transcript: [turn],
  });
  await a;
  assert.equal(f.controller.current.phase, "completed");
  assert.equal(f.controller.current.report, null);
  assert.equal(f.controller.current.reportError, "Not available.");
});
test("a failed finish retains the application ID for an idempotent retry without reopening hardware", async () => {
  const f = fixture({ finishReject: true });
  await f.controller.start(settings);
  f.started();
  await f.controller.finish();
  assert.equal(f.controller.current.phase, "error");
  const id = f.controller.current.session.id;
  f.env.post = (_endpoint, body) =>
    Promise.resolve({ id: body.id, status: "completed", report, transcript: [turn] });
  await f.controller.finish();
  assert.equal(f.controller.current.phase, "completed");
  assert.equal(f.controller.current.session.id, id);
  assert.equal(f.peers.length, 1);
  assert.equal(f.tracks[0].enabled, false);
});
test("malformed finish ACK cannot display an unrelated report or call the session completed", async () => {
  const pending = deferred(),
    f = fixture({ finishDeferred: pending });
  await f.controller.start(settings);
  f.started();
  const closing = f.controller.finish();
  pending.resolve({ id: "wrong-id", status: "completed", report, transcript: [] });
  await closing;
  assert.equal(f.controller.current.phase, "error");
  assert.equal(f.controller.current.report, null);
});
test("connection loss and server errors stop all tracks, discard callbacks and preserve interruption notice", async () => {
  for (const mode of ["connection", "error", "closed", "bad-json"]) {
    const f = fixture();
    await f.controller.start(settings);
    f.started();
    const channel = f.peers[0].channel,
      callback = channel.onmessage;
    if (mode === "connection") {
      f.peers[0].connectionState = "disconnected";
      f.peers[0].onconnectionstatechange();
    }
    if (mode === "error")
      f.send({ type: "error", event_id: "error", error: { message: "private error" } });
    if (mode === "closed")
      f.send({ type: "session.closed", event_id: "closed", reason: "connection_lost" });
    if (mode === "bad-json") callback({ data: "not JSON" });
    await settle();
    const count = f.snapshots.length;
    callback({ data: JSON.stringify(event("late", "session.input_transcript.delta", "late")) });
    assert.ok(f.tracks[0].stopped > 0);
    assert.equal(f.snapshots.length, count);
    assert.ok(f.controller.current.message.length > 0);
    assert.ok(!f.controller.current.message.includes("private"));
  }
});
test("dispose closes hardware immediately and uses finish beacon once, without assuming persistence success", async () => {
  const f = fixture();
  await f.controller.start(settings);
  f.started();
  const id = f.controller.current.session.id,
    count = f.snapshots.length;
  f.controller.dispose();
  f.controller.dispose();
  assert.deepEqual(f.abandoned, [id]);
  assert.equal(f.clock.jobs.size, 0);
  assert.equal(f.peers[0].closed, 1);
  assert.ok(f.tracks[0].stopped > 0);
  assert.equal(f.snapshots.length, count);
});

test("remote audio remains muted before started and neither audio energy nor deltas can claim a connected session", async () => {
  const f = fixture();
  await f.controller.start(settings);
  f.peers[0].ontrack({ streams: [{ getTracks: () => [{ stop() {} }] }], track: { stop() {} } });
  assert.equal(f.audio.muted, true);
  f.meterSample(0.8);
  assert.equal(f.controller.current.phase, "connecting");
  assert.equal(f.energies.at(-1), 0);
  f.started();
  assert.equal(f.audio.muted, false);
  f.meterSample(0.8);
  assert.equal(f.controller.current.phase, "speaking");
  f.controller.dispose();
});
test("a local microphone or remote audio track ending releases the rest of the call and warns the learner", async () => {
  for (const mode of ["microphone", "remote"]) {
    const f = fixture();
    await f.controller.start(settings);
    f.started();
    if (mode === "microphone") f.tracks[0].onended();
    else {
      const track = { stop() {} };
      f.peers[0].ontrack({ streams: [{ getTracks: () => [track] }], track });
      track.onended();
    }
    await settle();
    assert.ok(f.tracks[0].stopped > 0);
    assert.equal(f.audio.srcObject, null);
    assert.equal(f.clock.jobs.size, 0);
    assert.ok(f.controller.current.message.length > 0);
  }
});
test("valid session identity with malformed report or transcript cannot become a completed result", async () => {
  for (const malformed of [
    { report: { summary: "Incomplete" }, transcript: [] },
    { report, transcript: [{ id: "t", role: "admin", text: "wrong role" }] },
  ]) {
    const pending = deferred(),
      f = fixture({ finishDeferred: pending });
    await f.controller.start(settings);
    f.started();
    const closing = f.controller.finish();
    pending.resolve({ id: f.controller.current.session.id, status: "completed", ...malformed });
    await closing;
    assert.equal(f.controller.current.phase, "error");
    assert.equal(f.controller.current.report, null);
  }
});
test("cancel before session creation completes releases hardware; its late result cannot replace a newer session", async () => {
  const pending = deferred(),
    f = fixture({ sessionDeferred: pending });
  const a = f.controller.start(settings);
  await settle();
  await f.controller.finish("Cancelled");
  const nextId = "33333333-3333-4333-8333-333333333333";
  f.env.post = (endpoint, body) =>
    Promise.resolve(
      endpoint === "/session"
        ? {
            id: nextId,
            answerSdp: "answer",
            model: "gpt-live-1",
            expiresAt: new Date(f.clock.time + 480000).toISOString(),
            maxSeconds: 480,
            topic: { id: "new", title: "New topic" },
            languageLabel: "Language",
          }
        : { id: body.id, status: "completed", report, transcript: [] },
    );
  await f.controller.start(settings);
  f.started();
  const count = f.snapshots.length;
  pending.resolve({ id: "old-late-session" });
  await a;
  assert.equal(f.controller.current.session.id, nextId);
  assert.equal(f.snapshots.length, count);
  assert.deepEqual(f.abandoned, ["old-late-session"]);
  f.controller.dispose();
});
test("dispose while finish awaits its ACK cannot publish a report or error into a new owner", async () => {
  for (const reject of [false, true]) {
    const pending = deferred(),
      f = fixture({ finishDeferred: pending });
    await f.controller.start(settings);
    f.started();
    const id = f.controller.current.session.id,
      closing = f.controller.finish();
    f.controller.dispose();
    const count = f.snapshots.length;
    if (reject) pending.reject(new Error("old error"));
    else pending.resolve({ id, status: "completed", report, transcript: [] });
    await closing;
    assert.equal(f.snapshots.length, count);
    assert.deepEqual(f.abandoned, [id]);
  }
});
test("connection timeout also owns delayed microphone permission and does not leave newly granted tracks running", async () => {
  const pending = deferred(),
    f = fixture({ micDeferred: pending });
  const start = f.controller.start(settings);
  await settle();
  f.clock.advance(30000);
  assert.equal(f.controller.current.phase, "error");
  pending.resolve(f.media);
  await start;
  assert.ok(f.tracks[0].stopped > 0);
  assert.equal(f.peers.length, 0);
  assert.equal(f.clock.jobs.size, 0);
});

test("expired and failed persisted finishes retain their real terminal status without inventing a report", async () => {
  for (const status of ["expired", "failed"]) {
    const pending = deferred(),
      f = fixture({ finishDeferred: pending });
    await f.controller.start(settings);
    f.started();
    const closing = f.controller.finish();
    pending.resolve({
      id: f.controller.current.session.id,
      status,
      report: null,
      reportError: "No evaluation available.",
      transcript: [],
    });
    await closing;
    assert.equal(f.controller.current.resultStatus, status);
    assert.equal(f.controller.current.phase, "completed");
    assert.equal(f.controller.current.report, null);
    assert.equal(f.controller.current.reportError, "No evaluation available.");
    assert.ok(f.tracks[0].stopped > 0);
  }
});
test("unknown nonterminal finish status is never treated as a confirmed closure", async () => {
  const pending = deferred(),
    f = fixture({ finishDeferred: pending });
  await f.controller.start(settings);
  f.started();
  const closing = f.controller.finish();
  pending.resolve({
    id: f.controller.current.session.id,
    status: "active",
    report: null,
    transcript: [],
  });
  await closing;
  assert.equal(f.controller.current.phase, "error");
  assert.equal(f.controller.current.resultStatus, null);
});

test("a paused conversation rejects typed help without any request, channel event or pending-state publication", async () => {
  const f = fixture();
  await f.controller.start(settings);
  f.started();
  await f.controller.pause(true);
  const requests = f.calls.length,
    events = f.peers[0].channel.sent.length,
    publications = f.snapshots.length;
  assert.equal(await f.controller.message("Please explain."), false);
  assert.equal(f.calls.length, requests);
  assert.equal(f.peers[0].channel.sent.length, events);
  assert.equal(f.snapshots.length, publications);
  assert.equal(f.controller.current.phase, "paused");
  assert.equal(f.tracks[0].enabled, false);
  assert.equal(f.audio.muted, true);
  f.controller.dispose();
});
test("finish receives a 60s fetch deadline while session and control keep their 45s deadlines", async (context) => {
  const delays = [],
    requests = [];
  context.mock.method(AbortSignal, "timeout", (ms) => {
    delays.push(ms);
    return new AbortController().signal;
  });
  context.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body), signal: init.signal });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const env = loaded.exports.browserLiveEnvironment({});
  await env.post("/finish", { id: "app-id" });
  await env.post("/session", { operationId: "operation-id" });
  await env.post("/control", { id: "app-id", action: "heartbeat" });
  assert.deepEqual(delays, [60000, 45000, 45000]);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/ai/live-conversation/finish",
      "/api/ai/live-conversation/session",
      "/api/ai/live-conversation/control",
    ],
  );
  assert.ok(requests.every((request) => request.signal instanceof AbortSignal));
});

test("history report retry uses finish only and accepts the actual confirmed terminal status/report", async (context) => {
  const calls = [];
  for (const status of ["completed", "expired", "failed"]) {
    context.mock.method(globalThis, "fetch", async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          id: "history-id",
          status,
          report: status === "completed" ? report : null,
          transcript: [turn],
          reportError: status === "completed" ? undefined : "Unavailable.",
        }),
      );
    });
    const result = await loaded.exports.prepareLiveReport("history-id");
    assert.equal(result.id, "history-id");
    assert.equal(result.status, status);
    assert.deepEqual(result.transcript, [turn]);
    assert.equal(Boolean(result.report), status === "completed");
    context.mock.restoreAll();
  }
  assert.deepEqual(
    calls,
    Array.from({ length: 3 }, () => ({
      url: "/api/ai/live-conversation/finish",
      body: { id: "history-id" },
    })),
  );
});
test("history retry rejects wrong IDs, unknown status, malformed reports and malformed transcripts", async (context) => {
  for (const override of [
    { id: "other-id" },
    { status: "active" },
    { report: { summary: "Incomplete" } },
    { transcript: [{ id: "t", role: "unknown", text: "Invalid" }] },
  ]) {
    context.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            id: "history-id",
            status: "completed",
            report,
            transcript: [turn],
            ...override,
          }),
        ),
    );
    await assert.rejects(loaded.exports.prepareLiveReport("history-id"));
    context.mock.restoreAll();
  }
});
test("already-aborted history context cannot issue a finish request", async (context) => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new Error("Must not fetch");
  });
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(loaded.exports.prepareLiveReport("history-id", abort.signal), {
    name: "AbortError",
  });
  assert.equal(calls, 0);
});
test("history context cancellation propagates and rejects an ACK arriving after selection/owner has changed", async (context) => {
  const pending = deferred(),
    abort = new AbortController();
  let requestSignal;
  context.mock.method(globalThis, "fetch", (_url, init) => {
    requestSignal = init.signal;
    return pending.promise;
  });
  const result = loaded.exports.prepareLiveReport("history-id", abort.signal),
    rejected = assert.rejects(result, { name: "AbortError" });
  abort.abort();
  assert.equal(requestSignal.aborted, true);
  pending.resolve(
    new Response(
      JSON.stringify({ id: "history-id", status: "completed", report, transcript: [turn] }),
    ),
  );
  await rejected;
});
test("history report retry enforces its 60s deadline and clears the timer without accepting late success", async (context) => {
  const pending = deferred();
  let expire,
    cleared = false,
    signal;
  context.mock.method(globalThis, "setTimeout", (callback, ms) => {
    assert.equal(ms, 60000);
    expire = callback;
    return 999;
  });
  context.mock.method(globalThis, "clearTimeout", (id) => {
    assert.equal(id, 999);
    cleared = true;
  });
  context.mock.method(globalThis, "fetch", (_url, init) => {
    signal = init.signal;
    return pending.promise;
  });
  const result = loaded.exports.prepareLiveReport("history-id"),
    rejected = assert.rejects(result, { name: "AbortError" });
  expire();
  assert.equal(signal.aborted, true);
  pending.resolve(
    new Response(
      JSON.stringify({ id: "history-id", status: "completed", report, transcript: [turn] }),
    ),
  );
  await rejected;
  assert.equal(cleared, true);
});

test("multi-topic request keeps the complete selection and uses the existing single-call lifecycle", async () => {
  const f = fixture();
  const { topicId: _legacy, ...base } = settings;
  void _legacy;
  const selection = { ...base, topicIds: ["studied-a", "studied-b"] };
  await f.controller.start(selection);
  assert.deepEqual(f.calls[0].body, {
    ...selection,
    sdp: "local-offer",
    operationId: f.env.uuid(),
  });
  assert.equal(f.calls.filter((call) => call.endpoint === "/session").length, 1);
  assert.equal(f.tracks[0].enabled, false);
  f.started();
  assert.equal(f.tracks[0].enabled, true);
  f.controller.dispose();
});
