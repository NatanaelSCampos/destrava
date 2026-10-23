import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { capabilityCatalog } from "../src/engine/capabilities/registry";
import { checkCapabilityImplementations } from "./capability-implementation-check";

const issues = checkCapabilityImplementations();
if (issues.length) throw new Error(`Cannot export an inconsistent catalog:\n${issues.join("\n")}`);
mkdirSync(resolve("contracts"), { recursive: true });
writeFileSync(
  resolve("contracts/engine-capabilities-v1.json"),
  `${JSON.stringify(capabilityCatalog(), null, 2)}\n`,
  "utf8",
);
console.log(
  "Exported contracts/engine-capabilities-v1.json from verified engine definitions; no payload instances.",
);
