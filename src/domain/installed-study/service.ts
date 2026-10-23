import { z } from "zod";
import { sameContentReference } from "@/domain/course-installations/artifact";
import {
  InstallationError,
  type ResolvedSession,
  type VersionEvidence,
} from "@/domain/course-installations/contracts";
import {
  InstalledStudyError,
  type InstalledStudyDependencies,
  type InstalledProgressWrite,
  type InstalledProgressEnvelope,
  type RuntimeSelectionCommand,
  type RuntimeSelectionEnvelope,
  type StoredInstalledProgress,
} from "./contracts";
import { installedCourseCompatibility } from "./compatibility";
import {
  cloneInstalledJson,
  projectInstalledEvidence,
  sanitizeInstalledDraft,
} from "./evidence-projection";
import { readCourseState } from "@/domain/study/course-state-storage";

const uuid = z.uuid();
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const courseId = z.string().trim().min(1).max(128);
export const installedReferenceSchema = z
  .object({
    installationId: uuid,
    courseId,
    contentVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
    contractVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
    envelopeVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    languageContractVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
    artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const runtimeSelectionCommandSchema = z
  .object({
    source: z.enum(["compiled", "installed"]),
    courseId,
    expectedRevision: revision,
    operationId: uuid,
  })
  .strict();
export const runtimeSelectionEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    userId: uuid,
    revision,
    selection: z
      .discriminatedUnion("source", [
        z.object({ source: z.literal("compiled"), courseId }).strict(),
        z.object({ source: z.literal("installed"), courseId, versionSessionId: uuid }).strict(),
      ])
      .nullable(),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();
const writeSchema = z
  .object({
    versionSessionId: uuid,
    expectedRevision: revision,
    operationId: uuid,
    state: z.unknown(),
  })
  .strict();
const activeSchema = z
  .object({
    courseId,
    installationId: uuid.nullable(),
    revision,
  })
  .strict();

export class InstalledStudyService {
  constructor(private readonly dependencies: InstalledStudyDependencies) {}

  async getSelection(userId: string): Promise<RuntimeSelectionEnvelope> {
    this.requireUser(userId);
    return this.read(async () =>
      this.validateSelection(userId, await this.dependencies.catalog.getSelection(userId)),
    );
  }

  async select(userId: string, raw: RuntimeSelectionCommand): Promise<RuntimeSelectionEnvelope> {
    this.requireUser(userId);
    const command = runtimeSelectionCommandSchema.safeParse(cloneInstalledJson(raw));
    if (!command.success) throw new InstalledStudyError("INVALID_INPUT");
    // Consult the receipt first: a delayed retry must neither reselect nor resolve a new active version.
    const receipt = await this.read(() =>
      this.dependencies.catalog.getSelectionReceipt(userId, command.data.operationId),
    );
    if (receipt) {
      const old = runtimeSelectionCommandSchema.safeParse(receipt.command);
      if (!old.success || JSON.stringify(old.data) !== JSON.stringify(command.data))
        throw new InstalledStudyError("OPERATION_CONFLICT");
      return this.read(() => this.validateSelection(userId, receipt.result));
    }
    if (command.data.source === "compiled") {
      if (!this.dependencies.compiledCourseExists?.(command.data.courseId))
        throw new InstalledStudyError("INVALID_INPUT");
      const result = await this.write(() => this.dependencies.catalog.select(userId, command.data));
      return this.read(() => this.validateSelection(userId, result));
    }
    const active = await this.read(async () => {
      const items = z.array(activeSchema).parse(await this.dependencies.catalog.listActive());
      const matches = items.filter((item) => item.courseId === command.data.courseId);
      if (matches.length > 1) throw new InstalledStudyError("READ_FAILED");
      return matches[0];
    });
    if (!active?.installationId || !active.revision)
      throw new InstalledStudyError("NO_ACTIVE_VERSION");
    const content = await this.read(() =>
      this.dependencies.installations.resolveInstallation(active.installationId!),
    );
    const installation = content.installation;
    await this.read(async () => installedReferenceSchema.parse(installation.reference));
    if (
      installation.reference.installationId !== active.installationId ||
      installation.reference.courseId !== command.data.courseId ||
      installation.state !== "installed" ||
      installation.preparation !== "prepared" ||
      installation.approval !== "local_test_approved"
    )
      throw new InstalledStudyError("INTEGRATION_UNAVAILABLE");
    this.requireCompatible(content.prepared.bundle.course);
    const result = await this.write(() =>
      this.dependencies.catalog.select(userId, command.data, {
        selection: active,
        reference: installation.reference,
      }),
    );
    return this.read(() => this.validateSelection(userId, result));
  }

  async resolveContext(userId: string, versionSessionId: string): Promise<ResolvedSession> {
    this.requireUser(userId);
    if (!uuid.safeParse(versionSessionId).success) throw new InstalledStudyError("INVALID_INPUT");
    return this.read(async () => {
      const resolved = await this.dependencies.installations.resolveSession(
        userId,
        versionSessionId,
      );
      const session = resolved.session;
      if (
        !session ||
        session.userId !== userId ||
        session.id !== versionSessionId ||
        !installedReferenceSchema.safeParse(session.reference).success ||
        !revision.safeParse(session.activeRevision).success ||
        session.activeRevision === 0 ||
        !sameContentReference(session.reference, resolved.content.installation.reference) ||
        resolved.content.prepared.bundle.course.id !== session.reference.courseId ||
        resolved.content.prepared.bundle.course.contentVersion !==
          session.reference.contentVersion ||
        resolved.content.installation.state !== "installed" ||
        resolved.content.installation.preparation !== "prepared" ||
        resolved.content.installation.approval !== "local_test_approved"
      )
        throw new InstalledStudyError("SESSION_CONFLICT");
      this.requireCompatible(resolved.content.prepared.bundle.course);
      return resolved;
    });
  }

  async listVersionEvidence(userId: string, versionSessionId: string): Promise<VersionEvidence[]> {
    const resolved = await this.resolveContext(userId, versionSessionId);
    return this.evidence(resolved);
  }

  async load(userId: string, versionSessionId: string): Promise<InstalledProgressEnvelope> {
    return (await this.loadProjection(userId, versionSessionId)).progress;
  }

  /** Server consumers use one captured evidence batch for both projection and provenance. */
  async loadProjection(
    userId: string,
    versionSessionId: string,
  ): Promise<{ progress: InstalledProgressEnvelope; evidence: VersionEvidence[] }> {
    const resolved = await this.resolveContext(userId, versionSessionId);
    const stored = await this.read(() =>
      this.dependencies.catalog.readProgress(userId, resolved.session.reference),
    );
    const evidence = await this.evidence(resolved);
    let draft = readCourseState(
      null,
      resolved.session.reference.courseId,
      resolved.content.prepared.bundle.course.languageCode,
    );
    if (stored)
      draft = await this.read(async () => {
        this.validateStored(stored, resolved);
        return sanitizeInstalledDraft(stored.state, resolved);
      });
    const progress: InstalledProgressEnvelope = {
      schemaVersion: 1,
      versionSessionId,
      reference: structuredClone(resolved.session.reference),
      revision: stored?.revision ?? 0,
      updatedAt: stored?.updatedAt ?? null,
      state: stored || evidence.length ? projectInstalledEvidence(draft, resolved, evidence) : null,
    };
    return { progress, evidence };
  }

  async save(userId: string, raw: InstalledProgressWrite): Promise<InstalledProgressEnvelope> {
    this.requireUser(userId);
    const input = writeSchema.safeParse(cloneInstalledJson(raw)); // Freeze before any I/O.
    if (!input.success) throw new InstalledStudyError("INVALID_INPUT");
    const resolved = await this.resolveContext(userId, input.data.versionSessionId);
    const draft = sanitizeInstalledDraft(input.data.state, resolved);
    const evidence = await this.evidence(resolved);
    const canonical = projectInstalledEvidence(draft, resolved, evidence);
    const command = input.data as InstalledProgressWrite;
    const saved = await this.write(() =>
      this.dependencies.catalog.writeProgress(userId, resolved.session, command, canonical),
    );
    await this.read(async () => this.validateStored(saved, resolved));
    // The original receipt wins on retry; fresh evidence may still enrich its state.
    const savedDraft = await this.read(async () => sanitizeInstalledDraft(saved.state, resolved));
    return {
      schemaVersion: 1,
      versionSessionId: resolved.session.id,
      reference: structuredClone(resolved.session.reference),
      revision: saved.revision,
      updatedAt: saved.updatedAt,
      state: projectInstalledEvidence(savedDraft, resolved, await this.evidence(resolved)),
    };
  }

  private async evidence(resolved: ResolvedSession): Promise<VersionEvidence[]> {
    return this.read(async () => {
      const items = await this.dependencies.catalog.listVersionEvidence(
        resolved.session.userId,
        resolved.session.reference,
      );
      if (
        !Array.isArray(items) ||
        items.some(
          (item) =>
            item.userId !== resolved.session.userId ||
            !sameContentReference(item.reference, resolved.session.reference),
        )
      )
        throw new InstalledStudyError("READ_FAILED");
      // Validate every result even when callers request just the evidence list.
      projectInstalledEvidence(
        readCourseState(
          null,
          resolved.session.reference.courseId,
          resolved.content.prepared.bundle.course.languageCode,
        ),
        resolved,
        items,
      );
      return structuredClone(items);
    });
  }
  private async validateSelection(
    userId: string,
    raw: RuntimeSelectionEnvelope,
  ): Promise<RuntimeSelectionEnvelope> {
    const envelope = runtimeSelectionEnvelopeSchema.parse(raw);
    if (
      envelope.userId !== userId ||
      (envelope.revision === 0 && (envelope.selection !== null || envelope.updatedAt !== null)) ||
      (envelope.revision > 0 && (envelope.selection === null || envelope.updatedAt === null))
    )
      throw new InstalledStudyError("READ_FAILED");
    // Selection metadata supports recovery and CAS even when its previous artifact is unavailable.
    // A selection envelope never authorizes execution; resolveContext verifies its session separately.
    if (
      envelope.selection?.source === "compiled" &&
      !this.dependencies.compiledCourseExists?.(envelope.selection.courseId)
    )
      throw new InstalledStudyError("READ_FAILED");
    return envelope;
  }
  private validateStored(stored: StoredInstalledProgress, resolved: ResolvedSession) {
    if (
      !stored ||
      stored.userId !== resolved.session.userId ||
      !installedReferenceSchema.safeParse(stored.reference).success ||
      !sameContentReference(stored.reference, resolved.session.reference) ||
      !revision.safeParse(stored.revision).success ||
      stored.revision === 0 ||
      !z.iso.datetime({ offset: true }).safeParse(stored.updatedAt).success
    )
      throw new InstalledStudyError("READ_FAILED");
  }
  private requireCompatible(course: ResolvedSession["content"]["prepared"]["bundle"]["course"]) {
    const report = installedCourseCompatibility(course);
    if (!report.compatible)
      throw new InstalledStudyError("INTEGRATION_UNAVAILABLE", report.diagnostics);
  }
  private requireUser(userId: string) {
    if (!uuid.safeParse(userId).success) throw new InstalledStudyError("INVALID_INPUT");
  }
  private async read<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof InstalledStudyError) {
        if (error.code === "INVALID_INPUT") throw new InstalledStudyError("READ_FAILED");
        throw error;
      }
      if (
        error instanceof InstallationError &&
        ["NOT_AUTHORIZED", "SESSION_NOT_FOUND", "SESSION_CONFLICT"].includes(error.code)
      )
        throw new InstalledStudyError(
          error.code === "NOT_AUTHORIZED" ? "NOT_AUTHORIZED" : "SESSION_CONFLICT",
        );
      throw new InstalledStudyError("READ_FAILED");
    }
  }
  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof InstalledStudyError) throw error;
      throw new InstalledStudyError("WRITE_FAILED");
    }
  }
}
