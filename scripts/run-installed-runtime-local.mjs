import { spawn } from "node:child_process";
import {
  assertLocalDocker,
  isolatedProcessEnvironment,
  localEnvironment,
  workspace,
} from "./local-environment.mjs";
if (process.env.NODE_ENV === "production")
  throw new Error("Installed homologation cannot run in production.");
const env = isolatedProcessEnvironment(localEnvironment());
console.log(JSON.stringify(assertLocalDocker()));
const child = spawn(
  process.execPath,
  ["--import", "tsx", "scripts/verify-installed-runtime-local.tsx"],
  {
    cwd: workspace,
    env,
    stdio: "inherit",
    windowsHide: true,
  },
);
child.on("error", () => {
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
