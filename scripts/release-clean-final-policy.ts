import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { SupabaseStudyRepository } from '../src/repositories/supabase-study-repository';
import { requireCourseBundle } from '../src/content/course-registry';
import { readPersistedCourseState } from '../src/domain/study/course-state-storage';

const API = 'http://127.0.0.1:55421';
const APP = 'http://127.0.0.1:3100';
export const resources = ['user_course_state', 'user_course_profiles', 'study_events', 'lesson_progress', 'unit_progress', 'skill_progress'];
const copy = (v: unknown) => JSON.parse(JSON.stringify(v));
const sorted = (v: unknown) : unknown => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sorted(x)])) : v;
const equal = (a: unknown,b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const headers = (h: Record<string,string>) => Object.fromEntries(Object.entries(h).map(([k,v])=>[k.toLowerCase(),v]));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
type Wire = {url:string;method:string;headers:Record<string,string>;postData?:string;networkId?:string};
type Plan = {url:string;rows:Record<string,unknown>[]};

/** Fixture-specific policy. SDK/repository projections run against an in-memory fetch, never a service. */
export async function createFinalPersistencePolicy(input:{owner:string;courseId:string;baseline:unknown;accessToken:string;publicKey:string;clientInfo:string;phase:()=>string;now?:()=>number}) {
 const {owner,courseId,accessToken,publicKey,clientInfo,phase}=input;
 assert(uuid.test(owner)); assert.equal(courseId,'frecuencias-a1'); assert(accessToken&&publicKey&&clientInfo);
 const now=input.now??Date.now, bundle=requireCourseBundle(courseId);
 const baseline=copy(readPersistedCourseState(input.baseline,courseId,bundle.course.languageCode));
 assert(baseline&&equal(baseline,input.baseline),'Baseline normalization drift');
 assert.equal(baseline.profile.onboardingStep,0); assert.equal(baseline.profile.onboarded,false);
 assert.equal(baseline.activeSessionId,null); assert.equal(baseline.events.length,2);
 for(const e of baseline.events){assert(uuid.test(e.id));assert.equal(e.type,'onboarding_started');assert(equal(e.metadata,{courseId}));}
 const receipts:Record<string,unknown>[] = [], preflights:Record<string,unknown>[]=[];
 const readReceipts:Record<string,unknown>[]=[], pendingReads=new Map<string,{step:number;stateHash:string;status?:number}>();
 const pending=new Map<string,{resource:string;step:number;events:number;stateHash:string;rows:number}>();
 let plans:Map<string,Plan>|null=null, acceptedState=baseline;
 const stateHash=(s:unknown)=>createHash('sha256').update(JSON.stringify(sorted(s))).digest('hex');
 function validateState(s:typeof baseline){
  assert(equal(Object.keys(s).sort(),Object.keys(baseline).sort()));
  for(const key of Object.keys(baseline))if(!['profile','events'].includes(key))assert(equal(s[key],baseline[key]),'Unexpected root change');
  const p={...s.profile,onboardingStep:0};assert(equal(p,baseline.profile));
  assert([0,1].includes(s.profile.onboardingStep));
  assert.equal(s.events.length,s.profile.onboardingStep===0?2:3);
  assert(s.profile.onboardingStep>=acceptedState.profile.onboardingStep,'State regression');
  if(acceptedState.profile.onboardingStep===1)assert(equal(s,acceptedState),'Snapshot changed after final transition');
  for(const e of baseline.events)assert(s.events.some((x:{id:string})=>x.id===e.id&&equal(x,e)));
  assert.equal(new Set(s.events.map((e:{id:string})=>e.id)).size,s.events.length);
  const added=s.events.filter((e:{id:string})=>!baseline.events.some((b:{id:string})=>b.id===e.id));
  if(added.length){const e=added[0];assert.equal(s.profile.onboardingStep,1);assert(equal(Object.keys(e).sort(),['createdAt','id','metadata','type']));assert(uuid.test(e.id));assert.equal(e.type,'onboarding_step_completed');assert(equal(e.metadata,{courseId,step:'Idioma'}));assert(Math.abs(Date.parse(e.createdAt)-now())<120000);}
  return s;
 }
 async function project(s:typeof baseline){
  const map=new Map<string,Plan>();
  const client=createClient(API,'synthetic-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
   const u=new URL(String(url));assert.equal(u.origin,API);assert.equal(init?.method,'POST');const resource=u.pathname.slice('/rest/v1/'.length);assert(resources.includes(resource)&&!map.has(resource));const body=JSON.parse(String(init?.body));map.set(resource,{url:u.href,rows:Array.isArray(body)?body:[body]});return new Response('[]',{status:201,headers:{'Content-Type':'application/json'}});
  }}});
  await new SupabaseStudyRepository(client,owner).save(s,bundle.course,bundle.resources.vocabulary);
  assert(equal([...map.keys()].sort(),[...resources].sort()));return map;
 }
 plans=await project(baseline);
 const handles=(url:URL)=>url.origin===API&&resources.some(r=>url.pathname==='/rest/v1/'+r);
 function actualHeaders(h:Record<string,string>,method:string){
  assert.equal(h.origin,APP);assert.equal(h.apikey,publicKey);assert.equal(h.authorization,'Bearer '+accessToken);assert.equal(h['x-client-info'],clientInfo);
  if(method==='POST'){assert.equal(h['content-profile'],'public');assert.equal(h['content-type'],'application/json');assert.equal(h.prefer,'resolution=merge-duplicates');assert(!h['accept-profile']);}
  else {assert.equal(h['accept-profile'],'public');assert(!h['content-profile']&&!h.prefer);}
  const known=new Set(['origin','apikey','authorization','x-client-info','content-profile','content-type','prefer','accept-profile','accept','accept-encoding','accept-language','connection','content-length','host','referer','user-agent','priority','cache-control','pragma','sec-fetch-dest','sec-fetch-mode','sec-fetch-site','sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform']);
  assert(Object.keys(h).every(k=>known.has(k)));
 }
 async function allow(url:URL,request:Wire){try{
  assert(handles(url)&&!url.username&&!url.password&&!url.hash);assert(['retry-switch','complete','compiled-persistence'].includes(phase()));
  const resource=url.pathname.slice('/rest/v1/'.length), h=headers(request.headers),m=request.method;
  if(m==='OPTIONS'){
   assert.equal(h.origin,APP);const requested=h['access-control-request-method'];assert(requested==='POST'||resource==='user_course_state'&&requested==='GET');
   const names=(h['access-control-request-headers']??'').toLowerCase().split(',').map(s=>s.trim()).sort();
   const expected=requested==='POST'?['apikey','authorization','content-profile','content-type','prefer','x-client-info']:['accept-profile','apikey','authorization','x-client-info'];assert(equal(names,expected.sort()));
   if(requested==='POST')assert.equal(url.search,new URL(plans!.get(resource)!.url).search);
   else assert.equal(url.search,new URL(API+'/rest/v1/user_course_state?select=state&user_id=eq.'+owner+'&course_id=eq.'+courseId).search);
   preflights.push({resource,requested,origin:h.origin,headers:names,at:now()});return true;
  }
  actualHeaders(h,m);
  if(m==='GET'){assert(resource==='user_course_state'&&url.href===API+'/rest/v1/user_course_state?select=state&user_id=eq.'+owner+'&course_id=eq.'+courseId);assert(request.networkId);pendingReads.set(request.networkId,{step:acceptedState.profile.onboardingStep,stateHash:stateHash(acceptedState)});return true;}
  assert.equal(m,'POST');const body=JSON.parse(request.postData??'null'),rows=Array.isArray(body)?body:[body];
  let nextState=acceptedState,nextPlans=plans!;
  if(resource==='user_course_state'){assert.equal(rows.length,1);validateState(rows[0].state);nextState=copy(rows[0].state);nextPlans=await project(nextState);}
  const expected=nextPlans.get(resource)!;assert.equal(url.href,expected.url);assert.equal(rows.length,expected.rows.length);
  const normal=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).map(([k,v])=>{
   if(k==='updated_at'||['completed_at','mastered_at','onboarding_completed_at'].includes(k)&&v!==null){assert(typeof v==='string'&&Math.abs(Date.parse(v)-now())<120000);return[k,'<bounded-generated-time>'];}return[k,v];
  }));
  const ordered=(r:Record<string,unknown>[])=>r.map(normal).map(v=>JSON.stringify(sorted(v))).sort();assert(equal(ordered(rows),ordered(expected.rows)));
  assert(request.networkId&&!pending.has(request.networkId));
  // Recheck after asynchronous projection against the state that is current now.
  if(resource==='user_course_state')validateState(nextState);
  acceptedState=nextState;plans=nextPlans;
  pending.set(request.networkId,{resource,step:acceptedState.profile.onboardingStep,events:acceptedState.events.length,stateHash:stateHash(acceptedState),rows:rows.length});return true;
 }catch{return false;}}
 function response(id:string,status:number){const read=pendingReads.get(id);if(read)read.status=status;const item=pending.get(id);if(item){pending.delete(id);receipts.push({...item,status,at:now()});}}
 function readResponse(id:string,body:string,base64Encoded=false){const item=pendingReads.get(id);if(!item)return;pendingReads.delete(id);let matched=false,rowCount=0,observedHash:null|string=null;try{assert(body.length<256000);const parsed=JSON.parse(base64Encoded?Buffer.from(body,'base64').toString('utf8'):body);const rows=Array.isArray(parsed)?parsed:[parsed];rowCount=rows.length;assert.equal(rows.length,1);assert(equal(Object.keys(rows[0]),['state']));observedHash=stateHash(rows[0].state);matched=item.status===200&&observedHash===item.stateHash;}catch{matched=false;}readReceipts.push({...item,id,rowCount,observedHash,matched,at:now()});}
 function proof(){return{preflights,receipts,readReceipts,acknowledgedStepOne:acceptedState.profile.onboardingStep===1&&resources.every(resource=>receipts.some(r=>r.resource===resource&&r.stateHash===stateHash(acceptedState)&&r.step===1&&r.events===3&&Number(r.status)>=200&&Number(r.status)<300))};}
 return{handles,allow,response,readExpected:(id:string)=>pendingReads.has(id),readResponse,proof,validateState,expected:()=>Object.fromEntries([...plans!].map(([k,v])=>[k,v.rows]))};
}
