import assert from "node:assert/strict";
import { NarrationController, narrationLine, transcriptNarration, teachingNarration,
  type NarrationContext, type NarrationSpeaker } from "../src/domain/interactive-lesson/narration-controller";
import { speakText, claimAudioPlayback, type PlaybackHandle } from "../src/lib/speak-text";

let passed = 0;
function check(name: string, run: () => void) { run(); passed++; console.log(`PASS ${name}`); }
const context: NarrationContext = { sourceLanguage: "fr-CA", targetLanguage: "zz",
  targetLocale: "zz-ZZ", targetFallbackAllowed: false };
check("source non PT and synthetic target use declarations", () => {
  assert.equal(narrationLine("s", "Un texte", "fr-CA", context).locale, "fr-CA");
  assert.equal(narrationLine("t", "arbitrary", "zz", context).locale, "zz-ZZ");
  assert.equal(narrationLine("t", "arbitrary", "zz-ZZ", context).role, "target");
  for (const [targetLanguage, targetLocale] of [["es", "es-MX"], ["en", "en-GB"]]) {
    const declared = { ...context, targetLanguage, targetLocale };
    assert.equal(narrationLine("t", "same unchanged text", targetLanguage, declared).locale, targetLocale);
  }
});
check("unknown, mixed and legacy lines never default to target", () => {
  for (const language of [undefined, "de-DE", "pt-BR"])
    assert.equal(narrationLine("x", "hola hello bonjour", language, context).locale, null);
  const lines = transcriptNarration([
    { startMs: 0, endMs: 100, text: "legacy mixed" },
    { startMs: 100, endMs: 200, text: "declared", textPresentation: { language: "zz" } },
  ], context);
  assert.equal(lines[0].locale, null); assert.equal(lines[1].locale, "zz-ZZ");
  assert.equal(lines[1].anchorMs, 100);
});
check("teacher fields carry roles and follow-up requires explicit metadata", () => {
  const reply = { message: "explain", example: "example", translation: "translation", followUp: "ask" };
  const lines = teachingNarration(reply, context);
  assert.deepEqual(lines.map((line) => line.locale), ["fr-CA", "zz-ZZ", "fr-CA", null]);
  assert.equal(teachingNarration({ ...reply, followUpSpeech: { role: "source", language: "fr-CA" } }, context)[3].locale, "fr-CA");
  assert.equal(teachingNarration({ ...reply, followUpSpeech: { role: "source", language: "zz" } }, context)[3].locale, null);
  assert.equal(teachingNarration({ ...reply, unannotatedMessage: true }, context)[0].locale, null);
  const noRole = { ...reply, followUpSpeech: { language: "fr-CA" } };
  assert.equal(teachingNarration(noRole as unknown as Parameters<typeof teachingNarration>[0], context)[3].locale, null);
});
const line = narrationLine("one", "Whole phrase from beginning", "zz", context, 100);
const calls: Array<{ text: string; callbacks: Parameters<NarrationSpeaker>[1]; cancelled: boolean }> = [];
const statuses: string[] = [];
const controller = new NarrationController((line, callbacks) => {
  const call = { text: line.text, callbacks, cancelled: false }; calls.push(call);
  return { cancel: () => { call.cancelled = true; callbacks.cancel(); } };
}, (state) => statuses.push(state.status));
check("construction does not autoplay", () => assert.equal(calls.length, 0));
check("pause cancels owner and resume repeats complete phrase", () => {
  controller.start([line]); assert.equal(calls.length, 1);
  controller.pause(); assert.equal(calls[0].cancelled, true);
  calls[0].callbacks.end(); assert.equal(calls.length, 1);
  controller.resume(); assert.equal(calls.length, 2);
  assert.equal(calls[1].text, line.text);
});
check("cancel invalidates old completion and never resumes another queue", () => {
  controller.cancel(); controller.start([{ ...line, text: "new context" }]);
  calls[1].callbacks.end(); calls[1].callbacks.error();
  assert.equal(calls.length, 3); assert.equal(statuses.at(-1), "speaking");
});
check("speech completion is only presentation completion", () => {
  calls[2].callbacks.end(); assert.equal(statuses.at(-1), "completed");
  calls[2].callbacks.end(); assert.equal(calls.length, 3);
});
check("unknown text does not call speaker; retry requires manual action", () => {
  controller.start([{ ...line, locale: null }]); assert.equal(calls.length, 3);
  assert.equal(statuses.at(-1), "text"); controller.cancel();
});
check("dispose invalidates callbacks and future starts", () => {
  controller.start([line]); const old = calls.at(-1)!; controller.dispose();
  old.callbacks.end(); controller.start([line]); controller.resume(); assert.equal(calls.length, 4);
});

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalUtterance = Object.getOwnPropertyDescriptor(globalThis, "SpeechSynthesisUtterance");
type FakeUtterance = { text: string; lang?: string; voice?: unknown; rate?: number;
  onend?: () => void; onerror?: (event: { error: string }) => void };
