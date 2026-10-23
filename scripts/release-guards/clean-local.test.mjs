import assert from "node:assert/strict";
import test from "node:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CLEAN_LOCAL_PROFILE as P, canonicalCleanWorkspace, validateCleanLocal, validateCleanDocker } from "./clean-local.mjs";

const workspace = process.platform === "win32" ?
  "D:\\synthetic-f1\\destrava-release-clean" : "/synthetic-f1/destrava-release-clean";
const configText = [
  'project_id = "destrava-release-clean"',
  "[api]", "enabled = true", "port = 55421",
  "[db]", "port = 55422", "shadow_port = 55420",
  "[db.seed]", "enabled = false", 'sql_paths = ["./seed.sql"]',
  "[db.pooler]", "enabled = false", "port = 55429",
  "[studio]", "port = 55423", 'openai_api_key = "env(OPENAI_API_KEY)"',
  "[local_smtp]", "port = 55424", "smtp_port = 55425", "pop3_port = 55426",
  "[analytics]", "port = 55427",
  "[edge_runtime]", "inspector_port = 8183",
  "[auth]", 'site_url = "http://127.0.0.1:3100"',
  'additional_redirect_urls = ["http://127.0.0.1:3100", "http://127.0.0.1:3100/auth/callback"]',
].join("\n");
function values(root = workspace) {
  return {
    DESTRAVA_LOCAL_ONLY: "1",
    DESTRAVA_LOCAL_PROJECT: P.id,
    DESTRAVA_LOCAL_WORKSPACE: root,
    NEXT_PUBLIC_SUPABASE_URL: P.apiUrl,
    APP_ORIGIN: P.appOrigin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable",
    SUPABASE_SECRET_KEY: "synthetic-secret",
  };
}
function input(overrides = {}) {
  return { workspace, expectedWorkspace: workspace, configText, values: values(), ...overrides };
}
const labels = () => ({
  "com.supabase.cli.project": P.id,
  "com.supabase.cli.workdir": workspace,
});
function snapshot() {
  const network = "supabase_network_" + P.id;
  const volume = "supabase_db_" + P.id;
  return {
    context: { Name: "synthetic-local", Endpoints: { docker: { Host: "npipe:////./pipe/docker_engine" } } },
    containers: ["db", "kong"].map((type) => ({
      Name: "/supabase_" + type + "_" + P.id,
      Config: { Labels: labels() },
      HostConfig: { NetworkMode: network, Privileged: false },
      NetworkSettings: {
        Networks: { [network]: {} },
        Ports: { [type === "db" ? "5432/tcp" : "8000/tcp"]:
          [{ HostIp: "127.0.0.1", HostPort: type === "db" ? "55422" : "55421" }] },
      },
      Mounts: type === "db" ? [{ Type: "volume", Name: volume }] : [],
    })),
    volumes: [{ Name: volume, Labels: labels() }],
    networks: [{ Name: network, Labels: labels(), Driver: "bridge" }],
  };
}

test("profile is deeply immutable and reserves every isolated port", () => {
  assert.equal(Object.isFrozen(P), true);
  assert.equal(Object.isFrozen(P.ports), true);
  assert.deepEqual(Object.values(P.ports), [55421, 55422, 3100, 55420, 55423, 55424,
    55425, 55426, 55427, 55429, 8183, 9447]);
  assert.throws(() => { P.ports.api = 54321; });
});
test("local validation is deterministic, pure and never returns credentials", () => {
  const original = input();
  const before = JSON.stringify(original);
  const result = validateCleanLocal(original);
  assert.equal(result.ok, true);
  assert.equal(result.operational, false);
  assert.equal(result.phase, "F1");
  assert.deepEqual(validateCleanLocal(original), result);
  assert.equal(JSON.stringify(original), before);
  assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
});

for (const root of [
  "D:\\Documents\\espanhol-plataform\\destrava-release-clean",
  "D:\\Documents\\espanhol-plataform\\nested\\destrava-release-clean",
  "D:\\Documents\\ESPANHOL-PLATAFORM\\destrava-release-clean",
  "/home/test/espanhol-plataform/destrava-release-clean",
  "/home/test/espanhol-plataform/nested/destrava-release-clean",
  "/home/test/ESPANHOL-PLATAFORM/destrava-release-clean",
  "D:\\Documents\\espanholPlataform\\destrava-release-clean",
  "/home/test/espanholPlataform/destrava-release-clean",
]) test("workspace ancestry rejects legacy project: " + root, () => {
  assert.throws(() => canonicalCleanWorkspace(root), /workspace/u);
  // Align every identity field: rejection must come from ancestry, not mismatch.
  const candidate = input({ workspace: root, expectedWorkspace: root, values: values(root) });
  assert.throws(() => validateCleanLocal(candidate), /workspace/u);
});

