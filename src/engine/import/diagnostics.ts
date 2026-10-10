import type { z } from "zod";
import type { packageDiagnosticSchema } from "@/content/package-contract";
export type ImportDiagnostic = z.infer<typeof packageDiagnosticSchema>;
/** Diagnostics never serialize answer payloads, tokens, absolute host paths or arbitrary received objects. */
export function diagnostic(
  code: string,
  category: ImportDiagnostic["category"],
  document: string,
  field: string,
  message: string,
  resolution: string,
  severity: ImportDiagnostic["severity"] = "error",
): ImportDiagnostic {
  return {
    code,
    category,
    severity,
    document,
    field,
    message: message.replace(
      /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted]",
    ),
    resolution,
  };
}
export function fieldPointer(path: readonly PropertyKey[]) {
  return (
    "/" +
    path
      .map((part) =>
        typeof part === "number"
          ? String(part)
          : /^[A-Za-z][A-Za-z0-9_-]{0,64}$/.test(String(part))
            ? String(part)
            : "[field]",
      )
      .join("/")
  );
}
