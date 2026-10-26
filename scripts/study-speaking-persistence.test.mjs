import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAndRecordSpeaking } from '../src/components/study-provider.tsx';
import { SupabaseStudyRepository } from '../src/repositories/supabase-study-repository.ts';
import { StudyProgressSync, canonicalStudyState } from '../src/domain/study/study-progress-sync.ts';
import { readCourseState } from '../src/domain/study/course-state-storage.ts';

const dataUrl='data:audio/webm;codecs=opus;base64,AQIDBAU=';
const course={id:'audio-course',languageCode:'zz',contentVersion:'2.0.0',units:[],assessments:[]};
const scope={courseId:course.id,contentVersion:course.contentVersion};
const draft=(id='submission-a')=>({id,activityId:'speaking-a',transcription:'original transcription',audioUrl:dataUrl,practiceMode:'own',createdAt:'2026-10-26T00:00:00.000Z'});
const fresh=()=>readCourseState(null,course.id,course.languageCode);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(){
  let row=null,entry={state:null,pending:null,recovery:[]};
  const uploads=[],projections=[],writes=[];
  const control={uploadGate:null,uploadStarted:deferred(),uploadError:null,lostAck:false};
  const db={from(table){return{
    select(){return this;},eq(){return this;},
    async maybeSingle(){return{data:table==='user_course_state'&&row?{state:structuredClone(row)}:null,error:null};},
    async upsert(value){
      if(table==='user_course_state'){
        row=structuredClone(value.state);
        if(control.lostAck){control.lostAck=false;throw Error('synthetic lost ACK');}
      }else projections.push({table,rows:structuredClone(value)});
      return{error:null};
    },
  };},storage:{from(bucket){assert.equal(bucket,'speaking-audio');return{
    async upload(path,blob,options){
      uploads.push({path,bytes:new Uint8Array(await blob.arrayBuffer()),options});
      control.uploadStarted.resolve();
      if(control.uploadGate)await control.uploadGate.promise;
      return{error:control.uploadError};
    },
    async createSignedUrl(){throw Error('Ephemeral signing must not enter StudyState');},
  };}}};
  const cache={read(){return structuredClone(entry);},write(owner,value){entry=structuredClone(value);writes.push({owner,entry:structuredClone(entry)});}};
  const repository=new SupabaseStudyRepository(db,'owner-a');
  const port={load:()=>repository.load(course.id,course.languageCode),save:state=>repository.save(state,course,[])};
  const sync=new StudyProgressSync(fresh,cache,scope);
  return{sync,repository,cache,port,control,uploads,projections,writes,get row(){return row;},get entry(){return entry;},set row(value){row=structuredClone(value);}};
}
async function loaded(f,owner='owner-a'){await f.sync.load(f.sync.beginLoading(),owner,f.port);}
async function prepared(f,value=draft()){return prepareAndRecordSpeaking(f.sync,value,submission=>f.repository.prepareSpeakingSubmission(submission));}
async function reloaded(f){const sync=new StudyProgressSync(fresh,f.cache,scope);await sync.load(sync.beginLoading(),'owner-a',f.port);return sync;}

test('production preparation commits audio before any speaking completion or pending intent',async()=>{
  const f=fixture();await loaded(f);await f.sync.flush();
  const before=canonicalStudyState(f.sync.getSnapshot().state),beforeWrites=f.writes.length;
  f.control.uploadGate=deferred();
  const pending=prepared(f);
  // Blob conversion and upload are asynchronous; wait on an actual observable upload, not a timer.
  await f.control.uploadStarted.promise;
  assert.equal(canonicalStudyState(f.sync.getSnapshot().state),before);
  assert.equal(f.sync.getSnapshot().dirty,false);
  assert.equal(f.writes.length,beforeWrites);
  assert.equal(f.row.speaking.length,0);
  f.control.uploadGate.resolve();
  assert.equal(await pending,'submission-a');
  assert.equal(f.sync.getSnapshot().state.speaking.length,1);
  assert.equal(f.sync.getSnapshot().state.speaking[0].audioUrl,null);
  assert.equal(f.sync.getSnapshot().state.speaking[0].audioPath,'owner-a/submission-a.webm');
  assert.deepEqual([...f.uploads[0].bytes],[1,2,3,4,5]);
  assert.equal(f.entry.pending.speaking[0].audioUrl,null);
  assert.equal(f.entry.pending.speaking[0].audioPath,'owner-a/submission-a.webm');
  await f.sync.flush();
  assert.equal(canonicalStudyState(f.row),canonicalStudyState(f.sync.getSnapshot().state));
  assert.equal(f.uploads.length,1);
  assert.equal(f.projections.find(x=>x.table==='speaking_submissions').rows[0].audio_path,'owner-a/submission-a.webm');
  assert.equal(f.sync.getSnapshot().state.speaking[0].feedback,undefined);
});

