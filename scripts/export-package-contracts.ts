import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { publicPackageArtifacts } from "../src/engine/import/public-artifacts";
import { checkCapabilityImplementations } from "./capability-implementation-check";
const issues = checkCapabilityImplementations();
if (issues.length) throw Error("Capability definitions must pass before export");
const root = resolve("contracts/package-v1");
mkdirSync(root, { recursive: true });
const artifacts = publicPackageArtifacts();
for (const [file, data] of Object.entries(artifacts))
  writeFileSync(resolve(root, file), JSON.stringify(data, null, 2) + "\n");
console.log(
  "Exported " +
    Object.keys(artifacts).length +
    " public artifacts from canonical schemas and capabilities.",
);
