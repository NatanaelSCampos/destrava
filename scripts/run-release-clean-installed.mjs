import {randomUUID} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {writeFileSync,existsSync} from 'node:fs';
import {localEnvironment,isolatedProcessEnvironment} from './release-clean-installed-environment.mjs';
const mode=process.argv[2];if(!['dev','verify'].includes(mode))throw Error('F2CI action');
const env=isolatedProcessEnvironment({...localEnvironment(),NODE_ENV:'development',C2_RETAIN_FILES:'1',C2_LOCAL_JOURNEY:'1'});
if(mode==='dev'){
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3100'],{env,windowsHide:true,stdio:'inherit'});
 writeFileSync('.tmp/f2-ci/app-process.json',JSON.stringify({pid:child.pid,port:3100,production:false}));
 process.on('SIGINT',()=>child.kill());await new Promise(resolve=>child.once('exit',resolve));
}else{
 if(existsSync('.tmp/f2-ci/gate-lease.json')||existsSync('.tmp/f2-ci/installed-attempt.json'))throw Error('F2CI retained attempt exists; automatic retry forbidden');
 env.F2CI_RUN_ID=randomUUID();
 writeFileSync('.tmp/f2-ci/installed-attempt.json',JSON.stringify({runId:env.F2CI_RUN_ID,at:new Date().toISOString()}),{flag:'wx'});
 let status=1;
 try{
 const r=spawnSync(process.execPath,['--import','tsx','scripts/verify-release-clean-installed.tsx'],{env,encoding:'utf8',windowsHide:true,maxBuffer:20e6});
 writeFileSync('.tmp/f2-ci/installed-stdout.log',r.stdout??'',{flag:'wx'});writeFileSync('.tmp/f2-ci/installed-stderr.log',r.stderr??'',{flag:'wx'});
 console.log(r.stdout??'');if(r.stderr)console.error(r.stderr);status=r.status??1;
 }finally{
 if(existsSync('.tmp/f2-ci/gate-lease.json')){
 const r=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',"import {restoreReleaseCleanGate} from './scripts/release-clean-installed-authority.ts';restoreReleaseCleanGate();"],{env,encoding:'utf8',windowsHide:true});
 writeFileSync('.tmp/f2-ci/gate-restore-stdout.log',r.stdout??'');writeFileSync('.tmp/f2-ci/gate-restore-stderr.log',r.stderr??'');if(r.status!==0){console.error('F2CI gate restoration FAILED');status=1;}
 }
 }
 process.exitCode=status;
}
