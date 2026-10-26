import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { z } from "zod";
import { loadContent } from "./content-loader.ts";
import { coursePackageSchema } from "../src/content/contracts.ts";
import { annotatedParts, activityPresentationSchema, publicPresentation } from "../src/content/text-presentation.ts";
import { inlinePresentationIssues } from "../src/content/validate-inline.ts";
import { gradePresentation } from "../src/content/grade-presentation.ts";
import { publicActivity } from "../src/content/public.ts";
import { gradeActivity } from "../src/domain/activities/grader.ts";
import { runtimeBundle } from "../src/content/runtime-package.ts";
import { capabilityRegistry } from "../src/engine/capabilities/registry.ts";
import { packageCapabilityRequests } from "../src/engine/capabilities/package-compatibility.ts";
import { teachingAudioReferences, recallSceneSchema } from "../src/content/teaching.ts";
const a=(text,item=0,occurrence=1)=>({text,item,occurrence,role:"target"});
const annotation={annotations:{support:[a("TARGET")],explanation:[a("PRIVATE")],feedbackSummary:[a("YES"),a("NO",1)],feedbackAlternative:[a("ONE"),a("TWO",1)]}};
test("exact spans retain text and distinguish repeated occurrence",()=>{
 const parts=annotatedParts("X TARGET X TARGET!",[a("TARGET",0,2)]);
 assert.equal(parts.map(p=>p.text).join(""),"X TARGET X TARGET!");
 assert.deepEqual(parts.filter(p=>p.role),[{text:"TARGET",role:"target"}]);
 assert.equal(parts[0].text,"X TARGET X ");
});
for(const annotations of [[a("missing")],[a("TARGET"),a("ARGET")],[a("TARGET",0,3)]])
 test("reject missing, overlap and nonexistent occurrence "+JSON.stringify(annotations),()=>assert.throws(()=>annotatedParts("TARGET",annotations)));
test("paragraph/item is explicit, not guessed",()=>{
 const base={title:"X",prompt:"Y",payload:{teaching:{support:"TARGET\n\nOTHER"}},presentation:{annotations:{support:[a("OTHER",1)]}}};
 assert.deepEqual(inlinePresentationIssues(base),[]);
 base.presentation.annotations.support[0].item=0;assert.equal(inlinePresentationIssues(base).length,1);
});
test("invalid counts and arbitrary markup fields rejected",()=>{
 for(const change of [{item:-1},{occurrence:0},{role:"script"},{html:"<b/>"}])
 assert.equal(activityPresentationSchema.safeParse({annotations:{support:[{...a("X"),...change}]}}).success,false);
});
test("public projection removes private spans without mutating original",()=>{
 const original=JSON.stringify(annotation),safe=publicPresentation(annotation);
 assert.deepEqual(Object.keys(safe.annotations),["support"]);assert.equal(JSON.stringify(annotation),original);
 const projected=publicActivity({id:"x",type:"short_answer",answer:"PRIVATE",explanation:"PRIVATE",presentation:annotation});
 assert(!JSON.stringify(projected).includes("PRIVATE"));assert(!JSON.stringify(projected).includes("ONE"));
});
test("hidden transcript has no annotation side channel",()=>{
 const p={annotations:{transcript:[a("SECRET")]}};
 assert(!JSON.stringify(publicPresentation(p,true)).includes("SECRET"));
});
test("selected grade remaps only correct summary and normalized alternative detail",()=>{
 const p=gradePresentation(annotation,false,1);assert.equal(p.annotations.feedbackSummary[0].text,"NO");assert.equal(p.annotations.feedbackSummary[0].item,0);
 assert.equal(p.annotations.feedback[0].text,"TWO");assert(!p.annotations.support);
 const result=gradeActivity({id:"x",type:"multiple_choice",answer:"X",options:["X","Y"],explanation:"PRIVATE",presentation:annotation,
 feedback:{summaryCorrect:"YES",summaryIncorrect:"NO",alternatives:[{answer:"X",detail:"ONE"},{answer:"Y",detail:"TWO"}]}}," y ");
 assert.equal(result.correct,false);assert.equal(result.feedback.detail,"TWO");assert.equal(result.presentation.annotations.feedback[0].text,"TWO");
});
const model={kind:"dialogue",lines:[{speaker:"A",text:"Target",audioMediaId:"a"},{speaker:"B",text:"Reply",audioMediaId:"b"}]};
const scene={title:"Context",context:"Situation",action:"Write",illustration:"message",model};
test("recall is data, requires speakers and two dialogue turns",()=>{
 assert.equal(recallSceneSchema.safeParse(scene).success,true);
 for(const model of [{kind:"concept",lines:[{text:"X"}]},{kind:"dialogue",lines:[{text:"X"},{text:"Y"}]}])
 assert.equal(recallSceneSchema.safeParse({...scene,model}).success,false);
 assert.equal(recallSceneSchema.safeParse({...scene,html:"<div/>"}).success,false);
 assert.deepEqual(teachingAudioReferences({recallScene:scene}),["a","b"]);
});
test("old consumers reject new annotations and recall version",()=>{
 assert.equal(capabilityRegistry.get("presentation.bidi").schema.safeParse(annotation).success,false);
 assert.equal(capabilityRegistry.get("presentation.inline").schema.safeParse(annotation).success,true);
 const registry=capabilityRegistry.get("activity.flashcard");
 const data={front:"F",back:"Target",example:"E",recallScene:scene};
 assert.equal(registry.versionSchemas["2.0.0"].safeParse(data).success,false);
 assert.equal(registry.versionSchemas["3.0.0"].safeParse(data).success,true);
});
test("Course 1.7 needed and inferred for both normal and recovery metadata",()=>{
 const fixture=structuredClone(loadContent().find(b=>b.language.id==="xx-Test"));assert(fixture);
 const activity=fixture.course.units[0].lessons[0].activities[0];
 activity.presentation={annotations:{prompt:[a(activity.prompt)]}};
 fixture.course.schemaVersion="1.6";assert.equal(coursePackageSchema.safeParse(fixture.course).success,false);
 fixture.course.schemaVersion="1.7";assert.equal(coursePackageSchema.safeParse(fixture.course).success,true);
 const runtime=runtimeBundle(fixture);assert(runtime.course.teachingMedia);
 assert(packageCapabilityRequests(fixture.course,fixture.language,fixture.moduleData).some(r=>r.requirement.id==="presentation.inline"));
});
test("installed evidence strict parser accepts actual authored feedback and presentation",()=>{
 const source=fs.readFileSync("src/domain/installed-study/evidence-projection.ts","utf8");
 const start=source.indexOf("const gradeSchema = z"),end=source.indexOf("const evidenceSchema",start);
 const schema=Function("z","activityPresentationSchema",source.slice(start,end)+";return gradeSchema;")(z,activityPresentationSchema);
 assert.equal(schema.safeParse({correct:true,correctAnswer:"X",explanation:"Y",presentation:{annotations:{explanation:[a("Y")]}},feedback:{summary:"S",alternatives:[{answer:"X",detail:"D"}]}}).success,true);
});

