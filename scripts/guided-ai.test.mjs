import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { interactiveTeachingInputSchema, resolveTeachingMoment, teachingBoardActions, TeachingContextError } from '../src/domain/ai/interactive-teaching-context';
import { teachingNarration } from '../src/domain/interactive-lesson/narration-controller';
import { boardElementSchema } from '../src/content/contracts';
import { deriveLessonEvents } from '../src/domain/interactive-lesson/telemetry';
import { interactiveTeachingSchema } from '../src/domain/ai/schemas';
import { initialRuntime, reduceRuntime, TimelineEngine } from '../src/domain/interactive-lesson/runtime';
import { interactiveLessonSchema, coursePackageSchema } from '../src/content/contracts';
import { loadContent } from './content-loader';
const definition=interactiveLessonSchema.parse(JSON.parse(fs.readFileSync('content/courses/espanol-a-tu-paso-a1/interactive-lessons/003.json','utf8')));
const scope={userId:'owner',courseId:definition.courseId,lessonId:definition.lessonId,sessionId:'11111111-1111-4111-8111-111111111111',contentVersion:'1.7.0',definitionHash:'a'.repeat(64)};
const input={courseId:scope.courseId,lessonId:scope.lessonId,segmentId:definition.segments[0].id,sessionId:scope.sessionId,contentVersion:scope.contentVersion,definitionHash:scope.definitionHash,revision:2,requestId:'22222222-2222-4222-8222-222222222222',positionMs:5000,question:'Por que esta forma muda?'};
const runtime=()=>({...initialRuntime(definition,scope),phase:'paused',positionMs:5000});
const fails=(fn,code)=>assert.throws(fn,e=>e instanceof TeachingContextError&&e.code===code);
test('strict bounded input rejects injected board, empty question and unbound request',()=>{
 assert(interactiveTeachingInputSchema.safeParse(input).success);
 for(const change of [{board:[]},{question:' '},{question:'a'.repeat(401)},{revision:0},{requestId:'unsafe'},{positionMs:-1},{previousReply:{message:'x'.repeat(651),example:'',translation:'',followUp:''}}])assert(!interactiveTeachingInputSchema.safeParse({...input,...change}).success);
});
for(const field of ['courseId','lessonId','sessionId','contentVersion','definitionHash','revision'])test('rejects changed '+field,()=>fails(()=>resolveTeachingMoment({...input,[field]:field==='revision'?3:'other'},definition,runtime(),scope,2),'TEACHING_SCOPE_CHANGED'));
test('rejects different owner in stored runtime',()=>fails(()=>resolveTeachingMoment(input,definition,{...runtime(),evidenceScope:{...scope,userId:'other'}},scope,2),'TEACHING_SCOPE_CHANGED'));
test('uses stored interrupted position, not client time or stale playing clock',()=>{
 const state={...runtime(),phase:'intervening',positionMs:0,resumePoint:{segmentId:input.segmentId,playbackPositionMs:5000,anchorMs:0,reason:'explain',board:{elements:[]}}};
 assert.equal(resolveTeachingMoment(input,definition,state,scope,2).positionMs,5000);
 fails(()=>resolveTeachingMoment({...input,positionMs:5501},definition,state,scope,2),'TEACHING_POSITION_CHANGED');
 assert.equal(resolveTeachingMoment({...input,positionMs:5500},definition,state,scope,2).positionMs,5000);
});
for(const phase of ['idle','checkpoint','speaking','completed'])test('rejects phase '+phase,()=>fails(()=>resolveTeachingMoment(input,definition,{...runtime(),phase},scope,2),'TEACHING_MOMENT_UNAVAILABLE'));
test('checkpoint and activity cannot receive AI hints',()=>{
 const index=definition.segments.findIndex(s=>s.type==='checkpoint');
 fails(()=>resolveTeachingMoment({...input,segmentId:definition.segments[index].id,positionMs:0},definition,{...runtime(),segmentIndex:index},scope,2),'TEACHING_MOMENT_UNAVAILABLE');
});
test('context ignores forged runtime board and private answer canaries',()=>{
 const state={...runtime(),board:{elements:[{text:'PRIVATE_ANSWER_CANARY'}]},mistakes:[{correctAnswer:'PRIVATE_ANSWER_CANARY'}]};
 const moment=resolveTeachingMoment(input,definition,state,scope,2),text=JSON.stringify(moment.teachingContext);
 assert(!text.includes('PRIVATE_ANSWER_CANARY'));assert(!text.includes('answerPolicy'));assert(moment.teachingContext.board.length<=4);
});
test('all optional-field combinations accepted by provider schema produce valid, non-progressing board actions',()=>{
 for(const example of ['', ' ', 'Estoy en la plaza.'])for(const translation of ['', ' ', 'Estou na praça.'])for(const followUp of ['', ' ', 'Qual lugar você quer informar?']){
 const feedback=interactiveTeachingSchema.parse({message:'Vamos separar as partes desta mensagem.',example,translation,followUp,canResume:true});
 const actions=teachingBoardActions(feedback,'pt-BR','es','meeting');assert(actions.length>=2);assert(actions.every(a=>['board.clear','board.show'].includes(a.type)));
 for(const a of actions.filter(a=>a.type==='board.show'))assert.equal(a.element.textPresentation?.language,a.element.id==='teacher-example'?'es':a.element.id==='teacher-followUp'?undefined:'pt-BR');
 }
});
test('every canonical audio clip exists, hash matches and total exceeds five minutes',()=>{
 const media=JSON.parse(fs.readFileSync('content/courses/espanol-a-tu-paso-a1/media.json','utf8'));
 let total=0;for(const segment of definition.segments.filter(s=>s.presentation)){
 const asset=media.find(m=>m.id===segment.presentation.mediaId);assert(asset);const bytes=fs.readFileSync('public'+asset.src);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.metadata.sha256);assert.equal(segment.presentation.durationMs,asset.metadata.durationMs);total+=asset.metadata.durationMs;
 const lines=segment.presentation.transcript;for(let i=0;i<lines.length;i++){assert(lines[i].endMs>lines[i].startMs);assert(lines[i].endMs<=segment.presentation.durationMs);if(i)assert(lines[i].startMs>=lines[i-1].endMs);}
 }
 assert(total>=300000);assert.equal(total,624072);
});
test('backward seek reconstructs the earlier illustrated board and drops future highlights',()=>{
 const segment=definition.segments[0],engine=new TimelineEngine();engine.load(segment.cues);const cues=segment.cues.filter(c=>c.action.type==='board.show');const first=cues[0],last=cues.at(-1);assert.notEqual(first.action.element.id,last.action.element.id);
 engine.tick(segment.presentation.durationMs);const back=engine.seek(0);assert(back.elements.some(e=>e.id===first.action.element.id));assert(!back.elements.some(e=>e.id===last.action.element.id));assert(!back.highlightedIds.includes(last.action.element.id));assert.deepEqual(engine.tick(0).effects,[]);
});
test('required checkpoint blocks progression without signed evidence even under auto-flow',()=>{
 const index=definition.segments.findIndex(s=>s.type==='checkpoint'),state={...initialRuntime(definition,scope),segmentIndex:index,phase:'checkpoint'};
 assert.equal(reduceRuntime(definition,state,{type:'NEXT',nextBoard:{elements:[],highlightedIds:[],translationVisible:false,caption:'',teacherState:'paused'}}).segmentIndex,index);
});
test('new visual capabilities and automatic flow are version-gated and existing packs still parse',()=>{
 for(const raw of loadContent())coursePackageSchema.parse(raw.course);
 const raw=loadContent().find(p=>p.course.id===scope.courseId).course;assert.equal(raw.schemaVersion,'1.12');
 assert(!coursePackageSchema.safeParse({...raw,schemaVersion:'1.11'}).success);
});
test('interruption events retain the captured millisecond without storing question text',()=>{
 const before={...runtime(),phase:'presenting',positionMs:12345};
 const current={...before,phase:'intervening',resumePoint:{segmentId:input.segmentId,playbackPositionMs:12345,anchorMs:0,reason:'explain',board:{elements:[]}}};
 const events=deriveLessonEvents(before,current,definition);assert.equal(events.length,2);assert(events.every(e=>e.positionMs===12345));assert(!JSON.stringify(events).includes(input.question));
});

