import { spawn } from "node:child_process";
import {
  localEnvironment,
  isolatedProcessEnvironment,
  assertLocalDocker,
  workspace,
} from "./local-environment.mjs";

const [action, ...args] = process.argv.slice(2);
const entry =
  action === "verify"
    ? "scripts/verify-course-installations-local.tsx"
    : action === "manage"
      ? "scripts/manage-course-installations-local.ts"
      : null;
if (!entry) throw new Error("Use verify or manage for local course installations.");
if (process.env.NODE_ENV === "production")
  throw new Error("Local activation is forbidden in production mode.");
const env = isolatedProcessEnvironment(localEnvironment());
console.log(JSON.stringify(assertLocalDocker()));
const child = spawn(process.execPath, ["--import", "tsx", entry, ...args], {
  cwd: workspace,
  env,
  stdio: "inherit",
  windowsHide: true,
});
child.on("error", () => {
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
