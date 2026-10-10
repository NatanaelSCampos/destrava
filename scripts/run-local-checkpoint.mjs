import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  localEnvironment,
  isolatedProcessEnvironment,
  assertLocalDocker,
  workspace,
} from "./local-environment.mjs";

const env = isolatedProcessEnvironment(localEnvironment());
const action = process.argv[2];
const actions = {
  migrate: [
    "node_modules/supabase/dist/supabase.js",
    "db",
    "push",
    "--local",
    "--workdir",
    workspace,
    "--skip-vault",
    "--yes",
  ],
  seed: ["--import", "tsx", "scripts/seed-supabase.ts"],
  verify: ["--import", "tsx", "scripts/verify-local-checkpoint.tsx"],
  dev: ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"],
  build: ["node_modules/next/dist/bin/next", "build"],
  restart: [],
};
if (!actions[action]) throw new Error("Unknown local checkpoint action.");
console.log(JSON.stringify(assertLocalDocker()));
if (action === "restart") {
  for (const args of [
    ["stop", "--project-id", "espanhol-plataform", "--workdir", workspace],
    ["start", "--workdir", workspace],
  ]) {
    const command = spawn(process.execPath, ["node_modules/supabase/dist/supabase.js", ...args], {
      cwd: workspace,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    // CLI startup can print credentials. Suppress both streams; report only completion.
    command.stdout.resume();
    command.stderr.resume();
    const code = await new Promise((resolve) => command.on("exit", resolve));
    if (code !== 0) throw new Error(`Local stack ${args[0]} failed; output suppressed.`);
    console.log(`Local stack ${args[0]} completed; data volumes preserved.`);
  }
  console.log(JSON.stringify(assertLocalDocker()));
  process.exit(0);
}
if (action === "dev" || action === "build") {
  const compile = spawn(process.execPath, ["--import", "tsx", "scripts/compile-content.ts"], {
    cwd: workspace,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  const code = await new Promise((resolve) => compile.on("exit", resolve));
  if (code !== 0) process.exit(code ?? 1);
}
const child = spawn(process.execPath, actions[action], {
  cwd: resolve(workspace),
  env,
  stdio: "inherit",
  windowsHide: true,
});
child.on("error", () => {
  console.error("Local checkpoint process could not start.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
