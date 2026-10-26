import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDbStudySyncStore } from '../src/lib/indexeddb-study-sync-store.ts';
import { browserStudySyncCache } from '../src/lib/study-sync-cache.ts';
import { StudyProgressSync, canonicalStudyState } from '../src/domain/study/study-progress-sync.ts';
import { readCourseState } from '../src/domain/study/course-state-storage.ts';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const COURSE='synthetic-cache-course', OWNER='owner-a', VERSION='1.0.0';
const fresh=()=>readCourseState(null,COURSE,'synthetic-language');
const scope={courseId:COURSE,contentVersion:VERSION};
const edit=(sync,id)=>sync.update(s=>({...s,events:[...s.events,{id,type:'synthetic',createdAt:'2026-10-27T00:00:00Z'}]}));

// A transaction stages writes until oncomplete. Aborts after put.success roll back.
// Every request runs in transaction order; transactions serialize over the store.
function transactionalIndexedDB(){
 const rows=new Map(),waiting=[];let active=null,created=false,nextGate=null;
 const controls={blocked:false,opens:0,closes:0,lastDb:null,
  holdNextWrite(){const reached=deferred();const gate={reached:reached.promise,notify:reached.resolve,tx:null,commit(){this.tx.finish();},abort(){this.tx.abort();}};nextGate=gate;return gate;}};
 function start(){if(active||!waiting.length)return;active=waiting.shift();active.active=true;active.pump();}
 const factory={rows,controls,open(){controls.opens++;const db={objectStoreNames:{contains:()=>created},createObjectStore(){created=true;},close(){controls.closes++;},onversionchange:null,
 transaction(_name,mode){const staged=new Map(),requests=[],gate=mode==='readwrite'?nextGate:null;if(gate)nextGate=null;
 const tx={active:false,done:false,pending:0,error:null,oncomplete:null,onerror:null,onabort:null,
  finish(){if(this.done)return;this.done=true;for(const[k,v]of staged)rows.set(k,v);this.oncomplete?.();active=null;queueMicrotask(start);},
  abort(){if(this.done)return;this.done=true;this.error=Error('AbortError after request success');this.onabort?.();if(active===this)active=null;queueMicrotask(start);},
  pump(){if(!this.active||this.done)return;if(requests.length){const [req,operation]=requests.shift();queueMicrotask(()=>{if(this.done)return;try{req.result=operation();req.onsuccess?.();}catch(error){this.error=error;req.error=error;req.onerror?.();this.onerror?.();this.abort();return;}this.pending--;this.pump();});}
   else if(!this.pending)queueMicrotask(()=>{if(this.done||this.pending||requests.length)return;if(gate){gate.tx=this;gate.notify();}else this.finish();});},
  objectStore(){const request=operation=>{const req={result:undefined,error:null,onsuccess:null,onerror:null};this.pending++;requests.push([req,operation]);this.pump();return req;};return{transaction:this,get:key=>request(()=>staged.has(key)?staged.get(key):rows.get(key)),put:(value,key)=>request(()=>{staged.set(key,structuredClone(value));return key;})};}};
 waiting.push(tx);queueMicrotask(start);return tx;}};controls.lastDb=db;const req={result:db,error:null};queueMicrotask(()=>{if(controls.blocked){req.onblocked?.();return;}if(!created)req.onupgradeneeded?.();req.onsuccess?.();});return req;}};
 return factory;
}
function browser(storage=transactionalIndexedDB(),values=new Map()){
 const previous=globalThis.window;let writes=0;
 const localStorage={getItem:k=>values.get(k)??null,setItem(k,v){writes++;const bytes=[...values].filter(([key])=>key!==k).reduce((sum,[key,value])=>sum+2*(key.length+value.length),0)+2*(k.length+v.length);if(bytes>5*1024*1024)throw Error('QuotaExceededError');values.set(k,v);},removeItem:k=>values.delete(k)};
 globalThis.window={indexedDB:storage,localStorage};return{storage,values,get localWrites(){return writes;},close(){globalThis.window=previous;}};
}
function setup(cache,remote=fresh()){
 let saved=structuredClone(remote);const writes=[];
 const repository={load:async()=>structuredClone(saved),save:async state=>{writes.push(structuredClone(state));saved=structuredClone(state);}};
 const sync=new StudyProgressSync(fresh,cache,scope);return{sync,repository,writes,remote:value=>saved=structuredClone(value),start:async()=>{await sync.load(sync.beginLoading(),OWNER,repository);assert.equal(sync.getSnapshot().loadStatus,remote===null?'absent':'loaded');return sync;}};
}
function largeState(){const state=fresh();state.attempts=Array.from({length:951},(_,i)=>({id:'attempt-'+i,activityId:'activity-'+i,answer:'x'.repeat(1600),correct:false,skill:'grammar',createdAt:'2026-10-27T00:00:00Z',sessionId:null,serverReceipt:'immutable-synthetic-receipt-'+i}));return state;}

