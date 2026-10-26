import test from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Independent requirements-based QA. No Docker, database, network or real Fly calls.
const candidateRoot = resolve(process.env.RELEASE_QA_CANDIDATE_ROOT || ".");
const localPath = join(resolve(process.env.RELEASE_QA_LOCAL_ROOT || candidateRoot), "scripts/release-guards/clean-local.mjs");
const local = await import(pathToFileURL(localPath).href);
const workspace = resolve(candidateRoot, "..", "qa-fixtures", "destrava-release-clean");
const project = "destrava-release-clean";
const copy = (value) => structuredClone(value);
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
console.log(JSON.stringify({ qa: "F1 independent", candidateRoot, candidateFiles: { [localPath]: digest(localPath) }, node: process.version, platform: process.platform, network: false, database: false }));

function validLocal() {
  return {
    workspace,
    expectedWorkspace: workspace,
    values: {
      DESTRAVA_LOCAL_ONLY: "1", DESTRAVA_LOCAL_PROJECT: project,
      DESTRAVA_LOCAL_WORKSPACE: workspace,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55421",
      APP_ORIGIN: "http://127.0.0.1:3100",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_qa_only",
      SUPABASE_SECRET_KEY: "sb_secret_synthetic_local_only",
    },
    ambient: {},
    configText: `project_id = "${project}"
[api]
port = 55421
[db]
port = 55422
shadow_port = 55420
[db.pooler]
enabled = false
port = 55429
[db.seed]
enabled = false
[studio]
port = 55423
api_url = "http://127.0.0.1:55421"
[local_smtp]
port = 55424
smtp_port = 55425
pop3_port = 55426
[analytics]
port = 55427
[edge_runtime]
inspector_port = 8183
[auth]
site_url = "http://127.0.0.1:3100"
additional_redirect_urls = ["http://127.0.0.1:3100"]
`,
  };
}
function validDocker() {
  const labels = { "com.supabase.cli.project": project, "com.supabase.cli.workdir": workspace };
  const network = `supabase_network_${project}`;
  const volume = `supabase_db_${project}`;
  return {
    context: { Name: "synthetic-local", Endpoints: { docker: { Host: "npipe:////./pipe/docker_engine" } } },
    containers: [
      { Name: `/supabase_db_${project}`, Config: { Labels: copy(labels) }, NetworkSettings: { Ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55422" }] }, Networks: { [network]: {} } }, Mounts: [{ Type: "volume", Name: volume }] },
      { Name: `/supabase_kong_${project}`, Config: { Labels: copy(labels) }, NetworkSettings: { Ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "55421" }] }, Networks: { [network]: {} } }, Mounts: [] },
    ],
    volumes: [{ Name: volume, Labels: copy(labels) }],
    networks: [{ Name: network, Labels: copy(labels), Driver: "bridge" }],
  };
}
function rejectsLocal(name, change) {
  test(`local rejects ${name}`, () => {
    const input = validLocal(); change(input);
    assert.throws(() => local.validateCleanLocal(input));
  });
}
function rejectsDocker(name, change) {
  test(`Docker metadata rejects ${name}`, () => {
    const input = validDocker(); change(input);
    assert.throws(() => local.validateCleanDocker(input, { workspace }));
  });
}

