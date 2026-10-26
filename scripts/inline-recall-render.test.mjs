import fs from "node:fs";
import path from "node:path";
import Module, {createRequire} from "node:module";
import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
const loadRoot=createRequire(path.resolve("package.json"));
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(q, parent, ...rest) {
 return originalResolve.call(this,q.startsWith("@/")?path.join(process.cwd(),"src",q.slice(2)):q,parent,...rest);
};
for(const ext of [".ts",".tsx"])Module._extensions[ext]=(loaded,file)=>loaded._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
 fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText,file);
const originalLoad=Module._load;
Module._load=function(q,parent,...rest){
 if(q==="@/components/study-provider")return{useStudy:()=>({language:{id:"xx",writingSystem:{direction:"ltr"}},course:{sourceLanguage:"en"}})};
 return originalLoad.call(this,q,parent,...rest);
};
const {LessonSupport}=loadRoot("./src/components/activities/lesson-support.tsx");
const {LearningText}=loadRoot("./src/components/learning/text-presentation.tsx");
const span=(text,item)=>({text,item,occurrence:1,role:"target"});
test("future help retains authored paragraph indices including empty items",()=>{
 const activity={id:"future",type:"lesson_content",title:"Help",body:"\n\nAlpha\n\n\n\nBeta",highlights:[],
 presentation:{annotations:{body:[span("Alpha",1),span("Beta",3)]}}};
 const html=renderToStaticMarkup(React.createElement(LessonSupport,{lesson:{activities:[activity]}}));
 assert.equal((html.match(/class="learning-inline-term"/g)??[]).length,2);
});
test("future help highlights retain independent indices",()=>{
 const activity={id:"future",type:"lesson_content",title:"Help",body:"Plain",highlights:["Alpha","Beta"],
 presentation:{annotations:{highlights:[span("Alpha",0),span("Beta",1)]}}};
 const html=renderToStaticMarkup(React.createElement(LessonSupport,{lesson:{activities:[activity]}}));
 assert.equal((html.match(/class="learning-inline-term"/g)??[]).length,2);
});
test("inline content stays escaped plain text",()=>{
 const text="<img src=x onerror=alert(1)>";
 const html=renderToStaticMarkup(React.createElement(LearningText,{as:"p",text,field:"support",textRole:"source",presentation:{annotations:{support:[span(text,0)]}}}));
 assert(!html.includes("<img"));assert(html.includes("&lt;img"));assert(html.includes('lang="xx"'));
});
