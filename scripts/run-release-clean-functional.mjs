import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {localEnvironment,isolatedProcessEnvironment} from './release-clean-environment.mjs';
const modes={update:['--import','tsx','scripts/verify-release-clean-update.tsx'],catalog:['--import','tsx','scripts/prepare-release-clean-fixture.ts'],b1:['--import','tsx','scripts/verify-release-clean-b1.tsx'],browser:['--import','tsx','scripts/verify-release-clean-browser.tsx'],build:['node_modules/next/dist/bin/next','build'],auth:['--import','tsx','scripts/verify-release-clean-auth.tsx']};
const mode=process.argv[2];if(!Object.hasOwn(modes,mode))throw Error('Unknown F2-C action');
const env=isolatedProcessEnvironment({...localEnvironment(),DESTRAVA_LOCAL_ONLY:"0"});if(mode==='browser')env.C2_LOCAL_JOURNEY='1';
const result=spawnSync(process.execPath,modes[mode],{env,encoding:'utf8',windowsHide:true,maxBuffer:20e6});
writeFileSync('.tmp/f2-c/'+mode+'-stdout.log',result.stdout??'');writeFileSync('.tmp/f2-c/'+mode+'-stderr.log',result.stderr??'');
console.log(result.stdout??'');if(result.stderr)console.error(result.stderr);process.exitCode=result.status??1;
