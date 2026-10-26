import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadContent } from "./content-loader";
import { selectPublishedCourses } from "../src/content/catalog-selection";

function writeCompiledFile(file: string, text: string) {
  if (existsSync(file) && readFileSync(file, "utf8").replace(/\r\n/g, "\n") === text) return;
  writeFileSync(file, text, "utf8");
}

const bundles = loadContent();
const catalog = selectPublishedCourses(
  bundles,
  JSON.parse(readFileSync(join(process.cwd(), "content/catalog.json"), "utf8")),
);
const root = join(process.cwd(), "src/content/generated");
mkdirSync(join(root, "packs"), { recursive: true });
const imports: string[] = [];
const entries: string[] = [];
for (const bundle of bundles) {
  const file = `packs/${bundle.course.id}.json`;
  writeCompiledFile(join(root, file), `${JSON.stringify(bundle, null, 2)}\n`);
}
for (const [index, bundle] of catalog.bundles.entries()) {
  const name = `pack${index}`;
  imports.push(`import ${name} from "./packs/${bundle.course.id}.json";`);
  entries.push(name);
}
writeCompiledFile(
  join(root, "registry.ts"),
  `${imports.join("\n")}\nimport type { CompiledPackage } from "../runtime-package";\nexport const compiledPackages = [${entries.join(", ")}] as unknown as CompiledPackage[];\nexport const defaultCompiledCourseId = ${JSON.stringify(catalog.defaultCourseId)};\n`,
);
console.log(
  `Validated ${bundles.length} source packages; published ${catalog.bundles.length} course packages.`,
);
