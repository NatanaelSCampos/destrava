import {assessedAnswerSchema} from "../src/content/assessment-results.ts";
import {gradeActivity} from "../src/domain/activities/grader.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {loadContent} from "./content-loader.ts";
import {coursePackageSchema} from "../src/content/contracts.ts";
import {activityPayloadSchemas} from "../src/content/activity-data.ts";
import {activitySceneSchema} from "../src/content/activity-scene.ts";
import {capabilityRegistry} from "../src/engine/capabilities/registry.ts";
import {packageCapabilityRequests} from "../src/engine/capabilities/package-compatibility.ts";
import {negotiateCapabilities} from "../src/engine/capabilities/compatibility.ts";
import {runtimeBundle} from "../src/content/runtime-package.ts";
import {publicCourse} from "../src/content/public.ts";
import {installedCapabilityEnvironment} from "../src/domain/installed-study/compatibility.ts";
const source=loadContent().find(b=>b.language.id==="xx-Test");
const scene={illustration:"clock",context:"A meeting at a given time",clock:{hour:7,minute:30},
 cue:{speaker:"Partner",text:"Where?",translation:"Meaning",audioMediaId:"scene-audio"},
 items:[{label:"A",translation:"Source A",value:"7:30",icon:"clock"}]};
function sample(){
 const raw=structuredClone(source);raw.course.schemaVersion="1.8";
 const activity=raw.course.units[0].lessons[0].activities.find(a=>a.type==="multiple_choice");
 activity.payload.scene=structuredClone(scene);
 activity.payload.explanation="PRIVATE_SCENE_EXPLANATION";
 raw.course.media.push({id:"scene-audio",type:"audio",src:"/media/test/scene.wav",
 metadata:{author:"Synthetic",license:"CC0",licenseUrl:"https://creativecommons.org/publicdomain/zero/1.0/",sourceUrl:"https://example.org/scene",credit:"No playback claim"}});
 return{raw,activity};
}
test("all six authored illustrations accepted without content inference",()=>{
 for(const illustration of ["message","meeting","clock","cafe","menu","takeaway"])
 assert(activitySceneSchema.safeParse({illustration,context:"Context"}).success);
});
for(const change of [{html:"<img/>"},{illustration:"unknown"},{clock:{hour:0,minute:30}},{clock:{hour:13,minute:30}},{clock:{hour:7,minute:60}},{items:[]},{items:[{label:"A",icon:"script"}]}])
 test("scene rejects invalid declarative data "+JSON.stringify(change),()=>assert.equal(activitySceneSchema.safeParse({...scene,...change}).success,false));
