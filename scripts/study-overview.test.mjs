import test from "node:test";
import assert from "node:assert/strict";
import { studyOverview } from "../src/domain/study/study-overview.ts";
import { courseStudyProgress, courseStudySummary } from "../src/domain/study/progress.ts";
import { initialStudyState } from "../src/domain/study/study-state.ts";

const now = new Date(2026, 9, 25, 12);
const at = (day, hour = 10) => new Date(2026, 9, day, hour).toISOString();
function fixture() {
  const units = [98,79].map((count,i) => ({id:"unit-"+i, active:true, lessons:[{id:"lesson-"+i,active:true,
    activities:Array.from({length:count},(_,n)=>({id:"a-"+i+"-"+n}))}]}));
  const course={id:"course",contentVersion:"1.0.0",units,assessments:[]};
  const state={...structuredClone(initialStudyState),courseId:"course"};
  return {course,state};
}
function session(overrides={}) {return {id:"session",unitId:"unit-0",startedAt:at(25,9),finishedAt:at(25,10),durationSeconds:125,activityIds:[],correct:0,wrong:0,wordsReviewed:0,plan:[],...overrides};}

test("course percentage and counts share one collection: 42 of 177 is 23.7%",()=>{
 const {course,state}=fixture();state.completedActivityIds=course.units[0].lessons[0].activities.slice(0,42).map(a=>a.id);
 assert.deepEqual(courseStudySummary(course,state),{completed:42,total:177,percentage:23.7});
 assert.equal(studyOverview(course,state,[],now).coverage.percentage,courseStudyProgress(course,state));
});
test("coverage excludes inactive units/lessons and stale IDs, and deduplicates IDs",()=>{
 const {course,state}=fixture();course.units[1].active=false;
 course.units[0].lessons.push({id:"off",active:false,activities:[{id:"removed"}]});
 course.units[0].lessons[0].activities.push({id:"a-0-0"});
 state.completedActivityIds=["a-0-0","a-0-0","a-1-0","removed","foreign"];
 assert.deepEqual(courseStudySummary(course,state),{completed:1,total:98,percentage:1});
});
test("a different course's state contributes no completion, time or practice dates",()=>{
 const {course,state}=fixture();state.courseId="foreign";state.completedActivityIds=["a-0-0"];state.sessions=[session()];state.attempts=[{activityId:"a-0-0",createdAt:at(25)}];
 const view=studyOverview(course,state,[],now);assert.equal(view.coverage.completed,0);assert.equal(view.recordedSeconds,0);assert.equal(view.streak,0);
});
test("wrong answers and ungraded writing/speaking count as participation days, not mastery",()=>{
 const {course,state}=fixture();state.attempts=[{activityId:"a-0-0",createdAt:at(25),correct:false}];state.writing=[{activityId:"a-0-1",createdAt:at(24)}];state.speaking=[{activityId:"a-0-2",createdAt:at(23)}];
 const v=studyOverview(course,state,[],now);assert.equal(v.streak,3);assert.equal(v.practicedToday,true);assert.equal(v.recordedSeconds,0);assert.equal(v.coverage.completed,0);
});
test("yesterday keeps the streak alive; an older gap does not",()=>{
 const {course,state}=fixture();state.events=[24,23].map(d=>({type:"lesson_completed",activityId:"a-0-0",createdAt:at(d)}));
 assert.equal(studyOverview(course,state,[],now).streak,2);state.events.shift();assert.equal(studyOverview(course,state,[],now).streak,0);
});
test("starts, page views, invalid/future/foreign actions do not create practice",()=>{
 const {course,state}=fixture();state.events=[
 {type:"lesson_started",activityId:"a-0-0",createdAt:at(25)},
 {type:"assessment_started",itemId:"assessment",createdAt:at(25)},
 {type:"lesson_completed",activityId:"foreign",createdAt:at(25)},
 {type:"lesson_completed",activityId:"a-0-0",createdAt:"bad"},
 {type:"lesson_completed",activityId:"a-0-0",createdAt:at(25,13)},
 {type:"lesson_completed",activityId:"a-0-0",createdAt:at(25),metadata:{courseId:"foreign"}},
 ];
 assert.equal(studyOverview(course,state,[],now).hasPracticeDates,false);
});
test("repeated evidence on one local day counts once and crosses month boundaries",()=>{
 const {course,state}=fixture();state.attempts=Array.from({length:5},()=>({activityId:"a-0-0",createdAt:new Date(2026,9,31,23).toISOString()}));
 state.writing=[{activityId:"a-0-1",createdAt:new Date(2026,10,1,1).toISOString()}];
 assert.equal(studyOverview(course,state,[],new Date(2026,10,1,12)).streak,2);
});
test("local midnight follows the configured calendar, including UTC offsets",()=>{
 const {course,state}=fixture();const today=new Date(2026,9,25,0,30);
 state.attempts=[{activityId:"a-0-0",createdAt:new Date(2026,9,24,23,50).toISOString()}];
 let v=studyOverview(course,state,[],today);assert.equal(v.practicedToday,false);assert.equal(v.streak,1);
 state.attempts.push({activityId:"a-0-1",createdAt:new Date(2026,9,25,0,5).toISOString()});
 v=studyOverview(course,state,[],today);assert.equal(v.practicedToday,true);assert.equal(v.streak,2);
});
test("measured seconds below a minute stay visible; planned and wall time are not substituted",()=>{
 const {course,state}=fixture();state.sessions=[session({durationSeconds:59,targetMinutes:90,startedAt:at(24)})];
 const v=studyOverview(course,state,[],now);assert.equal(v.recordedSeconds,59);assert.equal(v.finishedSessions,1);
 state.sessions=[];state.completedActivityIds=["a-0-0"];assert.equal(studyOverview(course,state,[],now).recordedSeconds,0);
});
test("the identified active session contributes measured seconds; abandoned open sessions do not",()=>{
 const {course,state}=fixture();state.activeSessionId="active";state.sessions=[session({id:"active",finishedAt:null,durationSeconds:31,paused:true}),session({id:"abandoned",finishedAt:null,durationSeconds:800})];
 const v=studyOverview(course,state,[],now);assert.equal(v.recordedSeconds,31);assert.equal(v.activeSeconds,31);assert.equal(v.finishedSessions,0);
});
test("invalid duration, foreign unit, invalid or future dates are ignored",()=>{
 const {course,state}=fixture();state.sessions=[
 ...[NaN,Infinity,-1,14401].map((durationSeconds,i)=>session({id:"bad-"+i,durationSeconds})),
 session({id:"foreign",unitId:"foreign"}),session({id:"badstart",startedAt:"bad"}),session({id:"badend",finishedAt:"bad"}),
 session({id:"future",finishedAt:at(26)}),session({id:"reverse",finishedAt:at(24)})
 ];assert.equal(studyOverview(course,state,[],now).recordedSeconds,0);
});
test("duplicate session IDs do not double count and a finished record wins over an open copy",()=>{
 const {course,state}=fixture();state.activeSessionId="session";state.sessions=[session(),session({finishedAt:null,durationSeconds:999})];
 const v=studyOverview(course,state,[],now);assert.equal(v.recordedSeconds,125);assert.equal(v.activeSeconds,0);assert.equal(v.finishedSessions,1);
});
test("only scoped vocabulary review schedules contribute practice dates",()=>{
 const {course,state}=fixture();state.vocabulary.word={schedule:{id:"schedule"}};state.reviews=[{scheduleId:"schedule",reviewedAt:at(25)}];
 assert.equal(studyOverview(course,state,[],now).streak,0);
 assert.equal(studyOverview(course,state,[{id:"word",lessonId:"lesson-0"}],now).streak,1);
});
test("only canonical matching assessment answers contribute an assessment date",()=>{
 const {course,state}=fixture();course.assessments=[{id:"assessment",purpose:"diagnostic",method:"adaptive"}];
 const result={id:"result",assessmentId:"assessment",courseId:course.id,contentVersion:course.contentVersion,source:"server",purpose:"diagnostic",method:"adaptive",status:"completed",finishedAt:at(25),answers:[{activityId:"a-0-0"}]};
 state.adaptiveAssessments=[result];assert.equal(studyOverview(course,state,[],now).streak,1);
 for(const delta of [{source:"historical"},{courseId:"foreign"},{contentVersion:"old"},{purpose:"summative"},{method:"fixed"},{answers:[]}]){
 state.adaptiveAssessments=[{...result,...delta}];assert.equal(studyOverview(course,state,[],now).streak,0);
 }
});
test("selectors do not mutate state, definitions or timing records",()=>{
 const {course,state}=fixture();state.sessions=[session()];state.attempts=[{activityId:"a-0-0",createdAt:at(25)}];const before=structuredClone({course,state});studyOverview(course,state,[],now);assert.deepEqual({course,state},before);
});

test("inactive content cannot contribute practice days, reviews, canonical answers or session time",()=>{
 const {course,state}=fixture();course.units[1].active=false;course.units[0].lessons.push({id:"inactive",active:false,activities:[{id:"inactive-a"}]});state.attempts=[{activityId:"a-1-0",createdAt:at(25)},{activityId:"inactive-a",createdAt:at(25)}];state.sessions=[session({unitId:"unit-1"})];state.vocabulary.word={schedule:{id:"schedule"}};state.reviews=[{scheduleId:"schedule",reviewedAt:at(25)}];
 let v=studyOverview(course,state,[{id:"word",lessonId:"inactive"}],now);assert.equal(v.hasPracticeDates,false);assert.equal(v.recordedSeconds,0);
 course.assessments=[{id:"assessment",purpose:"summative",method:"fixed"}];state.assessmentAttempts=[{assessmentId:"assessment",source:"server",courseId:course.id,contentVersion:course.contentVersion,purpose:"summative",method:"fixed",status:"completed",finishedAt:at(25),answers:[{activityId:"inactive-a"}]}];v=studyOverview(course,state,[],now);assert.equal(v.hasPracticeDates,false);
});