test('load is stable across changing signed URL responses and never requests an ephemeral URL',async()=>{
  const f=fixture();await loaded(f);await prepared(f);await f.sync.flush();
  const a=await f.repository.load(course.id,course.languageCode);
  const b=await f.repository.load(course.id,course.languageCode);
  assert.equal(canonicalStudyState(a),canonicalStudyState(b));
  assert.equal(a.speaking[0].audioUrl,null);
  assert.equal(a.speaking[0].audioPath,'owner-a/submission-a.webm');
});

test('ACK audio A then a legitimate pending edit B reloads visibly without a recovery conflict',async()=>{
  const f=fixture();await loaded(f);await prepared(f);await f.sync.flush();
  f.sync.update(state=>({...state,profile:{...state.profile,goal:'legitimate pending B'}}));
  const expected=canonicalStudyState(f.sync.getSnapshot().state);
  const sync=await reloaded(f);
  assert.equal(canonicalStudyState(sync.getSnapshot().state),expected);
  assert.equal(sync.getSnapshot().dirty,true);
  assert.deepEqual(sync.getSnapshot().recovery,[]);
  await sync.flush();
  assert.equal(canonicalStudyState(f.row),expected);
  assert.equal(f.uploads.length,1);
});

test('lost ACK recognizes the exact normalized transmitted state and preserves newer B on reload',async()=>{
  const f=fixture();await loaded(f);await prepared(f);f.control.lostAck=true;
  await assert.rejects(f.sync.flush(),/lost ACK/);
  assert.equal(f.entry.compiledPendingBase.transmitted,canonicalStudyState(f.row));
  f.sync.update(state=>({...state,profile:{...state.profile,goal:'B after uncertain A'}}));
  const expected=canonicalStudyState(f.sync.getSnapshot().state);
  const sync=await reloaded(f);
  assert.equal(canonicalStudyState(sync.getSnapshot().state),expected);
  assert.equal(sync.getSnapshot().dirty,true);
  assert.deepEqual(sync.getSnapshot().recovery,[]);
  await sync.flush();
  assert.equal(canonicalStudyState(f.row),expected);
  assert.equal(f.uploads.length,1);
});

test('upload failure never records completion, a speaking event, or any new pending state',async()=>{
  const f=fixture();await loaded(f);await f.sync.flush();f.control.uploadError={message:'synthetic storage failure'};
  const before=structuredClone(f.sync.getSnapshot()),cacheBefore=structuredClone(f.entry);
  await assert.rejects(prepared(f),/synthetic storage failure/);
  assert.deepEqual(f.sync.getSnapshot(),before);
  assert.deepEqual(f.entry,cacheBefore);
  assert.equal(f.row.speaking.length,0);
});

test('owner or generation change during audio upload cannot register the old submission in a new session',async()=>{
  const f=fixture();await loaded(f);await f.sync.flush();f.control.uploadGate=deferred();
  const pending=prepared(f);
  await f.control.uploadStarted.promise;
  await f.sync.load(f.sync.beginLoading(),'owner-b',null);
  const before=structuredClone(f.sync.getSnapshot());
  f.control.uploadGate.resolve();await assert.rejects(pending,/conta ou contexto mudou/);
  assert.deepEqual(f.sync.getSnapshot(),before);
  assert.equal(f.sync.getSnapshot().state.speaking.length,0);
  assert.equal(f.row.speaking.length,0);
});

test('anonymous and unchanged installed-style recording retain the complete local audio without a compiled upload',async()=>{
  for(const owner of [null,'installed-owner']){
    const f=fixture();await f.sync.load(f.sync.beginLoading(),owner,null);
    await prepareAndRecordSpeaking(f.sync,draft());
    assert.equal(f.sync.getSnapshot().state.speaking[0].audioUrl,dataUrl);
    assert.equal(f.sync.getSnapshot().state.speaking[0].audioPath,undefined);
    assert.equal(f.uploads.length,0);
    assert.equal(f.sync.getSnapshot().dirty,true);
  }
});

