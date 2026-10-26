import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parsePackageJson} from "../src/engine/import/json-data.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import {packageLimits,externalPackageManifestSchema,packageAssetSchema} from '../src/content/package-contract.ts';
import {validateExternalPackageFiles} from '../src/engine/import/validate-package.ts';
const asset=i=>({path:`assets/phrase-${i}.mp3`,bytes:1000,sha256:'a'.repeat(64),mediaType:'audio/mpeg'});
test('bounded rich-course inventory accepts measured614 and maximum2048 but rejects2049',()=>{
 assert.equal(packageLimits.files,4096);assert.equal(packageLimits.assets,2048);
 for(const n of [100,614,1200,2048])assert(externalPackageManifestSchema.shape.assets.safeParse(Array.from({length:n},(_,i)=>asset(i))).success);
 assert(!externalPackageManifestSchema.shape.assets.safeParse(Array.from({length:2049},(_,i)=>asset(i))).success);
});
test('byte and JSON budgets remain fixed while activity count is bounded',()=>{
 assert.equal(packageLimits.totalBytes,32*1024*1024);assert.equal(packageLimits.jsonBytes,1024*1024);
 assert.equal(packageLimits.assetBytes,16*1024*1024);assert.equal(packageLimits.activities,4096);
 assert(!packageAssetSchema.safeParse({...asset(0),bytes:packageLimits.assetBytes+1}).success);
});
for(const path of ['../escape.mp3','assets/../../escape.mp3','https://example.test/audio.mp3','D:/audio.mp3','assets/CON.mp3'])test('larger inventory does not permit '+path,()=>assert(!packageAssetSchema.safeParse({...asset(0),path}).success));
test('reader rejects count beyond4096 and keeps614 below count limit',()=>{
 const files=n=>new Map(Array.from({length:n},(_,i)=>['assets/p'+i+'.mp3',new Uint8Array(1)]));
 assert(validateExternalPackageFiles(files(4097)).report.diagnostics.some(d=>d.code==='PACKAGE_SIZE_LIMIT'));
 assert(!validateExternalPackageFiles(files(614)).report.diagnostics.some(d=>d.code==='PACKAGE_SIZE_LIMIT'));
});
test('reader still rejects aggregate bytes above32MiB',()=>{
 const bytes=new Uint8Array(8*1024*1024),files=new Map(Array.from({length:5},(_,i)=>['assets/p'+i+'.mp3',bytes]));
 assert(validateExternalPackageFiles(files).report.diagnostics.some(d=>d.code==='PACKAGE_SIZE_LIMIT'));
});
test('JSON byte, node and depth budgets still reject their immediate upper boundaries',()=>{
 assert.throws(()=>parsePackageJson(new Uint8Array(packageLimits.jsonBytes+1)),/JSON_SIZE_LIMIT/);
 assert.throws(()=>parsePackageJson(Buffer.from(JSON.stringify(Array(packageLimits.jsonNodes).fill(0)))),/JSON_COMPLEXITY_LIMIT/);
 assert.throws(()=>parsePackageJson(Buffer.from('['.repeat(packageLimits.jsonDepth+1)+'0'+']'.repeat(packageLimits.jsonDepth+1))),/JSON_COMPLEXITY_LIMIT/);
 assert.throws(()=>parsePackageJson(Buffer.from('{"a":1,"a":2}')),/JSON_DUPLICATE_KEY/);
 assert.throws(()=>parsePackageJson(Buffer.from('{"__proto__":{}}')),/JSON_UNSAFE_KEY/);
});
test('a JSON document cannot consume the separate binary size budget',()=>{
 const schema=externalPackageManifestSchema.shape.documents.shape.course;
 const ref={path:'course.json',bytes:packageLimits.jsonBytes,sha256:'a'.repeat(64)};
 assert(schema.safeParse(ref).success);
 assert(!schema.safeParse({...ref,bytes:packageLimits.jsonBytes+1}).success);
});

function countedPackage(ordinary,deferred=0){
 const fixture=JSON.parse(fs.readFileSync(new URL('../contracts/package-v1/example-source.json',import.meta.url),'utf8'));
 const files=new Map();
 function put(path,value){const b=Buffer.from(JSON.stringify(value));files.set(path,b);return{path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
 const activity=i=>({id:'bounded-'+i,type:'short_answer',title:'Synthetic',prompt:'Write a.',skills:['writing'],concepts:[],minutes:1,payload:{answer:'a'},evaluation:{strategy:'exact-normalized'}});
 const units=[];let next=0,remaining=ordinary;
 while(remaining){const count=Math.min(1000,remaining),index=units.length;const lesson={id:'lesson-'+index,slug:'lesson-'+index,order:1,title:'Synthetic',objectives:['demo.goal'],minutes:1,activities:Array.from({length:count},()=>activity(next++))};
  if(index===0&&deferred)lesson.deferredRecovery={delayActivities:2,maxPerConcept:1,rules:Array.from({length:deferred},(_,i)=>({sourceActivityIds:['bounded-0'],conceptId:'concept-'+i,activity:activity(next++)}))};
  units.push(put('units/unit-'+index+'.json',{id:'unit-'+index,slug:'unit-'+index,order:index+1,title:'Synthetic',objectives:['demo.goal'],skills:['writing'],learningPolicy:{completion:{requirements:[]},mastery:{requirements:[]}},lessons:[lesson]}));remaining-=count;}
 const documents={language:put('language.json',fixture.language),course:put('course.json',{...fixture.course,schemaVersion:'1.11'}),units,concepts:put('concepts.json',[]),lexicon:put('lexicon.json',[]),assessments:put('assessments.json',[]),media:put('media.json',[])};
 put('manifest.json',{format:'destrava.course-package',envelopeVersion:'1.0.0',id:fixture.course.id,contentVersion:fixture.course.contentVersion,contracts:{language:'1.1',course:'1.11'},producer:{id:'bounded-fixture',name:'Synthetic bounded count'},provenance:{material:'test',origin:'imported',sources:[{label:'Synthetic independent budget fixture',reference:'package-media-limits.test.mjs'}],review:{status:'draft'}},documents,assets:[]});
 return files;
}
test('semantic activity budget accepts4096 count and rejects4097 across separate bounded documents',()=>{
 const accepted=validateExternalPackageFiles(countedPackage(4096)).report.diagnostics;
 assert(!accepted.some(d=>d.severity==='error'&&d.category==='structure'||d.code==='ENTITY_COUNT_LIMIT'||d.code==='JSON_SIZE_LIMIT'),JSON.stringify(accepted.slice(0,5)));
 const diagnostics=validateExternalPackageFiles(countedPackage(4097)).report.diagnostics;assert(diagnostics.some(d=>d.code==='ENTITY_COUNT_LIMIT'),JSON.stringify(diagnostics.slice(0,4)));
});
test('deferred activities consume the same total budget as ordinary activities',()=>{
 assert(!validateExternalPackageFiles(countedPackage(4088,8)).report.diagnostics.some(d=>d.code==='ENTITY_COUNT_LIMIT'));
 assert(validateExternalPackageFiles(countedPackage(4089,8)).report.diagnostics.some(d=>d.code==='ENTITY_COUNT_LIMIT'));
});
