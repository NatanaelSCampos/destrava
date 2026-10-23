import { parseReleaseJson } from "./strict-json.mjs";
export { parseReleaseJson } from "./strict-json.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, readdirSync } from "node:fs";
import { isAbsolute, resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const fail = (message) => { throw new Error(`Release guard: ${message}; values suppressed.`); };
const digest = (data) => createHash("sha256").update(data).digest("hex");
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => plain(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const buildKeys = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_FEATURE_AI_TUTOR", "NEXT_PUBLIC_FEATURE_AI_WRITING",
  "NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED", "NEXT_PUBLIC_PASSKEYS_ENABLED",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
]);
const fileKeys = Object.freeze(["Dockerfile", "fly.toml", "package-lock.json"]);


function localPath(value) {
  if (typeof value !== "string" || !isAbsolute(value) || /^(?:\\\\|\/\/)/.test(value)) fail("absolute local path required");
  return resolve(value);
}
function canonicalOrigin(value) {
  let url;
  try { url = new URL(value); } catch { fail("invalid production origin"); }
  if (url.protocol !== "https:" || url.username || url.password || value !== url.origin || url.port ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(url.hostname) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)) fail("production HTTPS origin required");
  return url;
}

export function assertPublishableKey(key, projectRef) {
  if (typeof key !== "string") fail("publishable key missing");
  if (/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(key)) return;
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      if (payload.role === "anon" && payload.ref === projectRef) return;
    } catch { /* Public-role format inspection only; no authenticity claim. */ }
  }
  fail("private or invalid key in public build configuration");
}

// Deliberately conservative TOML subset for the existing Fly config. Never evaluate code/env().
function flySettings(text) {
  const result = new Map(); const tables = new Set(); let section = ""; let arrayIndex = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#(?=(?:[^"\\]|\\.|"(?:[^"\\]|\\.)*")*$).*$/, "").trim();
    if (!line) continue;
    if (/^\[\[.*\]\]$/.test(line)) { section = `array-${arrayIndex++}`; continue; }
    const table = /^\[([A-Za-z0-9_.-]+)\]$/.exec(line);
    if (table) {
      section = table[1];
      if (tables.has(section)) fail("duplicate Fly table");
      tables.add(section); continue;
    }
    const field = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line);
    if (!field) fail("unsupported Fly configuration syntax");
    const name = `${section}.${field[1]}`;
    if (result.has(name)) fail("duplicate Fly setting");
    let v;
    try { v = JSON.parse(field[2]); } catch { fail("unsupported Fly setting value"); }
    result.set(name, v);
  }
  return result;
}

