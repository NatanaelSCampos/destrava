import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadContent } from "./content-loader";

const bundles = loadContent();
const root = join(process.cwd(), "src/content/generated");
mkdirSync(join(root, "packs"), { recursive: true });
const imports: string[] = [];
const entries: string[] = [];
for (const [index, bundle] of bundles.entries()) {
  const name = `pack${index}`;
  const file = `packs/${bundle.course.id}.json`;
  writeFileSync(join(root, file), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  imports.push(`import ${name} from "./${file}";`);
  entries.push(name);
}
writeFileSync(join(root, "registry.ts"),
  `${imports.join("\n")}\nimport type { CompiledPackage } from "../runtime-package";\nexport const compiledPackages = [${entries.join(", ")}] as unknown as CompiledPackage[];\n`,
  "utf8");
console.log(`Compiled ${bundles.length} course package(s).`);