test("local accepts exclusive loopback profile without mutation", () => {
  const input = validLocal(); const before = copy(input);
  const actual = local.validateCleanLocal(input);
  assert.equal(actual.ok, true); assert.equal(actual.phase, "F1"); assert.equal(actual.operational, false);
  assert.deepEqual(input, before);
});
test("profile fixes independent ports and is deeply frozen", () => {
  assert.equal(local.CLEAN_LOCAL_PROFILE.id, project);
  assert.deepEqual(local.CLEAN_LOCAL_PROFILE.ports, { api: 55421, db: 55422, app: 3100, shadow: 55420, studio: 55423, smtpWeb: 55424, smtp: 55425, pop3: 55426, analytics: 55427, pooler: 55429, edgeInspector: 8183, cdp: 9447 });
  assert.ok(Object.isFrozen(local.CLEAN_LOCAL_PROFILE)); assert.ok(Object.isFrozen(local.CLEAN_LOCAL_PROFILE.ports));
});
for (const key of Object.keys(validLocal().values)) rejectsLocal(`missing ${key}`, (v) => { delete v.values[key]; });
rejectsLocal("old project", (v) => { v.values.DESTRAVA_LOCAL_PROJECT = "espanhol-plataform"; });
rejectsLocal("old workspace basename", (v) => { v.workspace = resolve(workspace, "../espanhol-plataform"); v.expectedWorkspace = v.workspace; v.values.DESTRAVA_LOCAL_WORKSPACE = v.workspace; });
rejectsLocal("workspace identity mismatch", (v) => { v.expectedWorkspace = resolve(workspace, "../other/destrava-release-clean"); });
rejectsLocal("relative workspace", (v) => { v.workspace = "destrava-release-clean"; });
for (const url of ["http://127.0.0.1:54321", "https://synthetic.supabase.co", "http://127.0.0.1:55421.evil.invalid", "http://user:password@127.0.0.1:55421", "http://127.0.0.1:55421/x", "http://127.0.0.1:55421/?a=1", "http://127.0.0.1:55421/#a"]) rejectsLocal(`API ${url}`, (v) => { v.values.NEXT_PUBLIC_SUPABASE_URL = url; });
rejectsLocal("old app port", (v) => { v.values.APP_ORIGIN = "http://127.0.0.1:3000"; });
for (const key of ["DOCKER_HOST", "DOCKER_CONTEXT", "SUPABASE_CLI_BINARY_OVERRIDE", "DATABASE_URL", "OPENAI_API_KEY", "AZURE_SPEECH_KEY", "HTTPS_PROXY"]) rejectsLocal(`ambient ${key}`, (v) => { v.ambient[key] = "synthetic-not-a-credential"; });
for (const secret of ["sb_secret_synthetic_private", "service_role", `a.${Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url")}.c`]) rejectsLocal("secret cannot enter public build setting", (v) => { v.values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = secret; });
for (const port of [55421, 55422, 55420, 55429, 55423, 55424, 55425, 55426, 55427, 8183]) rejectsLocal(`wrong configured port ${port}`, (v) => { v.configText = v.configText.replace(`= ${port}`, "= 12345"); });
rejectsLocal("automatic seed", (v) => { v.configText = v.configText.replace("[db.seed]\nenabled = false", "[db.seed]\nenabled = true"); });
rejectsLocal("old config project", (v) => { v.configText = v.configText.replace(`project_id = "${project}"`, 'project_id = "espanhol-plataform"'); });
rejectsLocal("remote auth site", (v) => { v.configText = v.configText.replace('site_url = "http://127.0.0.1:3100"', 'site_url = "https://remote.invalid"'); });
rejectsLocal("remote redirect", (v) => { v.configText = v.configText.replace('additional_redirect_urls = ["http://127.0.0.1:3100"]', 'additional_redirect_urls = ["https://remote.invalid/auth/callback"]'); });
rejectsLocal("duplicate project id", (v) => { v.configText = `project_id = "${project}"\n${v.configText}`; });
rejectsLocal("unparsed TOML syntax", (v) => { v.configText += "\n[unparsed]\nvalue = { a = 1 }\n"; });

test("Docker metadata accepts exclusive identities without mutation", () => {
  const input = validDocker(); const before = copy(input);
  const result = local.validateCleanDocker(input, { workspace });
  assert.ok(result); assert.deepEqual(input, before);
});
for (const host of ["tcp://127.0.0.1:2375", "tcp://remote.invalid:2375", "unix://remote.invalid/docker.sock", "npipe://remote.invalid/pipe/docker_engine"]) rejectsDocker(`daemon ${host}`, (v) => { v.context.Endpoints.docker.Host = host; });
for (const kind of ["containers", "volumes", "networks"]) {
  rejectsDocker(`missing ${kind}`, (v) => { delete v[kind]; });
  rejectsDocker(`${kind} wrong project label`, (v) => { const item = v[kind][0]; (item.Config?.Labels || item.Labels)["com.supabase.cli.project"] = "espanhol-plataform"; });
  rejectsDocker(`${kind} wrong workdir`, (v) => { const item = v[kind][0]; (item.Config?.Labels || item.Labels)["com.supabase.cli.workdir"] = resolve(workspace,".."); });
}
for (const host of ["0.0.0.0", "::", "192.168.1.2", ""]) rejectsDocker(`API bind ${host || "empty"}`, (v) => { v.containers[1].NetworkSettings.Ports["8000/tcp"][0].HostIp = host; });
rejectsDocker("wrong API binding port", (v) => { v.containers[1].NetworkSettings.Ports["8000/tcp"][0].HostPort = "54321"; });
rejectsDocker("wrong DB binding port", (v) => { v.containers[0].NetworkSettings.Ports["5432/tcp"][0].HostPort = "54322"; });
rejectsDocker("DB missing mounted volume", (v) => { v.containers[0].Mounts = []; });
rejectsDocker("legacy volume name", (v) => { v.volumes[0].Name = "supabase_db_espanhol-plataform"; v.containers[0].Mounts[0].Name = v.volumes[0].Name; });
rejectsDocker("bind mount outside fixture", (v) => { v.containers[0].Mounts[0] = { Type: "bind", Source: "C:/old-data", Destination: "/var/lib/postgresql/data" }; });
rejectsDocker("legacy network", (v) => { v.networks[0].Name = "supabase_network_espanhol-plataform"; });
rejectsDocker("host network driver", (v) => { v.networks[0].Driver = "host"; });
rejectsDocker("unreferenced volume", (v) => { const item = copy(v.volumes[0]); item.Name = `supabase_orphan_${project}`; v.volumes.push(item); });
rejectsDocker("unreferenced network", (v) => { const item = copy(v.networks[0]); item.Name = `supabase_orphan_${project}`; v.networks.push(item); });

