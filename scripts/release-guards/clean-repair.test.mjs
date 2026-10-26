import test from "node:test";
import assert from "node:assert/strict";
import { digest, REPAIR_PROJECT as project, REPAIR_NETWORK as network, SERVICE_PORTS,
  TEMPLATE_VOLUME, SNIPPETS_VOLUME, TEMPLATE_DEST, repairCreateBody, validateRepairContainers, validateRepairHelper } from "./clean-repair.mjs";

// Synthetic metadata only. These tests do not contact Docker or a database.
const workspace = "D:\\Release\\destrava-release-clean", networkId = "1".repeat(64);
const snippetsDestination = "/Documents/destrava-worktrees/destrava-release-clean/supabase/snippets";
const opts = { workspace, networkId, snippetsDestination };
function fixture() {
  const manifest = [], original = [], containers = [];
  Object.keys(SERVICE_PORTS).forEach((type, i) => {
    const c = {
      Id: (i + 10).toString(16).padStart(64, "0"), Name: `/supabase_${type}_${project}`, Image: "sha256:" + "2".repeat(64),
      State: { Running: false, Status: "created" }, Config: { Labels: { "com.supabase.cli.project": project, "com.supabase.cli.workdir": workspace },
        Env: ["LOCAL_ONLY=1"], Cmd: ["local-service"], Entrypoint: null, Healthcheck: { Test: ["NONE"] }, User: "", WorkingDir: "/" },
      HostConfig: { NetworkMode: network, RestartPolicy: { Name: "no" },
        PortBindings: Object.fromEntries(Object.entries(SERVICE_PORTS[type]).map(([k, HostPort]) => [k, [{ HostIp: "", HostPort }]])) },
      NetworkSettings: { Networks: { [network]: { NetworkID: networkId, Aliases: [type] } } }, Mounts: [],
    };
    if (type === "db") c.Mounts = [{ Type: "volume", Name: "supabase_db_" + project, Destination: "/var/lib/postgresql/data", RW: true }];
    if (type === "storage") c.Mounts = [{ Type: "volume", Name: "supabase_storage_" + project, Destination: "/mnt", RW: true }];
    if (type === "kong") c.Mounts = [{ Type: "bind", Source: workspace + "\\supabase\\templates\\confirmation.html", Destination: TEMPLATE_DEST + "/confirmation.html", RW: true }];
    if (type === "studio") c.Mounts = [{ Type: "bind", Source: workspace + "\\supabase\\snippets", Destination: snippetsDestination, RW: true }];
    original.push(c);
    const b = repairCreateBody(c, opts), id = (i + 100).toString(16).padStart(64, "0");
    const mounts = b.HostConfig.Mounts.map(m => ({ Type: "volume", Name: m.Source, Destination: m.Target, RW: !m.ReadOnly }));
    manifest.push({ type, oldId: c.Id, newId: id, image: c.Image, envHash: digest(c.Config.Env), cmdHash: digest(c.Config.Cmd),
      entrypointHash: digest(c.Config.Entrypoint), healthHash: digest(c.Config.Healthcheck), user: c.Config.User,
      workingDir: c.Config.WorkingDir, aliasesHash: digest(c.NetworkSettings.Networks[network].Aliases), mounts: structuredClone(mounts) });
    containers.push({ ...structuredClone(c), Id: id, Mounts: mounts, HostConfig: { ...b.HostConfig, Binds: null },
      NetworkSettings: { ...structuredClone(c.NetworkSettings), Ports: structuredClone(b.HostConfig.PortBindings) } });
  });
  return { original, containers, manifest };
}
test("synthetic plan preserves sources and removes all host binds", () => {
  const f = fixture(), before = structuredClone(f.original);
  for (const source of f.original) {
    const b = repairCreateBody(source, opts);
    assert.deepEqual(b.Env, source.Config.Env);
    assert.deepEqual(b.Cmd, source.Config.Cmd);
    assert.equal(b.Image, source.Image);
    assert.ok(b.HostConfig.Mounts.every(m => m.Type === "volume"));
    assert.equal(b.HostConfig.RestartPolicy.Name, "no");
  }
  assert.deepEqual(f.original, before);
  assert.equal(validateRepairContainers(f.containers, f.manifest, opts).ok, true);
  const kong = f.containers.find(c => c.Name.includes("_kong_"));
  assert.deepEqual(kong.Mounts, [{ Type: "volume", Name: TEMPLATE_VOLUME, Destination: TEMPLATE_DEST, RW: false }]);
});
test("synthetic live metadata needs actual running state and exact live loopback bindings", () => {
  const f = fixture();
  assert.throws(() => validateRepairContainers(f.containers, f.manifest, { ...opts, live: true }));
  f.containers.forEach(c => { c.State.Running = true; });
  assert.equal(validateRepairContainers(f.containers, f.manifest, { ...opts, live: true }).ok, true);
});
test("digest handles absent metadata without conflating defined values", () => {
  assert.equal(new Set([undefined, null, [], {}, "undefined", ""].map(digest)).size, 6);
  assert.equal(digest(undefined), digest(undefined));
  const f = fixture();
  delete f.original[0].Config.Healthcheck;
  assert.equal(Object.hasOwn(repairCreateBody(f.original[0], opts), "Healthcheck"), false);
  delete f.containers[0].Config.Healthcheck;
  f.manifest[0].healthHash = digest(undefined);
  assert.equal(validateRepairContainers(f.containers, f.manifest, opts).ok, true);
});
test("empty NetworkID is observed only before a created endpoint attaches; never operational proof", () => {
  const f = fixture();
  f.containers.forEach(c => { c.NetworkSettings.Networks[network].NetworkID = ""; });
  assert.equal(validateRepairContainers(f.containers, f.manifest, opts).ok, true);
  for (const status of ["exited", "running", undefined]) {
    const changed = structuredClone(f); changed.containers[0].State.Status = status;
    assert.throws(() => validateRepairContainers(changed.containers, changed.manifest, opts));
  }
  for (const id of [undefined, null, " ", "other"]) {
    const changed = structuredClone(f); changed.containers[0].NetworkSettings.Networks[network].NetworkID = id;
    assert.throws(() => validateRepairContainers(changed.containers, changed.manifest, opts));
  }
  f.containers.forEach(c => { c.State.Running = true; });
  assert.throws(() => validateRepairContainers(f.containers, f.manifest, { ...opts, live: true }));
});
const bad = [
  ["wildcard IPv4", f => { f.containers[0].HostConfig.PortBindings["5432/tcp"][0].HostIp = "0.0.0.0"; }],
  ["wildcard IPv6", f => { f.containers[0].HostConfig.PortBindings["5432/tcp"][0].HostIp = "::"; }],
  ["empty HostIp", f => { f.containers[0].HostConfig.PortBindings["5432/tcp"][0].HostIp = ""; }],
  ["LAN binding", f => { f.containers[0].HostConfig.PortBindings["5432/tcp"][0].HostIp = "192.168.0.1"; }],
  ["mapped IPv4", f => { f.containers[0].HostConfig.PortBindings["5432/tcp"][0].HostIp = "::ffff:127.0.0.1"; }],
  ["wrong port", f => { f.containers[0].HostConfig.PortBindings["5432/tcp"][0].HostPort = "54322"; }],
  ["extra port", f => { f.containers[0].HostConfig.PortBindings["9999/tcp"] = [{ HostIp: "127.0.0.1", HostPort: "9999" }]; }],
  ["missing binding", f => { delete f.containers[0].HostConfig.PortBindings["5432/tcp"]; }],
  ["second IPv6 binding", f => { f.containers[0].HostConfig.PortBindings["5432/tcp"].push({ HostIp: "::", HostPort: "55422" }); }],
  ["one service missing", f => { f.containers.pop(); }],
  ["duplicate ID", f => { f.containers[0].Id = f.containers[1].Id; }],
  ["duplicate original ID", f => { f.manifest[0].oldId = f.manifest[1].oldId; }],
  ["original overlaps another replacement", f => { f.manifest[0].oldId = f.containers[1].Id; }],
  ["unknown service", f => { f.containers[0].Name = "/supabase_extra_" + project; }],
  ["wrong workspace", f => { f.containers[0].Config.Labels["com.supabase.cli.workdir"] += "-other"; }],
  ["old project", f => { f.containers[0].Config.Labels["com.supabase.cli.project"] = "espanhol-plataform"; }],
  ["different concrete network", f => { f.containers[0].NetworkSettings.Networks[network].NetworkID = "f".repeat(64); }],
  ["extra network", f => { f.containers[0].NetworkSettings.Networks.other = {}; }],
  ["changed aliases", f => { f.containers[0].NetworkSettings.Networks[network].Aliases.push("old-db"); }],
  ["privileged", f => { f.containers[0].HostConfig.Privileged = true; }],
  ["publish all", f => { f.containers[0].HostConfig.PublishAllPorts = true; }],
  ["auto restart", f => { f.containers[0].HostConfig.RestartPolicy.Name = "always"; }],
  ["different image", f => { f.containers[0].Image = "sha256:" + "f".repeat(64); }],
  ["changed Env", f => { f.containers[0].Config.Env.push("SURPRISE=1"); }],
  ["changed command", f => { f.containers[0].Config.Cmd.push("migrate"); }],
  ["Kong generic bind", f => { f.containers[1].Mounts[0].Type = "bind"; }],
  ["Kong RW", f => { f.containers[1].Mounts[0].RW = true; f.manifest[1].mounts[0].RW = true; }],
  ["Kong wrong destination", f => { f.containers[1].Mounts[0].Destination = "/"; f.manifest[1].mounts[0].Destination = "/"; }],
  ["HostConfig hidden bind", f => { f.containers[0].HostConfig.Binds = ["/host:/data"]; }],
  ...["CapAdd", "CapDrop", "Devices", "DeviceRequests", "VolumesFrom", "Links", "ExtraHosts", "SecurityOpt", "Dns"]
    .map(key => ["unsafe host " + key, f => { f.containers[0].HostConfig[key] = ["unexpected"]; }]),
  ...["PidMode", "IpcMode", "UTSMode", "UsernsMode"].map(key => ["unsafe namespace " + key,
    f => { f.containers[0].HostConfig[key] = "host"; }]),
  ["unapproved rootfs mode", f => { f.containers[0].HostConfig.ReadonlyRootfs = true; }],
];
for (const [name, mutate] of bad) test("synthetic negative: " + name, () => {
  const f = fixture(); mutate(f);
  assert.throws(() => validateRepairContainers(f.containers, f.manifest, opts));
});
test("source must be stopped, safe and on the recorded network", () => {
  for (const mutate of [c => { c.State.Running = true; }, c => { c.HostConfig.Privileged = true; },
    c => { c.HostConfig.RestartPolicy.Name = "always"; }, c => { c.NetworkSettings.Networks[network].NetworkID = "other"; },
    c => { c.Mounts.push({ Type: "bind", Source: "/outside", Destination: "/outside" }); }]) {
    const c = fixture().original[0]; mutate(c);
    assert.throws(() => repairCreateBody(c, opts));
  }
});
test("source Kong cannot be rebound from an external or traversing template", () => {
  for (const source of ["C:\\outside\\confirmation.html", workspace + "\\supabase\\templates\\..\\other.html"]) {
    const c = fixture().original[1]; c.Mounts[0].Source = source;
    assert.throws(() => repairCreateBody(c, opts));
  }
});
test("helper is created stopped with exact command, isolated network and read-only DB", () => {
  const image = "sha256:" + "a".repeat(64), command = "check-only";
  const source = { Id: "c".repeat(64), State: { Running: false }, Image: image,
    Config: { Labels: { "com.supabase.cli.project": project, "com.supabase.cli.workdir": workspace },
      User: "0", Entrypoint: ["/bin/sh"], Cmd: ["-ec", command] },
    HostConfig: { NetworkMode: "none", RestartPolicy: { Name: "no" } },
    NetworkSettings: { Networks: { none: {} } }, Mounts: [
      { Type: "volume", Name: "supabase_db_" + project, Destination: "/check", RW: false },
      { Type: "volume", Name: TEMPLATE_VOLUME, Destination: "/out", RW: true },
      { Type: "volume", Name: SNIPPETS_VOLUME, Destination: "/snippets", RW: false },
    ] };
  const options = { workspace, image, command };
  assert.equal(validateRepairHelper(source, options).ok, true);
  for (const mutate of [c => { c.Mounts[0].RW = true; }, c => { c.State.Running = true; },
    c => { c.HostConfig.NetworkMode = "host"; }, c => { c.HostConfig.PortBindings = { "123/tcp": [] }; },
    c => { c.Config.Cmd = ["migrate"]; }, c => { c.Mounts.push({ Type: "bind", Destination: "/external" }); }]) {
    const c = structuredClone(source); mutate(c); assert.throws(() => validateRepairHelper(c, options));
  }
});
