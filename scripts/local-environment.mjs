import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { resolve } from "node:path";

export const workspace = fileURLToPath(new URL("../", import.meta.url));
export const projectId = "espanhol-plataform";
export const localApi = "http://127.0.0.1:54321";
export const localApp = "http://127.0.0.1:3000";

export function assertLocalUrl(value, allowed = [localApi]) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid local checkpoint destination; value suppressed.");
  }
  if (!allowed.includes(url.origin) || url.username || url.password || url.protocol !== "http:")
    throw new Error(
      "Local checkpoint rejected a destination outside the explicit loopback allowlist.",
    );
  return url;
}

export function localEnvironment() {
  const values = parseEnv(readFileSync(resolve(workspace, ".env.integration.local"), "utf8"));
  if (values.DESTRAVA_LOCAL_PROJECT !== projectId || values.DESTRAVA_LOCAL_ONLY !== "1")
    throw new Error("Missing isolated local checkpoint profile.");
  assertLocalUrl(values.NEXT_PUBLIC_SUPABASE_URL);
  if (values.NEXT_PUBLIC_SUPABASE_URL !== localApi || values.APP_ORIGIN !== localApp)
    throw new Error("Local checkpoint endpoints do not match the expected project ports.");
  if (!values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !values.SUPABASE_SECRET_KEY)
    throw new Error("Local Supabase credentials are missing.");
  if (values.OPENAI_API_KEY || values.AZURE_SPEECH_KEY || values.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
    throw new Error("External credentials are forbidden in the integration profile.");
  return values;
}

export function isolatedProcessEnvironment(values) {
  const env = { ...process.env };
  for (const name of Object.keys(env))
    if (
      /^(SUPABASE_|NEXT_PUBLIC_|OPENAI_|AZURE_|APP_ORIGIN|DATABASE_URL|PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|PGSERVICE|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)/i.test(
        name,
      )
    )
      delete env[name];
  return {
    ...env,
    ...values,
    TSX_DISABLE_CACHE: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    NO_PROXY: "127.0.0.1,localhost",
  };
}

export function assertLocalDocker() {
  const config = readFileSync(resolve(workspace, "supabase/config.toml"), "utf8");
  if (
    config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] !== projectId ||
    config.match(/\[api\][\s\S]*?^port\s*=\s*(\d+)/m)?.[1] !== "54321" ||
    config.match(/\[db\][\s\S]*?^port\s*=\s*(\d+)/m)?.[1] !== "54322"
  )
    throw new Error("CLI project/ports do not match the local checkpoint.");
  if (
    process.env.DOCKER_HOST ||
    process.env.DOCKER_CONTEXT ||
    process.env.SUPABASE_CLI_BINARY_OVERRIDE
  )
    throw new Error("Docker/CLI overrides are forbidden for local migrations.");
  const context = execFileSync("docker", ["context", "inspect"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const metadata = JSON.parse(context)[0];
  const host = metadata.Endpoints?.docker?.Host;
  if (!host || (!host.startsWith("npipe://") && !host.startsWith("unix://")))
    throw new Error("Docker daemon is not proven local.");
  for (const name of [`supabase_db_${projectId}`, `supabase_kong_${projectId}`]) {
    const label = execFileSync(
      "docker",
      ["inspect", "--format", '{{index .Config.Labels "com.supabase.cli.project"}}', name],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    const directory = execFileSync(
      "docker",
      ["inspect", "--format", '{{index .Config.Labels "com.supabase.cli.workdir"}}', name],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    if (
      label !== projectId ||
      resolve(directory).toLowerCase() !== resolve(workspace).toLowerCase()
    )
      throw new Error("Local container identity/workspace mismatch.");
  }
  const ports = JSON.parse(
    execFileSync(
      "docker",
      ["inspect", "--format", "{{json .NetworkSettings.Ports}}", `supabase_kong_${projectId}`],
      { encoding: "utf8", windowsHide: true },
    ),
  );
  if (!ports["8000/tcp"]?.some((binding) => binding.HostPort === "54321"))
    throw new Error("Local API port is not bound to the verified project.");
  const dbPorts = JSON.parse(
    execFileSync(
      "docker",
      ["inspect", "--format", "{{json .NetworkSettings.Ports}}", `supabase_db_${projectId}`],
      { encoding: "utf8", windowsHide: true },
    ),
  );
  if (!dbPorts["5432/tcp"]?.some((binding) => binding.HostPort === "54322"))
    throw new Error("Database port does not belong to the verified project.");
  return { project: projectId, context: metadata.Name, localDaemon: true, api: localApi };
}

export async function localFetch(input, init) {
  assertLocalUrl(typeof input === "string" || input instanceof URL ? input : input.url, [
    localApi,
    localApp,
  ]);
  return fetch(input, { ...init, redirect: "manual" });
}
