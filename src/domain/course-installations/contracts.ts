import type { CapabilityRequirement } from "@/content/capability-contracts";
import type { ExternalPackageManifest } from "@/content/package-contract";
import type { CapabilityEnvironment } from "@/engine/capabilities/compatibility";
import type {
  PackageValidationReport,
  PreparedExternalPackage,
} from "@/engine/import/validate-package";

export type ArtifactIdentity = {
  courseId: string;
  contentVersion: string;
  contractVersion: string;
  envelopeVersion: string;
  languageContractVersion: string;
  artifactHash: string;
};
export type InstalledContentReference = ArtifactIdentity & { installationId: string };
export type ArtifactFile = { path: string; bytes: number; sha256: string };
export type Installation = {
  reference: InstalledContentReference;
  inventory: ArtifactFile[];
  provenance: {
    producer: ExternalPackageManifest["producer"];
    material: ExternalPackageManifest["provenance"];
  };
  capabilityRequirements: CapabilityRequirement[];
  validation: PackageValidationReport;
  state: "preparing" | "installed" | "abandoned";
  preparation: "not_prepared" | "prepared";
  approval: "not_reviewed" | "local_test_approved";
  createdAt: string;
  installedAt: string | null;
  preparedAt: string | null;
  approvedAt: string | null;
};
export type InstallationReservation = Pick<
  Installation,
  "inventory" | "provenance" | "capabilityRequirements" | "validation"
> & {
  identity: ArtifactIdentity;
};
export type ActiveSelection = { courseId: string; installationId: string | null; revision: number };
export type ActivationCommand = {
  courseId: string;
  installationId: string;
  expectedRevision: number;
  operationId: string;
};
export type ActivationReceipt = {
  operationId: string;
  action: "activate" | "rollback";
  actorId: string;
  previousInstallationId: string | null;
  selection: ActiveSelection;
  reference: InstalledContentReference;
  createdAt: string;
};
export type InstallationTransition = {
  id: string;
  courseId: string;
  installationId: string;
  action: "reserve" | "confirm" | "prepare" | "approve" | "activate" | "rollback";
  actorId: string;
  operationId: string | null;
  revision: number | null;
  previousInstallationId: string | null;
  nextInstallationId: string | null;
  createdAt: string;
};
export type VersionSession = {
  id: string;
  userId: string;
  reference: InstalledContentReference;
  activeRevision: number;
  createdAt: string;
};
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type EvidenceInput = {
  id: string;
  kind: "activity" | "assessment" | "learning_policy";
  definitionId: string;
  input: JsonValue;
  result: JsonValue;
};
export type VersionEvidence = EvidenceInput & {
  userId: string;
  sessionId: string;
  reference: InstalledContentReference;
  createdAt: string;
};
export type ResolvedInstallation = {
  installation: Installation;
  prepared: PreparedExternalPackage;
};
export type ResolvedSession = { session: VersionSession; content: ResolvedInstallation };
export type InstallationAction = "install" | "prepare" | "approve" | "activate" | "rollback";
export type AuthorizationGrant = { actorId: string; localToken: string };
export interface AuthorizationGuard {
  assert(
    authority: unknown,
    action: InstallationAction,
    reference?: InstalledContentReference,
  ): Promise<AuthorizationGrant>;
}
/** Raw package bytes always remain private. putFile must never overwrite a different object. */
export interface ArtifactStore {
  putFile(
    reference: InstalledContentReference,
    file: ArtifactFile,
    bytes: Uint8Array,
  ): Promise<void>;
  readFile(reference: InstalledContentReference, path: string): Promise<Uint8Array>;
}
/** All mutations are privileged; activate and openSession require database transactions. */
export interface InstallationCatalog {
  reserve(input: InstallationReservation, actorId: string): Promise<Installation>;
  confirm(installationId: string, artifactHash: string, actorId: string): Promise<Installation>;
  prepare(installationId: string, artifactHash: string, actorId: string): Promise<Installation>;
  approve(
    installationId: string,
    artifactHash: string,
    grant: AuthorizationGrant,
  ): Promise<Installation>;
  get(installationId: string): Promise<Installation | null>;
  list(courseId: string): Promise<Installation[]>;
  getActive(courseId: string): Promise<ActiveSelection>;
  activate(
    command: ActivationCommand,
    action: "activate" | "rollback",
    reference: InstalledContentReference,
    grant: AuthorizationGrant,
  ): Promise<ActivationReceipt>;
  transitions(courseId: string): Promise<InstallationTransition[]>;
  openSession(userId: string, courseId: string, sessionId: string): Promise<VersionSession>;
  getSession(userId: string, sessionId: string): Promise<VersionSession | null>;
  appendEvidence(
    userId: string,
    session: VersionSession,
    evidence: EvidenceInput,
  ): Promise<VersionEvidence>;
  listEvidence(userId: string, sessionId: string): Promise<VersionEvidence[]>;
}
export type InstallationDependencies = {
  store: ArtifactStore;
  catalog: InstallationCatalog;
  authorizer?: AuthorizationGuard;
  environment?: CapabilityEnvironment;
};
export type InstallationStage =
  | "authorization"
  | "validation"
  | "reservation"
  | "storage"
  | "confirmation"
  | "preparation"
  | "approval"
  | "activation"
  | "resolution"
  | "session"
  | "evidence";
export type InstallationErrorCode =
  | "NOT_AUTHORIZED"
  | "INVALID_PACKAGE"
  | "INVALID_INPUT"
  | "VERSION_CONFLICT"
  | "ARTIFACT_INTEGRITY"
  | "INSTALLATION_NOT_FOUND"
  | "INSTALLATION_INCOMPLETE"
  | "INSTALLATION_NOT_PREPARED"
  | "INSTALLATION_NOT_APPROVED"
  | "INSTALLATION_ABANDONED"
  | "REVISION_CONFLICT"
  | "OPERATION_CONFLICT"
  | "NO_ACTIVE_VERSION"
  | "SESSION_NOT_FOUND"
  | "SESSION_CONFLICT"
  | "EVIDENCE_CONFLICT"
  | "DEFINITION_NOT_FOUND"
  | "STORAGE_FAILED"
  | "CATALOG_FAILED";
export class InstallationError extends Error {
  constructor(
    readonly code: InstallationErrorCode,
    readonly stage: InstallationStage,
  ) {
    super(`Course installation operation failed: ${code} (${stage}).`);
    this.name = "InstallationError";
  }
}
