import path from "node:path";

const freeze = (value) => {
  for (const child of Object.values(value))
    if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
};

/** F1 validates supplied evidence only. It never authorizes an operation. */
export const CLEAN_LOCAL_PROFILE = freeze({
  id: "destrava-release-clean",
  ports: {
    api: 55421, db: 55422, app: 3100, shadow: 55420, studio: 55423,
    smtpWeb: 55424, smtp: 55425, pop3: 55426, analytics: 55427,
    pooler: 55429, edgeInspector: 8183, cdp: 9447,
  },
  apiUrl: "http://127.0.0.1:55421",
  appOrigin: "http://127.0.0.1:3100",
});

function reject(code) {
  throw new Error("Clean release validation failed (" + code + "); input suppressed.");
}
function record(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject(code);
  return value;
}
function nonempty(value) {
  return typeof value === "string" && value.trim() === value && value.length > 0 &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

/** Lexical canonicality; the CLI also checks real paths before reading files. */
export function canonicalCleanWorkspace(workspace) {
  if (!nonempty(workspace)) reject("workspace");
  const windows = /^[A-Za-z]:\\/u.test(workspace);
  const flavor = windows ? path.win32 : path.posix;
  if (!flavor.isAbsolute(workspace) || flavor.normalize(workspace) !== workspace ||
      (!windows && workspace.includes("\\")) || /^[/\\]{2}/u.test(workspace) ||
      workspace.includes("%") || workspace.includes(":") && !windows ||
      (windows && (workspace.slice(2).includes(":") || /[<>"|?*]/u.test(workspace) ||
        workspace.split("\\").some((part) => /[. ]$/u.test(part)))) ||
      flavor.basename(workspace) !== CLEAN_LOCAL_PROFILE.id ||
      workspace.split(/[/\\]/u).some((part) =>
        ["espanholplataform", "espanhol-plataform"].includes(part.toLowerCase())))
    reject("workspace");
  return workspace;
}

// Deliberately limited TOML grammar: bare table/key names, scalar strings,
// decimal integers, booleans and single-line arrays. Unsupported TOML fails
// closed rather than being partly interpreted with regular expressions.
function parseToml(text) {
  if (typeof text !== "string" || text.includes("\0")) reject("toml");
  const entries = new Map();
  const tables = new Set();
  let section = "";
  for (const raw of text.split(/\r?\n/u)) {
    let quote = null, escaped = false, end = raw.length;
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (quote) {
        if (quote === '"' && escaped) escaped = false;
        else if (quote === '"' && char === "\\") escaped = true;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "#") { end = i; break; }
    }
    if (quote) reject("toml-string");
    const line = raw.slice(0, end).trim();
    if (!line) continue;
    const table = /^\[([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\]$/u.exec(line);
    if (table) {
      section = table[1];
      if (tables.has(section) || [...entries.keys()].some((key) =>
        section === key || section.startsWith(key + "."))) reject("toml-duplicate");
      tables.add(section);
      continue;
    }
    const assignment = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/u.exec(line);
    if (!assignment) reject("toml-syntax");
    const key = (section ? section + "." : "") + assignment[1];
    if (entries.has(key) || [...tables].some((name) => name === key ||
        name.startsWith(key + ".")) || [...entries.keys()].some((name) =>
        name.startsWith(key + "."))) reject("toml-duplicate");
    entries.set(key, parseTomlValue(assignment[2]));
  }
  return entries;
}
function parseTomlValue(text) {
  let cursor = 0;
  const skip = () => { while (/\s/u.test(text[cursor] ?? "") && cursor < text.length) cursor++; };
  function value() {
    skip();
    const start = cursor;
    const char = text[cursor++];
    if (char === '"' || char === "'") {
      let escaped = false;
      while (cursor < text.length) {
        const current = text[cursor++];
        if (char === '"' && escaped) { escaped = false; continue; }
        if (char === '"' && current === "\\") { escaped = true; continue; }
        if (current === char) {
          const token = text.slice(start, cursor);
          if (char === "'") return token.slice(1, -1);
          try { return JSON.parse(token); } catch { reject("toml-string"); }
        }
      }
      reject("toml-string");
    }
    if (char === "[") {
      const result = [];
      skip();
      if (text[cursor] === "]") { cursor++; return result; }
      while (cursor < text.length) {
        const item = value();
        if (Array.isArray(item)) reject("toml-array");
        result.push(item);
        skip();
        if (text[cursor] === "]") { cursor++; return result; }
        if (text[cursor++] !== ",") reject("toml-array");
        skip();
        if (text[cursor] === "]") { cursor++; return result; }
      }
      reject("toml-array");
    }
    cursor = start;
    while (cursor < text.length && !/[\s,\]]/u.test(text[cursor])) cursor++;
    const token = text.slice(start, cursor);
    if (token === "true") return true;
    if (token === "false") return false;
    if (/^(?:0|[1-9][0-9]*)$/u.test(token) && Number.isSafeInteger(Number(token)))
      return Number(token);
    reject("toml-value");
  }
  const parsed = value();
  skip();
  if (cursor !== text.length) reject("toml-value");
  return parsed;
}

const protectedAmbient = /^(?:DESTRAVA_|SUPABASE_|NEXT_PUBLIC_|OPENAI_|AZURE_|AWS_|S3_|SMTP_|SENDGRID_|FLY_|DATABASE_URL$|APP_ORIGIN$|PG[A-Z_]*$|DOCKER_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NODE_OPTIONS$|NODE_PATH$|DENO_|CDP_|CHROME_|PLAYWRIGHT_|.*(?:_SECRET|_TOKEN|_PASSWORD|_API_KEY)$)/iu;
function validateAmbient(ambient) {
  if (!ambient || typeof ambient !== "object" || Array.isArray(ambient)) reject("ambient");
  for (const [key, value] of Object.entries(ambient))
    if (protectedAmbient.test(key) && value !== undefined && value !== "")
      reject("ambient-override");
}
function validatePublicKey(value) {
  if (!nonempty(value) || /sb_secret|service[_-]?role|private|-----BEGIN|(?:^|\s)sk-/iu.test(value))
    reject("public-credential");
  if (value.split(".").length === 3 || value.startsWith("eyJ")) {
    try {
      const parts = value.split(".");
      if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part)))
        reject("public-credential");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload.role !== "anon") reject("public-credential");
    } catch { reject("public-credential"); }
  }
}
function appRedirect(value) {
  if (!nonempty(value) || /[*\\]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return url.origin === CLEAN_LOCAL_PROFILE.appOrigin && !url.username && !url.password &&
      !url.search && !url.hash && value === url.href.replace(/\/$/u, value.endsWith("/") ? "/" : "");
  } catch { return false; }
}
function validateConfig(configText) {
  const config = parseToml(configText);
  const p = CLEAN_LOCAL_PROFILE;
  const required = {
    project_id: p.id, "api.port": p.ports.api, "db.port": p.ports.db,
    "db.shadow_port": p.ports.shadow, "studio.port": p.ports.studio,
    "local_smtp.port": p.ports.smtpWeb, "local_smtp.smtp_port": p.ports.smtp,
    "local_smtp.pop3_port": p.ports.pop3, "analytics.port": p.ports.analytics,
    "db.pooler.port": p.ports.pooler, "edge_runtime.inspector_port": p.ports.edgeInspector,
    "auth.site_url": p.appOrigin, "db.seed.enabled": false,
  };
  for (const [key, value] of Object.entries(required))
    if (config.get(key) !== value) reject("config-identity");
  const redirects = config.get("auth.additional_redirect_urls");
  if (!Array.isArray(redirects) || redirects.length === 0 ||
      new Set(redirects).size !== redirects.length || !redirects.every(appRedirect))
    reject("config-redirects");
  for (const [key, value] of config) {
    if (/(?:^|\.)(?:port|[A-Za-z0-9_]*_port)$/u.test(key) && !(key in required))
      reject("config-port");
    if (key === "project_id") continue;
    if (key.endsWith(".enabled") && typeof value !== "boolean") reject("config-type");
    if (key.endsWith(".enabled") && value === true &&
        /^(?:auth\.(?:external|third_party|hook|captcha)|auth\.email\.smtp|auth\.sms\.)/u.test(key))
      reject("config-external");
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item !== "string") continue;
      if (item.includes("espanhol-plataform")) reject("config-old-project");
      // env(NAME) is only a symbolic placeholder: no environment is loaded.
      if (/^env\([A-Za-z_][A-Za-z0-9_]*\)$/u.test(item)) continue;
      if (/(?:^|\.)(?:secret|pass|password|.*_key|.*_token|signing_keys_path)$/u.test(key) && item !== "")
        reject("config-credential");
      if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(item)) {
        if (item.startsWith("pg-functions://postgres/") && key.startsWith("auth.hook.")) continue;
        let url;
        try { url = new URL(item); } catch { reject("config-url"); }
        if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" ||
            url.username || url.password || ![p.apiUrl, p.appOrigin, "http://127.0.0.1"].includes(url.origin))
          reject("config-url");
      }
    }
  }
}

