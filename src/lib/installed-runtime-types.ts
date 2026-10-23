import type { InstalledContentReference } from "@/domain/course-installations/contracts";
import type { CapabilityDiagnostic } from "@/content/capability-contracts";

export type InstalledRuntimeContext = {
  userId: string;
  versionSessionId: string;
  reference: InstalledContentReference;
  selectionRevision: number;
};
export type RuntimeCourseOption = {
  id: string;
  title: string;
  language: string;
  source?: "compiled" | "installed";
  contentVersion?: string;
};
export type RuntimeUnavailable = { error: string; diagnostics: CapabilityDiagnostic[] };
export function matchingInstalledReference(
  a: InstalledContentReference,
  b: InstalledContentReference,
) {
  return (
    (Object.keys(a) as (keyof InstalledContentReference)[]).every((key) => a[key] === b[key]) &&
    Object.keys(a).length === Object.keys(b).length
  );
}
