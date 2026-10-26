import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';

const root=process.cwd(),sourceRoot=process.env.DESTRAVA_TEST_SOURCE_ROOT??root;
const require=createRequire(path.join(root,'package.json')),esbuild=require('esbuild');
const target='src/lib/learning-access-server.ts';
const owner='synthetic-owner',secret='synthetic-local-test-authority';
const normalize={trimWhitespace:true,collapseWhitespace:true,caseInsensitive:true,ignoreTerminalPunctuation:true,ignoreDiacritics:false};
async function fixture(){
  const observed={hashes:[],verification:[]};let data={attempts:[],rows:[],pageError:null},queries=[];
  const db={from(table){return{select(){return this;},eq(){return this;},in(){return this;},order(){return this;},async maybeSingle(){queries.push({table,offset:null});return{data:{state:{attempts:data.attempts}},error:null};},async range(a,b){queries.push({table,offset:a});return{data:data.rows.slice(a,b+1),error:a>=500?data.pageError:null};}};}};
  const built=await esbuild.build({stdin:{contents:[
    'export * from "./src/lib/learning-access-server";',
    'export * from "./src/lib/signed-learning-evidence";',
    'export {evaluateLearningAccess} from "./src/domain/study/learning-access";',
    'export {evaluateAssessment,assessmentSummary} from "./src/domain/assessments/assessment-engine";',
    'export {publicCourse} from "./src/content/public";',
  ].join('\n'),resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',tsconfig:path.join(root,'tsconfig.json'),plugins:[{name:'pure-learning-access-fixture',setup(build){
    build.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export {};',loader:'js'}));
    build.onLoad({filter:/src[\\/]lib[\\/]supabase[\\/]server\.ts$/},()=>({contents:'export async function createSupabaseServerClient(){return testDb;}',loader:'ts'}));
    build.onLoad({filter:/src[\\/]lib[\\/]learning-access-server\.ts$/},()=>({contents:fs.readFileSync(path.join(sourceRoot,target),'utf8'),loader:'ts'}));
    build.onLoad({filter:/src[\\/]lib[\\/]signed-learning-evidence\.ts$/},args=>{
      let text=fs.readFileSync(args.path,'utf8');
      text=text.replace('export function evidenceHash(','function actualEvidenceHash(').replace('export function verifyLearningEvidence(','function actualVerifyLearningEvidence(');
      text+='\nexport function evidenceHash(value: unknown){observeHash(value);return actualEvidenceHash(value);}\nexport function verifyLearningEvidence(token: unknown,value: unknown,key: string){observeVerify(value);return actualVerifyLearningEvidence(token,value,key);}\n';
      return{contents:text,loader:'ts'};
    });
  }}]});
  const mod={exports:{}},testProcess=Object.create(process);testProcess.env={SUPABASE_SECRET_KEY:secret};
  new Function('require','module','exports','testDb','observeHash','observeVerify','process',built.outputFiles[0].text)(require,mod,mod.exports,db,value=>observed.hashes.push(value?.id??null),value=>observed.verification.push(value?.kind),testProcess);
  const api=mod.exports;
  const activity=(id,answer='answer')=>({id,type:'short_answer',title:'Synthetic',prompt:'Respond.',skill:'reading',skills:['reading'],conceptIds:[],minutes:1,answer,accepted:[answer],explanation:'Synthetic explanation.',presentation:{content:{language:'zz',direction:'ltr'}}});
  const practices=Array.from({length:10},(_,i)=>activity('p'+i)),questions=Array.from({length:5},(_,i)=>activity('q'+i));
  const exam={id:'exam',title:'Final',method:'fixed',purpose:'summative',unitId:'u1',lessonId:'bank',objectiveIds:[],gradingStrategy:'objective_mean',passingPolicy:{overall:0.8},activityIds:questions.map(a=>a.id),exam:{entry:{activityIds:practices.map(a=>a.id),minimumRatio:0.8},feedback:'after_submission'}};
  const course={id:'synthetic-course',contentVersion:'1.0.0',title:'Synthetic',languageCode:'zz',defaultVariant:'zz-XX',acceptedVariants:['zz-XX'],assessments:[exam],units:[{id:'u1',active:true,lessons:[{id:'practice',active:true,activities:practices},{id:'bank',active:true,activities:questions}]},{id:'u2',active:true,access:{assessmentId:'exam',minimumScore:80},lessons:[]}],capabilityRequests:[{location:'course.units[0].lessons[0].activities[1]',requirement:{id:'text.input',version:'1.0.0',required:true,data:{}}}]};
  const language={id:'zz',variants:[{id:'zz-XX',name:'Synthetic'}],normalization:{...normalize},speech:{defaultVariant:'zz-XX',support:{textToSpeech:true,speechRecognition:false,pronunciationAssessment:false},providers:{browser:{'zz-XX':{ttsLocale:'zz-XX'}}}}};
  const receipt=(id='p0')=>({activityId:id,serverReceipt:api.completionReceipt(course,owner,id)});
  const row=(correct=5)=>{const id=randomUUID(),input={courseId:course.id,assessmentId:exam.id,attemptId:id,startedAt:'2026-01-01T00:00:00.000Z',responses:questions.map((a,i)=>({activityId:a.id,answer:i<correct?a.answer:'wrong'}))},finished_at='2026-01-01T00:01:00.000Z';return{id,assessment_id:exam.id,started_at:input.startedAt,finished_at,objective_score:100,result:{contentVersion:course.contentVersion,variantId:'zz-XX',input,attestation:api.assessmentAttestation(course,owner,input,finished_at,'zz-XX',language)}};};
  const set=(next)=>{data={attempts:[],rows:[],pageError:null,...next};queries=[];observed.hashes=[];observed.verification=[];};
  return{api,course,language,practices,questions,exam,receipt,row,set,observed,get queries(){return queries;},load:(user=owner)=>api.loadLearningAccess(user,course,language),expected(completed,rows=[]){const results=rows.map(r=>{const grade=api.evaluateAssessment(course,'exam',r.result.input.responses,language.normalization,{language,course,preference:r.result.variantId});return{id:r.id,courseId:course.id,assessmentId:'exam',...api.assessmentSummary(grade.definition),contentVersion:course.contentVersion,source:'server',startedAt:r.started_at,finishedAt:r.finished_at,status:grade.status,objectiveScore:grade.objectiveScore,passed:grade.passed,answers:grade.answers,responseKey:grade.responseKey};});return api.evaluateLearningAccess(api.publicCourse(course,language),{completedActivityIds:completed,assessmentResults:results});}};
}