test('follow-up language requires an explicit provider declaration; unknown never acquires a voice',()=>{
 for(const role of ['source','target','unknown']){const reply=interactiveTeachingSchema.parse({message:'Vamos separar esta ideia em duas partes.',example:'',translation:'',followUp:'Uma pergunta curta',canResume:true,followUpRole:role});
 const card=teachingBoardActions(reply,'pt-BR','es').find(a=>a.type==='board.show'&&a.element.id==='teacher-followUp');assert.equal(card.element.textPresentation?.language,role==='target'?'es':role==='source'?'pt-BR':undefined);}
});

test('mixed explanation runs retain every character and use separate declared voices and fonts',()=>{
 const messageParts=[{text:'Use ',role:'source'},{text:'estoy',role:'target'},{text:' para indicar seu lugar.',role:'source'}];
 const reply=interactiveTeachingSchema.parse({message:messageParts.map(p=>p.text).join(''),messageParts,example:'Estoy en la plaza.',translation:'Estou na praça.',followUp:'',canResume:true});
 const card=teachingBoardActions(reply,'pt-BR','es').find(a=>a.type==='board.show'&&a.element.id==='teacher-message').element;
 assert.deepEqual(card.runs.map(r=>r.language),['pt-BR','es','pt-BR']);assert.equal(card.runs.map(r=>r.text).join(''),reply.message);
 const lines=teachingNarration(reply,{sourceLanguage:'pt-BR',targetLanguage:'es',targetLocale:'es-ES',targetFallbackAllowed:false});assert.deepEqual(lines.slice(0,3).map(l=>l.locale),['pt-BR','es-ES','pt-BR']);
 assert(!interactiveTeachingSchema.safeParse({...reply,message:'Outra mensagem incompatível'}).success);
 assert(!boardElementSchema.safeParse({...card,runs:[{text:'Texto diferente',language:'pt-BR'}]}).success);
});
test('uncertain explanation fragment remains readable without assuming a language',()=>{
 const messageParts=[{text:'Texto em idioma incerto.',role:'unknown'}],reply=interactiveTeachingSchema.parse({message:messageParts[0].text,messageParts,example:'',translation:'',followUp:'',canResume:false});
 const lines=teachingNarration(reply,{sourceLanguage:'pt-BR',targetLanguage:'es',targetLocale:'es-ES',targetFallbackAllowed:false});assert.equal(lines[0].role,null);assert.equal(lines[0].locale,null);
 const card=teachingBoardActions(reply,'pt-BR','es').find(a=>a.type==='board.show').element;assert.equal(card.runs[0].language,undefined);
});
