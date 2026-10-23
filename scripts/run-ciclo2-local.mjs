import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { assertLocalDocker, isolatedProcessEnvironment, localEnvironment, workspace } from "./local-environment.mjs";

assert.notEqual(process.env.NODE_ENV, "production");
const env = isolatedProcessEnvironment(localEnvironment());
const isolation = assertLocalDocker();
const steps = {
  i8: ["scripts/verify-installed-runtime-local.tsx", { C2_RETAIN_FILES: "1" }],
  journey: ["scripts/verify-installed-runtime-local.tsx", { C2_LOCAL_JOURNEY: "1", C2_ONLY: "1" }],
  narration: ["scripts/verify-fase4-browser.tsx", { C2_LOCAL_JOURNEY: "1" }],
  b1: ["scripts/verify-fase4-local.tsx", {}],
};
const mode = process.argv[2] ?? "all";
assert(mode === "all" || Object.hasOwn(steps, mode), "Unknown local C2 step");
const query = (sql) => execFileSync("docker", ["exec", "-i", "supabase_db_espanhol-plataform", "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }).trim();
// The existing local authority nonce is data, not a database policy. Restore it
// after the synthetic tests; never bootstrap/reset/seed/migrate this gate.
const gateSQL = "begin transaction read only; select row_to_json(t) from (select enabled,nonce_hash from destrava_private.course_installation_local_gate where singleton=true) t; rollback;";
const gate = JSON.parse(query(gateSQL));
assert(gate && typeof gate.enabled === "boolean" && /^[a-f0-9]{64}$/.test(gate.nonce_hash), "Existing local test gate required; bootstrap forbidden");
const policySQL = "begin transaction read only; select coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'policy',policyname,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) order by schemaname,tablename,policyname),'[]'::jsonb) from pg_policies; rollback;";
const policies = query(policySQL);
function snapshotCandidate() {
  const paths=[];
  const walk=directory=>{for(const entry of readdirSync(resolve(workspace,directory),{withFileTypes:true})){assert(!entry.isSymbolicLink(),"Candidate must not contain linked source");const path=resolve(workspace,directory,entry.name);if(entry.isDirectory())walk(relative(workspace,path));else if(entry.isFile())paths.push(relative(workspace,path).replaceAll("\\","/"));}};
  walk("src");walk("scripts");
  paths.push("package.json","tsconfig.json","next.config.ts","supabase/config.toml");
  return paths.sort().map(path=>({path,sha256:createHash("sha256").update(readFileSync(resolve(workspace,path))).digest("hex")}));
}
const executions = [];
mkdirSync(resolve(workspace, ".tmp/ciclo2"), { recursive: true });
try {
  console.log(JSON.stringify({ isolation, migrations: 0, externalProviders: false, syntheticRecordsRetained: true }));
  for (const [name, [script, flags]] of Object.entries(steps)) {
    if (mode !== "all" && mode !== name) continue;
    const before=snapshotCandidate();
    const started = Date.now();
    const result = spawnSync(process.execPath, ["--import", "tsx", script], { cwd: workspace, env: { ...env, C2_ONLY: "", C2_LOCAL_JOURNEY: "", C2_RETAIN_FILES: "", ...flags }, encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
    writeFileSync(resolve(workspace, `.tmp/ciclo2/${name}.stdout.log`), result.stdout ?? "");
    writeFileSync(resolve(workspace, `.tmp/ciclo2/${name}.stderr.log`), result.stderr ?? "");
    const after=snapshotCandidate();
    writeFileSync(resolve(workspace,`.tmp/ciclo2/${name}.candidate.json`),JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)},null,2));
    assert.deepEqual(after,before,"Candidate changed during local test " + name);
    executions.push({ name, script, flags, exit: result.status, durationMs: Date.now() - started, candidateDigest:createHash("sha256").update(JSON.stringify(before)).digest("hex") });
    console.log(result.stdout ?? "");
    if (result.stderr) console.error(result.stderr);
    if (result.status !== 0) break;
  }
} finally {
  query(`begin; update destrava_private.course_installation_local_gate set enabled=${gate.enabled ? "true" : "false"}, nonce_hash='${gate.nonce_hash}' where singleton=true; commit;`);
  assert.deepEqual(JSON.parse(query(gateSQL)), gate, "Local gate not restored");
  assert.equal(query(policySQL), policies, "Database policies changed during tests");
  const proof = { executions, localGateRestored: true, databasePoliciesUnchanged: true, migrations: 0, deletedLearningRecords: 0 };
  writeFileSync(resolve(workspace, `.tmp/ciclo2/${mode}.json`), JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
}
process.exitCode = executions.length && executions.every(item => item.exit === 0) ? 0 : 1;
