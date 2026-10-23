// QA requirements frozen before inspecting Ciclo 2 implementation.
// Baseline: b2e94ce89e9bbaf964e4738b8464dc49f049cb2d.
export const independentScenarios = [
  ['A2-01', 'Repeated start preserves one pedagogical session and installed identity'],
  ['A2-02', 'Explicit/automatic pause excludes idle time; reload restores confirmed plan/cursor/time; no draft'],
  ['A2-03', 'Repeated finish/reload does not duplicate completion or learning evidence'],
  ['A2-04', 'V1 session remains V1 after V2 activation; next start verifies active version'],
  ['A2-05', 'GET failure writes nothing; POST failure/lost ACK preserves pending identity and retry'],
  ['A2-06', 'Stale account/course response cannot affect new context; flush failure prevents switch'],
  ['A2-07', 'Adaptive diagnostic and final remain distinct; submitted answers/results survive reload'],
  ['A2-08', 'Reserved Lead browser: desktop and 360/390 px controls and overflow'],
  ['B2-01', 'Non-PT source and synthetic target come from explicit metadata'],
  ['B2-02', 'Missing/late/incompatible voices and API failures yield text without wrong-language speech'],
  ['B2-03', 'Manual start, exclusive ownership, restart sentence/anchor, ignore stale callbacks'],
  ['B2-04', 'Unannotated legacy/mixed line remains visible text and never defaults to target voice'],
  ['B2-05', 'Contextual fields and followUp require explicit semantic language before speech'],
  ['B2-06', 'Narration cannot approve checkpoints/speaking evidence or mutate B1 proofs'],
  ['B2-07', 'Reserved Lead browser: accessible controls/focus/feedback; mocks distinct from real voice'],
] as const;

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const results: Array<{ name: string; passed: boolean; error?: string }> = [];
async function check(name: string, action: () => unknown | Promise<unknown>) {
  try { await action(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }); console.log(`FAIL ${name}: ${String(error)}`); }
}
async function main() {
  const root = resolve(process.env.CICLO2_CANDIDATE_ROOT ?? process.cwd());
  assert.equal(root.toLowerCase(), resolve(process.cwd()).toLowerCase(), 'Run from candidate cwd so aliases resolve to candidate');
  const load = <T,>(file: string) => import(pathToFileURL(resolve(root, file)).href) as Promise<T>;
  const paths = ['src/domain/study/session-time.ts', 'src/engine/variants/speech.ts', 'src/lib/speak-text.ts',
    'src/domain/study/study-state.ts', 'src/domain/interactive-lesson/runtime.ts', 'src/domain/study/session-lifecycle.ts', 'src/domain/assessments/adaptive-progress.ts', 'src/domain/interactive-lesson/narration-controller.ts'].filter(path => existsSync(resolve(root, path)));
  const hashes = () => paths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex') }));
  const before = hashes();
  const timer = await load<typeof import('../src/domain/study/session-time')>('src/domain/study/session-time.ts');
  const voices = await load<typeof import('../src/engine/variants/speech')>('src/engine/variants/speech.ts');
  for (const inactive of [false]) await check('A2-02 hidden document freezes active seconds', () => {
    assert.equal(timer.advanceActiveStudySeconds(17, 1000, 2000, 1000, inactive), 17);
  });
  await check('A2-02 idle boundary accrues only until inactivity cutoff', () => {
    const cutoff = timer.STUDY_IDLE_LIMIT_MS;
    assert.equal(timer.advanceActiveStudySeconds(17, cutoff - 500, cutoff + 500, 0, true), 17.5);
    assert.equal(timer.advanceActiveStudySeconds(17, cutoff, cutoff + 5000, 0, true), 17);
  });
  await check('A2-02 clock regression never subtracts confirmed active time', () => {
    assert.equal(timer.advanceActiveStudySeconds(17, 2000, 1000, 1000, true), 17);
    assert.equal(timer.advanceActiveStudySeconds(17, NaN, 2000, 1000, true), 17);
  });
  await check('A2-03 long inactive gap never becomes session wall-clock time', () => {
    assert.ok(timer.advanceActiveStudySeconds(17, 1000, 86400000, 1000, true) <= 19);
    assert.equal(timer.boundedStudySeconds(Infinity), 0);
    assert.equal(timer.boundedStudySeconds(-5), 0);
  });
  const voice = (lang: string, name = lang) => ({ lang, name, voiceURI: `qa:${name}` });
  for (const locale of ['es-ES', 'en-GB', 'zz-ZZ', 'fr-CA']) {
    await check(`B2-02 no cross-language fallback for ${locale}`, () => {
      const selection = voices.selectBrowserVoice([voice('de-DE'), voice('ja-JP')], locale, true);
      assert.equal(selection.status, 'unavailable'); assert.equal(selection.voice, null);
      assert.equal(selection.operationalLocale, null);
    });
    await check(`B2-02 late voice catalogue for ${locale}`, () => {
      assert.equal(voices.selectBrowserVoice([], locale, true).status, 'unavailable');
      assert.equal(voices.selectBrowserVoice([voice(locale)], locale, true).voice?.lang, locale);
    });
  }
  await check('B2-02 strict locale rejects same-language alternative when fallback forbidden', () => {
    assert.equal(voices.selectBrowserVoice([voice('en-US')], 'en-GB', false).status, 'unavailable');
    assert.equal(voices.selectBrowserVoice([voice('en-US')], 'en-GB', true).fallback, true);
  });
  await check('B2-02 incompatible saved preference cannot select wrong-language voice', () => {
    const wrong = voice('de-DE'); const expected = voice('es-ES');
    assert.deepEqual(voices.selectBrowserVoice([wrong, expected], 'es-ES', true, voices.descriptorId(wrong)).voice, expected);
  });
  const { readCourseState } = await load<typeof import('../src/domain/study/course-state-storage')>('src/domain/study/course-state-storage.ts');
  const { restoreServerAssessmentResults } = await load<typeof import('../src/domain/study/study-state')>('src/domain/study/study-state.ts');
  const course = { id: 'qa-course', languageCode: 'zz', contentVersion: '1.0.0', assessments: [
    { id: 'qa-diagnostic', purpose: 'diagnostic', method: 'adaptive' },
    { id: 'qa-final', purpose: 'final', method: 'fixed' },
  ] } as unknown as import('../src/content/public').PublicCourse;
  const result = { id: '10000000-0000-4000-8000-000000000001', assessmentId: 'qa-diagnostic',
    courseId: course.id, contentVersion: course.contentVersion, purpose: 'diagnostic', method: 'adaptive',
    source: 'server', status: 'completed', objectiveScore: 100, passed: true,
    startedAt: '2026-10-23T10:00:00.000Z', finishedAt: '2026-10-23T10:01:00.000Z', responseKey: 'qa-confirmed',
    answers: [{ activityId: 'qa-item', answer: 'submitted value', correct: true, difficulty: 2, skill: 'reading' }],
  } as import('../src/content/assessment-results').ServerAssessmentResult;
  await check('A2-07 confirmed adaptive diagnostic restores submitted answer without becoming final', () => {
    const empty = readCourseState(null, course.id, course.languageCode);
    const restored = restoreServerAssessmentResults(empty, course, [result]);
    assert.equal(restored.adaptiveAssessments.length, 1);
    assert.equal(restored.adaptiveAssessments[0].answers[0].answer, 'submitted value');
    assert.equal(restored.assessmentAttempts.length, 0);
    assert.equal(restored.completedActivityIds.length, 0);
    assert.deepEqual(empty.adaptiveAssessments, []);
    const twice = restoreServerAssessmentResults(restored, course, [result, result]);
    assert.equal(twice.adaptiveAssessments.length, 1);
  });
  for (const patch of [{ courseId: 'different' }, { contentVersion: '2.0.0' }, { assessmentId: 'missing' }, { purpose: 'final' }, { method: 'fixed' }]) {
    await check(`A2-07 mismatched diagnostic cannot create current evidence ${JSON.stringify(patch)}`, () => {
      const empty = readCourseState(null, course.id, course.languageCode);
      const restored = restoreServerAssessmentResults(empty, course, [{ ...result, ...patch } as typeof result]);
      assert.equal(restored.adaptiveAssessments.length + restored.assessmentAttempts.length, 0);
    });
  }
  await check('A2-07 unconfirmed adaptive answer never restores a graded diagnostic', () => {
    const empty = readCourseState(null, course.id, course.languageCode);
    const restored = restoreServerAssessmentResults(empty, course, [{ ...result, answers: [{ ...result.answers[0], correct: null }] }]);
    assert.equal(restored.adaptiveAssessments.length, 0);
  });
  type Checkpoint = (state: import('../src/domain/study/study-state').StudyState, id: string, update: { seconds?: number; cursor?: number; paused?: boolean }) => import('../src/domain/study/study-state').StudyState;
  await check('A2-02 checkpoint roundtrip preserves explicit pause, cursor, active time and plan without learning evidence', async () => {
    const lifecycle = await load<{ checkpointSession: Checkpoint }>('src/domain/study/session-lifecycle.ts');
    const state = readCourseState(null, 'qa-course', 'zz');
    const session = { id: 'qa-session', unitId: 'qa-unit', startedAt: '2026-10-23T10:00:00.000Z', finishedAt: null,
      durationSeconds: 23, activityIds: [], correct: 0, wrong: 0, wordsReviewed: 0,
      plan: [{ kind: 'activity' as const, id: 'qa-a', title: 'one', minutes: 1 }, { kind: 'activity' as const, id: 'qa-b', title: 'two', minutes: 1 }] };
    state.sessions = [session]; state.activeSessionId = session.id;
    const original = structuredClone(state);
    const next = lifecycle.checkpointSession(state, session.id, { seconds: 42, cursor: 1, paused: true });
    const saved = next.sessions[0] as typeof session & { cursor: number; paused: boolean };
    assert.equal(saved.cursor, 1); assert.equal(saved.paused, true); assert.equal(saved.durationSeconds, 42);
    assert.deepEqual(saved.plan, session.plan); assert.deepEqual(next.events, []); assert.deepEqual(next.completedActivityIds, []);
    assert.deepEqual(state, original, 'Checkpoint must not mutate input');
    const restored = readCourseState(JSON.parse(JSON.stringify(next)), 'qa-course', 'zz');
    assert.deepEqual(restored.sessions, next.sessions);
    assert.deepEqual(lifecycle.checkpointSession(next, session.id, { seconds: 42, cursor: 1, paused: true }), next);
  });
  await check('A2-02 stale and completed session checkpoints cannot revive or alter learning evidence', async () => {
    const lifecycle = await load<{ checkpointSession: Checkpoint }>('src/domain/study/session-lifecycle.ts');
    const state = readCourseState(null, 'qa-course', 'zz');
    state.sessions = [{ id: 'qa-finished', unitId: 'qa-unit', startedAt: '2026-10-23T10:00:00.000Z',
      finishedAt: '2026-10-23T10:01:00.000Z', durationSeconds: 60, activityIds: [], correct: 0, wrong: 0, wordsReviewed: 0, plan: [] }];
    state.activeSessionId = null;
    assert.deepEqual(lifecycle.checkpointSession(state, 'missing', { seconds: 99, cursor: 1, paused: false }), state);
    assert.deepEqual(lifecycle.checkpointSession(state, 'qa-finished', { seconds: 99, cursor: 1, paused: false }), state);
  });
  await check('A2-02 malformed checkpoint cannot erase confirmed time or create invalid cursor', async () => {
    const lifecycle = await load<{ checkpointSession: Checkpoint }>('src/domain/study/session-lifecycle.ts');
    const state = readCourseState(null, 'qa-course', 'zz');
    state.sessions = [{ id: 'qa-active', unitId: 'qa-unit', startedAt: '2026-10-23T10:00:00.000Z',
      finishedAt: null, durationSeconds: 60, activityIds: [], correct: 0, wrong: 0, wordsReviewed: 0,
      plan: [{ kind: 'activity', id: 'qa-a', title: 'one', minutes: 1 }] }];
    state.activeSessionId = 'qa-active';
    for (const update of [{ seconds: -10, cursor: -1 }, { seconds: Infinity, cursor: Infinity }, { seconds: NaN, cursor: NaN }]) {
      const next = lifecycle.checkpointSession(state, 'qa-active', update);
      assert.ok(Number.isFinite(next.sessions[0].durationSeconds));
      assert.ok(next.sessions[0].durationSeconds >= 60, 'Confirmed time cannot decrease');
      const cursor = (next.sessions[0] as { cursor?: number }).cursor ?? 0;
      assert.ok(Number.isInteger(cursor) && cursor >= 0 && cursor <= 1);
    }
  });
  type Prefix = { attemptId: string; assessmentId: string; startedAt: string; responses: {activityId: string; answer: string}[]; answers?: {correct: boolean}[] };
  type CanonicalPrefixes = (raw: unknown, course: unknown, language: unknown, preference: string) => Prefix[];
  await check('A2-07 adaptive submitted prefix is privately regraded and never promotes forged client score', async () => {
    const { canonicalAdaptiveProgress } = await load<{ canonicalAdaptiveProgress: CanonicalPrefixes }>('src/domain/assessments/adaptive-progress.ts');
    const definition = { id: 'qa-diagnostic', purpose: 'diagnostic', method: 'adaptive', title: 'Synthetic diagnostic',
      objectiveIds: [], skillPlan: ['reading', 'reading'], bank: [
        { activityId: 'qa-mid', skill: 'reading', difficulty: 2 }, { activityId: 'qa-low', skill: 'reading', difficulty: 1 },
        { activityId: 'qa-high', skill: 'reading', difficulty: 3 }], passingPolicy: { overall: 0.7 }, skillWeights: {reading: 1} };
    const privateCourse = { id: 'qa-course', languageCode: 'zz', contentVersion: '1', defaultVariant: 'synthetic', acceptedVariants: ['synthetic'],
      assessments: [definition, { id: 'qa-final', purpose: 'final', method: 'fixed', activityIds: ['qa-mid'], passingPolicy: { overall: 0.7 } }],
      assessmentRefs: {diagnostic: 'qa-diagnostic'}, units: [{id:'qa-unit', lessons:[{id:'qa-lesson', activities:
        ['qa-mid','qa-low','qa-high'].map(id => ({id, type:'multiple_choice', skill:'reading', skills:['reading'], answer:'accepted', choices:['accepted','wrong']}))}]}] };
    const language = { id: 'zz', variants: [{id:'synthetic'}], speech: {defaultVariant:'synthetic'},
      normalization: {trimWhitespace:true,collapseWhitespace:true,caseInsensitive:true,ignoreTerminalPunctuation:true,ignoreDiacritics:false} };
    const prefix: Prefix = { attemptId:'10000000-0000-4000-8000-000000000002', assessmentId:'qa-diagnostic',
      startedAt:'2026-10-23T10:00:00.000Z', responses:[{activityId:'qa-mid',answer:'wrong'}], answers:[{correct:true}] };
    const original = structuredClone(prefix);
    const canonical = canonicalAdaptiveProgress([prefix], privateCourse, language, 'synthetic');
    assert.equal(canonical.length, 1); assert.deepEqual(canonical[0].responses, prefix.responses);
    assert.equal(canonical[0].answers?.[0].correct, false, 'Private answer must override forged client correctness');
    assert.deepEqual(prefix, original, 'Server canonicalization must not mutate client input');
    for (const invalid of [
      {...prefix,responses:[]}, {...prefix,assessmentId:'qa-final'}, {...prefix,assessmentId:'missing'},
      {...prefix,responses:[{activityId:'unknown',answer:'accepted'}]},
      {...prefix,responses:[{activityId:'qa-low',answer:'accepted'}]},
      {...prefix,responses:[...prefix.responses,...prefix.responses]},
      {...prefix,responses:[...prefix.responses,{activityId:'qa-high',answer:'accepted'}]},
    ]) {
      let rejected = false;
      try { rejected = canonicalAdaptiveProgress([invalid], privateCourse, language, 'synthetic').length === 0; }
      catch { rejected = true; }
      assert.equal(rejected, true, `Unsubmitted or noncanonical sequence accepted: ${JSON.stringify(invalid.responses)}`);
    }
  });
  type Line = {id:string;text:string;language:string|null;locale:string|null;role:'source'|'target'|null;anchorMs:number;fallbackAllowed:boolean};
  type Context = {sourceLanguage:string;targetLanguage:string;targetLocale:string;targetFallbackAllowed:boolean};
  type Callbacks = {end:()=>void;error:()=>void;cancel:()=>void};
  type Controller = {start(lines:Line[]):unknown;pause():unknown;resume():unknown;cancel():unknown;dispose():unknown};
  type NarrationApi = {
    narrationLine(id:string,text:string,language:string|null,context:Context,anchorMs?:number,explicitRole?:'source'|'target'):Line;
    transcriptNarration(lines:unknown[],context:Context):Line[];
    teachingNarration(reply:unknown,context:Context):Line[];
    NarrationController:new(speak:(line:Line,callbacks:Callbacks)=>{cancel:()=>void}|null,change:(...args:unknown[])=>void)=>Controller;
  };
  const context: Context = {sourceLanguage:'fr-CA',targetLanguage:'zz',targetLocale:'zz-ZZ',targetFallbackAllowed:false};
  await check('B2-01/04 annotated metadata drives language, legacy/mixed text never infers a target voice', async () => {
    const api = await load<NarrationApi>('src/domain/interactive-lesson/narration-controller.ts');
    const mixed = api.narrationLine('mixed','hello bonjour hola',null,context);
    assert.equal(mixed.locale,null); assert.equal(mixed.role,null);
    const target = api.narrationLine('target','opaque value','zz',context);
    assert.equal(target.role,'target'); assert.equal(target.locale,'zz-ZZ'); assert.equal(target.fallbackAllowed,false);
    const source = api.narrationLine('source','opaque value','fr-CA',context);
    assert.equal(source.role,'source'); assert.equal(source.locale,'fr-CA');
    const lines = api.transcriptNarration([
      {startMs:0,endMs:1000,text:'bonjour hola'},
      {startMs:1000,endMs:2000,text:'opaque',textPresentation:{language:'zz',direction:'ltr'}},
    ],context);
    assert.equal(lines.length,2); assert.equal(lines[0].locale,null); assert.equal(lines[1].locale,'zz-ZZ');
  });
  await check('B2-05 contextual explanation/translation use source, example target, undefined followUp stays text', async () => {
    const api = await load<NarrationApi>('src/domain/interactive-lesson/narration-controller.ts');
    const lines = api.teachingNarration({message:'explanation',translation:'translation',example:'example',followUp:'follow-up opaque',canResume:true},context);
    for (const text of ['explanation','translation']) {
      const line = lines.find(item=>item.text===text); assert.ok(line); assert.equal(line.role,'source'); assert.equal(line.locale,'fr-CA');
    }
    const example = lines.find(item=>item.text==='example'); assert.ok(example); assert.equal(example.locale,'zz-ZZ');
    const followUp = lines.find(item=>item.text==='follow-up opaque'); assert.ok(followUp); assert.equal(followUp.locale,null);
  });
  const controllerFake = async () => {
    const api = await load<NarrationApi>('src/domain/interactive-lesson/narration-controller.ts');
    const calls: Array<{line:Line;callbacks:Callbacks;active:boolean}> = [];
    const controller = new api.NarrationController((line,callbacks)=>{
      assert.equal(calls.filter(item=>item.active).length,0,'At most one active utterance');
      const call={line,callbacks,active:true}; calls.push(call);
      return {cancel(){call.active=false;callbacks.cancel();}};
    },()=>{});
    const line=(id:string):Line=>({id,text:id,language:'zz',locale:'zz-ZZ',role:'target',anchorMs:1000,fallbackAllowed:false});
    return {controller,calls,line};
  };
  await check('B2-03 start is manual; pause/resume restarts current sentence and ignores old end callbacks', async () => {
    const {controller,calls,line}=await controllerFake(); assert.equal(calls.length,0);
    controller.start([line('one'),line('two')]); assert.equal(calls.length,1);
    controller.pause(); assert.equal(calls[0].active,false);
    calls[0].callbacks.end(); assert.equal(calls.length,1,'Paused old callback cannot advance');
    controller.resume(); assert.equal(calls.length,2); assert.equal(calls[1].line.id,'one'); assert.equal(calls[1].line.anchorMs,1000);
    calls[0].callbacks.end(); assert.equal(calls.length,2,'Resumed owner ignores stale callback');
    calls[1].active=false; calls[1].callbacks.end(); assert.equal(calls.length,3); assert.equal(calls[2].line.id,'two');
    controller.dispose();
  });
  await check('B2-03 replacement, cancel and dispose invalidate previous lesson callbacks', async () => {
    const {controller,calls,line}=await controllerFake();
    controller.start([line('old-a'),line('old-b')]); controller.start([line('new-a'),line('new-b')]);
    assert.equal(calls.length,2); assert.equal(calls[0].active,false);
    calls[0].callbacks.end();calls[0].callbacks.error();assert.equal(calls.length,2);
    controller.cancel();calls[1].callbacks.end();assert.equal(calls.length,2);
    controller.start([line('last')]);controller.dispose();const count=calls.length;
    calls.at(-1)!.callbacks.end();controller.resume();assert.equal(calls.length,count);
  });
  // Browser APIs are fakes in an isolated VM. No browser or audio device is opened.
  const { build } = await import('esbuild');
  const { runInNewContext } = await import('node:vm');
  const built = await build({ entryPoints: [resolve(root, 'src/lib/speak-text.ts')], bundle: true,
    write: false, platform: 'node', format: 'cjs', tsconfig: resolve(root, 'tsconfig.json') });
  const speechFake = (failure?: 'getVoices' | 'speak' | 'cancel', catalogue = [voice('zz-ZZ')]) => {
    const spoken: Array<{ text: string; lang: string; onend?: () => void; onerror?: (event: { error: string }) => void }> = [];
    let errors = 0;
    const synth = { cancel() { if (failure === 'cancel') throw Error('synthetic cancel failure'); },
      getVoices() { if (failure === 'getVoices') throw Error('synthetic catalogue failure'); return catalogue; },
      speak(utterance: typeof spoken[number]) { if (failure === 'speak') throw Error('synthetic device failure'); spoken.push(utterance); } };
    const fakeModule = { exports: {} as typeof import('../src/lib/speak-text') };
    runInNewContext(built.outputFiles[0].text, { module: fakeModule, exports: fakeModule.exports,
      window: { speechSynthesis: synth, localStorage: { getItem: () => null } },
      SpeechSynthesisUtterance: class { constructor(public text: string) {} }, console });
    return { api: fakeModule.exports, spoken, onError() { errors++; }, errors: () => errors };
  };
  await check('B2-01/03 importing speech helper never starts automatic playback', () => {
    assert.equal(speechFake().spoken.length, 0);
  });
  await check('B2-02 compatible synthetic voice preserves declared locale', () => {
    const fake = speechFake();
    assert.equal(fake.api.speakText('opaque synthetic content', 'zz-ZZ', fake.onError), true);
    assert.equal(fake.spoken.length, 1); assert.equal(fake.spoken[0].lang, 'zz-ZZ');
  });
  await check('B2-02 missing compatible voice never asks device for default voice', () => {
    const fake = speechFake(undefined, [voice('en-US')]);
    assert.equal(fake.api.speakText('opaque synthetic content', 'zz-ZZ', fake.onError), false);
    assert.equal(fake.spoken.length, 0);
  });
  for (const failure of ['getVoices', 'speak', 'cancel'] as const) await check(`B2-02 synchronous ${failure} failure returns text fallback without throwing`, () => {
    const fake = speechFake(failure);
    assert.equal(fake.api.speakText('opaque synthetic content', 'zz-ZZ', fake.onError), false);
    assert.equal(fake.spoken.length, 0);
    assert.equal(fake.errors(), 1, 'An API failure must notify the accessible fallback owner');
  });
  type Playback = {cancel:()=>void;isCurrent:()=>boolean;release:()=>void};
  type PlaybackApi = {claimAudioPlayback(stop:()=>void):Playback;speakText(text:string,locale:string,error:()=>void,rate:number,options:{onHandle?:(handle:Playback)=>void;onEnd?:()=>void}):boolean};
  await check('B2-03 TTS claims exclusive playback and stale media handle cannot cancel successor', () => {
    const fake=speechFake();const api=fake.api as unknown as PlaybackApi;
    let mediaActive=true;const media=api.claimAudioPlayback(()=>{mediaActive=false;});let current:Playback|undefined;
    assert.equal(api.speakText('manual sentence','zz-ZZ',fake.onError,0.86,{onHandle:handle=>{current=handle;}}),true);
    assert.equal(mediaActive,false);assert.equal(media.isCurrent(),false);assert.ok(current?.isCurrent());
    media.release();media.cancel();assert.ok(current?.isCurrent(),'Stale media ownership must not interrupt new TTS');
    current?.cancel();
  });
  await check('B2-03 old utterance end cannot release or complete the new audio owner', () => {
    const fake=speechFake();const api=fake.api as unknown as PlaybackApi;
    let oldEnds=0,newEnds=0,current:Playback|undefined;
    api.speakText('old','zz-ZZ',fake.onError,0.86,{onEnd:()=>{oldEnds++;}});
    api.speakText('new','zz-ZZ',fake.onError,0.86,{onEnd:()=>{newEnds++;},onHandle:handle=>{current=handle;}});
    fake.spoken[0].onend?.();assert.equal(oldEnds,0);assert.equal(newEnds,0);assert.ok(current?.isCurrent());
    fake.spoken[1].onend?.();assert.equal(newEnds,1);
  });
  const { initialRuntime, reduceRuntime, emptyBoard } = await load<typeof import('../src/domain/interactive-lesson/runtime')>('src/domain/interactive-lesson/runtime.ts');
  const { multiSegmentLesson, qaScope, qaEvidence } = await import('./fase4-qa-fixtures');
  await check('B2-06 playback and narration-like callbacks cannot approve checkpoint A', () => {
    const lesson = multiSegmentLesson();
    let state = reduceRuntime(lesson, initialRuntime(lesson, qaScope()), { type: 'START' });
    for (const event of [{ type: 'PLAY' }, { type: 'PAUSE' }, { type: 'NEXT', nextBoard: emptyBoard }])
      state = reduceRuntime(lesson, state, event as Parameters<typeof reduceRuntime>[2]);
    assert.equal(state.segmentIndex, 0); assert.deepEqual(state.segmentEvidence, {});
    assert.equal(state.checkpointPassed, false);
  });
  await check('B2-06 checkpoint A proof never satisfies checkpoint B or either speech', () => {
    const lesson = multiSegmentLesson();
    let state = reduceRuntime(lesson, initialRuntime(lesson, qaScope()), { type: 'START' });
    state = reduceRuntime(lesson, state, { type: 'SEGMENT_EVIDENCE', evidence: qaEvidence('checkpoint-a', 1) });
    state = reduceRuntime(lesson, state, { type: 'NEXT', nextBoard: emptyBoard });
    assert.equal(state.segmentIndex, 1);
    const again = reduceRuntime(lesson, state, { type: 'NEXT', nextBoard: emptyBoard });
    assert.equal(again.segmentIndex, 1); assert.equal(again.checkpointPassed, false); assert.equal(again.speakingSaved, false);
    assert.deepEqual(Object.keys(again.segmentEvidence), ['checkpoint-a']);
  });
  assert.deepEqual(hashes(), before, 'Candidate bytes changed during pure QA run');
  console.log(JSON.stringify({ candidateRoot: root, node: process.version, candidate: before, results,
    limitations: ['Pure module tests only; no SQL, HTTP, browser, acoustic or physical-device certification',
      'Lifecycle, explicit pause UI, cursor persistence and integrated installed diagnostic still require integrated candidate tests'] }, null, 2));
  if (results.some(item => !item.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