test('full access DTO and exact receipt bytes retain first definition lookup semantics',async()=>{
  const f=await fixture(),first=f.practices[0],receipt=f.receipt();
  f.course.units[0].lessons[0].activities.push({...first,answer:'later duplicate definition',accepted:['later duplicate definition']});
  const expected={v:1,kind:'participation',owner,courseId:f.course.id,contentVersion:f.course.contentVersion,activityId:first.id,definitionHash:f.api.evidenceHash(first)};
  assert.deepEqual(f.api.activityEvidence(f.course,owner,first.id),expected);
  assert.equal(receipt.serverReceipt,f.api.signLearningEvidence(expected,secret));
  f.set({attempts:[receipt]});assert.deepEqual(await f.load(),f.expected(['p0']));
});

test('repeated valid and invalid receipts are each verified but the definition is hashed once per request',async()=>{
  const f=await fixture(),valid=f.receipt(),invalid={...valid,serverReceipt:valid.serverReceipt+'!'};
  for(const attempts of [[valid,invalid],[invalid,valid],[invalid,invalid],[valid,valid]]){
    f.set({attempts});const actual=await f.load();
    assert.deepEqual(actual,f.expected(attempts.includes(valid)?['p0']:[]));
    assert.equal(f.observed.verification.filter(k=>k==='participation').length,2);
    assert.equal(f.observed.hashes.filter(id=>id==='p0').length,1);
  }
});

