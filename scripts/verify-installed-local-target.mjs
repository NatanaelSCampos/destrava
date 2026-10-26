import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateCleanDocker} from './release-guards/clean-local.mjs';
import {validateRepairContainers} from './release-guards/clean-repair.mjs';
export const ROOT='D:\\Documents\\destrava-worktrees\\destrava-release-clean';
const PROJECT='destrava-release-clean',LEDGER='09d6a9011040462c9f1708ff9ad62f1996debc1aaa0f46d43c380dad33083bd1';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
/** No writes, SQL, credentials file, startup or fallback; every call inspects live resources. */
export function verifyInstalledLocalTarget({read=p=>fs.readFileSync(p),real=p=>fs.realpathSync(p),docker}={}){
 if(process.platform!=='win32'||process.env.NODE_ENV==='production'||real('.')!==ROOT||real(path.dirname(fileURLToPath(import.meta.url))+'/..')!==ROOT)throw Error('scope');
 for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','SUPABASE_CLI_BINARY_OVERRIDE'])if(process.env[k])throw Error('override');
 const bytes=read(path.join(ROOT,'.tmp/f2-r/repair-state.json'));if(sha(bytes)!==LEDGER)throw Error('ledger');const state=JSON.parse(bytes);
 if(state.workspace!==ROOT||state.entries.length!==10)throw Error('ledger identity');
 for(const [p,h]of Object.entries(state.candidateHashes))if(sha(read(path.join(ROOT,p)))!==h)throw Error('guard source');
 const childEnv={};for(const k of ['SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP'])if(process.env[k])childEnv[k]=process.env[k];
 const run=docker??(args=>JSON.parse(execFileSync('docker',['--context','desktop-linux',...args],{cwd:ROOT,env:childEnv,encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:20e6,stdio:['ignore','pipe','pipe']})));
 const context=run(['context','inspect','desktop-linux'])[0];if(context.Name!=='desktop-linux'||context.Endpoints?.docker?.Host!=='npipe:////./pipe/dockerDesktopLinuxEngine')throw Error('daemon');
 const network=run(['network','inspect',state.networkId])[0];if(network.Id!==state.networkId||network.Name!=='supabase_network_'+PROJECT||network.Labels?.['com.supabase.cli.project']!==PROJECT||network.Labels?.['com.supabase.cli.workdir']!==ROOT||network.Options?.['com.docker.network.bridge.host_binding_ipv4']!=='127.0.0.1'||network.EnableIPv6)throw Error('network');
 const old=run(['inspect',...state.entries.map(e=>e.oldId)]);if(old.length!==10)throw Error('archived count');for(const e of state.entries){const c=old.find(c=>c.Id===e.oldId);if(!c||c.Name!==e.archivedName||c.State.Running||c.Config.Labels?.['com.supabase.cli.project']!==PROJECT||c.Config.Labels?.['com.supabase.cli.workdir']!==ROOT)throw Error('archived identity');}
 const containers=run(['inspect',...state.entries.map(e=>e.newId)]);validateRepairContainers(containers,state.entries,{workspace:ROOT,networkId:state.networkId,live:true});
 const volumes=run(['volume','inspect',...['db','config','storage','email_templates','snippets'].map(n=>'supabase_'+n+'_'+PROJECT)]);if(volumes.length!==5)throw Error('volumes');for(const v of volumes)if(v.Driver!=='local'||Object.keys(v.Options??{}).length||v.Labels?.['com.supabase.cli.project']!==PROJECT||v.Labels?.['com.supabase.cli.workdir']!==ROOT)throw Error('volume identity');
 const pair=containers.filter(c=>state.entries.some(e=>e.newId===c.Id&&['db','kong'].includes(e.type)));const used=new Set(pair.flatMap(c=>c.Mounts.map(m=>m.Name)));
 validateCleanDocker({context,containers:pair,volumes:volumes.filter(v=>used.has(v.Name)),networks:[network]},{workspace:ROOT});
 return true;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{verifyInstalledLocalTarget();process.stdout.write('VERIFIED destrava-release-clean\n');}catch{process.stderr.write('Installed local destination rejected; details suppressed.\n');process.exitCode=1;}
}
