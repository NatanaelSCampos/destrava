import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const roots = ["src/domain", "src/app", "src/components", "src/lib", "src/repositories"];
const allowed = new Set(["src/domain/study/course-state-storage.ts"]);
const leak = /frecuenciasA1|spanishResources|spanishAlphabet|spanishRegions|SpanishRegion|speakSpanish|es-ES|es-MX|es-AR|\bspanish\b|\bespanhol\b|en-US|en-GB|\bEnglish\b|\binglês\b|lang=["'](?:es|en)["']/i;
const matches: string[] = [];
function scan(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const relative = path.slice(resolve(process.cwd()).length + 1).replaceAll("\\", "/");
      if (allowed.has(relative)) continue;
      const lines = readFileSync(path, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => { if (leak.test(line)) matches.push(`${relative}:${index + 1}`); });
    }
  }
}
for (const root of roots) scan(resolve(root));
if (matches.length) {
  console.error(`Language-specific references in generic runtime:\n${matches.join("\n")}`);
  process.exitCode = 1;
} else console.log("architecture boundary: ok");
