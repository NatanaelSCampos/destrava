import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.DESTRAVA_TEST_SOURCE_ROOT ?? root;
const require = createRequire(import.meta.url);
const ts = require(process.env.DESTRAVA_TEST_NODE_MODULES
  ? resolve(process.env.DESTRAVA_TEST_NODE_MODULES, "typescript") : "typescript");
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const loadedModule = {exports:{}}; modules.set(file,loadedModule);
  const source = ts.transpileModule(readFileSync(file,"utf8"), {
    fileName:file, compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText;
  const localRequire = specifier => {
    assert.ok(specifier.startsWith("@/") || specifier.startsWith("."), "Only pure source dependencies");
    const target = specifier.startsWith("@/")
      ? resolve(sourceRoot,"src",specifier.slice(2)+".ts") : resolve(dirname(file),specifier+".ts");
    return load(target);
  };
  runInThisContext("(function(exports,require,module){"+source+"\n})",{filename:file})(loadedModule.exports,localRequire,loadedModule);
  return loadedModule.exports;
}
const {projectUnitProgress} = load(resolve(root,"src/repositories/unit-progress-projection.ts"));
const {unitProgress} = load(resolve(sourceRoot,"src/domain/study/progress.ts"));
const now = "2026-10-24T12:00:00.000Z";
function fixture(total,completed) {
  const activities=Array.from({length:total},(_,i)=>({id:"activity-"+i,type:"multiple_choice",skill:"reading",skills:["reading"]}));
  const unit={id:"unit",assessmentRefs:{},lessons:[{id:"lesson",activities}],learningPolicy:{
    completion:{requirements:[{id:"participation",label:"Participate",kind:"participation",activityIds:activities.map(a=>a.id)}]},
    mastery:{requirements:[{id:"completion",label:"Complete",kind:"unit_completed"}]},
  }};
  const course={id:"course",contentVersion:"1.0.0",assessments:[]};
  const state={courseId:course.id,completedActivityIds:activities.slice(0,completed).map(a=>a.id),attempts:[],
    vocabulary:{},mistakes:{},writing:[],speaking:[],assessmentAttempts:[],adaptiveAssessments:[]};
  return {unit,course,state};
}

test("fractional participation is rounded only in the derived SQL integer projection",()=>{
  for(const [total,completed,fraction,integer] of [[39,35,89.7,90],[61,57,93.4,93],[10,0,0,0],[10,10,100,100]]){
    const {unit,course,state}=fixture(total,completed), before=structuredClone(state);
    const progress=unitProgress(unit,state,[],course);
    const row=projectUnitProgress("owner",course,unit,state,[],now);
    assert.equal(progress.participationPercentage,fraction);
    assert.equal(row.participation_percent,integer);
    assert.ok(Number.isInteger(row.participation_percent) && row.participation_percent>=0 && row.participation_percent<=100);
    assert.equal(row.completion_percent,progress.percentage);
    assert.deepEqual(row.policy_state,{completion:progress.completion,mastery:progress.mastery});
    assert.equal(row.exercise_score,progress.exerciseScore);
    assert.equal(row.review_score,progress.reviewScore);
    assert.equal(row.assessment_score,progress.assessmentScore);
    assert.equal(row.completed_at,progress.isCompleted?now:null);
    assert.equal(row.mastered_at,progress.isMastered?now:null);
    assert.deepEqual(state,before);
    assert.equal(unitProgress(unit,state,[],course).participationPercentage,fraction);
  }
});
test("rounding to 100 never satisfies pending completion/mastery or changes policy precision",()=>{
  const {unit,course,state}=fixture(1000,999);
  const progress=unitProgress(unit,state,[],course), row=projectUnitProgress("owner",course,unit,state,[],now);
  assert.equal(progress.participationPercentage,99.9);
  assert.equal(row.participation_percent,100);
  assert.equal(progress.isCompleted,false); assert.equal(progress.isMastered,false);
  assert.equal(row.completed_at,null); assert.equal(row.mastered_at,null);
  assert.equal(row.policy_state.completion.status,"pending");
  assert.equal(row.policy_state.completion.requirements[0].progress,0.999);
  assert.deepEqual(row.policy_state,{completion:progress.completion,mastery:progress.mastery});
});
