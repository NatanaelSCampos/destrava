import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";
const require=createRequire(import.meta.url),ts=require("typescript"),React=require("react"),jsx=require("react/jsx-runtime"),{renderToStaticMarkup}=require("react-dom/server");
const source=fs.readFileSync(resolve("src/components/interactive-lesson/guided-study-activity.tsx"),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
let received;
const loadedModule={exports:{}};
new Function("exports","require","module",compiled.outputText)(loadedModule.exports,id=>{
 if(id==="react/jsx-runtime")return jsx;
 if(id==="@/components/activities/activity-renderer")return{ActivityRenderer:({activity})=>{received=activity;return React.createElement("button",null,activity.type==="review"?"Concluí a revisão":"Marcar como estudado")}};
 throw new Error("Unexpected runtime import "+id);
},loadedModule);
const {GuidedStudyActivity,guidedStudyActivity}=loadedModule.exports;
const activity=type=>({id:"own-activity",type,title:"Leitura da etapa",body:"Explicação",highlights:[]});
for(const type of ["lesson_content","review"])for(const phase of ["presenting","paused"])test("passive participation uses existing renderer "+type+" "+phase,()=>{
 const current=activity(type);received=undefined;const html=renderToStaticMarkup(React.createElement(GuidedStudyActivity,{activity:current,phase}));assert.equal(received,current);assert.equal(guidedStudyActivity(current,phase),current);assert.match(html,/sem nota/);assert.match(html,/Leitura e revisão da etapa/);assert.doesNotMatch(html,/checkpointPassed|SEGMENT_EVIDENCE|correctAnswer|nota objetiva/);
});
for(const type of ["multiple_choice","writing","speaking","listening","fill_blank","ordering","short_answer","true_false","quiz","flashcard"])test("authoritative and unsupported activities stay out of passive renderer "+type,()=>{received=undefined;assert.equal(guidedStudyActivity(activity(type),"paused"),undefined);assert.equal(renderToStaticMarkup(React.createElement(GuidedStudyActivity,{activity:activity(type),phase:"paused"})),"");assert.equal(received,undefined);});
for(const phase of ["idle","checkpoint","speaking","intervening","reinforcement","completed"])test("no passive action in other phase "+phase,()=>{received=undefined;assert.equal(renderToStaticMarkup(React.createElement(GuidedStudyActivity,{activity:activity("lesson_content"),phase})),"");assert.equal(received,undefined);});
test("missing reference cannot produce completion UI",()=>{assert.equal(renderToStaticMarkup(React.createElement(GuidedStudyActivity,{phase:"paused"})),"");});
