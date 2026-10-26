import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  checkContentContractDependencies,
  formatContractDependencyIssues,
} from "./contract-dependency-check";
import { checkCapabilityImplementations } from "./capability-implementation-check";
import { findLanguageSpecificReferences } from "./architecture-language-check";

const roots = [
  "src/domain",
  "src/app",
  "src/components",
  "src/lib",
  "src/repositories",
  "src/engine",
];
const allowed = new Set(["src/domain/study/course-state-storage.ts"]);
const matches: string[] = [];
function scan(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const relative = path.slice(resolve(process.cwd()).length + 1).replaceAll("\\", "/");
      if (allowed.has(relative)) continue;
      for (const issue of findLanguageSpecificReferences(relative, readFileSync(path, "utf8"))) {
        matches.push(`${relative}:${issue.line}${issue.reason === "parse-error" ? ":parse-error" : ""}`);
      }
    }
  }
}
for (const root of roots) scan(resolve(root));
if (matches.length) {
  console.error(`Language-specific references in generic runtime:\n${matches.join("\n")}`);
  process.exitCode = 1;
} else console.log("architecture boundary: ok");

const contracts = checkContentContractDependencies(process.cwd(), {
  roots: ["src/content/contracts.ts", "src/content/package-contract.ts"],
  directories: ["src/content/"],
});
if (contracts.issues.length) {
  console.error(
    `Content contract dependency violations:\n${formatContractDependencyIssues(contracts)}`,
  );
  process.exitCode = 1;
} else
  console.log(
    `content contract dependencies: ok (${contracts.files.length} local modules; no cycles)`,
  );

const capabilities = checkCapabilityImplementations();
if (capabilities.length) {
  console.error(`Capability registry violations:\n${capabilities.join("\n")}`);
  process.exitCode = 1;
} else
  console.log("capability registry: executors, shared schemas and dependency boundaries verified");
