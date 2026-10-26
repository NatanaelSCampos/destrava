// One scoped F2-R repair. No Supabase start, SQL client, migration, seed, delete,
// image pull, or old-project discovery. Existing F2 receipts are mandatory.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateCleanLocal, validateCleanDocker } from "./release-guards/clean-local.mjs";
import { REPAIR_PROJECT as project, REPAIR_NETWORK as network, TEMPLATE_VOLUME, SNIPPETS_VOLUME,
  digest, serviceType, repairCreateBody, validateRepairContainers, validateRepairContainer, validateRepairHelper } from "./release-guards/clean-repair.mjs";

const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const dir = path.join(root, ".tmp/f2-r");
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const save = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const candidatePaths = ["scripts/repair-release-clean.mjs", "scripts/release-guards/clean-repair.mjs",
  "scripts/release-guards/clean-repair.test.mjs", "scripts/release-guards/clean-local.test.mjs",
  "scripts/release-guards/clean-local.mjs", "supabase/config.toml"];
const candidateHashes = () => Object.fromEntries(candidatePaths.map(p => [p, sha(fs.readFileSync(path.join(root, p)))]));
const planEntries = plans => plans.map(x => ({ type: serviceType(x.original.Name), oldId: x.original.Id, image: x.original.Image,
  createBodyHash: digest(x.body), mounts: x.body.HostConfig.Mounts, ports: x.body.HostConfig.PortBindings }));