test("errors suppress confidential input values", () => {
  const input = validLocal(); const marker = "sb_secret_DO_NOT_DISCLOSE_QA_837426";
  input.values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = marker;
  assert.throws(() => local.validateCleanLocal(input), (e) => !e.message.includes(marker));
});

const deployPath = join(candidateRoot, "scripts/release-guards/deployment-plan.mjs");
const deploy = await import(pathToFileURL(deployPath).href);
console.log(JSON.stringify({ candidateFiles: { [deployPath]: digest(deployPath) } }));
const publicArgs = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_SYNTHETICQAONLY123456789",
  NEXT_PUBLIC_FEATURE_AI_TUTOR: "false", NEXT_PUBLIC_FEATURE_AI_WRITING: "false",
  NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED: "false", NEXT_PUBLIC_PASSKEYS_ENABLED: "false",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
};
const dockerText = Object.keys(publicArgs).map((key) => `ARG ${key}`).join("\n");
function productionFixture() {
  const profile = {
    schemaVersion: 1, environment: "production", workspace,
    commit: "a".repeat(40), app: "destrava-qa-f1", supabaseProjectRef: "abcdefghijklmnopqrst",
    origin: "https://destrava-qa-f1.fly.dev",
    files: { Dockerfile: "b".repeat(64), "fly.toml": "c".repeat(64), "package-lock.json": "d".repeat(64) },
    buildArgs: copy(publicArgs),
  };
  const context = { workspace, expectedApp: profile.app, expectedSupabaseProject: profile.supabaseProjectRef,
    expectedOrigin: profile.origin, expectedSha: profile.commit, actualSha: profile.commit, gitStatus: "",
    hashes: copy(profile.files), flyConfig: `app = "${profile.app}"\n[env]\nNODE_ENV = "production"\nAPP_ORIGIN = "${profile.origin}"\n`, dockerfileText: dockerText, ambient: {},
  };
  return { profile, context };
}
const productionCases = [
  ["absent profile", (v) => { v.profile = undefined; }],
  ["wrong environment", (v) => { v.profile.environment = "development"; }],
  ["unknown public field", (v) => { v.profile.buildArgs.NEXT_PUBLIC_PRIVATE_SECRET = "sb_secret_DO_NOT_DISCLOSE_QA_837426"; }],
  ["unknown profile field", (v) => { v.profile.secret = "sb_secret_DO_NOT_DISCLOSE_QA_837426"; }],
  ["wrong workspace", (v) => { v.profile.workspace = resolve(workspace,"../wrong"); }],
  ["relative workspace", (v) => { v.profile.workspace = "relative"; }],
  ["wrong Fly app", (v) => { v.profile.app = "other-fly-app"; }],
  ["wrong expected app", (v) => { v.context.expectedApp = "other-fly-app"; }],
  ["wrong project", (v) => { v.profile.supabaseProjectRef = "z".repeat(20); }],
  ["wrong origin", (v) => { v.profile.origin = "https://other.fly.dev"; }],
  ["wrong SHA", (v) => { v.profile.commit = "f".repeat(40); }],
  ["wrong actual SHA", (v) => { v.context.actualSha = "f".repeat(40); }],
  ["dirty tree", (v) => { v.context.gitStatus = " M Dockerfile"; }],
  ["untracked files", (v) => { v.context.gitStatus = "?? injected-file"; }],
  ["missing public key", (v) => { delete v.profile.buildArgs.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; }],
  ["empty public key", (v) => { v.profile.buildArgs.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ""; }],
  ["private public key", (v) => { v.profile.buildArgs.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_DO_NOT_DISCLOSE_QA_837426"; }],
  ["privileged JWT", (v) => { v.profile.buildArgs.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = `e30.${Buffer.from(JSON.stringify({role:"service_role",ref:v.profile.supabaseProjectRef})).toString("base64url")}.c2ln`; }],
  ["boolean flag type", (v) => { v.profile.buildArgs.NEXT_PUBLIC_FEATURE_AI_TUTOR = false; }],
  ["missing flag", (v) => { delete v.profile.buildArgs.NEXT_PUBLIC_FEATURE_AI_WRITING; }],
  ["Fly config app mismatch", (v) => { v.context.flyConfig = v.context.flyConfig.replace(v.profile.app,"wrong-app"); }],
  ["Fly config origin mismatch", (v) => { v.context.flyConfig = v.context.flyConfig.replace(v.profile.origin,"https://wrong.fly.dev"); }],
  ["Fly config public flag mismatch", (v) => { v.context.flyConfig += '[build.args]\nNEXT_PUBLIC_FEATURE_AI_TUTOR = "true"\n'; }],
  ["Fly config alternate image", (v) => { v.context.flyConfig += '[build]\nimage = "unapproved-image"\n'; }],
  ["Fly config alternate Dockerfile", (v) => { v.context.flyConfig += '[build]\ndockerfile = "unapproved.Dockerfile"\n'; }],
  ["Fly release command", (v) => { v.context.flyConfig += '[deploy]\nrelease_command = "unapproved-command"\n'; }],
  ["Dockerfile missing public argument", (v) => { v.context.dockerfileText = v.context.dockerfileText.replace("ARG NEXT_PUBLIC_SUPABASE_URL", ""); }],
];
for (const url of ["http://127.0.0.1:55421", "https://127.0.0.1", "http://abcdefghijklmnopqrst.supabase.co", "https://abcdefghijklmnopqrst.supabase.co.evil.com", "https://user:pass@abcdefghijklmnopqrst.supabase.co", "https://abcdefghijklmnopqrst.supabase.co/path", "https://abcdefghijklmnopqrst.supabase.co?x=y", "https://abcdefghijklmnopqrst.supabase.co#fragment"]) productionCases.push([`Supabase URL ${url}`, (v) => { v.profile.buildArgs.NEXT_PUBLIC_SUPABASE_URL = url; }]);
for (const origin of ["http://destrava-qa-f1.fly.dev", "https://127.0.0.1", "https://localhost", "https://user:pass@destrava-qa-f1.fly.dev", "https://destrava-qa-f1.fly.dev/path", "https://destrava-qa-f1.fly.dev?x=y", "https://destrava-qa-f1.fly.dev#fragment"]) productionCases.push([`origin ${origin}`, (v) => { v.profile.origin = origin; v.context.expectedOrigin = origin; }]);
for (const file of ["Dockerfile", "fly.toml", "package-lock.json"]) productionCases.push([`altered ${file} digest`, (v) => { v.profile.files[file] = "f".repeat(64); }]);
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "OPENAI_API_KEY", "DATABASE_URL", "APP_ORIGIN", "DOCKER_HOST", "FLY_APP"]) productionCases.push([`ambient ${key}`, (v) => { v.context.ambient[key] = "sb_secret_DO_NOT_DISCLOSE_QA_837426"; }]);

