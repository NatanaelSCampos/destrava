import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import ts from "typescript";
import { activityPayloadSchemas, activityTypeSchema } from "../src/content/activity-data";
import {
  capabilityRegistry,
  executionBindings,
  type CapabilityRegistry,
  type ImplementationReference,
} from "../src/engine/capabilities/registry";
import { checkContentContractDependencies } from "./contract-dependency-check";

export function inspectImplementationReference(
  reference: ImplementationReference,
  read = (file: string) => readFileSync(file, "utf8"),
) {
  const issues: string[] = [];
  const target = resolve(reference.file);
  if (relative(process.cwd(), target).startsWith("..")) return ["Executor escapes the workspace."];
  let source: ts.SourceFile;
  try {
    source = ts.createSourceFile(target, read(target), ts.ScriptTarget.Latest, true);
  } catch {
    return [`Missing executor file: ${reference.file}`];
  }
  const declaration = source.statements.find(
    (node) =>
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name?.text === reference.symbol &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
  if (
    !declaration ||
    (!ts.isFunctionDeclaration(declaration) && !ts.isClassDeclaration(declaration))
  )
    return [`Missing exported executor: ${reference.file}#${reference.symbol}`];
  const body = ts.isClassDeclaration(declaration)
    ? declaration.members.find(
        (member): member is ts.MethodDeclaration =>
          ts.isMethodDeclaration(member) && member.name.getText(source) === reference.method,
      )?.body
    : declaration.body;
  if (!body || !body.statements.length || body.statements.every(ts.isThrowStatement))
    issues.push(
      `Executor is absent or a throwing placeholder: ${reference.symbol}.${reference.method ?? ""}`,
    );
  return issues;
}
export function checkCapabilityImplementations(registry: CapabilityRegistry = capabilityRegistry) {
  const issues: string[] = [];
  for (const entry of registry.values()) {
    if (entry.support !== "implemented") continue;
    const binding = entry.executor && executionBindings[entry.executor];
    if (!binding) {
      issues.push(`No executor for ${entry.id}`);
      continue;
    }
    issues.push(...inspectImplementationReference(binding).map((issue) => `${entry.id}: ${issue}`));
    if (entry.presentation) issues.push(...inspectImplementationReference(entry.presentation));
    const walk = (id: string, visited: string[]) => {
      const dependency = registry.get(id);
      if (!dependency || dependency.support !== "implemented") {
        issues.push(`${entry.id}: unsupported dependency ${id}`);
        return;
      }
      if (visited.includes(id)) {
        issues.push(`${entry.id}: dependency cycle`);
        return;
      }
      for (const next of dependency.dependencies ?? []) walk(next, [...visited, id]);
    };
    for (const dependency of entry.dependencies ?? []) walk(dependency, [entry.id]);
  }
  const renderer = readFileSync(executionBindings.activity.file, "utf8");
  for (const type of activityTypeSchema.options) {
    const entry = registry.get(`activity.${type}`);
    if (entry?.schema !== activityPayloadSchemas[type])
      issues.push(`Duplicated/divergent schema for ${type}`);
    if (!renderer.includes(`"${type}"`)) issues.push(`Missing activity rendering branch: ${type}`);
  }
  const graph = checkContentContractDependencies(process.cwd(), {
    roots: [
      "src/engine/capabilities/registry.ts",
      "src/engine/capabilities/compatibility.ts",
      "src/engine/capabilities/package-compatibility.ts",
      "src/engine/capabilities/availability-projection.ts",
    ],
    directories: ["src/content/", "src/engine/"],
  });
  issues.push(...graph.issues.map((item) => `${item.file}:${item.line}: ${item.message}`));
  return issues;
}
