import assert from "node:assert/strict";
import test from "node:test";
import { environment, harness, empty, icons } from "./ui-lifecycle-harness.mjs";
function fixture() {
 const env=environment(), h=harness(env), changes=[], writes=[];
 env.window.location={href:"http://127.0.0.1:3100/course/sample/unit/1/lesson/short?from=trial&activity=first#draft"};
 env.window.history={replaceState(_state,_unused,url){changes.push(url);env.window.location.href=new URL(url,env.window.location.href).href;}};
 const lesson={id:"lesson",slug:"short",objectives:[],objectiveLabels:{},activities:[{id:"first",type:"lesson_content"},{id:"second",type:"short_answer"}]};
 const unit={id:"unit",slug:"unit",number:1,lessons:[lesson],assessmentRefs:{}};
 const context={course:{id:"sample",slug:"sample",contentVersion:"1.1.0",units:[unit],assessments:[]},state:{completedActivityIds:[]},authUserId:"synthetic-owner",runtime:null,completeActivity(){writes.push("complete")},assessActivity(){writes.push("grade")}};
 const params={courseSlug:"sample",unitSlug:"1",lessonSlug:"short"};
 const {default:Page}=h.load("src/app/course/[courseSlug]/unit/[unitSlug]/lesson/[lessonSlug]/page.tsx",{
  "next/link":{default:empty},"next/navigation":{useParams:()=>params,useRouter:()=>({replace(){throw Error("Unexpected route replacement")}}),useSearchParams:()=>new URL(env.window.location.href).searchParams},
  "lucide-react":icons,"@/components/study-provider":{useStudy:()=>context},
  "@/components/activities/activity-renderer":{ActivityRenderer:empty},"@/components/activities/lesson-experience":{LessonExperience:empty},
  "@/components/activities/lesson-support":{LessonSupport:empty},"@/components/activities/assessment-result":{AssessmentResult:empty},
  "@/lib/lesson-writing-scope":{lessonWritingScopeKey:()=> "scope"},
  "@/content/assessment-references":{assessmentLink:()=>"",resolveAssessment:()=>undefined},"@/lib/assessment-lesson":{assessmentsForLesson:()=>[]},
 });
 const outer=h.mount(Page().props.children.type), Component=outer.tree.type;
 return {h,env,changes,writes,Component,mount:h.mount(Component)};
}
test("active lesson step survives reload while unrelated URL context is preserved",()=>{
 const f=fixture();assert.equal(f.mount.tree.props.index,0);
 f.mount.tree.props.onSelect(1);f.mount.flush();assert.equal(f.mount.tree.props.index,1);
 const url=new URL(f.env.window.location.href);assert.equal(url.searchParams.get("activity"),"second");assert.equal(url.searchParams.get("from"),"trial");assert.equal(url.hash,"#draft");
 f.mount.unmount();const reloaded=f.h.mount(f.Component);assert.equal(reloaded.tree.props.index,1);
 assert.deepEqual(f.writes,[]);
});
test("invalid step cannot replace the current address or fabricate completion",()=>{
 const f=fixture();f.mount.tree.props.onSelect(99);f.mount.flush();assert.equal(f.mount.tree.props.index,0);assert.deepEqual(f.changes,[]);assert.deepEqual(f.writes,[]);
});