test("production accepts fully explicit identities without mutation", () => {
  const input = productionFixture(); const before = copy(input);
  const result = deploy.validateProductionProfile(input.profile, input.context);
  assert.equal(result.app, input.profile.app); assert.equal(result.commit, input.profile.commit);
  assert.deepEqual(input, before); assert.ok(Object.isFrozen(result));
});
for (const [name, change] of productionCases) test(`production rejects ${name} without exposing secrets`, () => {
  const input = productionFixture(); change(input);
  assert.throws(() => deploy.validateProductionProfile(input.profile, input.context), (e) => !e.message.includes("sb_secret_DO_NOT_DISCLOSE_QA_837426"));
});
for (const text of ['{"app":"one","app":"two"}', '{"buildArgs":{"a":1,"a":2}}', '{"app":"one","\\u0061pp":"two"}', '{"__proto__":{}}', '{"constructor":{}}', '{} {}', '{"a":1,}', '[1,]', '{']) test(`profile JSON rejects ambiguity ${text}`, () => {
  assert.throws(() => deploy.parseReleaseJson(text));
});
test("public anon JWT is bound to approved project", () => {
  const jwt = (role, ref) => `e30.${Buffer.from(JSON.stringify({role,ref})).toString("base64url")}.c2ln`;
  assert.doesNotThrow(() => deploy.assertPublishableKey(jwt("anon", "abcdefghijklmnopqrst"), "abcdefghijklmnopqrst"));
  assert.throws(() => deploy.assertPublishableKey(jwt("anon", "zzzzzzzzzzzzzzzzzzzz"), "abcdefghijklmnopqrst"));
  assert.throws(() => deploy.assertPublishableKey(jwt("authenticated", "abcdefghijklmnopqrst"), "abcdefghijklmnopqrst"));
});


