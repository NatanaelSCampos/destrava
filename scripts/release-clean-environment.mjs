import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { canonicalCleanWorkspace } from './release-guards/clean-local.mjs';
export const workspace=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
export const projectId='destrava-release-clean';
export const localApi='http://127.0.0.1:55421',localApp='http://127.0.0.1:3100';
const expected='D:\\Documents\\destrava-worktrees\\destrava-release-clean';
export function assertLocalUrl(value,allowed=[localApi]) {
 const u=new URL(value);if(u.protocol!=='http:'||u.username||u.password||!allowed.includes(u.origin)||u.hostname!=='127.0.0.1')throw Error('F2C destination rejected');return u;
}
export function isolatedProcessEnvironment(values={}) {
 const env={};for(const k of ['SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP','USERPROFILE'])if(process.env[k])env[k]=process.env[k];
 return {...env,...values,TSX_DISABLE_CACHE:'1',NEXT_TELEMETRY_DISABLED:'1',NO_PROXY:'127.0.0.1,localhost'};
}
export function assertLocalDocker() {
 canonicalCleanWorkspace(workspace);
 if(workspace!==expected||realpathSync('.')!==workspace)throw Error('F2C workspace');
 for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','SUPABASE_CLI_BINARY_OVERRIDE'])if(process.env[k])throw Error('F2C override');
 execFileSync(process.execPath,['.tmp/f2-c/ops.mjs','inspect'],{cwd:workspace,env:isolatedProcessEnvironment(),windowsHide:true,stdio:['ignore','pipe','pipe']});
 return {project:projectId,context:"desktop-linux",localDaemon:true,api:localApi,app:localApp,full10:true};
}
export function localEnvironment() {
 assertLocalDocker();
 for(const n of readdirSync(workspace))if(/^\.env(?:\.|$)/.test(n)&&n!=='.env.example')throw Error('F2C unexpected env file');
 const own=JSON.parse(readFileSync(resolve(workspace,'.tmp/f2/local-profile.json'),'utf8'));
 if(own.workspace!==workspace||own.values.DESTRAVA_LOCAL_PROJECT!==projectId||own.values.NEXT_PUBLIC_SUPABASE_URL!==localApi||own.values.APP_ORIGIN!==localApp)throw Error('F2C credential profile');
 const pub=own.values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=own.values.SUPABASE_SECRET_KEY;
 if(!pub||!secret)throw Error('F2C credentials missing');
 for(const [key,role]of [[pub,'anon'],[secret,'service_role']])if(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!==role)throw Error('F2C credential role');
 return {DESTRAVA_LOCAL_PROJECT:projectId,DESTRAVA_LOCAL_ONLY:'1',NEXT_PUBLIC_SUPABASE_URL:localApi,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:pub,SUPABASE_SECRET_KEY:secret,APP_ORIGIN:localApp};
}
export async function localFetch(input,init) {assertLocalUrl(typeof input==='string'||input instanceof URL?input:input.url,[localApi,localApp]);return fetch(input,{...init,redirect:'manual'});}
