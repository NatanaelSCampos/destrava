import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { inspectConversationWav } from "../src/domain/conversation/live-audio-contract";
function wav(seconds = 1) {
  const b = new Uint8Array(44 + 32000 * seconds),
    v = new DataView(b.buffer);
  for (const [at, t] of [
    [0, "RIFF"],
    [8, "WAVE"],
    [12, "fmt "],
    [36, "data"],
  ] as const)
    for (let i = 0; i < t.length; i++) b[at + i] = t.charCodeAt(i);
  v.setUint32(4, b.length - 8, true);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  v.setUint32(40, b.length - 44, true);
  return b;
}
test("PCM duration is derived from actual validated bytes", () => {
  assert.deepEqual(inspectConversationWav(wav(2)), { seconds: 2, bytes: 64044 });
});
test("truncated, wrong rate, fake data size, compressed and oversized files fail", () => {
  for (const at of [0, 8, 12, 20, 22, 24, 28, 32, 34, 36, 40]) {
    const b = wav();
    b[at] ^= 7;
    assert.throws(() => inspectConversationWav(b));
  }
  assert.throws(() => inspectConversationWav(wav().slice(0, 400)));
  assert.throws(() => inspectConversationWav(new Uint8Array(16000045)));
});
test("worklet downsamples 48k to16k, flushes, pauses and emits no teacher audio", () => {
  let C: new () => {
    port: { onmessage: ({ data }: { data: string }) => void };
    process: (a: Float32Array[][]) => boolean;
  };
  const messages: Array<{ samples?: Int16Array; done?: boolean }> = [];
  class Base {
    port = {
      onmessage: () => {},
      postMessage: (m: { samples?: Int16Array; done?: boolean }) => messages.push(m),
    };
  }
  vm.runInNewContext(fs.readFileSync("public/audio/conversation-capture.js", "utf8"), {
    AudioWorkletProcessor: Base,
    registerProcessor: (_n: string, c: typeof C) => (C = c),
    sampleRate: 48000,
    Int16Array,
    Math,
  });
  const recorder = new C!();
  for (let i = 0; i < 375; i++) recorder.process([[new Float32Array(128).fill(0.5)]]);
  recorder.port.onmessage({ data: "pause" });
  for (let i = 0; i < 375; i++) recorder.process([[new Float32Array(128).fill(0.8)]]);
  recorder.port.onmessage({ data: "finish" });
  const all = messages.flatMap((m) => Array.from(m.samples ?? []));
  assert.equal(all.length, 16000);
  assert.ok(all.every((v) => v === 16384));
  assert.equal(messages.at(-1)?.done, true);
});