// The only executable external-command path uses retained synthetic Git fixtures.
// A committed PowerShell wrapper stub replaces fly-ipv4.ps1 before any command.
import { mkdirSync, writeFileSync, copyFileSync, mkdtempSync, existsSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const qaRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const fixtureBase = join(qaRoot, ".tmp/release-f1-qa");
function safeEnvironment(extra = {}) {
  const result = {};
  for (const [key,value] of Object.entries(process.env)) {
    if (/^(PATH|PATHEXT|SystemRoot|WINDIR|COMSPEC|TEMP|TMP|OS|PROCESSOR_ARCHITECTURE|ProgramFiles|ProgramFiles\(x86\)|SYSTEMDRIVE|USERPROFILE|HOME|LOCALAPPDATA|APPDATA|PSModulePath)$/i.test(key)) result[key] = value;
  }
  return { ...result, ...extra };
}
const flyStub = `param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Forwarded)
$ErrorActionPreference = 'Stop'
if (-not $env:RELEASE_QA_CALL_LOG) { throw 'QA stub requires an isolated log.' }
$entry = @{ arguments = $Forwarded; simulated = $true } | ConvertTo-Json -Compress
Add-Content -LiteralPath $env:RELEASE_QA_CALL_LOG -Value $entry
if ($env:RELEASE_QA_STUB_WARN -eq '1') { [Console]::Error.WriteLine('Synthetic native warning; successful exit') }
if ($env:RELEASE_QA_STUB_FAIL -eq '1') { Write-Output 'sb_secret_DO_NOT_DISCLOSE_QA_837426'; exit 19 }
exit 0
`;
function gitFixture() {
  mkdirSync(fixtureBase, { recursive: true });
  const retained = mkdtempSync(join(fixtureBase, "execution-"));
  const root = join(retained, "workspace");
  mkdirSync(join(root,"scripts/release-guards"), { recursive: true });
  mkdirSync(join(root,"supabase/migrations"), { recursive: true });
  mkdirSync(join(retained,"empty-hooks"));
  copyFileSync(join(candidateRoot,"scripts/deploy-fly.ps1"),join(root,"scripts/deploy-fly.ps1"));
  copyFileSync(deployPath, join(root,"scripts/release-guards/deployment-plan.mjs"));
  copyFileSync(join(candidateRoot,"scripts/release-guards/run-deployment.mjs"),join(root,"scripts/release-guards/run-deployment.mjs"));
  if (existsSync(join(candidateRoot,"scripts/release-guards/strict-json.mjs"))) copyFileSync(join(candidateRoot,"scripts/release-guards/strict-json.mjs"),join(root,"scripts/release-guards/strict-json.mjs"));
  writeFileSync(join(root,"scripts/fly-ipv4.ps1"), flyStub);
  const { profile } = productionFixture(); profile.workspace = root;
  writeFileSync(join(root,"Dockerfile"),dockerText);
  writeFileSync(join(root,"package-lock.json"),'{}\n');
  writeFileSync(join(root,"fly.toml"),`app = "${profile.app}"\n[env]\nNODE_ENV = "production"\nAPP_ORIGIN = "${profile.origin}"\n`);
  writeFileSync(join(root,"supabase/migrations/20261023000000_synthetic_qa.sql"),"-- Synthetic fixture; never executed.\n");
  writeFileSync(join(root,".gitignore"),".env*\n.tmp/\n");
  const git = (...args) => execFileSync("git",["-c","core.autocrlf=false","-c",`core.hooksPath=${join(retained,"empty-hooks")}`,"-c","commit.gpgsign=false","-c","user.name=Destrava QA Synthetic","-c","user.email=qa-fixture@example.invalid","-C",root,...args],{ encoding:"utf8",windowsHide:true,env:safeEnvironment(),stdio:["ignore","pipe","pipe"] }).trim();
  git("init","-q"); git("add","--all"); git("commit","-qm","Synthetic QA fixture only");
  profile.commit = git("rev-parse","HEAD");
  for (const file of Object.keys(profile.files)) profile.files[file] = digest(join(root,file));
  const profilePath = join(retained,"release.json");
  writeFileSync(profilePath,JSON.stringify(profile));
  return { root, retained, profile, profilePath, log:join(retained,"fly-calls.jsonl"), git };
}
function dispatchFixture(fixture, { profile = fixture.profile, omit = [], extra = [], env = {}, validateOnly = false } = {}) {
  writeFileSync(fixture.profilePath,JSON.stringify(profile));
  const named = { ReleaseProfile: fixture.profilePath, ExpectedApp:fixture.profile.app,
    ExpectedSupabaseProject:fixture.profile.supabaseProjectRef, ExpectedOrigin:fixture.profile.origin, ExpectedSha:fixture.profile.commit };
  const args = ["-NoProfile","-ExecutionPolicy","Bypass","-File",join(fixture.root,"scripts/deploy-fly.ps1")];
  for (const [key,value] of Object.entries(named)) if (!omit.includes(key)) args.push(`-${key}`,value);
  if (validateOnly) args.push("-ValidateOnly"); args.push(...extra);
  const result = spawnSync("powershell.exe", args, { cwd: fixture.root, env:safeEnvironment({RELEASE_QA_CALL_LOG:fixture.log,...env}), encoding:"utf8",windowsHide:true,timeout:20000 });
  const calls = existsSync(fixture.log) ? readFileSync(fixture.log,"utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  writeFileSync(join(fixture.retained,"execution.json"),JSON.stringify({candidateRoot,candidateHashes:{deploymentPlan:digest(deployPath),deployPs:digest(join(candidateRoot,"scripts/deploy-fly.ps1"))},command:["powershell.exe",...args],environment:"sanitized, synthetic fixtures; fly-ipv4 replaced by committed stub",status:result.status,error:result.error?.message,calls,output},null,2));
  assert.ok(!result.error, result.error?.message); assert.ok(!output.includes("sb_secret_DO_NOT_DISCLOSE_QA_837426"),"secret leaked in child output");
  return { ...result, calls, output };
}
test("PowerShell valid production profile dispatches exactly once to simulated IPv4 wrapper", () => {
  const fixture = gitFixture(); const result = dispatchFixture(fixture);
  assert.equal(result.status,0,result.output); assert.equal(result.calls.length,1);
  const args = result.calls[0].arguments;
  assert.ok(args.includes("deploy")); assert.ok(args.includes("--app")); assert.ok(args.includes(fixture.profile.app));
  for (const [key,value] of Object.entries(fixture.profile.buildArgs)) assert.ok(args.includes(`${key}=${value}`),`missing explicit ${key}`);
});
test("PowerShell ValidateOnly performs no wrapper dispatch", () => {
  const fixture = gitFixture(); const result = dispatchFixture(fixture,{validateOnly:true});
  assert.equal(result.status,0,result.output); assert.equal(result.calls.length,0);
  const manifest = JSON.parse(result.output); assert.equal(manifest.commit,fixture.profile.commit);
  assert.equal(manifest.phase,"F1-guards-only"); assert.match(manifest.tree,/^[a-f0-9]{40}$/);
  assert.deepEqual(manifest.files,fixture.profile.files); assert.equal(manifest.migrations.length,1);
  assert.equal(manifest.migrations[0].sha256,digest(join(fixture.root,"supabase/migrations/20261023000000_synthetic_qa.sql")));
  assert.equal(manifest.runtimeSecretsVerified,false); assert.equal(manifest.imageDigest,null); assert.equal(manifest.courseVersion,null);
  assert.ok(!result.output.includes(fixture.profile.buildArgs.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
});
for (const name of ["ReleaseProfile","ExpectedApp","ExpectedSupabaseProject","ExpectedOrigin","ExpectedSha"]) test(`PowerShell missing ${name} rejects before simulated Fly`, () => {
  const fixture = gitFixture(); const result = dispatchFixture(fixture,{omit:[name]});
  assert.notEqual(result.status,0); assert.equal(result.calls.length,0);
});
for (const [name,change] of productionCases.filter(([name]) => ["wrong environment","wrong Fly app","wrong project","wrong origin","wrong SHA","missing public key","private public key","privileged JWT","boolean flag type","missing flag"].includes(name))) test(`PowerShell ${name} rejects before simulated Fly`, () => {
  const fixture = gitFixture(); const input = { profile:copy(fixture.profile), context:{} }; change(input);
  const result = dispatchFixture(fixture,{profile:input.profile});
  assert.notEqual(result.status,0); assert.equal(result.calls.length,0);
});
for (const url of ["http://127.0.0.1:55421","https://abcdefghijklmnopqrst.supabase.co.evil.com"]) test(`PowerShell invalid Supabase ${url} dispatches zero times`, () => {
  const fixture = gitFixture(); const profile = copy(fixture.profile); profile.buildArgs.NEXT_PUBLIC_SUPABASE_URL = url;
  const result = dispatchFixture(fixture,{profile}); assert.notEqual(result.status,0); assert.equal(result.calls.length,0);
});
for (const name of [".env",".env.local",".env.production",".env.production.local"]) test(`PowerShell refuses ignored implicit ${name} before simulated Fly`, () => {
  const fixture = gitFixture(); writeFileSync(join(fixture.root,name),"NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SYNTHETICQAONLY123456789\n");
  assert.equal(fixture.git("status","--porcelain"),"");
  const result = dispatchFixture(fixture); assert.notEqual(result.status,0); assert.equal(result.calls.length,0);
});
test("PowerShell refuses dirty build identity before simulated Fly", () => {
  const fixture = gitFixture(); writeFileSync(join(fixture.root,"Dockerfile"),`${dockerText}\n# changed\n`);
  const result = dispatchFixture(fixture); assert.notEqual(result.status,0); assert.equal(result.calls.length,0);
});
test("PowerShell refuses altered manifest hash before simulated Fly", () => {
  const fixture = gitFixture(); const profile = copy(fixture.profile); profile.files["package-lock.json"] = "f".repeat(64);
  const result = dispatchFixture(fixture,{profile}); assert.notEqual(result.status,0); assert.equal(result.calls.length,0);
});
test("PowerShell propagates simulated build failure and suppresses child output", () => {
  const fixture = gitFixture(); const result = dispatchFixture(fixture,{env:{RELEASE_QA_STUB_FAIL:"1"}});
  assert.notEqual(result.status,0); assert.equal(result.calls.length,1);
});


function localCliFixture() {
  mkdirSync(fixtureBase, {recursive:true});
  const retained = mkdtempSync(join(fixtureBase,"local-cli-"));
  const root = join(retained,"destrava-release-clean");
  mkdirSync(join(root,"scripts/release-guards"),{recursive:true}); mkdirSync(join(root,"supabase"));
  copyFileSync(localPath,join(root,"scripts/release-guards/clean-local.mjs"));
  if (existsSync(join(candidateRoot,"scripts/release-guards/strict-json.mjs"))) copyFileSync(join(candidateRoot,"scripts/release-guards/strict-json.mjs"),join(root,"scripts/release-guards/strict-json.mjs"));
  copyFileSync(join(resolve(process.env.RELEASE_QA_LOCAL_ROOT || candidateRoot),"scripts/check-release-clean.mjs"),join(root,"scripts/check-release-clean.mjs"));
  const input = validLocal(); input.workspace = root; input.expectedWorkspace = root; input.values.DESTRAVA_LOCAL_WORKSPACE = root;
  const profilePath = join(root,"qa.profile.json"); const configPath = join(root,"supabase/config.toml");
  writeFileSync(profilePath,JSON.stringify({workspace:root,values:input.values})); writeFileSync(configPath,input.configText);
  const attemptedCalls = join(retained,"external-call-attempts.log"); const preload = join(retained,"deny-external.mjs");
  writeFileSync(preload,`import cp from 'node:child_process';\nimport {appendFileSync} from 'node:fs';\nimport {syncBuiltinESMExports} from 'node:module';\nconst deny=(kind)=>()=>{appendFileSync(${JSON.stringify(attemptedCalls)},kind+'\\n');throw Error('QA external call denied');};\nfor(const name of ['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork']) cp[name]=deny(name);\nsyncBuiltinESMExports();\nglobalThis.fetch=deny('fetch');\n`);
  return {root,retained,profilePath,configPath,preload,attemptedCalls};
}
function runLocalCli(fixture,args) {
  const command = ["--import",pathToFileURL(fixture.preload).href,join(fixture.root,"scripts/check-release-clean.mjs"),...args];
  const result = spawnSync(process.execPath,command,{cwd:fixture.root,env:safeEnvironment(),encoding:"utf8",windowsHide:true,timeout:10000});
  const attempts = existsSync(fixture.attemptedCalls) ? readFileSync(fixture.attemptedCalls,"utf8") : "";
  writeFileSync(join(fixture.retained,"execution.json"),JSON.stringify({candidateRoot,localPath,localHash:digest(localPath),command:[process.execPath,...command],environment:"sanitized; child_process and fetch instrumented to deny all calls",status:result.status,attempts,stdout:result.stdout,stderr:result.stderr},null,2));
  assert.ok(!result.error,result.error?.message); assert.equal(attempts,"","CLI attempted an external command or fetch");
  return result;
}
const localCliArgs = (f) => ["check","--profile",f.profilePath,"--config",f.configPath,"--expected-workspace",f.root];
test("local CLI valid check is read only and never attempts Docker/Supabase/network", () => {
  const fixture = localCliFixture(); const beforeProfile = digest(fixture.profilePath); const beforeConfig = digest(fixture.configPath);
  const result = runLocalCli(fixture,localCliArgs(fixture)); assert.equal(result.status,0,result.stderr);
  assert.equal(digest(fixture.profilePath),beforeProfile); assert.equal(digest(fixture.configPath),beforeConfig);
});
for (const action of ["start","migrate","seed","restart","build","dev"]) test(`local CLI refuses operational ${action} with zero external attempts`, () => {
  const fixture = localCliFixture(); const args = localCliArgs(fixture); args[0] = action;
  const result = runLocalCli(fixture,args); assert.notEqual(result.status,0);
});
test("local CLI refuses unknown arguments with zero external attempts", () => {
  const fixture = localCliFixture(); const result = runLocalCli(fixture,[...localCliArgs(fixture),"--allow-remote"]); assert.notEqual(result.status,0);
});
test("local CLI refuses missing explicit profile with zero external attempts", () => {
  const fixture = localCliFixture(); writeFileSync(join(fixture.root,".env.local"),"NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co\n");
  const result = runLocalCli(fixture,["check","--config",fixture.configPath,"--expected-workspace",fixture.root]); assert.notEqual(result.status,0);
});
test("local CLI refuses remote URL with zero external attempts", () => {
  const fixture = localCliFixture(); const profile = JSON.parse(readFileSync(fixture.profilePath,"utf8")); profile.values.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co"; writeFileSync(fixture.profilePath,JSON.stringify(profile));
  const result = runLocalCli(fixture,localCliArgs(fixture)); assert.notEqual(result.status,0);
});
test("local CLI refuses alternate config path with zero external attempts", () => {
  const fixture = localCliFixture(); const other = join(fixture.root,"alternate.toml"); copyFileSync(fixture.configPath,other);
  const args = localCliArgs(fixture); args[4] = other;
  const result = runLocalCli(fixture,args); assert.notEqual(result.status,0);
});


test("local CLI rejects duplicate conflicting workspace keys before external operations", () => {
  const fixture = localCliFixture(); const profile = JSON.parse(readFileSync(fixture.profilePath,"utf8"));
  writeFileSync(fixture.profilePath,`{"workspace":"wrong-workspace",${JSON.stringify(profile).slice(1)}`);
  const result = runLocalCli(fixture,localCliArgs(fixture)); assert.notEqual(result.status,0);
});
test("local CLI rejects duplicate conflicting project keys before external operations", () => {
  const fixture = localCliFixture(); const profile = JSON.parse(readFileSync(fixture.profilePath,"utf8"));
  const values = `{"DESTRAVA_LOCAL_PROJECT":"espanhol-plataform",${JSON.stringify(profile.values).slice(1)}`;
  writeFileSync(fixture.profilePath,`{"workspace":${JSON.stringify(profile.workspace)},"values":${values}}`);
  const result = runLocalCli(fixture,localCliArgs(fixture)); assert.notEqual(result.status,0);
});

test("PowerShell native stderr warning keeps successful deployment exit", () => {
  const fixture=gitFixture(); const result=dispatchFixture(fixture,{env:{RELEASE_QA_STUB_WARN:"1"}});
  assert.equal(result.status,0,result.output); assert.equal(result.calls.length,1);
  assert(!result.output.includes("Synthetic native warning"));
});
