import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.env.DESTRAVA_TEST_SOURCE_ROOT??process.cwd(),require=createRequire(path.join(root,'package.json')),esbuild=require('esbuild');
const stubs={
  '@/lib/application-course-runtime':'export async function resolveApplicationRuntime(){return globalThis.__guidedEntryRuntime;}',
  '@/lib/supabase/server':'export async function getAuthenticatedUser(){return {id:"synthetic-user"};}',
  'next/headers':'export async function cookies(){return {get(){return undefined;}};}',
  'next/navigation':'export function redirect(href){const e=new Error("synthetic redirect");e.href=href;throw e;}',
  '@/content/public':'export function publicCourse(){return globalThis.__guidedEntryRuntime.bundle.course;}',
  '@/components/interactive-lesson/interactive-classroom':'export function InteractiveClassroom(){return null;}',
  './guided-lesson-catalog':'export function GuidedLessonCatalog(){return null;}',
};
const built=await esbuild.build({entryPoints:[path.join(root,'src/components/interactive-lesson/interactive-lesson-entry.tsx')],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',tsconfig:path.join(root,'tsconfig.json'),loader:{'.css':'empty'},plugins:[{name:'in-memory-selection-only',setup(build){build.onResolve({filter:/.*/},args=>stubs[args.path]?{path:args.path,namespace:'fixture'}:undefined);build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'ts'}));}}]});
const compiled={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,compiled,compiled.exports);
const {InteractiveLessonEntry}=compiled.exports;
function install(){const definitions=[{id:'one',courseId:'course',unitId:'u',lessonId:'l',title:'One',estimatedMinutes:5},{id:'two',courseId:'course',unitId:'u2',lessonId:'l2',title:'Two',estimatedMinutes:5}].map(d=>({...d,concepts:[],alternativeExamples:[]}));
 const course={id:'course',slug:'current-course',title:'Current course',contentVersion:'1',assessments:[],units:[{id:'u',number:1,slug:'first',active:true,title:'One',lessons:[{id:'l',slug:'guided-one',title:'One',active:true,interactiveLessonRef:'one'}]},{id:'u2',number:2,slug:'second',active:true,title:'Two',lessons:[{id:'l2',slug:'guided-two',title:'Two',active:true,interactiveLessonRef:'two'}]}],availability:{unavailableActivityIds:[],spacedRepetition:false,actionStates:{'lesson.interactive':{state:'available',reasons:[]}}}};
 globalThis.__guidedEntryRuntime={source:'compiled',bundle:{course,coursePackage:{interactiveLessons:definitions,media:[],sourceLanguage:'pt-BR',concepts:[],lexicon:[]},language:{}}};return{course,definitions};}
function names(element){if(!element||typeof element!=='object')return[];return[typeof element.type==='function'?element.type.name:element.type,...[].concat(element.props?.children??[]).flatMap(names)];}
test('absence of request/location returns complete active-course catalog, not the first classroom',async()=>{install();const element=await InteractiveLessonEntry({});assert.equal(element.type.name,'GuidedLessonCatalog');assert.deepEqual(element.props.definitions.map(d=>d.id),['one','two']);assert.equal(names(element).includes('InteractiveClassroom'),false);});
test('explicit valid definition or lesson ID opens its canonical unit lesson URL',async()=>{for(const requested of ['two','l2']){install();await assert.rejects(InteractiveLessonEntry({requested}),error=>error.href==='/course/current-course/unit/2/lesson/guided-two');}});
test('unknown request never selects the first definition',async()=>{install();const element=await InteractiveLessonEntry({requested:'unknown'});assert.equal(names(element).includes('InteractiveClassroom'),false);assert.equal(names(element).includes('GuidedLessonCatalog'),false);});
test('unavailable requested unit does not redirect or open a classroom',async()=>{const{course}=install();course.availability.unavailableUnitIds=['u2'];const element=await InteractiveLessonEntry({requested:'two'});assert.equal(names(element).includes('InteractiveClassroom'),false);});
test('exact canonical location renders its unit journey; conflicting course scope never falls back',async()=>{install();const location={courseSlug:'current-course',unitSlug:'2',lessonSlug:'guided-two'};const element=await InteractiveLessonEntry({location});assert.equal(names(element).includes('InteractiveClassroom'),true);const wrong=await InteractiveLessonEntry({location:{...location,courseSlug:'other-course'}});assert.equal(names(wrong).includes('InteractiveClassroom'),false);});
