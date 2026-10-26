import ts from "typescript";

const languageReference = /frecuenciasA1|spanishResources|spanishAlphabet|spanishRegions|SpanishRegion|speakSpanish|es-ES|es-MX|es-AR|\bspanish\b|\bespanhol\b|en-US|en-GB|\bEnglish\b|\binglês\b|lang=["'](?:es|en)["']/gi;

/** A project identity comparison is infrastructure, never a curriculum exception. */
export function findLanguageSpecificReferences(file: string, source: string) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const diagnostics = (ast as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  const at = (position: number) => ast.getLineAndCharacterOfPosition(position).line + 1;
  if (diagnostics.length) return diagnostics.map(d => ({ line: at(d.start ?? 0), reason: "parse-error" }));
  const infrastructure: Array<{ start: number; end: number }> = [];
  function visit(node: ts.Node) {
    if (file === "src/lib/installed-local-profile.ts" && ts.isStringLiteral(node) &&
      node.text === "espanhol-plataform" &&
      ["'espanhol-plataform'", '"espanhol-plataform"'].includes(node.getText(ast))) {
      const parent = node.parent;
      if (ts.isBinaryExpression(parent) && parent.right === node &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isPropertyAccessExpression(parent.left) && !parent.left.questionDotToken &&
        ts.isIdentifier(parent.left.expression) && parent.left.expression.text === "env" &&
        parent.left.name.text === "DESTRAVA_LOCAL_PROJECT") {
        infrastructure.push({ start: node.getStart(ast), end: node.end });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const lines = new Set<number>();
  for (const match of source.matchAll(new RegExp(languageReference.source, "gi"))) {
    const start = match.index!, end = start + match[0].length;
    if (!infrastructure.some(span => start >= span.start && end <= span.end)) lines.add(at(start));
  }
  return [...lines].map(line => ({ line, reason: "language-reference" }));
}