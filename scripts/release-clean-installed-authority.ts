import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {localEnvironment,assertLocalDocker,isolatedProcessEnvironment} from './release-clean-installed-environment.mjs';
import {InstallationError,type AuthorizationGuard} from '../src/domain/course-installations/contracts';
const DB='521adee1991d8a186b31463a19c56ca8fd448a24c95cb0df471fd0d156b5e0af';
function sql(input:string){
 assertLocalDocker();
 return execFileSync('docker',['--context','desktop-linux','exec','-i','-e','PGPASSFILE=/dev/null',DB,'env','-u','PGSERVICE','-u','PGSERVICEFILE','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5432','-U','postgres','-d','postgres'],{input,env:isolatedProcessEnvironment({}),encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']});
}
export function restoreReleaseCleanGate(){
 const lease=JSON.parse(readFileSync('.tmp/f2-ci/gate-lease.json','utf8')) as {nonceHash:string;runId:string};
 if(!process.env.F2CI_RUN_ID||lease.runId!==process.env.F2CI_RUN_ID)throw Error('Local gate lease belongs to another run');
 if(!/^[a-f0-9]{64}$/.test(lease.nonceHash))throw Error('Invalid local gate lease');
 sql(`BEGIN; DO $$ BEGIN
 IF (SELECT count(*) FROM destrava_private.course_installation_local_gate WHERE singleton AND NOT enabled AND nonce_hash IS NULL)=1 THEN RETURN; END IF;
 UPDATE destrava_private.course_installation_local_gate SET enabled=false,nonce_hash=NULL WHERE singleton AND enabled AND nonce_hash='${lease.nonceHash}';
 IF NOT FOUND THEN RAISE EXCEPTION 'F2CI_GATE_CONCURRENT_CHANGE'; END IF;
 END $$; COMMIT;`);
 const result=sql('BEGIN TRANSACTION READ ONLY; SELECT count(*) FROM destrava_private.course_installation_local_gate WHERE singleton AND NOT enabled AND nonce_hash IS NULL; ROLLBACK;').trim();
 if(result!=='1')throw Error('Local gate restoration failed');
 writeFileSync('.tmp/f2-ci/gate-restored.json',JSON.stringify({enabled:false,nonce:null,verified:true}));
}
/** Same test-only opaque issuer; no application route imports this file. */
export async function createLocalCourseInstallationContext(){
 if(process.env.NODE_ENV==='production')throw new InstallationError('NOT_AUTHORIZED','authorization');
 if(!process.env.F2CI_RUN_ID||!/^[a-f0-9-]{36}$/.test(process.env.F2CI_RUN_ID))throw Error('Missing local test run identity');
 const env=localEnvironment();
 const before=sql('BEGIN TRANSACTION READ ONLY; SELECT count(*) FROM destrava_private.course_installation_local_gate WHERE singleton AND NOT enabled AND nonce_hash IS NULL; ROLLBACK;').trim();
 if(before!=='1')throw Error('F2CI initial gate must be disabled with NULL nonce');
 const token=randomBytes(32).toString('hex'),tokenHash=createHash('sha256').update(token).digest('hex');
 writeFileSync('.tmp/f2-ci/gate-lease.json',JSON.stringify({runId:process.env.F2CI_RUN_ID,nonceHash:tokenHash,initial:{enabled:false,nonce:null}}),{flag:'wx'});
 sql(`BEGIN; DO $$ BEGIN UPDATE destrava_private.course_installation_local_gate SET enabled=true,nonce_hash='${tokenHash}' WHERE singleton AND NOT enabled AND nonce_hash IS NULL; IF NOT FOUND THEN RAISE EXCEPTION 'F2CI_GATE_PRECONDITION'; END IF; END $$; COMMIT;`);
 const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const authority=Object.freeze({});
 const authorizer:AuthorizationGuard={async assert(value){if(value!==authority||process.env.NODE_ENV==='production')throw new InstallationError('NOT_AUTHORIZED','authorization');assertLocalDocker();return{actorId:'local-test-operator',localToken:token};}};
 return{db,authorizer,authority};
}