test("clock data cannot be silently used in another illustration",()=>assert.equal(activitySceneSchema.safeParse({...scene,illustration:"menu"}).success,false));
test("1.8 scene parses, resolves public media and implies mandatory capabilities",()=>{
 const{raw}=sample();assert(coursePackageSchema.safeParse(raw.course).success);
 const runtime=runtimeBundle(raw),requests=packageCapabilityRequests(raw.course,raw.language,raw.moduleData);
 assert(requests.some(r=>r.requirement.id==="presentation.scene"&&r.requirement.required));
 assert(requests.some(r=>r.requirement.id==="activity.multiple_choice"&&r.requirement.version==="3.0.0"));
 assert(requests.some(r=>r.requirement.id==="media.audio"&&r.location.includes("scene-audio")));
 assert(runtime.course.teachingMedia.some(a=>a.id==="scene-audio"));
 assert(!JSON.stringify(publicCourse(runtime.course,runtime.language)).includes("PRIVATE_SCENE_EXPLANATION"));
});
for(const version of ["1.3","1.4","1.5","1.6","1.7"])
 test("older course "+version+" refuses authored scene",()=>{
 const{raw}=sample();raw.course.schemaVersion=version;
 assert.equal(coursePackageSchema.safeParse(raw.course).success,false);
});
test("cue audio rejects missing asset, invalid path and missing rights",()=>{
 for(const mutate of [r=>r.course.media.pop(),r=>r.course.media.at(-1).src="https://remote.example/file.wav",r=>delete r.course.media.at(-1).metadata.license]){
 const{raw}=sample();mutate(raw);assert.equal(coursePackageSchema.safeParse(raw.course).success,false);}
});
test("each interaction version remains frozen; new scene needs current version",()=>{
 for(const [type,schema] of Object.entries(activityPayloadSchemas)){
 const definition=capabilityRegistry.get("activity."+type);
 const payload=type==="multiple_choice"?{options:["A","B"],answer:"A",scene}:
 type==="flashcard"?{front:"F",back:"B",example:"E",scene}:null;
 if(!payload)continue;
 assert(schema.safeParse(payload).success);
 for(const [version,old] of Object.entries(definition.versionSchemas))
 assert.equal(old.safeParse(payload).success,version===(type==="flashcard"?"4.0.0":"3.0.0"),type+version);
 }
});
test("missing required scene capability blocks negotiation and installed readiness",()=>{
 const request={location:"test",requirement:{id:"presentation.scene",version:"1.0.0",required:true,data:scene}};
 const noScene=new Map(capabilityRegistry);noScene.delete("presentation.scene");
 assert.equal(negotiateCapabilities([request],{},noScene).compatible,false);
 assert.equal(negotiateCapabilities([request],installedCapabilityEnvironment()).readiness,"unavailable");
});
test("review recall requires real cards and 1.8",()=>{
 const{raw,activity}=sample();
 const clone=structuredClone(activity);raw.course.units[0].lessons[0].activities.push(clone);clone.id=activity.id;activity.id+="new-review";activity.type="review";activity.evaluation=undefined;activity.payload={body:"Practice",steps:[],cards:[],reviewMode:"recall"};
 assert.equal(coursePackageSchema.safeParse(raw.course).success,false);
 activity.payload.cards=[{label:"Task",practice:"Remember first",examples:["Model"]}];
 assert(coursePackageSchema.safeParse(raw.course).success);
 raw.course.schemaVersion="1.7";assert.equal(coursePackageSchema.safeParse(raw.course).success,false);
});
test("expanded recall illustration requires flashcard4 and course1.8",()=>{
 const{raw,activity}=sample();const clone=structuredClone(activity);raw.course.units[0].lessons[0].activities.push(clone);clone.id=activity.id;activity.id+="new-card";activity.type="flashcard";activity.evaluation=undefined;
 activity.payload={front:"F",back:"A",example:"E",recallScene:{title:"T",context:"C",action:"Try",illustration:"cafe",model:{kind:"dialogue",lines:[{speaker:"A",text:"A"},{speaker:"B",text:"B"}]}}};
 assert(coursePackageSchema.safeParse(raw.course).success);
 assert(packageCapabilityRequests(raw.course,raw.language,raw.moduleData).some(r=>r.requirement.id==="activity.flashcard"&&r.requirement.version==="4.0.0"));
 assert.equal(capabilityRegistry.get("activity.flashcard").versionSchemas["3.0.0"].safeParse(activity.payload).success,false);
 raw.course.schemaVersion="1.7";assert.equal(coursePackageSchema.safeParse(raw.course).success,false);
});

test("authoritative assessment result preserves private explanation metadata only after grading",()=>{
 const activity={id:"result-presentation",type:"multiple_choice",skill:"grammar",skills:["grammar"],options:["A","B"],answer:"A",
 explanation:"Use TARGET here.",presentation:{fields:{answer:{language:"pt-BR"}},annotations:{explanation:[{text:"TARGET",role:"target",item:0,occurrence:1}]}}};
 const before=publicCourse;assert(before);
 const output=gradeActivity(activity,"A");
 assert.equal(output.presentation.annotations.explanation[0].text,"TARGET");
 const parsed=assessedAnswerSchema.parse({...output,activityId:activity.id,answer:"A",skill:"grammar"});
 assert.equal(parsed.presentation.annotations.explanation[0].text,"TARGET");
 assert.equal(parsed.presentation.fields.answer.language,"pt-BR");
 assert.equal(assessedAnswerSchema.safeParse({...parsed,presentation:{html:"<script/>"}}).success,false);
});
