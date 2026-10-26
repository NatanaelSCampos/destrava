// F2-R only: strengthen the observed F1 contract; never relax clean-local.mjs.
import crypto from "node:crypto";
import { canonicalCleanWorkspace } from "./clean-local.mjs";

export const REPAIR_PROJECT = "destrava-release-clean";
export const REPAIR_NETWORK = "supabase_network_" + REPAIR_PROJECT;
export const TEMPLATE_VOLUME = "supabase_email_templates_" + REPAIR_PROJECT;
export const SNIPPETS_VOLUME = "supabase_snippets_" + REPAIR_PROJECT;
export const TEMPLATE_DEST = "/home/kong/templates/email";
export const SERVICE_PORTS = Object.freeze({
  db: { "5432/tcp": "55422" }, kong: { "8000/tcp": "55421" },
  studio: { "3000/tcp": "55423" },
  inbucket: { "1025/tcp": "55425", "1110/tcp": "55426", "8025/tcp": "55424" },
  auth: {}, rest: {}, realtime: {}, storage: {}, edge_runtime: {}, pg_meta: {},
});
export const digest = value => crypto.createHash("sha256").update(JSON.stringify(value) ?? "undefined").digest("hex");
const fail = code => { throw new Error(`Clean repair rejected (${code}); input suppressed.`); };
function safeHost(host) {
  if (host.Privileged || host.PublishAllPorts || host.AutoRemove || host.VolumesFrom?.length ||
      host.Links?.length || host.ExtraHosts?.length || host.Devices?.length || host.DeviceRequests?.length ||
      host.CapAdd?.length || host.CapDrop?.length || host.ReadonlyRootfs || host.SecurityOpt?.length || host.PidMode || host.UTSMode || host.UsernsMode ||
      host.Dns?.length || ![undefined, "", "private"].includes(host.IpcMode)) fail("unsafe-host");
}
export function serviceType(name) {
  return Object.keys(SERVICE_PORTS).find(t => name === "/supabase_" + t + "_" + REPAIR_PROJECT);
}
function identity(c, workspace) {
  if (c.Config?.Labels?.["com.supabase.cli.project"] !== REPAIR_PROJECT ||
      c.Config.Labels["com.supabase.cli.workdir"] !== workspace ||
      !/^[a-f0-9]{64}$/u.test(c.Id)) fail("identity");
}
function ports(bindings, type, live = false) {
  const required = SERVICE_PORTS[type];
  if (!bindings || typeof bindings !== "object") fail("ports");
  const used = [];
  for (const [port, list] of Object.entries(bindings)) {
    if (live && list === null) continue;
    if (!Object.hasOwn(required, port) || !Array.isArray(list) || list.length !== 1 ||
        list[0].HostIp !== "127.0.0.1" || list[0].HostPort !== required[port]) fail("ports");
    used.push(port);
  }
  if (used.length !== Object.keys(required).length) fail("ports");
}
export function repairCreateBody(original, { workspace, networkId, snippetsDestination }) {
  canonicalCleanWorkspace(workspace);
  identity(original, workspace);
  const type = serviceType(original.Name);
  safeHost(original.HostConfig);
  if (!type || original.State.Running || original.HostConfig.RestartPolicy?.Name !== "no" ||
      original.HostConfig.Privileged || original.HostConfig.PublishAllPorts ||
      original.HostConfig.AutoRemove || original.HostConfig.VolumesFrom?.length ||
      original.HostConfig.Links?.length || original.HostConfig.ExtraHosts?.length ||
      original.HostConfig.Devices?.length || original.HostConfig.DeviceRequests?.length ||
      original.HostConfig.CapAdd?.length) fail("source-mode");
  const network = original.NetworkSettings?.Networks;
  if (Object.keys(network ?? {}).length !== 1 || network[REPAIR_NETWORK]?.NetworkID !== networkId ||
      original.HostConfig.NetworkMode !== REPAIR_NETWORK) fail("source-network");
  if (Object.keys(original.HostConfig.PortBindings ?? {}).sort().join() !==
      Object.keys(SERVICE_PORTS[type]).sort().join()) fail("source-ports");
  if (!/^sha256:[a-f0-9]{64}$/u.test(original.Image)) fail("source-image");
  const mounts = [];
  for (const mount of original.Mounts) {
    if (type === "kong" && mount.Type === "bind" &&
        mount.Source === workspace + "\\supabase\\templates\\confirmation.html" &&
        mount.Destination === TEMPLATE_DEST + "/confirmation.html") {
      mounts.push({ Type: "volume", Source: TEMPLATE_VOLUME, Target: TEMPLATE_DEST, ReadOnly: true });
    } else if (type === "studio" && mount.Type === "bind" &&
        mount.Source === workspace + "\\supabase\\snippets" && mount.Destination === snippetsDestination) {
      mounts.push({ Type: "volume", Source: SNIPPETS_VOLUME, Target: mount.Destination, ReadOnly: false,
        VolumeOptions: { NoCopy: true } });
    } else if (mount.Type === "volume" &&
        ((type === "db" && mount.Name === "supabase_db_" + REPAIR_PROJECT && mount.Destination === "/var/lib/postgresql/data") ||
         (type === "storage" && mount.Name === "supabase_storage_" + REPAIR_PROJECT && mount.Destination === "/mnt"))) {
      mounts.push({ Type: "volume", Source: mount.Name, Target: mount.Destination, ReadOnly: false });
    } else fail("source-mount");
  }
  if (mounts.length !== (["kong", "studio", "db", "storage"].includes(type) ? 1 : 0)) fail("source-mount");
  const configKeys = ["User", "Env", "Cmd", "Entrypoint", "Healthcheck", "WorkingDir", "ExposedPorts", "Labels", "StopSignal"];
  const body = Object.fromEntries(configKeys.filter(k => original.Config[k] !== undefined).map(k => [k, structuredClone(original.Config[k])]));
  body.Image = original.Image;
  body.HostConfig = {
    NetworkMode: REPAIR_NETWORK, PortBindings: Object.fromEntries(Object.entries(SERVICE_PORTS[type])
      .map(([port, HostPort]) => [port, [{ HostIp: "127.0.0.1", HostPort }]])),
    Mounts: mounts, RestartPolicy: { Name: "no", MaximumRetryCount: 0 },
    PublishAllPorts: false, Privileged: false, AutoRemove: false,
    ShmSize: original.HostConfig.ShmSize, LogConfig: original.HostConfig.LogConfig,
    Ulimits: original.HostConfig.Ulimits,
  };
  body.NetworkingConfig = { EndpointsConfig: {
    [REPAIR_NETWORK]: { Aliases: structuredClone(network[REPAIR_NETWORK].Aliases ?? []) },
  } };
  return body;
}