test('a real remote semantic change still causes recovery and cannot be masked by audio normalization',async()=>{
  const f=fixture();await loaded(f);await prepared(f);await f.sync.flush();
  f.sync.update(state=>({...state,profile:{...state.profile,goal:'local B'}}));
  f.row={...f.row,speaking:f.row.speaking.map(s=>({...s,transcription:'genuine remote change'}))};
  const sync=await reloaded(f);
  assert.equal(sync.getSnapshot().state.speaking[0].transcription,'genuine remote change');
  assert.equal(sync.getSnapshot().dirty,false);
  assert.equal(sync.getSnapshot().recovery.length,1);
  assert.equal(sync.getSnapshot().recovery[0].profile.goal,'local B');
});

test('prepared paths avoid repeat uploads and MIME formats preserve the actual uploaded audio bytes',async()=>{
  for(const [mime,extension] of [['audio/webm','webm'],['audio/ogg','ogg'],['audio/mp4','m4a']]){
    const f=fixture(),input={...draft(),audioUrl:`data:${mime};base64,AQIDBAU=`};
    const normalized=await f.repository.prepareSpeakingSubmission(input);
    assert.equal(normalized.audioPath,`owner-a/submission-a.${extension}`);
    assert.equal(normalized.audioUrl,null);
    assert.deepEqual(await f.repository.prepareSpeakingSubmission(normalized),normalized);
    assert.equal(f.uploads.length,1);
    assert.deepEqual([...f.uploads[0].bytes],[1,2,3,4,5]);
  }
});


test('unprepared legacy data URLs fail closed before any remote write and remain complete pending after reload',async()=>{
  const f=fixture();await loaded(f);await f.sync.flush();
  const old=canonicalStudyState(f.row);
  f.sync.update(state=>({...state,speaking:[draft()]}));
  await assert.rejects(f.sync.flush(),/gravação ainda não está pronta/);
  assert.equal(canonicalStudyState(f.row),old);
  assert.equal(f.uploads.length,0);
  assert.equal(f.sync.getSnapshot().dirty,true);
  assert.equal(f.entry.pending.speaking[0].audioUrl,dataUrl);
  const sync=await reloaded(f);
  assert.equal(sync.getSnapshot().state.speaking[0].audioUrl,dataUrl);
  assert.equal(sync.getSnapshot().dirty,true);
  assert.equal(sync.getSnapshot().recovery.length,0);
});

test('signed URLs and foreign audio paths are never silently normalized or committed',async()=>{
  const f=fixture();await loaded(f);await f.sync.flush();
  const before=canonicalStudyState(f.row);
  for(const bad of [
    {...draft(),audioPath:'owner-a/submission-a.webm',audioUrl:'https://synthetic.invalid/audio?token=temporary'},
    {...draft(),audioPath:'other-owner/submission-a.webm',audioUrl:null},
    {...draft(),audioPath:'owner-a/different-submission.webm',audioUrl:null},
    {...draft(),audioPath:'owner-a/submission-a.webm',audioUrl:dataUrl},
  ]){
    await assert.rejects(f.repository.save({...fresh(),speaking:[bad]},course,[]),/preservada/);
    await assert.rejects(f.repository.prepareSpeakingSubmission(bad),/preservada/);
    assert.equal(canonicalStudyState(f.row),before);
  }
  assert.equal(f.uploads.length,0);
});

test('a genuine changed audio path is a full semantic conflict even with identical transcription',async()=>{
  const f=fixture();await loaded(f);await prepared(f);await f.sync.flush();
  f.sync.update(state=>({...state,profile:{...state.profile,goal:'pending B'}}));
  f.row={...f.row,speaking:f.row.speaking.map(s=>({...s,audioPath:'owner-a/submission-a.ogg'}))};
  const sync=await reloaded(f);
  assert.equal(sync.getSnapshot().dirty,false);
  assert.equal(sync.getSnapshot().state.speaking[0].audioPath,'owner-a/submission-a.ogg');
  assert.equal(sync.getSnapshot().recovery.length,1);
  assert.equal(sync.getSnapshot().recovery[0].speaking[0].audioPath,'owner-a/submission-a.webm');
});