test('IndexedDB write stays unacknowledged after put.success until transaction completes; late abort rolls back',async()=>{
 const db=transactionalIndexedDB(),store=indexedDbStudySyncStore(db);await store.write('key','original');const gate=db.controls.holdNextWrite();let settled=false;const writing=store.write('key','candidate').finally(()=>{settled=true;});const rejected=assert.rejects(writing,/AbortError/);await gate.reached;assert.equal(settled,false);assert.equal(db.rows.get('key'),'original');gate.abort();await rejected;assert.equal(await store.read('key'),'original');
 const success=db.controls.holdNextWrite();const commit=store.write('key','committed');await success.reached;assert.equal(db.rows.get('key'),'original');success.commit();await commit;assert.equal(await store.read('key'),'committed');
});
test('atomic initialize never replaces an IDB destination created after an earlier absent read',async()=>{
 const db=transactionalIndexedDB(),one=indexedDbStudySyncStore(db),two=indexedDbStudySyncStore(db);assert.equal(await one.read('key'),null);await two.write('key','newer');assert.equal(await one.initialize('key','stale legacy'),'newer');assert.equal(await one.read('key'),'newer');
});
test('blocked opens fail closed; version changes close the connection and later reads reopen',async()=>{
 const db=transactionalIndexedDB(),store=indexedDbStudySyncStore(db);db.controls.blocked=true;await assert.rejects(store.read('key'),/blocked/);db.controls.blocked=false;await store.write('key','kept');const prior=db.controls.opens;db.controls.lastDb.onversionchange();assert.ok(db.controls.closes>0);assert.equal(await store.read('key'),'kept');assert.equal(db.controls.opens,prior+1);
});
test('951 complete attempts exceed 5 MiB as an intent snapshot and survive pending reload without localStorage writes',async(t)=>{
 const env=browser();try{const cache=browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION),remote=largeState(),f=setup(cache,remote);await f.start();edit(f.sync,'pending-large');const pending=await cache.read(OWNER);assert.equal(pending.pending.attempts.length,951);const serialized=JSON.stringify({...pending,compiledPendingBase:{...pending.compiledPendingBase,transmitted:canonicalStudyState(pending.pending)}});assert.ok(Buffer.byteLength(serialized)>5*1024*1024);t.diagnostic(JSON.stringify({attempts:951,intentSnapshotBytes:Buffer.byteLength(serialized),localStorageLimitBytes:5*1024*1024}));assert.equal(env.localWrites,0);
 const nextCache=browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION),reopened=setup(nextCache,remote);await reopened.start();assert.equal(reopened.sync.getSnapshot().dirty,true);assert.equal(reopened.sync.getSnapshot().state.events[0].id,'pending-large');assert.deepEqual(reopened.sync.getSnapshot().state.attempts,remote.attempts);await reopened.sync.flush();assert.equal(reopened.writes.length,1);assert.deepEqual(reopened.writes[0].attempts,remote.attempts);assert.equal((await nextCache.read(OWNER)).pending,null);assert.equal(env.localWrites,0);
 }finally{env.close();}
});
test('a put.success followed by transaction abort blocks every remote save and retains dirty pending',async()=>{
 const env=browser();try{const cache=browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION),f=setup(cache);await f.start();edit(f.sync,'A');await cache.read(OWNER);const gate=env.storage.controls.holdNextWrite();const saving=f.sync.flush(),rejected=assert.rejects(saving);await gate.reached;assert.equal(f.writes.length,0);assert.equal(f.sync.getSnapshot().dirty,true);gate.abort();await rejected;assert.equal(f.writes.length,0);assert.equal(f.sync.getSnapshot().dirty,true);assert.ok(f.sync.getSnapshot().cacheError);assert.equal((await cache.read(OWNER)).pending.events[0].id,'A');
 }finally{env.close();}
});
test('intent commit and exact readback precede remote I/O, while a divergent readback authorizes zero saves',async()=>{
 for(const corrupt of [false,true]){const env=browser();try{const native=browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION);let corruptRead=false;const cache={write:(...args)=>native.write(...args),read:async owner=>{const entry=await native.read(owner);if(corruptRead&&entry.compiledPendingBase?.transmitted)entry.compiledPendingBase.transmitted=canonicalStudyState({...fresh(),events:[{id:'foreign intent'}]});return entry;}};const f=setup(cache);await f.start();edit(f.sync,'A');await native.read(OWNER);const gate=env.storage.controls.holdNextWrite();const began=deferred();f.repository.save=async state=>{const entry=await native.read(OWNER);assert.equal(entry.compiledPendingBase.transmitted,canonicalStudyState(state));assert.equal(entry.compiledPendingBase.pending,canonicalStudyState(entry.pending));f.writes.push(structuredClone(state));began.resolve();};corruptRead=corrupt;const saving=f.sync.flush();const outcome=corrupt?assert.rejects(saving):saving;await gate.reached;assert.equal(f.writes.length,0);gate.commit();await outcome;assert.equal(f.writes.length,corrupt?0:1);assert.equal(f.sync.getSnapshot().dirty,corrupt);
 }finally{env.close();}}
});
test('later edit B remains pending when save A is acknowledged during a slow cache write',async()=>{
 const env=browser();try{const cache=browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION),f=setup(cache);await f.start();edit(f.sync,'A');const sent=deferred(),ack=deferred();let transmitted;f.repository.save=async state=>{transmitted=structuredClone(state);f.remote(transmitted);sent.resolve();await ack.promise;};const saving=f.sync.flush();await sent.promise;const gate=env.storage.controls.holdNextWrite();edit(f.sync,'B');await gate.reached;ack.resolve();assert.equal(f.sync.getSnapshot().dirty,true);gate.commit();await saving;assert.equal(f.sync.getSnapshot().dirty,true);const cached=await cache.read(OWNER);assert.deepEqual(cached.pending.events.map(x=>x.id),['A','B']);assert.equal(cached.compiledPendingBase.base,canonicalStudyState(transmitted));const reopened=setup(browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION),transmitted);await reopened.start();assert.deepEqual(reopened.sync.getSnapshot().state.events.map(x=>x.id),['A','B']);assert.equal(reopened.sync.getSnapshot().dirty,true);
 }finally{env.close();}
});
test('legacy migration preserves complete recovery and pending; another edition rejects automatic restore',async()=>{
 const env=browser();try{const key='destrava-study:v2:demo:'+OWNER+':'+COURSE,old=fresh();old.events=[{id:'old-edition'}];env.values.set(key,JSON.stringify(fresh()));env.values.set(key+':pending',JSON.stringify(old));env.values.set(key+':recovery',JSON.stringify([old]));env.values.set(key+':pending-base:v1:0.9.0',JSON.stringify({schemaVersion:1,source:'compiled',userId:OWNER,courseId:COURSE,contentVersion:'0.9.0',base:canonicalStudyState(fresh()),pending:canonicalStudyState(old)}));const original=new Map(env.values);const cache=browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION),f=setup(cache);await f.start();assert.equal(f.sync.getSnapshot().dirty,false);assert.equal(f.sync.getSnapshot().state.events.length,0);assert.equal(f.sync.getSnapshot().recovery[0].events[0].id,'old-edition');assert.equal(f.writes.length,0);assert.deepEqual(env.values,original);assert.equal((await cache.read(OWNER)).recovery[0].events[0].id,'old-edition');
 const saved={...fresh(),events:[{id:'IDB-current'}]};await cache.write(OWNER,{state:saved,pending:null,recovery:[old],compiledPendingBase:null});assert.equal((await browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION).read(OWNER)).state.events[0].id,'IDB-current');assert.deepEqual(env.values,original);
 }finally{env.close();}
});
test('late cache reads and cache read errors from owner A cannot publish state or errors into owner B',async()=>{
 for(const rejects of [false,true]){const read=deferred(),entered=deferred(),entry={state:null,pending:null,recovery:[]};const cache={read:owner=>{if(owner===OWNER){entered.resolve();return read.promise;}return structuredClone(entry);},write:()=>{}};const sync=new StudyProgressSync(fresh,cache,scope);const old=sync.load(sync.beginLoading(),OWNER,{load:async()=>fresh(),save:async()=>{throw Error('obsolete save');}});await entered.promise;await sync.load(sync.beginLoading(),'owner-b',{load:async()=>fresh(),save:async()=>{}});const expected=structuredClone(sync.getSnapshot());if(rejects)read.reject(Error('QuotaExceededError transaction old owner'));else read.resolve({state:{...fresh(),events:[{id:'owner-a'}]},pending:null,recovery:[]});await old;assert.deepEqual(sync.getSnapshot(),expected);assert.equal(sync.getSnapshot().userId,'owner-b');}
});
test('late cache write failure cannot publish or clear an error in the next owner generation',async()=>{
 const values=new Map(),write=deferred(),entered=deferred();let held=false;const cache={read:owner=>structuredClone(values.get(owner)??{state:null,pending:null,recovery:[]}),write:(owner,entry)=>{if(held&&owner===OWNER){entered.resolve();return write.promise;}values.set(owner,structuredClone(entry));}};const sync=new StudyProgressSync(fresh,cache,scope);await sync.load(sync.beginLoading(),OWNER,{load:async()=>fresh(),save:async()=>{}});held=true;edit(sync,'A');await entered.promise;const next=sync.load(sync.beginLoading(),'owner-b',{load:async()=>fresh(),save:async()=>{}});write.reject(Error('old transaction error'));await next;assert.equal(sync.getSnapshot().userId,'owner-b');assert.equal(sync.getSnapshot().state.events.length,0);assert.equal(sync.getSnapshot().cacheError,'');assert.equal(sync.getSnapshot().saveError,'');
});
test('logout while intent commit is pending authorizes no remote save or late UI acknowledgement',async()=>{
 const env=browser();try{const cache=browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION),f=setup(cache);await f.start();edit(f.sync,'A');await cache.read(OWNER);const gate=env.storage.controls.holdNextWrite();const saving=f.sync.flush(),rejected=assert.rejects(saving,/sessão mudou/);await gate.reached;const logout=f.sync.load(f.sync.beginLoading(),null,null);gate.commit();await Promise.all([rejected,logout]);assert.equal(f.writes.length,0);assert.equal(f.sync.getSnapshot().userId,null);assert.equal(f.sync.getSnapshot().state.events.length,0);assert.equal(f.sync.getSnapshot().saveError,'');assert.equal((await cache.read(OWNER)).pending.events[0].id,'A');
 }finally{env.close();}
});
test('async readback exceptions use a student message and leave pending dirty without remote writes',async()=>{
 const env=browser();try{const native=browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION);let broken=false;const cache={write:(...args)=>native.write(...args),read:owner=>{if(broken)throw Error('IndexedDB transaction QuotaExceededError');return native.read(owner);}};const f=setup(cache);await f.start();edit(f.sync,'A');await native.read(OWNER);broken=true;await assert.rejects(f.sync.flush(),/cópia local/);assert.equal(f.writes.length,0);assert.equal(f.sync.getSnapshot().dirty,true);assert.ok(!/IndexedDB|transaction|QuotaExceededError/.test(f.sync.getSnapshot().saveError));assert.ok(f.sync.getSnapshot().cacheError);
 }finally{env.close();}
});
test('durable keys isolate owner, course, edition and installed runtime; foreign recovery rows fail closed',async()=>{
 const env=browser();try{const cache=browserStudySyncCache(COURSE,'synthetic-language',undefined,VERSION),value={...fresh(),events:[{id:'owned'}]};await cache.write(OWNER,{state:value,pending:value,recovery:[]});for(const other of [browserStudySyncCache(COURSE,'synthetic-language',undefined,'2.0.0'),browserStudySyncCache('other-course','synthetic-language',undefined,VERSION)])assert.equal((await other.read(OWNER)).pending,null);assert.equal((await cache.read('owner-b')).pending,null);
 const runtime={userId:OWNER,reference:{installationId:'one',artifactHash:'hash'},versionSessionId:'session',selectionRevision:1},installed=browserStudySyncCache(COURSE,'synthetic-language',runtime,VERSION);await installed.write(OWNER,{state:value,pending:value,recovery:[]});assert.equal((await browserStudySyncCache(COURSE,'synthetic-language',{...runtime,versionSessionId:'other'},VERSION).read(OWNER)).pending,null);assert.equal((await installed.read('owner-b')).pending,null);
 const row=[...env.storage.rows].find(([key])=>key.includes('"compiled"')&&key.includes('"owner-a"')&&key.includes('"1.0.0"'));const malformed=JSON.parse(row[1]);malformed.entry.recovery=[{...fresh(),courseId:'foreign'}];env.storage.rows.set(row[0],JSON.stringify(malformed));await assert.rejects(cache.read(OWNER),/curso atual/);
 }finally{env.close();}
});
test('runtime configuration is captured at cache creation even if the caller later mutates its context',async()=>{
 const env=browser();try{const runtime={userId:OWNER,reference:{installationId:'one',artifactHash:'original'},versionSessionId:'session',selectionRevision:1},original=structuredClone(runtime),cache=browserStudySyncCache(COURSE,'synthetic-language',runtime,VERSION);runtime.userId='owner-b';runtime.reference.artifactHash='changed';runtime.versionSessionId='changed';const state={...fresh(),events:[{id:'original-scope'}]};await cache.write(OWNER,{state,pending:state,recovery:[]});const reopened=browserStudySyncCache(COURSE,'synthetic-language',original,VERSION);assert.equal((await reopened.read(OWNER)).pending.events[0].id,'original-scope');assert.equal((await browserStudySyncCache(COURSE,'synthetic-language',runtime,VERSION).read('owner-b')).pending,null);
 }finally{env.close();}
});
