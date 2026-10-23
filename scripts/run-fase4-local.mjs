import { spawn } from "node:child_process";
import {
  assertLocalDocker,
  isolatedProcessEnvironment,
  localEnvironment,
  workspace,
} from "./local-environment.mjs";

// Deliberately no remote mode: this runner only homologates synthetic local data.
const env = isolatedProcessEnvironment(localEnvironment());
const action = process.argv[2] ?? "verify";
const scripts = {
  verify: "scripts/verify-fase4-local.tsx",
  browser: "scripts/verify-fase4-browser.tsx",
};
if (!Object.hasOwn(scripts, action)) throw new Error("Unknown local Fase 4 action");
console.log(JSON.stringify({ isolation: assertLocalDocker(), externalProviders: false }));
const child = spawn(
  process.execPath,
  ["--import", "tsx", scripts[action]],
  { cwd: workspace, env, stdio: "inherit", windowsHide: true },
);
child.on("error", () => {
  console.error("Fase 4 local verification could not start.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