const fail = code => { throw Error(code); };
const env = Object.fromEntries(["SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "PATH", "TEMP", "TMP"].filter(k => process.env[k]).map(k => [k, process.env[k]]));
const docker = args => execFileSync("docker", ["--context", "desktop-linux", ...args], {
  cwd: root, env, windowsHide: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
});
const socketPath = "//./pipe/dockerDesktopLinuxEngine";
function api(method, target, body, raw = false) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const req = http.request({ socketPath, path: "/v1.51" + target, method,
      headers: data ? { "Content-Type": Buffer.isBuffer(body) ? "application/x-tar" : "application/json", "Content-Length": data.length } : {} }, res => {
      const chunks = [];
      res.on("data", b => chunks.push(b));
      res.on("end", () => {
        const b = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) { const e = Error("engine-http-" + res.statusCode); e.status = res.statusCode; reject(e); return; }
        try { resolve(raw ? b : b.length ? JSON.parse(b.toString("utf8")) : null); } catch { reject(Error("engine-response")); }
      });
    });
    req.setTimeout(30000, () => req.destroy(Error("engine-timeout")));
    req.on("error", () => reject(Error("engine-transport")));
    req.end(data);
  });
}
const getContainer = id => {
  if (!/^[a-f0-9]{64}$/u.test(id)) fail("container-id");
  return api("GET", "/containers/" + id + "/json");
};
function identity(labels) {
  if (labels?.["com.supabase.cli.project"] !== project || labels?.["com.supabase.cli.workdir"] !== root) fail("resource-identity");
}
function noLink(relative, directory = false) {
  const absolute = path.join(root, relative);
  let current = root;
  for (const component of relative.split("/")) {
    current = path.join(current, component);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || fs.realpathSync(current) !== current) fail("workspace-link");
  }
  const s = fs.statSync(absolute);
  if (directory ? !s.isDirectory() : !s.isFile() || s.nlink !== 1) fail("workspace-file");
  return absolute;
}
const f1Hash = "0cb62755212516263f77c6d42faf9183af0c3fdd339fa82cffcc21763314bca4";
async function preflight(renamed = false) {
  if (sha(fs.readFileSync(path.join(root, "scripts/release-guards/clean-local.mjs"))) !== f1Hash) fail("f1-changed");
  const profile = read(".tmp/f2/local-profile.json");
  validateCleanLocal({ workspace: root, expectedWorkspace: root,
    configText: fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8"), values: profile.values, ambient: {} });
  const receipt = read(".tmp/f2/resources-created.json"), before = read(".tmp/f2-r/before.json");
  if (before.baseline !== "548a729a33b80fa7dfb8681855cd1e2a71c5174b" || receipt.workspace !== root ||
      receipt.project !== project || before.containers.length !== 10 || new Set(before.containers.map(c => c.Id)).size !== 10) fail("receipt");
  const context = JSON.parse(docker(["context", "inspect", "desktop-linux"]))[0];
  if (context.Endpoints?.docker?.Host !== "npipe:////./pipe/dockerDesktopLinuxEngine") fail("docker-endpoint");
  const n = (await api("GET", "/networks/" + receipt.networkId));
  identity(n.Labels);
  if (n.Name !== network || n.Driver !== "bridge" || n.Options?.["com.docker.network.bridge.host_binding_ipv4"] !== "127.0.0.1") fail("network");
  for (const name of receipt.volumes) {
    const v = await api("GET", "/volumes/" + name); identity(v.Labels);
    if (v.Driver !== "local" || Object.keys(v.Options ?? {}).length) fail("volume");
  }
  const originals = [];
  for (const source of before.containers) {
    const c = await getContainer(source.Id); identity(c.Config.Labels);
    const expectedNames = renamed === "partial" ? [source.Name, source.Name + "_f2r_original"] :
      [renamed ? source.Name + "_f2r_original" : source.Name];
    if (!expectedNames.includes(c.Name) || c.State.Running || c.HostConfig.RestartPolicy.Name !== "no") fail("original-not-parked");
    // Planning always uses the original canonical service name, never arbitrary names.
    originals.push({ ...c, ActualName: c.Name, Name: source.Name });
  }
  const templatePath = noLink("supabase/templates/confirmation.html");
  const snippetsPath = noLink("supabase/snippets", true);
  if (fs.readdirSync(snippetsPath).length) fail("snippets-not-empty");
  const snippetsDestination = before.containers.find(c => serviceType(c.Name) === "studio").Mounts[0].Destination;
  if (snippetsDestination !== "/Documents/destrava-worktrees/destrava-release-clean/supabase/snippets") fail("snippets-destination");
  const options = { workspace: root, networkId: n.Id, snippetsDestination };
  const plans = originals.map(c => ({ original: c, body: repairCreateBody(c, options) }));
  return { before, n, receipt, context, plans, options, templatePath, templateHash: sha(fs.readFileSync(templatePath)) };
}
function verifyMigrationsHeld() {
  const canonical = path.join(root, "supabase/migrations");
  if (fs.readdirSync(canonical).some(n => n.endsWith(".sql"))) fail("project-sql-available");
  const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");
  for (const section of ["db.migrations", "db.seed"]) {
    const block = config.split("[" + section + "]")[1]?.split(/\r?\n\[/u)[0];
    if (!block || !/^enabled\s*=\s*false\s*$/mu.test(block)) fail("automatic-sql-enabled");
  }
}
async function createVolume(name) {
  try { await api("GET", "/volumes/" + name); fail("new-volume-exists"); } catch (e) { if (e.status !== 404) throw e; }
  const volume = await api("POST", "/volumes/create", { Name: name, Driver: "local", Labels: {
    "com.supabase.cli.project": project, "com.supabase.cli.workdir": root } });
  identity(volume.Labels);
  if (volume.Name !== name || volume.Driver !== "local") fail("new-volume");
}
async function archiveCopy(source, destination, from, to) {
  const data = await api("GET", `/containers/${source}/archive?path=${encodeURIComponent(from)}`, undefined, true);
  await api("PUT", `/containers/${destination}/archive?path=${encodeURIComponent(to)}&noOverwriteDirNonDir=1&copyUIDGID=1`, data);
  return { from, to, archiveSha256: sha(data), size: data.length };
}
function preparedEntries(p) {
  return p.plans.map(({ original: o, body }) => ({ original: o, body, entry: {
    type: serviceType(o.Name), oldId: o.Id, oldName: o.Name, archivedName: o.Name + "_f2r_original", image: o.Image,
    envHash: digest(o.Config.Env), cmdHash: digest(o.Config.Cmd), entrypointHash: digest(o.Config.Entrypoint),
    healthHash: digest(o.Config.Healthcheck), user: o.Config.User, workingDir: o.Config.WorkingDir,
    aliasesHash: digest(body.NetworkingConfig.EndpointsConfig[network].Aliases), createBodyHash: digest(body),
    mounts: body.HostConfig.Mounts.map(m => ({ Type: "volume", Name: m.Source, Destination: m.Target, RW: !m.ReadOnly })), copies: [] },
  }));
}
async function finishPreparation(p, state) {
  // Compute ALL hashes before any rename/create; absent healthchecks are valid metadata.
  const prepared = preparedEntries(p);
  for (const { original: o, body, entry: planned } of prepared) {
    if (sha(fs.readFileSync(p.templatePath)) !== p.templateHash) fail("template-changed");
    const existing = state.entries.find(e => e.oldId === o.Id);
    if (existing) {
      const { newId, ...base } = existing;
      if (digest(base) !== digest(planned)) fail("partial-entry-drift");
      validateRepairContainer(await getContainer(newId), existing, { ...p.options, live: false });
      continue;
    }
    state.entries.push(planned); save("repair-state.json", state);
    if (o.ActualName === o.Name) await api("POST", "/containers/" + o.Id + "/rename?name=" + encodeURIComponent(o.Name.slice(1) + "_f2r_original"));
    else if (o.ActualName !== planned.archivedName) fail("partial-original-name");
    const made = await api("POST", "/containers/create?name=" + encodeURIComponent(o.Name.slice(1)), body);
    planned.newId = made.Id; save("repair-state.json", state);
    const paths = planned.type === "kong" ? [["/home/kong/kong.yml", "/home/kong"], ["/home/kong/localhost.crt", "/home/kong"], ["/home/kong/localhost.key", "/home/kong"]] :
      planned.type === "edge_runtime" ? [["/root/index.ts", "/root"]] : planned.type === "db" ? [["/etc/postgresql", "/etc"], ["/etc/postgresql-custom", "/etc"]] : [];
    for (const [from, to] of paths) { planned.copies.push(await archiveCopy(o.Id, made.Id, from, to)); save("repair-state.json", state); }
  }
  state.phase = "created-not-started"; save("repair-state.json", state);
  await inspect(false);
  console.log(JSON.stringify({ phase: state.phase, replacements: state.entries.length, originalsRetained: 10, servicesStarted: 0 }));
}
async function prepare() {
  if (fs.existsSync(path.join(dir, "repair-state.json"))) fail("repair-already-prepared");
  const p = await preflight();
  const frozen = read(".tmp/f2-r/plan.json");
  if (frozen.templateHash !== p.templateHash || digest(frozen.entries) !== digest(planEntries(p.plans)) ||
      digest(frozen.candidateHashes) !== digest(candidateHashes())) fail("frozen-plan-drift");
  preparedEntries(p);
  const state = { at: new Date().toISOString(), networkId: p.n.Id, workspace: root, templateHash: p.templateHash,
    candidateHashes: frozen.candidateHashes, helpers: [], entries: [], phase: "preparing" };
  save("repair-state.json", state);
  await createVolume(TEMPLATE_VOLUME); await createVolume(SNIPPETS_VOLUME);
  const kong = p.plans.find(x => serviceType(x.original.Name) === "kong").original;
  const command = "test -s /check/PG_VERSION && test -s /check/global/pg_control && test \"$(cat /check/PG_VERSION)\" = 17 && test -z \"$(ls -A /snippets)\" && chmod 0555 /out && chmod 0444 /out/confirmation.html && sha256sum /out/confirmation.html && stat -c '%a %u %g' /out/confirmation.html";
  const helperOptions = { workspace: root, image: kong.Image, command };
  const helper = await api("POST", "/containers/create?name=supabase_f2r_check_" + project, {
    Image: kong.Image, User: "0", Entrypoint: ["/bin/sh"], Cmd: ["-ec", command],
    Labels: { "com.supabase.cli.project": project, "com.supabase.cli.workdir": root },
    HostConfig: { NetworkMode: "none", RestartPolicy: { Name: "no" }, Mounts: [
      { Type: "volume", Source: TEMPLATE_VOLUME, Target: "/out", ReadOnly: false },
      { Type: "volume", Source: "supabase_db_" + project, Target: "/check", ReadOnly: true },
      { Type: "volume", Source: SNIPPETS_VOLUME, Target: "/snippets", ReadOnly: true, VolumeOptions: { NoCopy: true } },
    ] },
  });
  state.helpers.push(helper.Id); save("repair-state.json", state);
  validateRepairHelper(await getContainer(helper.Id), helperOptions);
  // Copies only this new workspace's non-symlink template; never credentials.
  docker(["cp", p.templatePath, helper.Id + ":/out/confirmation.html"]);
  validateRepairHelper(await getContainer(helper.Id), helperOptions);
  if (sha(fs.readFileSync(p.templatePath)) !== p.templateHash) fail("template-changed");
  await api("POST", "/containers/" + helper.Id + "/start");
  const waited = await api("POST", "/containers/" + helper.Id + "/wait?condition=not-running");
  if (waited.StatusCode !== 0) fail("helper-cluster-template");
  const h = await getContainer(helper.Id);
  const logs = await api("GET", "/containers/" + helper.Id + "/logs?stdout=1&stderr=1", undefined, true);
  if (!logs.includes(Buffer.from(p.templateHash)) || !logs.includes(Buffer.from("444 ")) || h.State.Running ||
      h.Mounts.find(m => m.Destination === "/check")?.RW !== false) fail("template-hash");
  save("cluster-template-check.json", { helperId: helper.Id, networkMode: h.HostConfig.NetworkMode, exited: h.State.ExitCode,
    databaseMountedReadOnly: h.Mounts.find(m => m.Destination === "/check")?.RW === false,
    initializedCluster: true, postgresMajor: 17, snippetsEmpty: true,
    templateHash: p.templateHash, fileMode: "444", directoryMode: "555" });
  await finishPreparation(p, state);
}
async function resumePreparation() {
  const state = read(".tmp/f2-r/repair-state.json"), prior = read(".tmp/f2-r/partial-c3.json");
  if (digest(state) !== digest(prior) || state.phase !== "preparing" || state.entries.length !== 2 || state.helpers.length !== 1 ||
      state.entries.map(e => e.type).join() !== "studio,pg_meta") fail("partial-receipt");
  const p = await preflight("partial"), frozen = read(".tmp/f2-r/plan.json");
  if (digest(frozen.candidateHashes) !== digest(candidateHashes()) || frozen.templateHash !== p.templateHash ||
      digest(frozen.entries) !== digest(planEntries(p.plans))) fail("frozen-plan-drift");
  const prepared = preparedEntries(p), reconciled = [];
  for (const { original: o, entry } of prepared) {
    const existing = state.entries.find(e => e.oldId === o.Id);
    if (existing) {
      const { newId, ...base } = existing;
      if (digest(base) !== digest(entry) || o.ActualName !== entry.archivedName) fail("partial-existing");
      validateRepairContainer(await getContainer(newId), existing, p.options);
    } else if (o.ActualName === entry.archivedName) {
      // C3 renamed edge before failing to hash its missing healthcheck. Accept
      // exactly that observed gap, with no canonical replacement to adopt.
      if (entry.type !== "edge_runtime") fail("partial-untracked-rename");
      try { await api("GET", "/containers/" + encodeURIComponent(o.Name.slice(1)) + "/json"); fail("partial-untracked-clone"); }
      catch (e) { if (e.status !== 404) throw e; }
    } else if (o.ActualName !== o.Name) fail("partial-original-name");
    reconciled.push({ oldId: o.Id, actualName: o.ActualName, newId: existing?.newId ?? null, running: o.State.Running });
  }
  const helper = await getContainer(state.helpers[0]), check = read(".tmp/f2-r/cluster-template-check.json");
  const kong = p.plans.find(x => serviceType(x.original.Name) === "kong").original;
  const command = "test -s /check/PG_VERSION && test -s /check/global/pg_control && test \"$(cat /check/PG_VERSION)\" = 17 && test -z \"$(ls -A /snippets)\" && chmod 0555 /out && chmod 0444 /out/confirmation.html && sha256sum /out/confirmation.html && stat -c '%a %u %g' /out/confirmation.html";
  validateRepairHelper(helper, { workspace: root, image: kong.Image, command });
  if (helper.State.ExitCode !== 0 || check.helperId !== helper.Id || check.templateHash !== p.templateHash || !check.snippetsEmpty) fail("partial-helper");
  for (const name of [TEMPLATE_VOLUME, SNIPPETS_VOLUME]) { const v = await api("GET", "/volumes/" + name); identity(v.Labels); if (v.Driver !== "local" || Object.keys(v.Options ?? {}).length) fail("partial-volume"); }
  save("reconcile-c3.json", { at: new Date().toISOString(), originals: reconciled, retainedHelpers: state.helpers, priorStateHash: digest(prior), candidateHashes: frozen.candidateHashes });
  state.candidateHashes = frozen.candidateHashes; save("repair-state.json", state);
  await finishPreparation(p, state);
}
async function inspect(live) {
  const p = await preflight(true), state = read(".tmp/f2-r/repair-state.json");
  if (digest(state.candidateHashes) !== digest(candidateHashes()) || state.templateHash !== p.templateHash) fail("candidate-drift");
  const containers = await Promise.all(state.entries.map(e => getContainer(e.newId)));
  const result = validateRepairContainers(containers, state.entries, { workspace: root, networkId: p.n.Id, live });
  const sanitize = c => ({ Id: c.Id, Name: c.Name, Image: c.Image, State: c.State, Config: { Labels: c.Config.Labels },
    HostConfig: c.HostConfig, Mounts: c.Mounts, NetworkSettings: c.NetworkSettings });
  const dbKong = containers.filter(c => ["db", "kong"].includes(serviceType(c.Name)));
  const used = [...new Set(dbKong.flatMap(c => c.Mounts.map(m => m.Name)))];
  const volumes = await Promise.all(used.map(n => api("GET", "/volumes/" + n)));
  const snap = { context: p.context, containers: dbKong.map(sanitize), volumes, networks: [p.n] };
  // Created containers do not yet have live port mappings; F1 runs on live truth only.
  const f1 = live ? validateCleanDocker(snap, { workspace: root }) : { pending: "live-port-metadata" };
  save(live ? "live.json" : "created.json", { at: new Date().toISOString(), result, f1, containers: containers.map(sanitize), originalStates: p.plans.map(x => ({ Id: x.original.Id, running: x.original.State.Running })), network: p.n, volumes });
  if (live) save("f1-live-snapshot.json", snap);
  return containers;
}
async function stop() {
  const state = read(".tmp/f2-r/repair-state.json");
  const out = [], errors = [];
  for (const e of [...state.entries].reverse()) {
    if (!e.newId) continue;
    try {
      let c = await getContainer(e.newId); identity(c.Config.Labels);
      if (c.Name !== e.oldName) fail("stop-identity");
      if (c.State.Running) await api("POST", "/containers/" + c.Id + "/stop?t=10");
      c = await getContainer(c.Id); out.push({ id: c.Id, name: c.Name, running: c.State.Running, status: c.State.Status });
      if (c.State.Running) errors.push(e.newId);
    } catch { errors.push(e.newId); }
  }
  save("after-stop.json", { containers: out, errors });
  console.log(JSON.stringify({ stoppedNewOnly: out.length, running: out.filter(x => x.running).length, volumesRetained: true }));
  if (errors.length) fail("containment-incomplete");
}
async function startVerify() {
  await inspect(false);
  const state = read(".tmp/f2-r/repair-state.json"), originals = read(".tmp/f2/preflight.json").migrations;
  if (originals.length !== 20) fail("migration-count");
  const hold = path.join(dir, "migrations-hold");
  if (fs.existsSync(hold)) fail("hold-exists");
  fs.mkdirSync(hold);
  const moves = originals.map(m => ({ ...m, from: path.join(root, "supabase/migrations", m.name), to: path.join(hold, m.name) }));
  if (moves.some(m => !/^\d{14}_[a-z0-9_]+\.sql$/u.test(m.name) || sha(fs.readFileSync(m.from)) !== m.sha256)) fail("migration-hash");
  const moved = [];
  let problem;
  try {
    for (const m of moves) { fs.renameSync(m.from, m.to); moved.push(m); }
    verifyMigrationsHeld();
    save("start-safety.json", { at: new Date().toISOString(), twentySqlPhysicallyUnavailable: true, seedEnabled: false, migrationsEnabled: false,
      supabaseCliStartInvoked: false, launch: "Docker Engine start by approved replacement IDs only", entries: state.entries.map(e => ({ oldId: e.oldId, newId: e.newId, type: e.type })) });
    const order = ["db", "inbucket", "auth", "rest", "realtime", "storage", "edge_runtime", "pg_meta", "kong", "studio"];
    for (const type of order) {
      verifyMigrationsHeld();
      const original = await getContainer(state.entries.find(e => e.type === type).oldId);
      if (original.State.Running) fail("original-running");
      await api("POST", "/containers/" + state.entries.find(e => e.type === type).newId + "/start");
    }
    await inspect(true);
  } catch (e) { problem = e; }
  finally {
    const restorationErrors = [];
    for (const m of moved) {
      try {
        if (fs.existsSync(m.from) || sha(fs.readFileSync(m.to)) !== m.sha256) fail("migration-restore");
        fs.renameSync(m.to, m.from);
      } catch { restorationErrors.push(m.name); }
    }
    if (restorationErrors.length) problem = Error("migration-restore");
    if (problem) await stop();
    save("sql-restored.json", { restored: moved.length - restorationErrors.length, restorationErrors,
      allHashesMatch: moves.every(m => fs.existsSync(m.from) && sha(fs.readFileSync(m.from)) === m.sha256) });
  }
  if (problem) throw problem;
  console.log(JSON.stringify({ liveIsolationVerified: true, f1: "PASS", services: 10,
    sqlClientInvoked: false, projectMigrationsInvoked: false }));
}
try {
  const action = process.argv[2];
  if (action === "plan") {
    const p = await preflight(fs.existsSync(path.join(dir, "repair-state.json")) ? "partial" : false);
    save("plan.json", { at: new Date().toISOString(), templateHash: p.templateHash,
      entries: planEntries(p.plans), candidateHashes: candidateHashes() });
    console.log(JSON.stringify({ plan: "prepared", services: 10, noServicesStarted: true }));
  } else if (action === "prepare") await prepare();
  else if (action === "resume-prepare") await resumePreparation();
  else if (action === "start-verify") await startVerify();
  else if (action === "inspect") { await inspect(true); console.log("Live isolation PASS"); }
  else if (action === "stop") await stop();
  else fail("unsupported-action");
} catch (e) {
  if (process.argv[2] === "start-verify") {
    try { await stop(); } catch { console.error("F2-R containment needs inspection of approved new IDs; no fallback started."); }
  }
  // Never log request/response objects, Env, API bodies, archives, or CLI secrets.
  console.error("F2-R stopped:", /^[A-Za-z0-9 ()_;.:-]+$/u.test(e.message) ? e.message : "operation-failed-input-suppressed");
  process.exitCode = 1;
}
