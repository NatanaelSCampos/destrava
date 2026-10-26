import 'server-only';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {InstallationError} from '@/domain/course-installations/contracts';
const ROOT='D:\\Documents\\destrava-worktrees\\destrava-release-clean';
const PROOF_SHA='8b23b5e221f80c4e081e5bcfa9d395a1afef0672d4a33fe5cabb1a79aa2a7cd4';
type Env=Record<string,string|undefined>;
/** Only the two explicitly authorized local profiles. No publication authority is created. */
export function assertInstalledLocalProfile(env:Env=process.env,missingSecret:'NOT_AUTHORIZED'|'CATALOG_FAILED'='NOT_AUTHORIZED') {
 const deny=()=>{throw new InstallationError('NOT_AUTHORIZED','resolution');};
 if(env.NODE_ENV==='production'||env.DESTRAVA_LOCAL_ONLY!=='1')deny();
 const old=env.DESTRAVA_LOCAL_PROJECT==='espanhol-plataform'&&env.NEXT_PUBLIC_SUPABASE_URL==='http://127.0.0.1:54321'&&env.APP_ORIGIN==='http://127.0.0.1:3000';
 const clean=env.DESTRAVA_LOCAL_PROJECT==='destrava-release-clean'&&env.NEXT_PUBLIC_SUPABASE_URL==='http://127.0.0.1:55421'&&env.APP_ORIGIN==='http://127.0.0.1:3100';
 if(!old&&!clean)deny();
 if(!env.SUPABASE_SECRET_KEY)throw new InstallationError(missingSecret,'resolution');
 if(old)return;
 try {
  for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','SUPABASE_CLI_BINARY_OVERRIDE'])if(env[k]||process.env[k])deny();
  if(process.platform!=='win32')deny();
  const workspace=realpathSync(process.cwd());
  if(workspace!==ROOT)deny();
  const program=join(workspace,'scripts/verify-installed-local-target.mjs');
  if(realpathSync(program)!==program||createHash('sha256').update(readFileSync(program)).digest('hex')!==PROOF_SHA)deny();
  const child:NodeJS.ProcessEnv={NODE_ENV:env.NODE_ENV==='development'?'development':'test'};
  for(const k of ['SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP'])if(process.env[k])child[k]=process.env[k];
  const proof=execFileSync(process.execPath,[program],{cwd:ROOT,env:child,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1024,stdio:['ignore','pipe','pipe']});
  if(proof!=='VERIFIED destrava-release-clean\n')deny();
 }catch{deny();}
}