export function validateCleanLocal({ workspace, expectedWorkspace, configText, values, ambient = {} } = {}) {
  canonicalCleanWorkspace(workspace);
  canonicalCleanWorkspace(expectedWorkspace);
  if (workspace !== expectedWorkspace) reject("workspace-mismatch");
  validateAmbient(ambient);
  record(values, "values");
  const required = {
    DESTRAVA_LOCAL_ONLY: "1",
    DESTRAVA_LOCAL_PROJECT: CLEAN_LOCAL_PROFILE.id,
    DESTRAVA_LOCAL_WORKSPACE: workspace,
    NEXT_PUBLIC_SUPABASE_URL: CLEAN_LOCAL_PROFILE.apiUrl,
    APP_ORIGIN: CLEAN_LOCAL_PROFILE.appOrigin,
  };
  const allowed = new Set([...Object.keys(required), "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY", "SUPABASE_DB_PASSWORD"]);
  for (const [key, value] of Object.entries(values))
    if (!allowed.has(key) || !nonempty(value)) reject("profile-value");
  for (const [key, value] of Object.entries(required))
    if (!Object.hasOwn(values, key) || values[key] !== value) reject("profile-identity");
  if (!Object.hasOwn(values, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
      !Object.hasOwn(values, "SUPABASE_SECRET_KEY") || !nonempty(values.SUPABASE_SECRET_KEY))
    reject("credentials-missing");
  validatePublicKey(values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === values.SUPABASE_SECRET_KEY)
    reject("public-credential");
  validateConfig(configText);
  return { ok: true, profile: CLEAN_LOCAL_PROFILE.id, workspace, phase: "F1", operational: false };
}

function identity(labels, workspace) {
  record(labels, "docker-labels");
  if (labels["com.supabase.cli.project"] !== CLEAN_LOCAL_PROFILE.id ||
      labels["com.supabase.cli.workdir"] !== workspace) reject("docker-identity");
}
function localDockerHost(host) {
  if (!nonempty(host)) return false;
  if (/^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+$/u.test(host)) return true;
  if (!host.startsWith("unix:///")) return false;
  const socket = host.slice("unix://".length);
  return socket.startsWith("/") && !socket.startsWith("//") && !/[?#%\\\u0000-\u0020]/u.test(socket) &&
    path.posix.normalize(socket) === socket && socket !== "/";
}

/**
 * Snapshot contract, not an observed Supabase version:
 * {context: Docker context inspect object, containers: [db inspect, kong inspect],
 *  volumes: [{Name,Labels}], networks: [{Name,Labels,Driver:"bridge"}]}.
 * Each named volume/network uses project AND workdir labels. F2 must verify
 * provenance and adapt collection to its actual Docker/CLI version.
 */
export function validateCleanDocker(metadata, { workspace } = {}) {
  canonicalCleanWorkspace(workspace);
  record(metadata, "docker-snapshot");
  const { context, containers, volumes, networks } = metadata;
  if (!nonempty(context?.Name) || !localDockerHost(context?.Endpoints?.docker?.Host))
    reject("docker-context");
  if (!Array.isArray(containers) || containers.length !== 2 ||
      !Array.isArray(volumes) || !volumes.length || !Array.isArray(networks) || !networks.length)
    reject("docker-snapshot");
  const volumeNames = new Set(), networkNames = new Set();
  const usedVolumes = new Set(), usedNetworks = new Set();
  for (const volume of volumes) {
    record(volume, "docker-volume");
    if (!/^supabase_[A-Za-z0-9_-]+_destrava-release-clean$/u.test(volume.Name) ||
        volume.Name.includes("espanhol-plataform") || volumeNames.has(volume.Name) ||
        volume.Driver !== undefined && volume.Driver !== "local" ||
        volume.Options != null && Object.keys(record(volume.Options, "docker-volume")).length > 0)
      reject("docker-volume");
    identity(volume.Labels, workspace);
    volumeNames.add(volume.Name);
  }
  for (const network of networks) {
    record(network, "docker-network");
    if (network.Name !== "supabase_network_" + CLEAN_LOCAL_PROFILE.id ||
        network.Driver !== "bridge" || networkNames.has(network.Name)) reject("docker-network");
    identity(network.Labels, workspace);
    networkNames.add(network.Name);
  }
  const seen = new Set();
  for (const container of containers) {
    record(container, "docker-container");
    const name = container.Name?.replace(/^\//u, "");
    const type = name === "supabase_db_" + CLEAN_LOCAL_PROFILE.id ? "db" :
      name === "supabase_kong_" + CLEAN_LOCAL_PROFILE.id ? "kong" : null;
    if (!type || seen.has(type)) reject("docker-container");
    seen.add(type);
    identity(container.Config?.Labels, workspace);
    if (container.HostConfig?.Privileged === true ||
        container.HostConfig?.NetworkMode && !networkNames.has(container.HostConfig.NetworkMode))
      reject("docker-mode");
    const attached = record(container.NetworkSettings?.Networks, "docker-network");
    if (!Object.keys(attached).length) reject("docker-network");
    for (const network of Object.keys(attached)) {
      if (!networkNames.has(network)) reject("docker-network");
      usedNetworks.add(network);
    }
    const ports = record(container.NetworkSettings?.Ports, "docker-ports");
    const internal = type === "db" ? "5432/tcp" : "8000/tcp";
    const external = String(CLEAN_LOCAL_PROFILE.ports[type === "db" ? "db" : "api"]);
    if (!Array.isArray(ports[internal]) || !ports[internal].length) reject("docker-ports");
    for (const [key, bindings] of Object.entries(ports)) {
      if (bindings === null) continue;
      if (key !== internal || !Array.isArray(bindings) || !bindings.length) reject("docker-ports");
      for (const binding of bindings)
        if (!["127.0.0.1", "::1"].includes(binding?.HostIp) || binding.HostPort !== external)
          reject("docker-ports");
    }
    if (!Array.isArray(container.Mounts) || type === "db" && !container.Mounts.length)
      reject("docker-mount");
    for (const mount of container.Mounts) {
      if (mount?.Type !== "volume" || !volumeNames.has(mount.Name)) reject("docker-mount");
      usedVolumes.add(mount.Name);
    }
  }
  if (usedVolumes.size !== volumeNames.size || usedNetworks.size !== networkNames.size)
    reject("docker-unreferenced");
  return { ok: true, profile: CLEAN_LOCAL_PROFILE.id, workspace, phase: "F1", operational: false };
}
