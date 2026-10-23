import type {
  InstalledContentReference,
  ActiveSelection,
  VersionSession,
  VersionEvidence,
  ResolvedSession,
  ResolvedInstallation,
} from "@/domain/course-installations/contracts";
import type { StudyState } from "@/domain/study/study-state";
import type { CapabilityDiagnostic } from "@/content/capability-contracts";

export type RuntimeSelection =
  | { source: "compiled"; courseId: string }
  | { source: "installed"; courseId: string; versionSessionId: string };
export type RuntimeSelectionEnvelope = {
  schemaVersion: 1;
  userId: string;
  revision: number;
  selection: RuntimeSelection | null;
  updatedAt: string | null;
};
export type RuntimeSelectionCommand = {
  source: "compiled" | "installed";
  courseId: string;
  expectedRevision: number;
  operationId: string;
};
export type SelectionReceipt = {
  command: RuntimeSelectionCommand;
  result: RuntimeSelectionEnvelope;
};
/** Progress is shared only within one user + immutable installation, never across content versions. */
export type StoredInstalledProgress = {
  userId: string;
  reference: InstalledContentReference;
  revision: number;
  state: StudyState;
  updatedAt: string;
};
export type InstalledProgressEnvelope = {
  schemaVersion: 1;
  versionSessionId: string;
  reference: InstalledContentReference;
  revision: number;
  state: StudyState | null;
  updatedAt: string | null;
};
export type InstalledProgressWrite = {
  versionSessionId: string;
  expectedRevision: number;
  operationId: string;
  state: StudyState;
};
export interface InstalledStudyCatalog {
  getSelection(userId: string): Promise<RuntimeSelectionEnvelope>;
  getSelectionReceipt(userId: string, operationId: string): Promise<SelectionReceipt | null>;
  select(
    userId: string,
    command: RuntimeSelectionCommand,
    active?: { selection: ActiveSelection; reference: InstalledContentReference },
  ): Promise<RuntimeSelectionEnvelope>;
  listActive(): Promise<ActiveSelection[]>;
  readProgress(
    userId: string,
    reference: InstalledContentReference,
  ): Promise<StoredInstalledProgress | null>;
  writeProgress(
    userId: string,
    session: VersionSession,
    command: InstalledProgressWrite,
    canonicalState: StudyState,
  ): Promise<StoredInstalledProgress>;
  listVersionEvidence(
    userId: string,
    reference: InstalledContentReference,
  ): Promise<VersionEvidence[]>;
}
export interface InstalledContentResolver {
  resolveSession(userId: string, versionSessionId: string): Promise<ResolvedSession>;
  resolveInstallation(installationId: string): Promise<ResolvedInstallation>;
}
export type InstalledStudyDependencies = {
  catalog: InstalledStudyCatalog;
  installations: InstalledContentResolver;
  compiledCourseExists?: (courseId: string) => boolean;
};
export type InstalledCompatibilityReport = {
  compatible: boolean;
  diagnostics: CapabilityDiagnostic[];
};
export type InstalledStudyErrorCode =
  | "INVALID_INPUT"
  | "NOT_AUTHORIZED"
  | "SELECTION_CONFLICT"
  | "PROGRESS_CONFLICT"
  | "OPERATION_CONFLICT"
  | "SESSION_CONFLICT"
  | "INTEGRATION_UNAVAILABLE"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "NO_ACTIVE_VERSION";
export class InstalledStudyError extends Error {
  constructor(
    readonly code: InstalledStudyErrorCode,
    readonly diagnostics: CapabilityDiagnostic[] = [],
  ) {
    super(`Installed study operation failed: ${code}`);
    this.name = "InstalledStudyError";
  }
}
