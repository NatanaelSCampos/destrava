import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import {
  assertLocalDocker,
  assertLocalUrl,
  workspace,
  localApi,
  localApp,
  projectId,
} from "./local-environment.mjs";

const proof = assertLocalDocker();
let status;
try {
  const raw = execFileSync(
    process.execPath,
    [
      resolve(workspace, "node_modules/supabase/dist/supabase.js"),
      "status",
      "--output",
      "json",
      "--workdir",
      workspace,
    ],
    { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  status = JSON.parse(raw);
} catch {
  throw new Error("Could not read local CLI status; credentials/output suppressed.");
}
assertLocalUrl(status.API_URL);
if (status.API_URL !== localApi)
  throw new Error("CLI local API does not match the verified container.");
const publishable = status.PUBLISHABLE_KEY || status.ANON_KEY;
const secret = status.SECRET_KEY || status.SERVICE_ROLE_KEY;
if (!publishable || !secret) throw new Error("Local CLI did not provide the required credentials.");
const values = {
  DESTRAVA_LOCAL_ONLY: "1",
  DESTRAVA_LOCAL_PROJECT: projectId,
  NEXT_PUBLIC_SUPABASE_URL: localApi,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
  SUPABASE_SECRET_KEY: secret,
  APP_ORIGIN: localApp,
  OPENAI_API_KEY: "",
  AZURE_SPEECH_KEY: "",
  AZURE_SPEECH_ENDPOINT: "",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
  NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED: "false",
  NEXT_PUBLIC_PASSKEYS_ENABLED: "false",
  NEXT_PUBLIC_FEATURE_AI_TUTOR: "false",
  NEXT_PUBLIC_FEATURE_AI_WRITING: "false",
  NEXT_PUBLIC_FEATURE_SPEAKING: "true",
  NEXT_PUBLIC_FEATURE_LISTENING: "true",
  NEXT_PUBLIC_FEATURE_SPACED_REPETITION: "true",
};
const text =
  "# Generated local-only integration profile. Never commit.\n" +
  Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n") +
  "\n";
const current = resolve(workspace, ".env.local");
const backup = resolve(workspace, ".env.remote.backup.local");
const previous = existsSync(current) ? parseEnv(readFileSync(current, "utf8")) : undefined;
if (
  previous &&
  (previous.DESTRAVA_LOCAL_ONLY !== "1" || previous.NEXT_PUBLIC_SUPABASE_URL !== localApi)
) {
  if (existsSync(backup))
    throw new Error(
      "Remote environment backup already exists; refusing to overwrite either configuration.",
    );
  copyFileSync(current, backup);
}
writeFileSync(resolve(workspace, ".env.integration.local"), text, { mode: 0o600 });
writeFileSync(current, text, { mode: 0o600 });
console.log(
  JSON.stringify({
    ...proof,
    app: localApp,
    credentials: "written only to Git-ignored local files",
    remoteBackup: existsSync(backup),
  }),
);
