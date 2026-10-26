import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, closeSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deploymentPlan } from "./deployment-plan.mjs";

// Revalidate immediately before launch. Capture native streams independently:
// Windows PowerShell 5 can turn redirected native stderr warnings into errors.
export async function runDeployment(options) {
  const plan = deploymentPlan(options);
  const parent = join(options.workspace, ".tmp");
  mkdirSync(parent, { recursive: true });
  const retained = mkdtempSync(join(parent, "fly-deploy-"));
  const stdout = openSync(join(retained, "stdout.log"), "wx");
  const stderr = openSync(join(retained, "stderr.log"), "wx");
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    join(options.workspace, "scripts/fly-ipv4.ps1"), "deploy", options.workspace,
    "--config", join(options.workspace, "fly.toml"), "--dockerfile",
    join(options.workspace, "Dockerfile"), "--remote-only", "--ha=false", "--app", plan.app];
  for (const [name, value] of Object.entries(plan.buildArgs)) args.push("--build-arg", `${name}=${value}`);
  let code = 1;
  try {
    code = await new Promise((done, reject) => {
      const child = spawn("powershell.exe", args, {
        cwd: options.workspace, env: process.env, windowsHide: true,
        stdio: ["ignore", stdout, stderr],
      });
      child.once("error", reject);
      child.once("close", status => done(status ?? 1));
    });
  } finally {
    closeSync(stdout); closeSync(stderr);
    writeFileSync(join(retained, "result.json"), JSON.stringify({
      commit: plan.commit, app: plan.app, exitCode: code, at: new Date().toISOString(),
    }, null, 2));
  }
  return code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const names = ["profilePath", "workspace", "expectedApp", "expectedSupabaseProject", "expectedOrigin", "expectedSha"];
    if (process.argv.length !== names.length + 2) throw Error("Explicit release identity required");
    process.exitCode = await runDeployment(Object.fromEntries(names.map((key, i) => [key, process.argv[i + 2]])));
  } catch {
    process.stderr.write("Fly execution failed; configuration and child output suppressed.\n");
    process.exitCode = 1;
  }
}