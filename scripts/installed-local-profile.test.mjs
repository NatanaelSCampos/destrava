import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
const ROOT='D:\\Documents\\destrava-worktrees\\destrava-release-clean';
const program=path.win32.join(ROOT,'scripts/verify-installed-local-target.mjs');
const clean={NODE_ENV:'test',DESTRAVA_LOCAL_ONLY:'1',DESTRAVA_LOCAL_PROJECT:'destrava-release-clean',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55421',APP_ORIGIN:'http://127.0.0.1:3100',SUPABASE_SECRET_KEY:'synthetic-private'};
const legacy={...clean,DESTRAVA_LOCAL_PROJECT:'espanhol-plataform',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',APP_ORIGIN:'http://127.0.0.1:3000'};
function fixture(options={}){
 const calls={fs:0,proof:0,sdk:0}, env={PATH:'test-path',SystemRoot:'C:\\Windows'};
 class InstallationError extends Error {constructor(code){super(code);this.code=code;}}
 const mocks={
 'server-only':{},'node:path':path.win32,'node:crypto':crypto,
 'node:fs':{realpathSync(p){calls.fs++;return options.wrongPath?'D:\\other':p==='.'?ROOT:p;},readFileSync(p){calls.fs++;assert.equal(p,program);return options.wrongHash?Buffer.from('modified'):fs.readFileSync('scripts/verify-installed-local-target.mjs');}},
 'node:child_process':{execFileSync(exe,args,o){calls.proof++;assert.deepEqual(Array.from(args),[program]);assert.equal(o.cwd,ROOT);assert.equal(o.env.SUPABASE_SECRET_KEY,undefined);if(options.failProof||calls.proof===options.failAt)throw Error('private diagnostic');return options.badSentinel?'not verified':'VERIFIED destrava-release-clean\n';}},
 '@/domain/course-installations/contracts':{InstallationError},
 '@supabase/supabase-js':{createClient(){calls.sdk++;return{};}},
 '@/content/course-registry':{},'@/content/public':{},
 '@/domain/course-installations/service':{CourseInstallationService:class{}},
 '@/repositories/supabase-course-installations':{SupabaseCourseArtifactStore:class{},SupabaseCourseInstallationCatalog:class{}},
 };
 const proc={platform:options.platform??'win32',cwd:()=>'.',execPath:'node',env:{...env,...options.ambient}};
 const load=(file)=>{const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require:n=>{assert(n in mocks,'unexpected module '+n);return mocks[n];},process:proc,Buffer},{filename:file});return mod.exports;};
 const shared=load('src/lib/installed-local-profile.ts');mocks['@/lib/installed-local-profile']=shared;
 return{...shared,scope:load('src/lib/installed-runtime-scope.ts'),runtime:load('src/lib/course-installation-runtime.ts'),calls,proc};
}
for(const [name,env]of [['legacy',legacy],['clean',clean]])test(name+' positive profile and both guards',()=>{const f=fixture();f.assertInstalledLocalProfile(env);f.scope.assertInstalledRuntimeScope(env);f.proc.env={...env};f.runtime.courseInstallationRuntime();assert.equal(f.calls.sdk,1);assert.equal(f.calls.proof,name==='clean'?3:0);});
const invalid=[['production',{NODE_ENV:'production'}],['flag missing',{DESTRAVA_LOCAL_ONLY:undefined}],['flag off',{DESTRAVA_LOCAL_ONLY:'0'}],['missing project',{DESTRAVA_LOCAL_PROJECT:undefined}],['unknown project',{DESTRAVA_LOCAL_PROJECT:'other'}],['legacy project clean ports',{DESTRAVA_LOCAL_PROJECT:'espanhol-plataform'}],['old API new app',{NEXT_PUBLIC_SUPABASE_URL:legacy.NEXT_PUBLIC_SUPABASE_URL}],['new API old app',{APP_ORIGIN:legacy.APP_ORIGIN}],['https API',{NEXT_PUBLIC_SUPABASE_URL:'https://127.0.0.1:55421'}],['remote API',{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'}],['localhost API',{NEXT_PUBLIC_SUPABASE_URL:'http://localhost:55421'}],['IPv6 API',{NEXT_PUBLIC_SUPABASE_URL:'http://[::1]:55421'}],['URL userinfo',{NEXT_PUBLIC_SUPABASE_URL:'http://u:p@127.0.0.1:55421'}],['API slash',{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55421/'}],['remote origin',{APP_ORIGIN:'https://example.test'}],['missing secret',{SUPABASE_SECRET_KEY:''}]];
for(const[name,delta]of invalid)test('both guards reject '+name+' before proof/SDK',()=>{const f=fixture(),e={...clean,...delta};assert.throws(()=>f.scope.assertInstalledRuntimeScope(e));f.proc.env=e;assert.throws(()=>f.runtime.courseInstallationRuntime());assert.deepEqual(f.calls,{fs:0,proof:0,sdk:0});});
for(const [name,options]of [['platform',{platform:'linux'}],['workspace',{wrongPath:true}],['proof hash',{wrongHash:true}],['missing/failed live proof',{failProof:true}],['bad sentinel',{badSentinel:true}],['ambient Docker override',{ambient:{DOCKER_HOST:'tcp://remote'}}]])test('clean fails closed: '+name,()=>{const f=fixture(options);assert.throws(()=>f.assertInstalledLocalProfile(clean));assert.equal(f.calls.sdk,0);});
for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','SUPABASE_CLI_BINARY_OVERRIDE'])test('rejects explicit '+key,()=>{const f=fixture();assert.throws(()=>f.assertInstalledLocalProfile({...clean,[key]:'override'}));assert.equal(f.calls.proof,0);});
test('proof rechecked on consecutive calls; stopped/stale proof fails',()=>{const f=fixture({failAt:2});f.assertInstalledLocalProfile(clean);assert.throws(()=>f.assertInstalledLocalProfile(clean));assert.equal(f.calls.proof,2);});
test('production never reads filesystem or starts proof even if proof passes',()=>{const f=fixture();assert.throws(()=>f.assertInstalledLocalProfile({...clean,NODE_ENV:'production'}));assert.deepEqual(f.calls,{fs:0,proof:0,sdk:0});});
test('caller missing-secret errors preserved',()=>{const f=fixture();assert.throws(()=>f.assertInstalledLocalProfile({...clean,SUPABASE_SECRET_KEY:undefined}),{code:'NOT_AUTHORIZED'});assert.throws(()=>f.assertInstalledLocalProfile({...clean,SUPABASE_SECRET_KEY:undefined},'CATALOG_FAILED'),{code:'CATALOG_FAILED'});});