export function validateRepairContainers(containers, manifest, { workspace, networkId, live = false }) {
  canonicalCleanWorkspace(workspace);
  if (containers.length !== 10 || manifest.length !== 10 ||
      new Set(containers.map(c => c.Id)).size !== 10 || new Set(manifest.map(m => m.type)).size !== 10 ||
      new Set(manifest.map(m => m.oldId)).size !== 10 ||
      manifest.some(m => !/^[a-f0-9]{64}$/u.test(m.oldId) || containers.some(c => c.Id === m.oldId))) fail("count");
  for (const c of containers) {
    validateRepairContainer(c, manifest.find(m => m.type === serviceType(c.Name)), { workspace, networkId, live });
  }
  return { ok: true, services: 10, loopbackOnly: true, live };
}

// A created container may have no allocated endpoint yet. Never fill this field:
// operational validation ALWAYS requires the concrete, inspected NetworkID.
export function validateRepairContainer(c, entry, { workspace, networkId, live = false }) {
    canonicalCleanWorkspace(workspace);
    if (!/^[a-f0-9]{64}$/u.test(networkId)) fail("network-id");
    identity(c, workspace);
    safeHost(c.HostConfig);
    const type = serviceType(c.Name);
    if (!entry || entry.type !== type || entry.newId !== c.Id || entry.image !== c.Image || entry.oldId === c.Id ||
        digest(c.Config.Env) !== entry.envHash || digest(c.Config.Cmd) !== entry.cmdHash ||
        digest(c.Config.Entrypoint) !== entry.entrypointHash || digest(c.Config.Healthcheck) !== entry.healthHash ||
        c.Config.User !== entry.user || c.Config.WorkingDir !== entry.workingDir) fail("config-drift");
    const actualNetworkId = c.NetworkSettings.Networks[REPAIR_NETWORK]?.NetworkID;
    const correctNetwork = actualNetworkId === networkId || (!live && actualNetworkId === "" &&
      c.State.Status === "created" && c.State.Running === false);
    if (c.HostConfig.Privileged || c.HostConfig.PublishAllPorts || c.HostConfig.AutoRemove ||
        c.HostConfig.RestartPolicy?.Name !== "no" || c.HostConfig.NetworkMode !== REPAIR_NETWORK ||
        Object.keys(c.NetworkSettings.Networks).length !== 1 ||
        !correctNetwork ||
        digest(c.NetworkSettings.Networks[REPAIR_NETWORK].Aliases) !== entry.aliasesHash ||
        c.HostConfig.Binds?.length) fail("mode");
    ports(c.HostConfig.PortBindings, type);
    if (live) {
      if (!c.State.Running) fail("not-running");
      ports(c.NetworkSettings.Ports, type, true);
    } else if (c.State.Running) fail("already-running");
    const actual = c.Mounts.map(m => ({ Type: m.Type, Name: m.Name, Destination: m.Destination, RW: m.RW }));
    if (digest(actual) !== digest(entry.mounts) || actual.some(m => m.Type !== "volume")) fail("mount");
    if (type === "kong" && (actual.length !== 1 || actual[0].Name !== TEMPLATE_VOLUME ||
        actual[0].Destination !== TEMPLATE_DEST || actual[0].RW !== false)) fail("template-mount");
  return { ok: true, service: type, live };
}

export function validateRepairHelper(c, { workspace, image, command }) {
  identity(c, workspace);
  safeHost(c.HostConfig);
  if (c.State.Running || c.Image !== image || c.Config.User !== "0" ||
      digest(c.Config.Entrypoint) !== digest(["/bin/sh"]) || digest(c.Config.Cmd) !== digest(["-ec", command]) ||
      c.HostConfig.NetworkMode !== "none" || c.HostConfig.RestartPolicy?.Name !== "no" ||
      Object.keys(c.HostConfig.PortBindings ?? {}).length || c.HostConfig.Binds?.length ||
      Object.keys(c.NetworkSettings.Networks ?? {}).some(n => n !== "none")) fail("helper-mode");
  const mounts = c.Mounts.map(m => ({ Type: m.Type, Name: m.Name, Destination: m.Destination, RW: m.RW }))
    .sort((a, b) => a.Destination.localeCompare(b.Destination));
  const expected = [
    { Type: "volume", Name: "supabase_db_" + REPAIR_PROJECT, Destination: "/check", RW: false },
    { Type: "volume", Name: TEMPLATE_VOLUME, Destination: "/out", RW: true },
    { Type: "volume", Name: SNIPPETS_VOLUME, Destination: "/snippets", RW: false },
  ];
  if (digest(mounts) !== digest(expected)) fail("helper-mount");
  return { ok: true };
}
