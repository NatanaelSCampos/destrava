import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {activitySceneSchema} from '../src/content/activity-scene.ts';
import {teachingCourseIssues} from '../src/content/validate-teaching.ts';
import {SceneIllustration} from '../src/components/activities/lesson-illustrations.tsx';
import {learningAccessIssues} from '../src/content/learning-access.ts';
const kinds=['home','interior','neighborhood','profile'];
function fixture(kind,version='1.11',icon) {
 return {schemaVersion:version,media:[],units:[{lessons:[{id:'lesson',activities:[{id:'context',title:'Um novo contexto',type:'lesson_content',skills:['reading'],concepts:[],payload:{body:'',scene:{illustration:kind,context:'Uma situação para praticar.',...(icon?{items:[{label:'Um item',icon}]}:{})}}}]}]}]};
}
for(const kind of kinds) {
 test(kind+' is declarative, rendered and gated by schema',()=>{
  assert.equal(activitySceneSchema.safeParse({illustration:kind,context:'Contexto'}).success,true);
  assert.deepEqual(teachingCourseIssues(fixture(kind)),[]);
  for(const version of ['1.8','1.9','1.10'])assert(teachingCourseIssues(fixture(kind,version)).some(x=>x.includes('require CoursePackage 1.11')));
  const html=renderToStaticMarkup(createElement(SceneIllustration,{kind,label:'Uma situação & outra'}));
  assert.match(html,/role="img"/);assert.match(html,/<title[^>]*>Uma situação &amp; outra<\/title>/);assert(!html.includes('cafe-illustration'));
 });
}
for(const icon of ['home','bed','sofa','key','phone','mail','book','briefcase'])test(icon+' icon version boundary',()=>{
 assert.deepEqual(teachingCourseIssues(fixture('message','1.11',icon)),[]);
 assert(teachingCourseIssues(fixture('message','1.10',icon)).some(x=>x.includes('require CoursePackage 1.11')));
});
test('existing scenes remain compatible and reject unknown illustrations or unrelated clocks',()=>{
 for(const kind of ['message','meeting','clock','cafe','menu','takeaway'])assert.deepEqual(teachingCourseIssues(fixture(kind,'1.10')),[]);
 assert(!activitySceneSchema.safeParse({illustration:'unknown',context:'Contexto'}).success);
 assert(!activitySceneSchema.safeParse({illustration:'home',context:'Contexto',clock:{hour:3,minute:0}}).success);
});
test('extended recall scenes require new version as well',()=>{
 const c=fixture('message','1.11');
 c.units[0].lessons[0].activities[0]={id:'recall',title:'Retome',type:'flashcard',skills:['reading'],concepts:[],payload:{front:'Uma situação',back:'Hello',example:'Hello',explanation:'Uma saudação.',recallScene:{illustration:'profile',title:'Retome',context:'Seu encontro',action:'Escreva uma saudação.',model:{kind:'dialogue',lines:[{text:'Hello',speaker:'A'},{text:'Hi',speaker:'B'}]}}}};
 assert.deepEqual(teachingCourseIssues(c),[]);
 c.schemaVersion='1.10';assert(teachingCourseIssues(c).some(x=>x.includes('require CoursePackage 1.11')));
});
test('new schema preserves strict exam validation',()=>{
 const c={schemaVersion:'1.11',units:[],assessments:[]};assert.deepEqual(learningAccessIssues(c),[]);
 const broken={...c,assessments:[{id:'exam',unitId:'absent',method:'fixed',purpose:'summative',activityIds:[],exam:{entry:{activityIds:['p'],minimumRatio:.8},feedback:'after_submission'}}]};
 assert(learningAccessIssues(broken).length>0);
});