let utterances: FakeUtterance[] = [];
let voices = [{ lang: "zz-ZZ", voiceURI: "synthetic", name: "Synthetic" }];
let fail = "";
let errors = 0;
const synth = { getVoices() { if (fail === "voices") throw Error("voices"); return voices; },
  speak(utterance: FakeUtterance) { if (fail === "speak") throw Error("speak"); utterances.push(utterance); },
  cancel() { if (fail === "cancel") throw Error("cancel"); } };
try {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { speechSynthesis: synth, localStorage: { getItem: () => null } } });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true,
    value: class { constructor(public text: string) {} } });
  check("media stops before TTS and stale callbacks are ignored", () => {
    let paused = false; let ended = 0;
    claimAudioPlayback(() => { paused = true; });
    assert.equal(speakText("hello", "zz-ZZ", undefined, undefined, { onEnd: () => ended++ }), true);
    assert.equal(paused, true); const old = utterances.at(-1)!;
    let handle: PlaybackHandle | undefined;
    speakText("new", "zz-ZZ", undefined, undefined, { onHandle: (owner) => { handle = owner; } });
    old.onend?.(); assert.equal(ended, 0);
    handle?.cancel(); utterances.at(-1)?.onend?.(); assert.equal(ended, 0);
  });
  check("media, transient, native activity audio and speech have one owner", () => {
    const stopped: string[] = [];
    const main = claimAudioPlayback(() => stopped.push("main"));
    const transient = claimAudioPlayback(() => stopped.push("transient"));
    assert.equal(main.isCurrent(), false);
    const native = claimAudioPlayback(() => stopped.push("native"));
    assert.equal(transient.isCurrent(), false);
    speakText("take ownership", "zz-ZZ");
    assert.equal(native.isCurrent(), false);
    assert.deepEqual(stopped, ["main", "transient", "native"]);
    native.release(); native.cancel();
    const next = claimAudioPlayback(() => stopped.push("next"));
    assert.equal(next.isCurrent(), true); next.cancel();
  });
  check("controller receives textual fallback on real helper startup failure", () => {
    const snapshots: string[] = [];
    const real = new NarrationController((line, callbacks) => {
      let owner: PlaybackHandle | null = null;
      return speakText(line.text, line.locale!, callbacks.error, undefined, {
        onHandle: (value) => { owner = value; }, onEnd: callbacks.end, onCancel: callbacks.cancel,
      }) ? owner : null;
    }, (state) => snapshots.push(state.status));
    fail = "speak"; real.start([line]); fail = "";
    assert.equal(snapshots.at(-1), "text"); real.dispose();
  });
  check("empty, incompatible and late catalog stay textual until next manual attempt", () => {
    utterances = []; voices = [];
    assert.equal(speakText("text", "zz-ZZ"), false);
    voices = [{ lang: "de-DE", voiceURI: "wrong", name: "Wrong" }];
    assert.equal(speakText("text", "zz-ZZ"), false); assert.equal(utterances.length, 0);
    voices = [{ lang: "zz-ZZ", voiceURI: "synthetic", name: "Synthetic" }];
    assert.equal(utterances.length, 0); assert.equal(speakText("manual retry", "zz-ZZ"), true);
  });
  for (const failure of ["voices", "speak", "cancel"]) check(`API ${failure} exception returns false`, () => {
    fail = failure;
    assert.equal(speakText("text", "zz-ZZ", () => errors++), false);
    fail = "";
  });
  check("operational speech errors notify fallback", () => {
    speakText("text", "zz-ZZ", () => errors++);
    const before = errors; utterances.at(-1)?.onerror?.({ error: "audio-busy" });
    assert.equal(errors, before + 1);
  });
  check("unavailable API and empty locale never speak", () => {
    assert.equal(speakText("text", ""), false);
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    assert.equal(speakText("text", "zz-ZZ"), false);
  });
} finally {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalUtterance) Object.defineProperty(globalThis, "SpeechSynthesisUtterance", originalUtterance);
  else Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
}
console.log(`B2: ${passed} checks passed; mocked browser speech only, no provider/network.`);