test('951 attempts and eleven histories preserve the complete DTO without memoizing receipt legitimacy',async()=>{
  const f=await fixture(),valid=f.practices.map(a=>f.receipt(a.id)),rows=Array.from({length:11},(_,i)=>f.row(i<5?2:5));
  f.set({attempts:Array.from({length:951},(_,i)=>valid[i%valid.length]),rows});
  const actual=await f.load();assert.deepEqual(actual,f.expected(valid.map(a=>a.activityId),rows));
  assert.equal(f.observed.verification.filter(k=>k==='participation').length,951);
  assert.equal(f.observed.hashes.filter(id=>id?.startsWith('p')).length,10);
  assert.equal(actual.units.u2.allowed,true);
});

test('same objects mutated between requests cannot reuse former definition, owner, or edition authority',async()=>{
  const f=await fixture(),receipt=f.receipt();
  for(const [key,value]of [['answer','changed'],['presentation',{content:{language:'zz',direction:'rtl'}}],['answerPolicy',{requiredForms:['changed']}]] ){
    const old=f.practices[0][key];f.set({attempts:[receipt]});assert.deepEqual(await f.load(),f.expected(['p0']));
    f.practices[0][key]=value;f.set({attempts:[receipt]});assert.deepEqual(await f.load(),f.expected([]));
    if(old===undefined)delete f.practices[0][key];else f.practices[0][key]=old;
  }
  f.set({attempts:[receipt]});assert.deepEqual(await f.load('foreign-owner'),f.expected([]));
  for(const key of ['id','contentVersion']){const old=f.course[key];f.course[key]='changed';f.set({attempts:[receipt]});assert.deepEqual(await f.load(),f.expected([]));f.course[key]=old;}
});

test('normalization and variants changes invalidate old assessment attestations on each request',async()=>{
  const f=await fixture(),row=f.row();f.set({rows:[row]});assert.equal((await f.load()).units.u2.allowed,true);
  f.language.normalization.ignoreDiacritics=true;f.set({rows:[row]});assert.equal((await f.load()).units.u2.allowed,false);f.language.normalization.ignoreDiacritics=false;
  f.language.variants[0].name='Changed';f.set({rows:[row]});assert.equal((await f.load()).units.u2.allowed,false);
});

test('active filtering and invalid required or accepted variants still follow original publicCourse guards',async()=>{
  const f=await fixture(),receipts=f.practices.slice(0,8).map(a=>f.receipt(a.id)),row=f.row();
  f.course.units[1].active=false;f.course.units[0].lessons[0].active=false;f.set({attempts:receipts,rows:[row]});assert.deepEqual(await f.load(),f.expected(receipts.map(a=>a.activityId),[row]));
  const oldReceipt=f.receipt('p1');f.practices[1].variant={requiredVariant:'unknown'};f.set({attempts:[oldReceipt]});assert.deepEqual(await f.load(),f.expected([]));delete f.practices[1].variant;
  f.course.acceptedVariants.push('unknown');f.set({attempts:[]});await assert.rejects(f.load(),/variant|configuration|consistent/i);
});

test('passing row501 survives pagination, second page errors fail closed, and cached grades cannot grant access',async()=>{
  const f=await fixture(),row=f.row(),junk=Array.from({length:500},()=>({...row,id:randomUUID(),result:{...row.result,contentVersion:'old'}}));
  f.set({rows:[...junk,row]});assert.equal((await f.load()).units.u2.allowed,true);assert.deepEqual(f.queries.filter(q=>q.table==='assessment_attempts').map(q=>q.offset),[0,500]);
  f.set({rows:[...junk,row],pageError:Error('second page unavailable')});await assert.rejects(f.load(),/second page unavailable/);
  const failed=f.row(2);failed.result.canonical={passed:true,objectiveScore:100};f.set({rows:[failed]});assert.equal((await f.load()).units.u2.allowed,false);
});

test('malformed evidence and absent eligible definitions remain fail closed',async()=>{
  const f=await fixture();f.set({attempts:{malformed:true}});await assert.rejects(f.load(),/Unreadable learning evidence/);
  const receipt=f.receipt();f.course.units[0].lessons[0].activities.shift();f.set({attempts:[receipt]});await assert.rejects(f.load(),/Unknown learning activity/);
});
