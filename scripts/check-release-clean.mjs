import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalCleanWorkspace, validateCleanLocal } from "./release-guards/clean-local.mjs";
import { parseReleaseJson } from "./release-guards/strict-json.mjs";

function fail() {
  throw new Error("F1 local check rejected; input suppressed; no operation authorized.");
}
function canonicalFile(filename, workspace, maximumBytes) {
  if (typeof filename !== "string" || !path.isAbsolute(filename) ||
      path.normalize(filename) !== filename || realpathSync(filename) !== filename) fail();
  const relative = path.relative(workspace, filename);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)) fail();
  const info = lstatSync(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximumBytes) fail();
  return filename;
}

/**
 * Inspection only:
 * node scripts/check-release-clean.mjs check --profile <absolute.json>
 *   --config <workspace>/supabase/config.toml --expected-workspace <absolute>
 *
 * Profile JSON: {workspace, values}. No env discovery, env loading, Docker
 * command, runner, filesystem write or operational authorization is provided.
 */
export function checkReleaseClean(args, ambient = {}) {
  if (!Array.isArray(args) || args[0] !== "check" || args.length !== 7) fail();
  const flags = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i];
    if (!["--profile", "--config", "--expected-workspace"].includes(key) ||
        Object.hasOwn(flags, key) || typeof args[i + 1] !== "string") fail();
    flags[key] = args[i + 1];
  }
  const workspace = canonicalCleanWorkspace(flags["--expected-workspace"]);
  const ownFile = fileURLToPath(import.meta.url);
  const scriptRoot = path.dirname(path.dirname(realpathSync(ownFile)));
  if (scriptRoot !== workspace || path.dirname(path.dirname(ownFile)) !== workspace ||
      realpathSync(workspace) !== workspace) fail();
  // Check all explicit paths before reading either file.
  const profilePath = canonicalFile(flags["--profile"], workspace, 65536);
  const configPath = canonicalFile(flags["--config"], workspace, 262144);
  if (path.extname(profilePath) !== ".json" ||
      path.basename(profilePath).toLowerCase().startsWith(".env") ||
      configPath !== path.join(workspace, "supabase", "config.toml")) fail();
  let profile;
  try { profile = parseReleaseJson(readFileSync(profilePath, "utf8").replace(/^\uFEFF/u, "")); }
  catch { fail(); }
  if (!profile || typeof profile !== "object" || Array.isArray(profile) ||
      Object.keys(profile).sort().join(",") !== "values,workspace") fail();
  return validateCleanLocal({
    workspace: profile.workspace,
    expectedWorkspace: workspace,
    configText: readFileSync(configPath, "utf8").replace(/^\uFEFF/u, ""),
    values: profile.values,
    ambient,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkReleaseClean(process.argv.slice(2), process.env);
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch {
    process.stderr.write("F1 local check rejected; input suppressed; no operation authorized.\n");
    process.exitCode = 1;
  }
}
