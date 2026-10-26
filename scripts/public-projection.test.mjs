import test from "node:test";
import assert from "node:assert/strict";
import { publicCourse } from "../src/content/public.ts";
const prefix = "course.units[0].lessons[0]";
const req = (location, extra = {}) => ({ location, requirement: { id: "speech.tts", version: "1.0.0", required: true, ...extra } });
const language = () => ({
  id: "en", variants: [{ id: "en-US" }, { id: "en-GB" }],
  speech: { defaultVariant: "en-US", support: { textToSpeech: true, speechRecognition: false, pronunciationAssessment: false },
    providers: { browser: { "en-US": { ttsLocale: "en-US" }, "en-GB": { ttsLocale: null } } } },
});
const fixture = () => ({
  id: "synthetic", defaultVariant: "en-US", acceptedVariants: ["en-US", "en-GB"], assessments: [], capabilityRequests: [],
  units: [{ id: "u", active: true, lessons: [{ id: "l", active: true,
    activities: Array.from({length:12}, (_,i) => ({ id:"a"+i, type:"mcq", variant:{requiredVariant:i===1?"en-GB":"en-US"}, answer:0, feedback:{secret:"private"} })),
    deferredRecovery: { rules: [{ id:"r", activity:{ id:"recovery", type:"listening", variant:{requiredVariant:"en-GB"}, answer:0, explanation:"private", transcript:"not before attempt", media:{kind:"audio",transcriptAvailableAfterAttempt:true} } }] },
  }] }],
});
const unavailable = p => p.capabilityReport.diagnostics.filter(d=>d.code==="CAPABILITY_UNAVAILABLE"&&d.capabilityId==="speech.tts").map(d=>d.location);
test("exact indexes, dotted descendants and recovery boundaries",()=>{
 const c=fixture(), denied=[prefix+".activities[1]",prefix+".activities[1].payload.audio",prefix+".deferredRecovery.rules[0].activity",prefix+".deferredRecovery.rules[0].activity.media"];
 const allowed=[prefix+".activities[10]",prefix+".activities[10].payload",prefix+".activities[1]suffix",prefix+".activities[100]",prefix+".deferredRecovery.rules[0].activitySuffix","course.media[0]"];
 c.capabilityRequests=[...denied,...allowed].map(x=>req(x));
 assert.deepEqual(unavailable(publicCourse(c,language(),undefined,"en-US")),denied);
});
test("activity variant overrides preference without contaminating other scopes",()=>{
 const c=fixture(); c.capabilityRequests=[req(prefix+".activities[0].payload"),req(prefix+".activities[1].payload"),req("course.media[0]")];
 assert.deepEqual(unavailable(publicCourse(c,language(),undefined,"en-GB")),[prefix+".activities[1].payload","course.media[0]"]);
});
test("explicit environment bypasses language configuration lookup",()=>{
 const c=fixture(),l=language();c.capabilityRequests=[req(prefix+".activities[1].payload")];
 Object.defineProperty(l,"speech",{get(){throw Error("must not resolve language");}});
 const p=publicCourse(c,l,{capabilities:{"speech.tts":{state:"available"}},dependencies:{"client.audio_output":{state:"available"}}},"en-GB");
 assert.equal(p.capabilityReport.compatible,true);assert.deepEqual(p.capabilityReport.diagnostics,[]);
});
test("configuration changes between calls and DTO isolation",()=>{
 const c=fixture(),l=language();c.capabilityRequests=[req("course.media[0]")];
 const a=publicCourse(c,l,undefined,"en-US"),b=publicCourse(c,l,undefined,"en-GB");
 assert.deepEqual(unavailable(a),[]);assert.equal(unavailable(b).length,1);
 l.speech.providers.browser["en-GB"].ttsLocale="en-GB";
 const d=publicCourse(c,l,undefined,"en-GB");assert.deepEqual(unavailable(d),[]);
 assert.notStrictEqual(a.units[0].lessons[0].activities,d.units[0].lessons[0].activities);
 d.units[0].lessons[0].activities.pop();assert.equal(c.units[0].lessons[0].activities.length,12);
});
test("private data and early recovery transcripts stay private",()=>{
 const c=fixture();c.capabilityRequests=[req(prefix+".activities[0]",{id:"unknown.private",data:{secret:"private payload"}})];
 const p=publicCourse(c,language()),l=p.units[0].lessons[0];
 assert.equal(p.capabilityRequests,undefined);
 for(const a of [...l.activities,...l.deferredRecovery.rules.map(r=>r.activity)])
   for(const key of ["answer","feedback","explanation"])assert.equal(a[key],undefined);
 assert.equal(l.deferredRecovery.rules[0].activity.transcript,"");
 assert.equal(c.units[0].lessons[0].deferredRecovery.rules[0].activity.transcript,"not before attempt");
 assert(!JSON.stringify(p.capabilityReport).includes("private payload"));assert.equal(p.capabilityReport.compatible,false);
});
test("invalid data and unsupported versions remain mandatory failures",()=>{
 const c=fixture();c.capabilityRequests=[req(prefix+".activities[0]",{id:"media.audio",data:{src:42}}),req(prefix+".activities[1]",{version:"999.0.0"})];
 const p=publicCourse(c,language());assert.equal(p.capabilityReport.compatible,false);
 for(const code of ["CAPABILITY_DATA_INVALID","CAPABILITY_VERSION_INCOMPATIBLE"])assert(p.capabilityReport.diagnostics.some(d=>d.code===code));
});
test("precomputed report is preserved without located requests",()=>{
 const c=fixture();delete c.capabilityRequests;c.capabilityReport={compatible:false,readiness:"unavailable",diagnostics:[],selections:[]};
 assert.deepEqual(publicCourse(c,language()).capabilityReport,c.capabilityReport);
});
test("request growth does not retraverse lesson activity arrays",()=>{
 function reads(n){const c=fixture(),l=c.units[0].lessons[0],a=l.activities;let count=0;
 Object.defineProperty(l,"activities",{enumerable:true,get(){count++;return a;}});
 c.capabilityRequests=Array.from({length:n},()=>req(prefix+".activities[1].payload"));publicCourse(c,language());return count;}
 const small=reads(10),large=reads(1000);assert(large<=small+2,JSON.stringify({small,large}));assert(large<10);
});