export function validateProductionProfile(profile, context) {
  if (!exactKeys(profile, ["schemaVersion", "environment", "workspace", "commit", "app", "supabaseProjectRef", "origin", "files", "buildArgs"])) fail("unexpected or missing production profile fields");
  if (profile.schemaVersion !== 1 || profile.environment !== "production") fail("explicit production profile required");
  const workspace = localPath(context.workspace);
  if (localPath(profile.workspace) !== workspace) fail("workspace mismatch");
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(profile.app) || profile.app !== context.expectedApp) fail("Fly app mismatch");
  if (!/^[a-z]{20}$/.test(profile.supabaseProjectRef) || profile.supabaseProjectRef !== context.expectedSupabaseProject) fail("Supabase project mismatch");
  canonicalOrigin(profile.origin);
  if (profile.origin !== context.expectedOrigin) fail("application origin mismatch");
  if (!/^[0-9a-f]{40}$/.test(profile.commit) || profile.commit !== context.expectedSha || profile.commit !== context.actualSha) fail("commit SHA mismatch");
  if (context.gitStatus !== "") fail("checkout must be clean");
  for (const name of Object.keys(context.ambient ?? {})) {
    if ((/^FLY_/i.test(name) && name !== "FLY_API_TOKEN") ||
        /^(?:NEXT_PUBLIC_|SUPABASE_|DESTRAVA_LOCAL|OPENAI_|AZURE_|DATABASE_URL$|PG[A-Z_]+$|APP_ORIGIN$|DOCKER_|NODE_OPTIONS$|NODE_PATH$|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$)/i.test(name)) fail("ambient release configuration is forbidden");
  }
  if (!exactKeys(profile.files, fileKeys) || !exactKeys(profile.buildArgs, buildKeys)) fail("incomplete build identity");
  for (const name of fileKeys) {
    if (!/^[a-f0-9]{64}$/.test(profile.files[name]) || profile.files[name] !== context.hashes[name]) fail("build file digest mismatch");
  }
  const args = profile.buildArgs;
  if (args.NEXT_PUBLIC_SUPABASE_URL !== `https://${profile.supabaseProjectRef}.supabase.co`) fail("Supabase URL is not the approved HTTPS project");
  assertPublishableKey(args.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, profile.supabaseProjectRef);
  for (const key of buildKeys.filter((k) => /ENABLED$|FEATURE_/.test(k))) {
    if (!["true", "false"].includes(args[key])) fail("explicit boolean build flag required");
  }
  if (typeof args.NEXT_PUBLIC_TURNSTILE_SITE_KEY !== "string" ||
      (args.NEXT_PUBLIC_TURNSTILE_SITE_KEY !== "" && !/^0x[A-Za-z0-9_-]{8,100}$/.test(args.NEXT_PUBLIC_TURNSTILE_SITE_KEY))) fail("invalid public site key");
  const config = flySettings(context.flyConfig);
  if (config.get(".app") !== profile.app || config.get("env.APP_ORIGIN") !== profile.origin || config.get("env.NODE_ENV") !== "production") fail("Fly runtime identity mismatch");
  for (const [key, value] of config) {
    if (key.startsWith("build.args.")) {
      const name = key.slice("build.args.".length);
      if (!buildKeys.includes(name) || args[name] !== value) fail("Fly build settings disagree with release profile");
    }
    if (["build.image", "build.dockerfile", "build.builder", "deploy.release_command"].includes(key)) fail("unapproved alternate build or release command");
  }
  const declared = [...context.dockerfileText.matchAll(/^ARG\s+([A-Z_]+)(?:=.*)?\s*$/gm)].map((x) => x[1]);
  if (buildKeys.some((key) => !declared.includes(key))) fail("Dockerfile does not declare approved public arguments");
  return Object.freeze({ app: profile.app, origin: profile.origin, supabaseProject: profile.supabaseProjectRef,
    commit: profile.commit, workspace, buildArgs: Object.freeze({ ...args }), files: Object.freeze({ ...profile.files }) });
}

export function deploymentPlan(options) {
  const workspace = localPath(realpathSync(localPath(options.workspace)));
  const requested = localPath(options.profilePath);
  if (!requested.endsWith(".json") || basename(requested).startsWith(".env")) fail("explicit JSON production profile required");
  const profilePath = localPath(realpathSync(requested));
  if (!profilePath.endsWith(".json") || basename(profilePath).startsWith(".env")) fail("invalid production profile path");
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    if (existsSync(resolve(workspace, name))) fail("implicit build environment files are forbidden");
  }
  const profile = parseReleaseJson(readFileSync(profilePath, "utf8"));
  const git = (...args) => execFileSync("git", ["-c", "core.fsmonitor=false", "-C", workspace, ...args], {
    encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  }).trim();
  if (realpathSync(git("rev-parse", "--show-toplevel")) !== workspace) fail("Git workspace mismatch");
  const hashes = {};
  const contents = {};
  for (const name of fileKeys) {
    const file = realpathSync(resolve(workspace, name));
    if (relative(workspace, file).startsWith("..") || isAbsolute(relative(workspace, file))) fail("build file escapes workspace");
    contents[name] = readFileSync(file, "utf8"); hashes[name] = digest(readFileSync(file));
  }
  const plan = validateProductionProfile(profile, { ...options, workspace, actualSha: git("rev-parse", "HEAD"),
    gitStatus: git("status", "--porcelain=v1", "--untracked-files=all"), hashes,
    flyConfig: contents["fly.toml"], dockerfileText: contents.Dockerfile, ambient: process.env });
  const migrations = readdirSync(resolve(workspace, "supabase/migrations")).filter((f) => /^\d{14}_[\w-]+\.sql$/.test(f)).sort().map((name) => ({ name, sha256: digest(readFileSync(resolve(workspace, "supabase/migrations", name))) }));
  return { ...plan, tree: git("rev-parse", "HEAD^{tree}"), migrations, phase: "F1-guards-only",
    runtimeSecretsVerified: false, imageDigest: null, courseVersion: null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const keys = ["profilePath", "workspace", "expectedApp", "expectedSupabaseProject", "expectedOrigin", "expectedSha"];
    if (process.argv.length !== keys.length + 2) fail("explicit release arguments required");
    const options = Object.fromEntries(keys.map((key, i) => [key, process.argv[i + 2]]));
    process.stdout.write(JSON.stringify(deploymentPlan(options)));
  } catch { process.stderr.write("Release preflight rejected the configuration; values suppressed.\n"); process.exitCode = 1; }
}
