import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

type Dependency = { specifier: string | null; line: number };
export type ContractDependencyIssue = {
  file: string;
  line: number;
  message: string;
  chain: string[];
};
export type ContractDependencyReport = { files: string[]; issues: ContractDependencyIssue[] };
export type ContractDependencyGraph = {
  roots: string[];
  read: (file: string) => string;
  resolve: (from: string, specifier: string) => { file: string; external: boolean } | null;
  allowedFile: (file: string) => boolean;
};

/** Static graph only: modules under inspection are never imported or evaluated. */
export function inspectContractDependencies(
  graph: ContractDependencyGraph,
): ContractDependencyReport {
  const files = new Set<string>();
  const active = new Set<string>();
  const issues: ContractDependencyIssue[] = [];
  const allowedExternal = (specifier: string) =>
    specifier === "zod" || specifier.startsWith("zod/");

  function visit(file: string, chain: string[]) {
    if (files.has(file)) return;
    let text: string;
    try {
      text = graph.read(file);
    } catch {
      issues.push({ file, line: 1, message: "Cannot read contract dependency", chain });
      return;
    }
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const dependencies: Dependency[] = [];
    const lineOf = (node: ts.Node) =>
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const add = (node: ts.Node, value: ts.Expression | ts.TypeNode | undefined) => {
      const literal = value && ts.isLiteralTypeNode(value) ? value.literal : value;
      dependencies.push({
        specifier: literal && ts.isStringLiteralLike(literal) ? literal.text : null,
        line: lineOf(node),
      });
    };
    const scan = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) add(node, node.moduleSpecifier);
      else if (ts.isExportDeclaration(node) && node.moduleSpecifier)
        add(node, node.moduleSpecifier);
      else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      )
        add(node, node.moduleReference.expression);
      else if (ts.isImportTypeNode(node)) add(node, node.argument);
      else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      )
        add(node, node.arguments[0]);

      if (
        (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
        ts.isIdentifier(node.expression) &&
        ["process", "window", "document", "navigator", "globalThis"].includes(node.expression.text)
      )
        issues.push({
          file,
          line: lineOf(node),
          message: `Host environment access is not allowed: ${node.expression.text}`,
          chain,
        });
      if (ts.isMetaProperty(node))
        issues.push({
          file,
          line: lineOf(node),
          message: "Host module metadata is not allowed in content contracts",
          chain,
        });
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "fetch"
      )
        issues.push({
          file,
          line: lineOf(node),
          message: "Network access is not allowed in content contracts",
          chain,
        });
      ts.forEachChild(node, scan);
    };
    scan(source);
    if (
      source.statements.some(
        (statement) =>
          ts.isExpressionStatement(statement) &&
          ts.isStringLiteral(statement.expression) &&
          statement.expression.text === "use client",
      )
    )
      issues.push({
        file,
        line: 1,
        message: "Client UI directives are not allowed in content contracts",
        chain,
      });

    active.add(file);
    for (const dependency of dependencies) {
      if (dependency.specifier === null) {
        issues.push({
          file,
          line: dependency.line,
          message: "Computed module dependencies cannot be verified",
          chain,
        });
        continue;
      }
      const target = graph.resolve(file, dependency.specifier);
      if (!target) {
        issues.push({
          file,
          line: dependency.line,
          message: `Unresolved dependency: ${dependency.specifier}`,
          chain,
        });
        continue;
      }
      if (target.external) {
        if (!allowedExternal(dependency.specifier))
          issues.push({
            file,
            line: dependency.line,
            message: `External dependency is not allowed: ${dependency.specifier}`,
            chain,
          });
        continue;
      }
      const nextChain = [...chain, target.file];
      if (!graph.allowedFile(target.file)) {
        issues.push({
          file,
          line: dependency.line,
          message: `Dependency outside the content contract boundary: ${dependency.specifier}`,
          chain: nextChain,
        });
      } else if (active.has(target.file)) {
        issues.push({
          file,
          line: dependency.line,
          message: "Circular contract dependency",
          chain: nextChain,
        });
      } else visit(target.file, nextChain);
    }
    active.delete(file);
    files.add(file);
  }
  for (const root of graph.roots) {
    if (!graph.allowedFile(root))
      issues.push({
        file: root,
        line: 1,
        message: "Root outside the contract boundary",
        chain: [root],
      });
    else visit(root, [root]);
  }
  return { files: [...files], issues };
}

export function checkContentContractDependencies(
  workspace = process.cwd(),
  boundary = { roots: ["src/content/contracts.ts"], directories: ["src/content/"] },
): ContractDependencyReport {
  const configFile = ts.readConfigFile(join(workspace, "tsconfig.json"), ts.sys.readFile);
  if (configFile.error)
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, workspace);
  if (config.errors.length)
    throw new Error(
      config.errors
        .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
        .join("\n"),
    );
  const label = (file: string) => relative(workspace, file).replaceAll("\\", "/");
  const report = inspectContractDependencies({
    roots: boundary.roots.map((root) => resolve(workspace, root)),
    read: (file) => readFileSync(file, "utf8"),
    resolve: (from, specifier) => {
      const result = ts.resolveModuleName(specifier, from, config.options, ts.sys).resolvedModule;
      return result
        ? {
            file: resolve(result.resolvedFileName),
            external: Boolean(result.isExternalLibraryImport),
          }
        : null;
    },
    allowedFile: (file) => boundary.directories.some((directory) => label(file).startsWith(directory)),
  });
  return {
    files: report.files.map(label),
    issues: report.issues.map((issue) => ({
      ...issue,
      file: label(issue.file),
      chain: issue.chain.map(label),
    })),
  };
}

export function formatContractDependencyIssues(report: ContractDependencyReport): string {
  return report.issues
    .map((issue) => `${issue.file}:${issue.line}: ${issue.message}\n  ${issue.chain.join(" -> ")}`)
    .join("\n");
}
