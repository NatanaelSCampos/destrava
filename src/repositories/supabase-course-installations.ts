import { createHash } from "node:crypto";
import { capabilityRequirementSchema } from "@/content/capability-contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  externalPackageManifestSchema,
  packageFileSchema,
  packageLimits,
  packageValidationReportSchema,
} from "@/content/package-contract";
import { artifactObjectPath } from "@/domain/course-installations/artifact";
import {
  InstallationError,
  type InstallationErrorCode,
  type InstallationStage,
  type ArtifactFile,
  type ArtifactStore,
  type InstalledContentReference,
  type InstallationCatalog,
  type InstallationReservation,
  type Installation,
  type AuthorizationGrant,
  type ActiveSelection,
  type ActivationCommand,
  type ActivationReceipt,
  type InstallationTransition,
  type VersionSession,
  type EvidenceInput,
  type VersionEvidence,
} from "@/domain/course-installations/contracts";

const referenceSchema = z
  .object({
    installationId: z.uuid(),
    courseId: z.string().min(1),
    contentVersion: z.string().min(1),
    contractVersion: z.string().min(1),
    envelopeVersion: z.string().min(1),
    languageContractVersion: z.string().min(1),
    artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const dateSchema = z.iso.datetime({ offset: true });
const installationSchema = z
  .object({
    reference: referenceSchema,
    inventory: z.array(packageFileSchema),
    provenance: z
      .object({
        producer: externalPackageManifestSchema.shape.producer,
        material: externalPackageManifestSchema.shape.provenance,
      })
      .strict(),
    capabilityRequirements: z.array(capabilityRequirementSchema),
    validation: packageValidationReportSchema,
    state: z.enum(["preparing", "installed", "abandoned"]),
    preparation: z.enum(["not_prepared", "prepared"]),
    approval: z.enum(["not_reviewed", "local_test_approved"]),
    createdAt: dateSchema,
    installedAt: dateSchema.nullable(),
    preparedAt: dateSchema.nullable(),
    approvedAt: dateSchema.nullable(),
  })
  .strict();
const selectionSchema = z
  .object({
    courseId: z.string(),
    installationId: z.uuid().nullable(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
const receiptSchema = z
  .object({
    operationId: z.uuid(),
    action: z.enum(["activate", "rollback"]),
    actorId: z.string(),
    previousInstallationId: z.uuid().nullable(),
    selection: selectionSchema,
    reference: referenceSchema,
    createdAt: dateSchema,
  })
  .strict();
const transitionSchema = z
  .object({
    id: z.uuid(),
    courseId: z.string(),
    installationId: z.uuid(),
    action: z.enum(["reserve", "confirm", "prepare", "approve", "activate", "rollback"]),
    actorId: z.string(),
    operationId: z.uuid().nullable(),
    revision: z.number().int().nullable(),
    previousInstallationId: z.uuid().nullable(),
    nextInstallationId: z.uuid().nullable(),
    createdAt: dateSchema,
  })
  .strict();
const sessionSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    reference: referenceSchema,
    activeRevision: z.number().int().positive(),
    createdAt: dateSchema,
  })
  .strict();
const evidenceSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    sessionId: z.uuid(),
    reference: referenceSchema,
    kind: z.enum(["activity", "assessment", "learning_policy"]),
    definitionId: z.string(),
    input: z.json(),
    result: z.json(),
    createdAt: dateSchema,
  })
  .strict();
const codes = new Set<InstallationErrorCode>([
  "NOT_AUTHORIZED",
  "INVALID_PACKAGE",
  "INVALID_INPUT",
  "VERSION_CONFLICT",
  "ARTIFACT_INTEGRITY",
  "INSTALLATION_NOT_FOUND",
  "INSTALLATION_INCOMPLETE",
  "INSTALLATION_NOT_PREPARED",
  "INSTALLATION_NOT_APPROVED",
  "INSTALLATION_ABANDONED",
  "REVISION_CONFLICT",
  "OPERATION_CONFLICT",
  "NO_ACTIVE_VERSION",
  "SESSION_NOT_FOUND",
  "SESSION_CONFLICT",
  "EVIDENCE_CONFLICT",
  "DEFINITION_NOT_FOUND",
]);

/** Privileged server adapter. Never construct this client in a browser or expose its credentials. */
export class SupabaseCourseInstallationCatalog implements InstallationCatalog {
  constructor(private readonly db: SupabaseClient) {}
  private async rpc<T>(
    name: string,
    args: Record<string, unknown>,
    schema: z.ZodType<T>,
    stage: InstallationStage,
  ): Promise<T> {
    try {
      const { data, error } = await this.db.rpc(name, args);
      if (error) {
        const candidate = /^I7_([A-Z_]+)$/.exec(error.message)?.[1] as
          InstallationErrorCode | undefined;
        throw new InstallationError(
          candidate && codes.has(candidate) ? candidate : "CATALOG_FAILED",
          stage,
        );
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new InstallationError("CATALOG_FAILED", stage);
      return parsed.data;
    } catch (error) {
      if (error instanceof InstallationError) throw error;
      throw new InstallationError("CATALOG_FAILED", stage);
    }
  }
  reserve(input: InstallationReservation, actorId: string): Promise<Installation> {
    return this.rpc(
      "i7_installation_reserve",
      { p_input: input, p_actor_id: actorId },
      installationSchema,
      "reservation",
    );
  }
  confirm(installationId: string, artifactHash: string, actorId: string): Promise<Installation> {
    return this.rpc(
      "i7_installation_confirm",
      { p_installation_id: installationId, p_artifact_hash: artifactHash, p_actor_id: actorId },
      installationSchema,
      "confirmation",
    );
  }
  prepare(installationId: string, artifactHash: string, actorId: string): Promise<Installation> {
    return this.rpc(
      "i7_installation_prepare",
      { p_installation_id: installationId, p_artifact_hash: artifactHash, p_actor_id: actorId },
      installationSchema,
      "preparation",
    );
  }
  approve(
    installationId: string,
    artifactHash: string,
    grant: AuthorizationGrant,
  ): Promise<Installation> {
    return this.rpc(
      "i7_installation_approve",
      {
        p_installation_id: installationId,
        p_artifact_hash: artifactHash,
        p_actor_id: grant.actorId,
        p_local_token: grant.localToken,
      },
      installationSchema,
      "approval",
    );
  }
  get(installationId: string): Promise<Installation | null> {
    return this.rpc(
      "i7_installation_get",
      { p_installation_id: installationId },
      installationSchema.nullable(),
      "resolution",
    );
  }
  list(courseId: string): Promise<Installation[]> {
    return this.rpc(
      "i7_installation_list",
      { p_course_id: courseId },
      z.array(installationSchema),
      "resolution",
    );
  }
  getActive(courseId: string): Promise<ActiveSelection> {
    return this.rpc(
      "i7_installation_active",
      { p_course_id: courseId },
      selectionSchema,
      "resolution",
    );
  }
  activate(
    command: ActivationCommand,
    action: "activate" | "rollback",
    reference: InstalledContentReference,
    grant: AuthorizationGrant,
  ): Promise<ActivationReceipt> {
    return this.rpc(
      "i7_installation_activate",
      {
        p_command: command,
        p_action: action,
        p_reference: reference,
        p_actor_id: grant.actorId,
        p_local_token: grant.localToken,
      },
      receiptSchema,
      "activation",
    );
  }
  transitions(courseId: string): Promise<InstallationTransition[]> {
    return this.rpc(
      "i7_installation_transitions",
      { p_course_id: courseId },
      z.array(transitionSchema),
      "resolution",
    );
  }
  openSession(userId: string, courseId: string, sessionId: string): Promise<VersionSession> {
    return this.rpc(
      "i7_session_open",
      { p_user_id: userId, p_course_id: courseId, p_session_id: sessionId },
      sessionSchema,
      "session",
    );
  }
  getSession(userId: string, sessionId: string): Promise<VersionSession | null> {
    return this.rpc(
      "i7_session_get",
      { p_user_id: userId, p_session_id: sessionId },
      sessionSchema.nullable(),
      "session",
    );
  }
  appendEvidence(
    userId: string,
    session: VersionSession,
    evidence: EvidenceInput,
  ): Promise<VersionEvidence> {
    return this.rpc(
      "i7_evidence_append",
      {
        p_user_id: userId,
        p_session_id: session.id,
        p_reference: session.reference,
        p_evidence: evidence,
      },
      evidenceSchema,
      "evidence",
    );
  }
  listEvidence(userId: string, sessionId: string): Promise<VersionEvidence[]> {
    return this.rpc(
      "i7_evidence_list",
      { p_user_id: userId, p_session_id: sessionId },
      z.array(evidenceSchema),
      "evidence",
    );
  }
}

export class SupabaseCourseArtifactStore implements ArtifactStore {
  constructor(private readonly db: SupabaseClient) {}
  async putFile(
    reference: InstalledContentReference,
    file: ArtifactFile,
    raw: Uint8Array,
  ): Promise<void> {
    const bytes = new Uint8Array(raw);
    if (
      bytes.byteLength !== file.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== file.sha256
    )
      throw new InstallationError("ARTIFACT_INTEGRITY", "storage");
    const path = artifactObjectPath(reference, file.path);
    try {
      const { error } = await this.db.storage
        .from("course-artifacts")
        .upload(path, bytes, { upsert: false, contentType: "application/octet-stream" });
      if (!error) return;
      // Duplicate upload or a lost response after commit: accept only the exact existing bytes.
      const stored = await this.readFile(reference, file.path);
      if (!Buffer.from(stored).equals(Buffer.from(bytes)))
        throw new InstallationError("ARTIFACT_INTEGRITY", "storage");
    } catch (error) {
      if (error instanceof InstallationError) throw error;
      throw new InstallationError("STORAGE_FAILED", "storage");
    }
  }
  async readFile(reference: InstalledContentReference, file: string): Promise<Uint8Array> {
    const path = artifactObjectPath(reference, file);
    try {
      const { data, error } = await this.db.storage
        .from("course-artifacts")
        .download(path, {}, { cache: "no-store" });
      if (error || !data) throw new InstallationError("STORAGE_FAILED", "storage");
      if (data.size > (file.endsWith(".json") ? packageLimits.jsonBytes : packageLimits.assetBytes))
        throw new InstallationError("ARTIFACT_INTEGRITY", "storage");
      return new Uint8Array(await data.arrayBuffer());
    } catch (error) {
      if (error instanceof InstallationError) throw error;
      throw new InstallationError("STORAGE_FAILED", "storage");
    }
  }
}
