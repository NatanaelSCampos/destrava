import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.env.DESTRAVA_TEST_SOURCE_ROOT ?? process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'src/domain/interactive-lesson/narration-controller.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
class Clock {
  time = 0; next = 1; jobs = new Map(); callbacks = new Map();
  set = (callback, ms) => { const id = this.next++; this.jobs.set(id, { callback, at: this.time + ms }); this.callbacks.set(id, callback); return id; };
  clear = id => { this.jobs.delete(id); };
  advance(ms) {
    const until = this.time + ms;
    for (;;) {
      const first = [...this.jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!first || first[1].at > until) break;
      this.time = first[1].at; this.jobs.delete(first[0]); first[1].callback();
    }
    this.time = until;
  }
}
const lines = [
  { id: 'pt', text: 'Veja este exemplo.', language: 'pt-BR', locale: 'pt-BR', role: 'source', anchorMs: 0, fallbackAllowed: false },
  { id: 'en', text: 'I can help.', language: 'en', locale: 'en-US', role: 'target', anchorMs: 0, fallbackAllowed: false },
];
function fixture(options = {}) {
  const clock = new Clock(), calls = [], snapshots = [], loaded = { exports: {} };
  new Function('module', 'exports', 'setTimeout', 'clearTimeout', 'Date', source)(loaded, loaded.exports, clock.set, clock.clear, { now: () => clock.time });
  const { NarrationController, teachingNarration } = loaded.exports;
  const controller = new NarrationController((line, callbacks) => {
    const call = { line, callbacks, cancelled: 0 }; calls.push(call);
    if (options.syncEnd && calls.length === 1) callbacks.end();
    return options.noHandle ? null : { cancel() { call.cancelled++; callbacks.cancel(); } };
  }, snapshot => snapshots.push(structuredClone(snapshot)));
  return { controller, clock, calls, snapshots, teachingNarration, current: () => snapshots.at(-1) };
}
test('teaching replies keep PT/example/translation/follow-up order and wait 650ms after each actual clip ending', () => {
  const f = fixture();
  const reply = f.teachingNarration({ message: 'Veja este exemplo.', example: 'I can help.', translation: 'Eu posso ajudar.', followUp: 'Agora tente.', followUpSpeech: { role: 'source', language: 'pt-BR' } },
    { sourceLanguage: 'pt-BR', targetLanguage: 'en', targetLocale: 'en-US', targetFallbackAllowed: false });
  f.controller.start(reply); f.clock.advance(60000);
  assert.equal(f.calls.length, 1); assert.notEqual(f.current().status, 'completed');
  for (let index = 0; index < reply.length - 1; index++) {
    f.calls[index].callbacks.end(); assert.equal(f.clock.jobs.size, 1);
    f.clock.advance(649); assert.equal(f.calls.length, index + 1); assert.notEqual(f.current().status, 'completed');
    f.clock.advance(1); assert.equal(f.calls.length, index + 2);
  }
  assert.deepEqual(f.calls.map(call => call.line.locale), ['pt-BR', 'en-US', 'pt-BR', 'pt-BR']);
  assert.notEqual(f.current().status, 'completed'); f.calls.at(-1).callbacks.end();
  assert.equal(f.current().status, 'completed'); assert.equal(f.clock.jobs.size, 0);
});
test('pausing inside the gap clears its timer and resume waits only the remaining gap once', () => {
  const f = fixture(); f.controller.start(lines); f.calls[0].callbacks.end();
  const delayed = f.clock.callbacks.get(1); f.clock.advance(200); f.controller.pause();
  assert.equal(f.clock.jobs.size, 0); assert.equal(f.current().status, 'paused');
  const count = f.snapshots.length; delayed(); f.clock.advance(5000);
  assert.equal(f.calls.length, 1); assert.equal(f.snapshots.length, count);
  f.controller.resume(); f.controller.resume(); assert.equal(f.clock.jobs.size, 1);
  f.clock.advance(449); assert.equal(f.calls.length, 1); f.clock.advance(1); assert.equal(f.calls.length, 2);
});
test('pausing a clip cancels its handle and stale endings cannot create a gap or completion', () => {
  const f = fixture(); f.controller.start(lines); const old = f.calls[0]; f.controller.pause();
  assert.equal(old.cancelled, 1); const count = f.snapshots.length;
  old.callbacks.end(); old.callbacks.error(); old.callbacks.cancel(); f.clock.advance(10000);
  assert.equal(f.snapshots.length, count); assert.equal(f.clock.jobs.size, 0);
  f.controller.resume(); assert.equal(f.calls.length, 2); assert.equal(f.calls[1].line.id, 'pt');
  f.calls[1].callbacks.end(); f.clock.advance(650); assert.equal(f.calls[2].line.id, 'en');
});
test('cancel during a gap invalidates even an already-dispatched timer and leaves no resumable queue', () => {
  const f = fixture(); f.controller.start(lines); f.calls[0].callbacks.end(); const delayed = f.clock.callbacks.get(1);
  f.controller.cancel(); const count = f.snapshots.length;
  assert.equal(f.current().status, 'idle'); assert.equal(f.clock.jobs.size, 0);
  delayed(); f.controller.resume(); f.clock.advance(10000);
  assert.equal(f.calls.length, 1); assert.equal(f.snapshots.length, count);
});
test('dispose during a gap prevents all future starts, callbacks and publications', () => {
  const f = fixture(); f.controller.start(lines); f.calls[0].callbacks.end(); const delayed = f.clock.callbacks.get(1);
  const count = f.snapshots.length; f.controller.dispose(); delayed(); f.controller.resume(); f.controller.start(lines);
  f.calls[0].callbacks.end(); f.calls[0].callbacks.error(); f.clock.advance(10000);
  assert.equal(f.clock.jobs.size, 0); assert.equal(f.calls.length, 1); assert.equal(f.snapshots.length, count);
});
test('a replacement queue starts immediately and old callbacks cannot cancel its newer gap', () => {
  const f = fixture(); f.controller.start(lines); f.calls[0].callbacks.end(); const oldGap = f.clock.callbacks.get(1);
  f.controller.start([...lines].reverse()); assert.equal(f.calls[1].line.id, 'en');
  f.calls[1].callbacks.end(); const count = f.snapshots.length; oldGap();
  f.calls[0].callbacks.error(); f.calls[0].callbacks.cancel();
  assert.equal(f.clock.jobs.size, 1); assert.equal(f.snapshots.length, count);
  f.clock.advance(649); assert.equal(f.calls.length, 2); f.clock.advance(1); assert.equal(f.calls[2].line.id, 'pt');
});
test('duplicate endings and late error/cancel callbacks cannot shorten the gap or skip a phrase', () => {
  const f = fixture(); f.controller.start(lines); const old = f.calls[0]; old.callbacks.end();
  old.callbacks.end(); old.callbacks.error(); old.callbacks.cancel();
  assert.equal(f.clock.jobs.size, 1); f.clock.advance(650);
  assert.equal(f.calls.length, 2); assert.equal(f.current().status, 'speaking'); assert.equal(f.current().line.id, 'en');
  old.callbacks.end(); assert.equal(f.clock.jobs.size, 0); assert.notEqual(f.current().status, 'completed');
});
test('a missing playback handle remains text-only even if its stale ending arrives', () => {
  const f = fixture({ noHandle: true }); f.controller.start(lines);
  assert.equal(f.current().status, 'text'); const count = f.snapshots.length;
  f.calls[0].callbacks.end(); f.clock.advance(10000);
  assert.equal(f.clock.jobs.size, 0); assert.equal(f.calls.length, 1); assert.equal(f.snapshots.length, count);
});
test('playback error never advances the queue or reports completion and retry restarts the failed phrase', () => {
  const f = fixture(); f.controller.start(lines); f.calls[0].callbacks.error();
  assert.equal(f.current().status, 'text'); const count = f.snapshots.length;
  f.calls[0].callbacks.end(); f.clock.advance(10000);
  assert.equal(f.clock.jobs.size, 0); assert.equal(f.snapshots.length, count);
  f.controller.resume(); assert.equal(f.calls[1].line.id, 'pt'); assert.notEqual(f.current().status, 'completed');
});
test('missing language, locale or role never starts another voice or creates a completion timer', () => {
  for (const field of ['language', 'locale', 'role']) {
    const f = fixture(); f.controller.start([{ ...lines[0], [field]: null }, lines[1]]); f.clock.advance(10000);
    assert.equal(f.calls.length, 0); assert.equal(f.clock.jobs.size, 0); assert.equal(f.current().status, 'text');
  }
});
test('synchronous ending from the speaker still requires the gap and ignores cancellation of its returned old handle', () => {
  const f = fixture({ syncEnd: true }); f.controller.start(lines);
  assert.equal(f.calls[0].cancelled, 1); assert.equal(f.clock.jobs.size, 1);
  f.clock.advance(649); assert.equal(f.calls.length, 1); f.clock.advance(1); assert.equal(f.calls.length, 2);
  assert.notEqual(f.current().status, 'completed'); f.calls[1].callbacks.end(); assert.equal(f.current().status, 'completed');
});
test('external cancellation pauses instead of completing, and resume replays only that phrase', () => {
  const f = fixture(); f.controller.start(lines); f.calls[0].callbacks.cancel(); f.calls[0].callbacks.end();
  assert.equal(f.current().status, 'paused'); assert.equal(f.clock.jobs.size, 0); f.controller.resume();
  assert.equal(f.calls[1].line.id, 'pt'); assert.notEqual(f.current().status, 'completed');
});
test('resume after completion or before a start cannot replay a finished queue', () => {
  const f = fixture(); f.controller.resume(); assert.equal(f.calls.length, 0);
  f.controller.start([lines[0]]); f.calls[0].callbacks.end(); const count = f.snapshots.length;
  f.controller.resume(); f.clock.advance(10000);
  assert.equal(f.calls.length, 1); assert.equal(f.snapshots.length, count); assert.equal(f.clock.jobs.size, 0);
});
