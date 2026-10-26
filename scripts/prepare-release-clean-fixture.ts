import assert from 'node:assert/strict';
import {existsSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {allCourseBundles} from '../src/content/course-registry';
import {localEnvironment,localApi,localFetch} from './release-clean-environment.mjs';
const marker='.tmp/f2-c/catalog-attempt.json';
async function main(){
 const env=localEnvironment();assert(!existsSync(marker),'Catalog attempt already recorded; inspect retained rows before resuming');
 const bundle=allCourseBundles().find(b=>b.coursePackage.interactiveLessons.length);assert(bundle);
 const db=createClient(localApi,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false},global:{fetch:localFetch}});
 const existing=await db.from('courses').select('id');assert.equal(existing.error,null);assert.equal(existing.data?.length,0,'Only an empty domain catalog is permitted for this fixture import');
 const c=bundle.course;
 const rows:Record<string,Record<string,unknown>[]>={
 courses:[{id:c.id,slug:c.slug,title:'F2-C compiled test reference',level:c.level,description:'Synthetic F2-C FK catalog; retained',content_version:bundle.coursePackage.contentVersion}],
 units:c.units.map(u=>({id:u.id,course_id:c.id,slug:u.slug,title:u.title,number:u.number})),
 lessons:c.units.flatMap(u=>u.lessons.map(l=>({id:l.id,unit_id:u.id,slug:l.slug,title:l.title,position:l.order}))),
 activities:c.units.flatMap(u=>u.lessons.flatMap(l=>l.activities.map((a,i)=>({id:a.id,lesson_id:l.id,type:a.type,title:a.title,skill:a.skill,position:i+1}))))
 };
 const receipt={courseId:c.id,contentVersion:bundle.coursePackage.contentVersion,tables:Object.entries(rows).map(([table,items])=>({table,ids:items.map(r=>r.id)})),completed:[] as string[],retained:true};
 writeFileSync(marker,JSON.stringify(receipt,null,2),{flag:'wx'});
 for(const [table,items] of Object.entries(rows)){const r=await db.from(table).insert(items);assert.equal(r.error,null,table+': '+r.error?.message);receipt.completed.push(table);writeFileSync('.tmp/f2-c/catalog-result.json',JSON.stringify(receipt,null,2));}
 console.log(JSON.stringify({catalog:'PASS',courseId:c.id,counts:Object.fromEntries(Object.entries(rows).map(([t,r])=>[t,r.length])),retained:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
