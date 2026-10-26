import test from "node:test";
import assert from "node:assert/strict";
import {assessmentsForLesson} from "../src/lib/assessment-lesson.ts";
const assessment={id:"exam",lessonId:"bank",unitId:"unit",method:"fixed",activityIds:["item"]};
const item={id:"item",type:"multiple_choice",supportActivityIds:["help"]};
const help={id:"help",type:"lesson_content"};
const check=(activities,definition=assessment,unit="unit")=>assessmentsForLesson({assessments:[definition]},{id:unit},{id:"bank",activities});
test("legacy bank and bank with referenced supports remain formal assessments",()=>{
 assert.deepEqual(check([item]),[assessment]);assert.deepEqual(check([item,help]),[assessment]);
});
for(const [name,activities] of [["missing assessed item",[help]],["orphan support",[item,{...help,id:"orphan"}]],["exercise posing as help",[item,{...help,type:"short_answer"}]],["ordinary lesson addition",[item,help,{id:"normal",type:"writing"}]],["empty",[]]])
 test(name+" is not a bank match",()=>assert.deepEqual(check(activities),[]));
test("no title/slug heuristics or cross-unit/lesson matches",()=>{
 assert.deepEqual(check([item,help],{...assessment,lessonId:"other"}),[]);
 assert.deepEqual(check([item,help],assessment,"other"),[]);
});