test("legacy field-only response metadata returns after grading",()=>{
 const result=gradeActivity({id:"meta",type:"short_answer",answer:"X",accepted:[],explanation:"E",presentation:{fields:{answer:{language:"he",direction:"rtl"},feedback:{language:"en",direction:"ltr"}}}},"X");
 assert.equal(result.presentation.fields.answer.direction,"rtl");
 assert.equal(result.presentation.fields.explanation.language,"en");
 assert.equal(publicActivity({id:"meta",type:"short_answer",answer:"X",presentation:{fields:{answer:{language:"he"}}}}).presentation.fields.answer,undefined);
});
test("answer and hidden transcript annotations return only after grading",()=>{
 const result=gradeActivity({id:"meta",type:"listening",answer:"X",options:["X","Y"],transcript:"Spoken X",
 presentation:{annotations:{answer:[a("X")],transcript:[a("Spoken")]}}},"X");
 assert.equal(result.presentation.annotations.answer[0].text,"X");
 assert.equal(result.presentation.annotations.transcript[0].text,"Spoken");
});
test("alternate result never reuses unmatched canonical spans",()=>{
 const result=gradePresentation({fields:{answer:{direction:"rtl"}},annotations:{answer:[a("Canonical")]}},true,-1,{answer:"Alternate"});
 assert.equal(result.fields.answer.direction,"rtl");assert.equal(result.annotations.answer,undefined);
});

test("post-grade target presentation retains general content override",()=>{
 const result=gradeActivity({id:"meta",type:"short_answer",answer:"X",accepted:[],explanation:"E",presentation:{content:{language:"he",direction:"rtl"},annotations:{explanation:[a("E")]}}},"X");
 assert.deepEqual(result.presentation.content,{language:"he",direction:"rtl"});
});

test("annotations validate the parsed text actually rendered, including trim",()=>{
 const fixture=structuredClone(loadContent().find(b=>b.language.id==="xx-Test"));fixture.course.schemaVersion="1.7";
 const activity=fixture.course.units[0].lessons[0].activities[0];activity.type="lesson_content";
 activity.payload={body:"B",highlights:[],teaching:{kind:"concept",lines:[{text:"X"}],support:"Target "}};
 activity.presentation={annotations:{support:[a("Target ")]}};
 assert.equal(coursePackageSchema.safeParse(fixture.course).success,false);
 activity.presentation.annotations.support[0].text="Target";
 assert.equal(coursePackageSchema.safeParse(fixture.course).success,true);
});