for (const root of [
  "D:\\Documents\\destrava-worktrees\\destrava-release-clean",
  "/home/test/destrava-worktrees/destrava-release-clean",
  "D:\\Documents\\espanhol-plataform-reference\\destrava-release-clean",
  "/home/test/espanhol-plataform-reference/destrava-release-clean",
]) test("workspace ancestry accepts independent project: " + root, () => {
  assert.equal(canonicalCleanWorkspace(root), root);
  const candidate = input({ workspace: root, expectedWorkspace: root, values: values(root) });
  assert.equal(validateCleanLocal(candidate).ok, true);
});

for (const [name, modify] of [
  ["old project", (x) => { x.values.DESTRAVA_LOCAL_PROJECT = "espanhol-plataform"; }],
  ["production API", (x) => { x.values.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.supabase.co"; }],
  ["old API port", (x) => { x.values.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"; }],
  ["remote app", (x) => { x.values.APP_ORIGIN = "https://synthetic.example"; }],
  ["missing profile marker", (x) => { delete x.values.DESTRAVA_LOCAL_ONLY; }],
  ["missing key", (x) => { delete x.values.SUPABASE_SECRET_KEY; }],
  ["blank key", (x) => { x.values.SUPABASE_SECRET_KEY = " "; }],
  ["public secret", (x) => { x.values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_synthetic"; }],
  ["extra public secret", (x) => { x.values.NEXT_PUBLIC_SECRET = "synthetic-secret"; }],
  ["external credential", (x) => { x.values.OPENAI_API_KEY = "synthetic-openai"; }],
  ["workspace mismatch", (x) => { x.values.DESTRAVA_LOCAL_WORKSPACE = workspace + "-other"; }],
  ["expected mismatch", (x) => { x.expectedWorkspace = "/other/destrava-release-clean"; }],
  ["relative workspace", (x) => { x.workspace = "destrava-release-clean"; }],
  ["un-normalized workspace", (x) => { x.workspace = "/tmp/a/../destrava-release-clean"; }],
  ["main checkout child", (x) => { x.workspace = "D:\\Documents\\espanholPlataform\\destrava-release-clean"; }],
  ["UNC workspace", (x) => { x.workspace = "\\\\remote\\share\\destrava-release-clean"; }],
]) test("rejects " + name, () => {
  const candidate = input();
  modify(candidate);
  assert.throws(() => validateCleanLocal(candidate));
});
for (const name of ["DOCKER_HOST", "DOCKER_CONTEXT", "SUPABASE_CLI_BINARY_OVERRIDE",
  "HTTPS_PROXY", "http_proxy", "DATABASE_URL", "PGHOST", "OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "NODE_OPTIONS", "CDP_PORT", "S3_HOST"])
  test("rejects ambient " + name, () => {
    assert.throws(() => validateCleanLocal(input({ ambient: { [name]: "synthetic-sensitive" } })),
      (error) => !error.message.includes("synthetic-sensitive"));
  });
test("public JWT must carry only anon role", () => {
  const jwt = (role) => Buffer.from('{"alg":"HS256"}').toString("base64url") + "." +
    Buffer.from(JSON.stringify({ role })).toString("base64url") + ".synthetic";
  const candidate = input();
  candidate.values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = jwt("anon");
  assert.equal(validateCleanLocal(candidate).ok, true);
  for (const role of ["service_role", "authenticated", "admin"]) {
    candidate.values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = jwt(role);
    assert.throws(() => validateCleanLocal(candidate));
  }
});
for (const [name, transform] of [
  ["duplicate project", (s) => s.replace("[api]", 'project_id="destrava-release-clean"\n[api]')],
  ["duplicate table", (s) => s + "\n[api]\nport=55421"],
  ["dotted override", (s) => s + "\nauth.site_url='http://127.0.0.1:3100'"],
  ["quoted table", (s) => s.replace("[api]", '["api"]')],
  ["multiline string", (s) => s + '\nx="""not-supported"""'],
  ["inline table", (s) => s + "\nx={ port=54321 }"],
  ["wrong seed", (s) => s.replace("enabled = false", "enabled = true")],
  ["old shadow", (s) => s.replace("shadow_port = 55420", "shadow_port = 54320")],
  ["missing auxiliary", (s) => s.replace("smtp_port = 55425", "")],
  ["wrong inspector", (s) => s.replace("inspector_port = 8183", "inspector_port = 8083")],
  ["unknown port", (s) => s + "\n[future]\nport=54321"],
  ["remote auth", (s) => s.replace(P.appOrigin, "https://synthetic.example")],
  ["wildcard redirect", (s) => s.replace('/auth/callback"', '/**"')],
  ["remote redirect", (s) => s.replace(P.appOrigin + '/auth/callback', "https://synthetic.example/callback")],
  ["enabled external", (s) => s + "\n[auth.external.synthetic]\nenabled=true"],
  ["literal external credential", (s) => s.replace("env(OPENAI_API_KEY)", "synthetic-external-secret")],
]) test("TOML rejects " + name, () => {
  assert.throws(() => validateCleanLocal(input({ configText: transform(configText) })));
});
test("parser accepts comments, literal strings, arrays and unrelated current configuration", () => {
  const extra = "\n[storage]\nenabled=true\nfile_size_limit='50MiB' # comment\n" +
    "[auth.rate_limit]\nemail_sent=2\n[auth.external.apple]\nenabled=false\n" +
    'secret="env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)"\n' +
    "[experimental]\ns3_host='env(S3_HOST)'\n";
  assert.equal(validateCleanLocal(input({ configText: configText + extra })).ok, true);
});
test("Docker snapshot requires local socket plus exact network, volume and container identities", () => {
  const original = snapshot();
  const before = JSON.stringify(original);
  assert.equal(validateCleanDocker(original, { workspace }).operational, false);
  original.context.Endpoints.docker.Host = "unix:///var/run/docker.sock";
  assert.equal(validateCleanDocker(original, { workspace }).ok, true);
  original.context.Endpoints.docker.Host = "npipe:////./pipe/docker_engine";
  assert.equal(JSON.stringify(original), before);
});
for (const [name, change] of [
  ["tcp daemon", (s) => { s.context.Endpoints.docker.Host = "tcp://127.0.0.1:2375"; }],
  ["remote npipe", (s) => { s.context.Endpoints.docker.Host = "npipe:////remote/pipe/docker_engine"; }],
  ["remote unix", (s) => { s.context.Endpoints.docker.Host = "unix://remote/var/run/docker.sock"; }],
  ["ambiguous unix", (s) => { s.context.Endpoints.docker.Host = "unix:////remote/socket"; }],
  ["old container", (s) => { s.containers[0].Name = "/supabase_db_espanhol-plataform"; }],
  ["old project label", (s) => { s.containers[0].Config.Labels["com.supabase.cli.project"] = "espanhol-plataform"; }],
  ["wrong workdir", (s) => { s.containers[1].Config.Labels["com.supabase.cli.workdir"] = "/other"; }],
  ["public binding", (s) => { s.containers[0].NetworkSettings.Ports["5432/tcp"][0].HostIp = "0.0.0.0"; }],
  ["old API port", (s) => { s.containers[1].NetworkSettings.Ports["8000/tcp"][0].HostPort = "54321"; }],
  ["extra binding", (s) => { s.containers[0].NetworkSettings.Ports["1111/tcp"] = [{ HostIp: "127.0.0.1", HostPort: "55422" }]; }],
  ["old volume", (s) => { s.volumes[0].Name = "supabase_db_espanhol-plataform"; }],
  ["unproven volume", (s) => { delete s.volumes[0].Labels["com.supabase.cli.workdir"]; }],
  ["bind mount", (s) => { s.containers[0].Mounts[0].Type = "bind"; }],
  ["missing DB mount", (s) => { s.containers[0].Mounts = []; }],
  ["old attached network", (s) => { s.containers[0].NetworkSettings.Networks.supabase_network_old = {}; }],
  ["missing network identity", (s) => { delete s.networks[0].Labels; }],
  ["host network", (s) => { s.containers[0].HostConfig.NetworkMode = "host"; }],
  ["duplicate container", (s) => { s.containers[1] = structuredClone(s.containers[0]); }],
  ["privileged container", (s) => { s.containers[0].HostConfig.Privileged = true; }],
]) test("Docker rejects " + name, () => {
  const candidate = snapshot();
  change(candidate);
  assert.throws(() => validateCleanDocker(candidate, { workspace }));
});

test("CLI reads only explicit canonical fixture paths; no runner or process is started by validation", async (t) => {
  const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
  const fixtureParent = path.join(sourceRoot, ".tmp", "release-f1-fixtures");
  mkdirSync(fixtureParent, { recursive: true });
  // Deliberately retained: no cleanup or recursive deletion.
  const retained = mkdtempSync(path.join(fixtureParent, "inspection-"));
  const root = path.join(retained, P.id);
  mkdirSync(path.join(root, "scripts", "release-guards"), { recursive: true });
  mkdirSync(path.join(root, "supabase"), { recursive: true });
  for (const name of ["scripts/check-release-clean.mjs", "scripts/release-guards/clean-local.mjs", "scripts/release-guards/strict-json.mjs"])
    copyFileSync(path.join(sourceRoot, name), path.join(root, name));
  const profilePath = path.join(root, "synthetic-profile.json");
  const configPath = path.join(root, "supabase", "config.toml");
  writeFileSync(profilePath, JSON.stringify({ workspace: root, values: values(root) }));
  writeFileSync(configPath, configText);
  const run = (args, extraEnv = {}) => spawnSync(process.execPath,
    [path.join(root, "scripts", "check-release-clean.mjs"), ...args],
    { encoding: "utf8", windowsHide: true,
      env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), ...extraEnv } });
  const args = ["check", "--profile", profilePath, "--config", configPath,
    "--expected-workspace", root];
  t.diagnostic("Retained synthetic fixture: " + retained);
  await t.test("valid explicit input gives only F1 inspection summary", async () => {
    const { checkReleaseClean } = await import(pathToFileURL(path.join(root, "scripts", "check-release-clean.mjs")).href);
    checkReleaseClean(args);
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.ok, true);
    assert.equal(summary.operational, false);
    assert.equal(result.stdout.includes("synthetic-secret"), false);
  });
  await t.test("ambient override is rejected without leaking its value", () => {
    const result = run(args, { DOCKER_HOST: "synthetic-sensitive" });
    assert.equal(result.status, 1);
    assert.equal((result.stderr + result.stdout).includes("synthetic-sensitive"), false);
  });
  await t.test("config outside exact canonical location is rejected", () => {
    const other = path.join(root, "other.toml");
    writeFileSync(other, configText);
    const changed = [...args];
    changed[4] = other;
    assert.equal(run(changed).status, 1);
  });
  await t.test("script-root mismatch and implicit flags fail", () => {
    const changed = [...args];
    changed[6] = workspace;
    assert.equal(run(changed).status, 1);
    assert.equal(run(args.slice(0, 5)).status, 1);
    assert.equal(run(["start", ...args.slice(1)]).status, 1);
  });
  await t.test("invalid JSON never prints profile content", () => {
    writeFileSync(profilePath, '{"secret":"synthetic-sensitive"');
    const result = run(args);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.includes("synthetic-sensitive"), false);
    assert.equal(readFileSync(configPath, "utf8"), configText);
  });
});


test("current Supabase configuration is accepted after only required identity/port/Auth changes in memory", () => {
  const original = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");
  const replacements = new Map([["54320", "55420"], ["54321", "55421"],
    ["54322", "55422"], ["54323", "55423"], ["54324", "55424"],
    ["54325", "55425"], ["54326", "55426"], ["54327", "55427"],
    ["54329", "55429"], ["8083", "8183"]]);
  let adapted = original.replaceAll("espanhol-plataform", P.id)
    .replace(/5432[0-9]|8083/gu, (number) => replacements.get(number) ?? number)
    .replaceAll("http://localhost:3000", P.appOrigin)
    .replaceAll("# smtp_port = 55425", "smtp_port = 55425")
    .replaceAll("# pop3_port = 55426", "pop3_port = 55426");
  assert.equal(validateCleanLocal(input({ configText: adapted })).ok, true);
  assert.equal(readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8"), original);
});
test("identical public and secret credentials are rejected", () => {
  const candidate = input();
  candidate.values.SUPABASE_SECRET_KEY = candidate.values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.throws(() => validateCleanLocal(candidate));
});
test("volume remote driver/options are rejected even under local project labels", () => {
  for (const extra of [{ Driver: "nfs" }, { Driver: "local", Options: { type: "nfs", device: "synthetic:/data" } }]) {
    const candidate = snapshot();
    Object.assign(candidate.volumes[0], extra);
    assert.throws(() => validateCleanDocker(candidate, { workspace }));
  }
});
