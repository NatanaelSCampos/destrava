import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.env.DESTRAVA_TEST_SOURCE_ROOT ?? process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const esbuild = require('esbuild');
const built = await esbuild.build({ stdin: { contents: [
  'export * from "./src/domain/interactive-lesson/guided-presentation";',
  'export * from "./src/domain/interactive-lesson/catalog";',
  'export {interactiveLessonSchema} from "./src/content/contracts";',
  'export {TimelineEngine,initialRuntime,reduceRuntime} from "./src/domain/interactive-lesson/runtime";',
  'export {loadContent} from "./scripts/content-loader";',
  'export {curatedInteractiveExamples} from "./src/content/interactive-examples";',
].join('\n'), resolveDir: root, loader: 'ts' }, bundle: true, write: false,
  platform: 'node', format: 'cjs', packages: 'external', tsconfig: path.join(root, 'tsconfig.json') });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(require, compiled, compiled.exports);
const { GuidedPresentationController, guidedLessonCatalog, interactiveLessonSchema, TimelineEngine,
  initialRuntime, reduceRuntime, loadContent } = compiled.exports;
class Clock {
  time = 0; next = 1; jobs = new Map();
  now = () => this.time;
  set = (callback, ms) => { const id = this.next++; this.jobs.set(id, { callback, at: this.time + ms }); return id; };
  clear = id => { this.jobs.delete(id); };
  advance(ms) { const until = this.time + ms; for (;;) { const first = [...this.jobs].sort((a,b) => a[1].at-b[1].at)[0];
    if (!first || first[1].at > until) break; this.time = first[1].at; this.jobs.delete(first[0]); first[1].callback(); } this.time = until; }
}
const lines = [
  { id: 'pt', text: 'Veja este exemplo.', language: 'pt-BR', locale: 'pt-BR', role: 'source', anchorMs: 0, endMs: 4000, fallbackAllowed: false },
  { id: 'target', text: 'A target example.', language: 'en', locale: 'en-US', role: 'target', anchorMs: 4650, endMs: 6650, fallbackAllowed: false },
];
function fixture(options = {}) {
  const clock = new Clock(), calls = [], snapshots = [];
  const controller = new GuidedPresentationController((line, callbacks) => {
    const call = { line, callbacks, paused: 0, resumed: 0, cancelled: 0, seeks: [] };
    calls.push(call); const handle = { cancel() { call.cancelled++; callbacks.cancel(); } };
    if (!options.legacy) Object.assign(handle, { pause() { call.paused++; }, resume() { call.resumed++; }, seek(ms) { call.seeks.push(ms); }, getPositionMs() { return call.nativePosition ?? 250; } });
    return options.startFailure ? null : handle;
  }, snapshot => snapshots.push(structuredClone(snapshot)), clock);
  return { controller, clock, calls, snapshots };
}
test('pending audio never advances by wall time; real progress maps the authored board interval', () => {
  const f = fixture(); f.controller.play(lines, 7100, 0); f.clock.advance(60000);
  assert.equal(f.calls.length, 1); assert.equal(f.controller.current.positionMs, 0);
  f.calls[0].callbacks.progress(2000, 8000); assert.equal(f.controller.current.positionMs, 1000);
  assert.equal(f.controller.current.audioPositionMs, 2000); assert.equal(f.controller.current.audioDurationMs, 8000);
  f.calls[0].callbacks.progress(NaN, 8000); assert.equal(f.controller.current.positionMs, 1000);
});
test('language switches wait for onEnd and a real authored pause; final completion waits for last ending', () => {
  const f = fixture(); f.controller.play(lines, 7100, 0); f.calls[0].callbacks.end();
  assert.equal(f.controller.current.status, 'gap'); f.clock.advance(649); assert.equal(f.calls.length, 1);
  f.clock.advance(1); assert.equal(f.calls.length, 2); assert.equal(f.calls[1].line.locale, 'en-US');
  f.calls[1].callbacks.progress(2000, 2000); assert.notEqual(f.controller.current.status, 'completed');
  f.calls[1].callbacks.end(); f.clock.advance(449); assert.notEqual(f.controller.current.status, 'completed');
  f.clock.advance(1); assert.equal(f.controller.current.status, 'completed'); assert.equal(f.controller.current.positionMs, 7100);
});
test('pause and resume keep the same clip and reject late ending while paused', () => {
  const f = fixture(); f.controller.play(lines, 7100, 0); f.calls[0].callbacks.progress(2000,8000);
  f.controller.pause(); assert.equal(f.calls[0].paused, 1); f.clock.advance(10000);
  assert.equal(f.calls.length, 1); assert.equal(f.controller.current.status, 'paused');
  f.controller.play(lines, 7100, f.controller.current.positionMs); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].resumed,1);
  f.calls[0].callbacks.end(); f.clock.advance(650); assert.equal(f.calls.length,2);
});
test('pause captures actual media time newer than the last timeupdate', () => {
  const f=fixture(); f.controller.play(lines,7100,0); f.calls[0].callbacks.progress(2000,8000);
  f.calls[0].nativePosition=3000; f.controller.pause();
  assert.equal(f.controller.current.audioPositionMs,3000); assert.equal(f.controller.current.positionMs,1500);
});
test('pause during a gap preserves the remaining pause, without starting another clip', () => {
  const f = fixture(); f.controller.play(lines,7100,0); f.calls[0].callbacks.end(); f.clock.advance(200); f.controller.pause();
  f.clock.advance(6000); assert.equal(f.calls.length,1); f.controller.play(lines,7100,f.controller.current.positionMs);
  f.clock.advance(449); assert.equal(f.calls.length,1); f.clock.advance(1); assert.equal(f.calls.length,2);
});
test('seek cancels prior clip, ignores its callbacks, and positions the next clip from its actual duration', () => {
  const f=fixture(); f.controller.play(lines,7100,0); const old=f.calls[0]; f.controller.seek(5650);
  old.callbacks.progress(7000,8000); old.callbacks.end(); old.callbacks.error(); assert.equal(f.controller.current.positionMs,5650);
  f.controller.play(lines,7100,5650); assert.equal(f.calls.length,2); assert.equal(f.calls[1].line.id,'target');
  f.calls[1].callbacks.progress(0,6000); assert.deepEqual(f.calls[1].seeks,[3000]); assert.notEqual(f.controller.current.status,'completed');
});
test('duplicate clip endings and late progress cannot skip the pause or reorder the next language', () => {
  const f=fixture(); f.controller.play(lines,7100,0); const first=f.calls[0]; first.callbacks.end();
  first.callbacks.end(); first.callbacks.progress(0,8000); f.clock.advance(650);
  assert.equal(f.calls.length,2); assert.equal(f.controller.current.line.id,'target');
});
test('an ending delivered after pause remains paused and is replayable', () => {
  const f=fixture(); f.controller.play(lines,7100,0); f.controller.pause(); f.calls[0].callbacks.end();
  f.clock.advance(10000); assert.equal(f.controller.current.status,'paused'); assert.equal(f.calls.length,1);
  f.controller.play(lines,7100,f.controller.current.positionMs); assert.equal(f.calls.length,2);
});
test('external audio cancellation pauses rather than finishing a lesson', () => {
  const f=fixture(); f.controller.play(lines,7100,0); f.calls[0].callbacks.cancel(); f.calls[0].callbacks.end();
  f.clock.advance(10000); assert.equal(f.controller.current.status,'paused'); assert.equal(f.calls.length,1);
});
test('disposal invalidates callbacks and clears delayed language switches', () => {
  const f=fixture(); f.controller.play(lines,7100,0); f.calls[0].callbacks.end(); const count=f.snapshots.length;
  f.controller.dispose(); f.clock.advance(10000); f.calls[0].callbacks.progress(5000,8000); f.calls[0].callbacks.error();
  assert.equal(f.calls.length,1); assert.equal(f.snapshots.length,count);
});
test('error or missing declared locale never advances or fabricates completion', () => {
  for(const mode of ['error','no-locale','start-failure']) { const f=fixture({startFailure:mode==='start-failure'});
    f.controller.play(mode==='no-locale'?[{...lines[0],locale:null}]:lines,7100,0);
    if(mode==='error')f.calls[0].callbacks.error(); f.clock.advance(10000);
    assert.equal(f.controller.current.status,'error'); assert.equal(f.controller.current.positionMs,0); }
});
test('legacy cancellation-only handle reports and restarts the current phrase on resume', () => {
  const f=fixture({legacy:true}); f.controller.play(lines,7100,0); f.calls[0].callbacks.progress(2000,4000); f.controller.pause();
  assert.equal(f.calls[0].cancelled,1); assert.equal(f.controller.current.positionMs,0); assert.match(f.controller.current.message,/início/);
  f.controller.play(lines,7100,0); assert.equal(f.calls.length,2); assert.equal(f.calls[1].line.id,'pt');
});
const definition = {id:'guided',courseId:'course',unitId:'u',lessonId:'l',title:'Guided',estimatedMinutes:5};
function courseFixture() {return {id:'course',slug:'course with space',contentVersion:'1',assessments:[],units:[{id:'u',number:2,title:'Unit',active:true,access:{assessmentId:'prior',minimumScore:80},lessons:[{id:'l',slug:'a/b',title:'Lesson',description:'One lesson',active:true,interactiveLessonRef:'guided'}]}],availability:{unavailableActivityIds:[],spacedRepetition:false,actionStates:{'lesson.interactive':{state:'available',reasons:[]}}}};}
function accessFixture(allowed=true) {return {courseId:'course',contentVersion:'1',units:{u:{allowed,message:'Synthetic'}},assessments:{}};}
test('catalog uses exact current-course references and canonical encoded unit URL', () => {
  const course=courseFixture(),entries=guidedLessonCatalog(course,[definition,{...definition,id:'foreign',courseId:'elsewhere'}],accessFixture());
  assert.equal(entries.length,1); assert.equal(entries[0].href,'/course/course%20with%20space/unit/2/lesson/a%2Fb'); assert.equal(entries[0].available,true);
});
test('catalog is fail closed for absent, stale, foreign, denied or projected locked access', () => {
  for(const access of [null,accessFixture(false),{...accessFixture(),courseId:'other'},{...accessFixture(),contentVersion:'old'}]) {
    assert.equal(guidedLessonCatalog(courseFixture(),[definition],access)[0].available,false);
  }
  const course=courseFixture();course.availability.lockedUnitIds=['u'];assert.equal(guidedLessonCatalog(course,[definition],accessFixture())[0].available,false);
});
test('catalog retains unavailable published cards but excludes inactive or mismatched definitions', () => {
  const course=courseFixture();course.availability.unavailableInteractiveLessonIds=['guided'];assert.equal(guidedLessonCatalog(course,[definition],accessFixture())[0].available,false);
  assert.equal(guidedLessonCatalog(course,[{...definition,unitId:'wrong'}],accessFixture()).length,0);
  course.units[0].lessons[0].active=false;assert.equal(guidedLessonCatalog(course,[definition],accessFixture()).length,0);
});
const owned=[];
for(const id of ['ingles-a1-pessoal','espanol-a-tu-paso-a1'])for(const file of fs.readdirSync(path.join(root,'content/courses',id,'interactive-lessons'))) {
  owned.push({course:id,file,definition:JSON.parse(fs.readFileSync(path.join(root,'content/courses',id,'interactive-lessons',file),'utf8'))});
}
test('all five existing definitions validate, declare separate languages, preserve non-transcript board visuals and pause boundaries', () => {
  assert.equal(owned.length,5);
  for(const {definition:d}of owned){interactiveLessonSchema.parse(d);assert.equal(d.autoAdvancePresentations,true);
    for(const segment of d.segments){if(!segment.presentation)continue;const p=segment.presentation;assert.equal(p.mode,'slides');assert.equal(p.mediaId,undefined);
      assert.ok(segment.cues.some(c=>c.action.type==='board.show'&&c.action.element.illustration));assert.ok(segment.cues.some(c=>c.action.type==='board.show'&&c.action.element.kind==='comparison')||segment.cues.filter(c=>c.action.type==='board.show').length>=3);
      for(let i=0;i<p.transcript.length;i++){const t=p.transcript[i];assert.ok(['en','es','pt-BR'].includes(t.textPresentation.language));assert.ok(t.endMs>t.startMs);assert.ok(t.endMs<=p.durationMs);if(i)assert.ok(t.startMs-p.transcript[i-1].endMs>=450);}
      const engine=new TimelineEngine();engine.load(segment.cues);assert.ok(engine.getStateAt(0).elements.length>=2);assert.ok(segment.cues.every(c=>c.atMs<=p.durationMs));
    }
  }
});
test('presentation callbacks cannot replace required objective or speaking evidence', () => {
  const d=structuredClone(owned.find(e=>e.definition.segments.some(s=>s.type==='speaking')).definition);
  for(const segment of d.segments)if(['checkpoint','speaking'].includes(segment.type))segment.required=true;
  const index=d.segments.findIndex(s=>s.type==='speaking');let state={...initialRuntime(d),segmentIndex:index,phase:'speaking'};
  assert.equal(reduceRuntime(d,state,{type:'NEXT',nextBoard:state.board}),state);
  const checkpoint=d.segments.findIndex(s=>s.type==='checkpoint');state={...initialRuntime(d),segmentIndex:checkpoint,phase:'checkpoint'};
  assert.equal(reduceRuntime(d,state,{type:'NEXT',nextBoard:state.board}),state);
});
test('complete source packages still validate authored references and capabilities without generated packs', () => {
  const bundles=loadContent();for(const id of ['ingles-a1-pessoal','espanol-a-tu-paso-a1'])assert.ok(bundles.some(b=>b.course.id===id));
});
