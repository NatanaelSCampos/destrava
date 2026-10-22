import { randomUUID } from "node:crypto";
import { installedCourseCompatibility } from "@/domain/installed-study/compatibility";
import { publicRequirements } from "@/content/capability-contracts";
import { z } from "zod";
import { packageFileSchema, packageLimits } from "@/content/package-contract";
import { negotiateCapabilities } from "@/engine/capabilities/compatibility";
import { parsePackageJson } from "@/engine/import/json-data";
import {
  validateExternalPackageFiles,
  type PackageValidationResult,
} from "@/engine/import/validate-package";
import {
  artifactInventory,
  clonePackageFiles,
  hashArtifact,
  identifyArtifact,
  sameContentReference,
} from "./artifact";
import {
  InstallationError,
  type Installation,
  type InstallationDependencies,
  type InstallationStage,
  type InstalledContentReference,
  type AuthorizationGrant,
  type InstallationAction,
  type ActivationCommand,
  type ActivationReceipt,
  type ResolvedInstallation,
  type ResolvedSession,
  type EvidenceInput,
  type JsonValue,
  type VersionSession,
  type VersionEvidence,
} from "./contracts";

const commandSchema = z
  .object({
    courseId: z.string().min(1).max(128),
    installationId: z.uuid(),
    expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    operationId: z.uuid(),
  })
  .strict();
const evidenceSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["activity", "assessment", "learning_policy"]),
    definitionId: z.string().min(1).max(1024),
    input: z.unknown(),
    result: z.unknown(),
  })
  .strict();
const deny = {
  assert: async (): Promise<AuthorizationGrant> => {
    throw new InstallationError("NOT_AUTHORIZED", "authorization");
  },
};

/** Server service. It consumes data snapshots and the existing runtime; it never imports package code. */
export class CourseInstallationService {
  constructor(private readonly dependencies: InstallationDependencies) {}

  async install(files: ReadonlyMap<string, Uint8Array>, authority: unknown): Promise<Installation> {
    const snapshot = clonePackageFiles(files); // This must precede the first await, including authorization.
    const validation = this.validate(snapshot, "validation");
    const prepared = validation.prepared!;
    const identity = identifyArtifact(snapshot, prepared.manifest);
    const capabilityRequirements = [
      ...new Map(
        (
          publicRequirements(
            (prepared.bundle.course.capabilityRequests ?? []).map((request) => request.requirement),
          ) ?? []
        ).map((requirement) => [JSON.stringify(requirement), requirement] as const),
      ).values(),
    ];
    const grant = await this.authorize(authority, "install");
    const installation = await this.catalog("reservation", () =>
      this.dependencies.catalog.reserve(
        {
          identity,
          inventory: artifactInventory(snapshot),
          provenance: {
            producer: prepared.manifest.producer,
            material: prepared.manifest.provenance,
          },
          capabilityRequirements,
          validation: validation.report,
        },
        grant.actorId,
      ),
    );
    if (installation.reference.artifactHash !== identity.artifactHash)
      throw new InstallationError("VERSION_CONFLICT", "reservation");
    if (installation.state === "abandoned")
      throw new InstallationError("INSTALLATION_ABANDONED", "reservation");
    if (installation.state === "installed") {
      await this.resolveInstallation(installation.reference.installationId);
      return structuredClone(installation);
    }
    for (const file of installation.inventory) {
      const bytes = snapshot.get(file.path);
      if (!bytes) throw new InstallationError("ARTIFACT_INTEGRITY", "storage");
      await this.storage(() =>
        this.dependencies.store.putFile(installation.reference, file, new Uint8Array(bytes)),
      );
    }
    await this.verify(installation, "confirmation");
    return structuredClone(
      await this.catalog("confirmation", () =>
        this.dependencies.catalog.confirm(
          installation.reference.installationId,
          identity.artifactHash,
          grant.actorId,
        ),
      ),
    );
  }

  async prepareForHomologation(installationId: string, authority: unknown): Promise<Installation> {
    await this.authorize(authority, "prepare");
    const installation = await this.requireInstallation(installationId);
    const grant = await this.authorize(authority, "prepare", installation.reference);
    this.requireComplete(installation, "preparation");
    await this.verify(installation, "preparation");
    return this.catalog("preparation", () =>
      this.dependencies.catalog.prepare(
        installationId,
        installation.reference.artifactHash,
        grant.actorId,
      ),
    );
  }

  async recordLocalApproval(installationId: string, authority: unknown): Promise<Installation> {
    await this.authorize(authority, "approve");
    const installation = await this.requireInstallation(installationId);
    const grant = await this.authorize(authority, "approve", installation.reference);
    this.requireComplete(installation, "approval");
    if (installation.preparation !== "prepared")
      throw new InstallationError("INSTALLATION_NOT_PREPARED", "approval");
    await this.verify(installation, "approval");
    return this.catalog("approval", () =>
      this.dependencies.catalog.approve(installationId, installation.reference.artifactHash, grant),
    );
  }

  activate(command: ActivationCommand, authority: unknown): Promise<ActivationReceipt> {
    return this.changeActive(command, authority, "activate");
  }
  rollback(command: ActivationCommand, authority: unknown): Promise<ActivationReceipt> {
    return this.changeActive(command, authority, "rollback");
  }
  private async changeActive(
    raw: ActivationCommand,
    authority: unknown,
    action: "activate" | "rollback",
  ): Promise<ActivationReceipt> {
    const parsed = commandSchema.safeParse(raw);
    if (!parsed.success) throw new InstallationError("INVALID_INPUT", "activation");
    const command = parsed.data;
    await this.authorize(authority, action);
    const installation = await this.requireInstallation(command.installationId);
    const grant = await this.authorize(authority, action, installation.reference);
    if (installation.reference.courseId !== command.courseId)
      throw new InstallationError("INVALID_INPUT", "activation");
    this.requireComplete(installation, "activation");
    if (installation.preparation !== "prepared")
      throw new InstallationError("INSTALLATION_NOT_PREPARED", "activation");
    if (installation.approval !== "local_test_approved")
      throw new InstallationError("INSTALLATION_NOT_APPROVED", "activation");
    const validated = await this.verify(installation, "activation");
    const integration = installedCourseCompatibility(validated.prepared!.bundle.course);
    if (!integration.compatible)
      throw new InstallationError("INTEGRATION_UNAVAILABLE", "activation", integration.diagnostics);
    const mandatory = negotiateCapabilities(
      (validated.prepared!.bundle.course.capabilityRequests ?? []).filter(
        (request) => request.requirement.required,
      ),
      this.verifiedEnvironment(validated.prepared!.assets),
    );
    if (mandatory.readiness !== "ready")
      throw new InstallationError("INVALID_PACKAGE", "activation");
    return this.catalog("activation", () =>
      this.dependencies.catalog.activate(command, action, installation.reference, grant),
    );
  }

  async resolveInstallation(installationId: string): Promise<ResolvedInstallation> {
    const installation = await this.requireInstallation(installationId);
    this.requireComplete(installation, "resolution");
    const validated = await this.verify(installation, "resolution");
    // Preserve I6's non-enumerable private runtime boundary in accidental JSON serialization.
    return Object.defineProperty({ installation: structuredClone(installation) }, "prepared", {
      value: validated.prepared,
      enumerable: false,
    }) as ResolvedInstallation;
  }

  async resolveActive(courseId: string): Promise<ResolvedInstallation> {
    this.requireCourseId(courseId);
    const selection = await this.catalog("resolution", () =>
      this.dependencies.catalog.getActive(courseId),
    );
    if (!selection.installationId) throw new InstallationError("NO_ACTIVE_VERSION", "resolution");
    const content = await this.resolveInstallation(selection.installationId);
    if (content.installation.reference.courseId !== courseId)
      throw new InstallationError("ARTIFACT_INTEGRITY", "resolution");
    return content;
  }

  async createSession(
    userId: string,
    courseId: string,
    sessionId: string = randomUUID(),
  ): Promise<VersionSession> {
    this.requireUserAndSession(userId, sessionId);
    this.requireCourseId(courseId);
    const session = await this.catalog("session", () =>
      this.dependencies.catalog.openSession(userId, courseId, sessionId),
    );
    if (
      session.userId !== userId ||
      session.reference.courseId !== courseId ||
      session.id !== sessionId
    )
      throw new InstallationError("SESSION_CONFLICT", "session");
    const content = await this.resolveInstallation(session.reference.installationId);
    if (!sameContentReference(session.reference, content.installation.reference))
      throw new InstallationError("ARTIFACT_INTEGRITY", "session");
    return structuredClone(session);
  }

  async resolveSession(userId: string, sessionId: string): Promise<ResolvedSession> {
    this.requireUserAndSession(userId, sessionId);
    const session = await this.catalog("session", () =>
      this.dependencies.catalog.getSession(userId, sessionId),
    );
    if (!session || session.userId !== userId || session.id !== sessionId)
      throw new InstallationError("SESSION_NOT_FOUND", "session");
    const content = await this.resolveInstallation(session.reference.installationId);
    if (!sameContentReference(session.reference, content.installation.reference))
      throw new InstallationError("ARTIFACT_INTEGRITY", "session");
    return { session: structuredClone(session), content };
  }

  async recordEvidence(
    userId: string,
    sessionId: string,
    raw: EvidenceInput,
  ): Promise<VersionEvidence> {
    const parsed = evidenceSchema.safeParse(raw);
    if (!parsed.success) throw new InstallationError("INVALID_INPUT", "evidence");
    const evidence: EvidenceInput = {
      ...parsed.data,
      input: this.cloneJson(parsed.data.input),
      result: this.cloneJson(parsed.data.result),
    };
    const { session, content } = await this.resolveSession(userId, sessionId);
    const course = content.prepared.bundle.coursePackage;
    const exists =
      evidence.kind === "activity"
        ? course.units.some((unit) =>
            unit.lessons.some((lesson) =>
              lesson.activities.some((activity) => activity.id === evidence.definitionId),
            ),
          )
        : evidence.kind === "assessment"
          ? course.assessments.some((assessment) => assessment.id === evidence.definitionId)
          : course.units.some((unit) => unit.id === evidence.definitionId);
    if (!exists) throw new InstallationError("DEFINITION_NOT_FOUND", "evidence");
    return this.catalog("evidence", () =>
      this.dependencies.catalog.appendEvidence(userId, session, evidence),
    );
  }

  async listEvidence(userId: string, sessionId: string): Promise<VersionEvidence[]> {
    const { session } = await this.resolveSession(userId, sessionId);
    const evidence = await this.catalog("evidence", () =>
      this.dependencies.catalog.listEvidence(userId, sessionId),
    );
    if (
      evidence.some(
        (item) =>
          item.userId !== userId ||
          item.sessionId !== sessionId ||
          !sameContentReference(item.reference, session.reference),
      )
    )
      throw new InstallationError("ARTIFACT_INTEGRITY", "evidence");
    return structuredClone(evidence);
  }

  async listInstallations(courseId: string): Promise<Installation[]> {
    this.requireCourseId(courseId);
    return this.catalog("resolution", () => this.dependencies.catalog.list(courseId));
  }

  private async requireInstallation(installationId: string): Promise<Installation> {
    if (!z.uuid().safeParse(installationId).success)
      throw new InstallationError("INVALID_INPUT", "resolution");
    const installation = await this.catalog("resolution", () =>
      this.dependencies.catalog.get(installationId),
    );
    if (!installation) throw new InstallationError("INSTALLATION_NOT_FOUND", "resolution");
    if (installation.reference.installationId !== installationId)
      throw new InstallationError("ARTIFACT_INTEGRITY", "resolution");
    return structuredClone(installation);
  }
  private requireComplete(installation: Installation, stage: InstallationStage) {
    if (installation.state === "abandoned")
      throw new InstallationError("INSTALLATION_ABANDONED", stage);
    if (installation.state !== "installed")
      throw new InstallationError("INSTALLATION_INCOMPLETE", stage);
  }
  private requireCourseId(courseId: string) {
    if (typeof courseId !== "string" || !courseId.length || courseId.length > 128)
      throw new InstallationError("INVALID_INPUT", "resolution");
  }
  private requireUserAndSession(userId: string, sessionId: string) {
    if (!z.uuid().safeParse(userId).success || !z.uuid().safeParse(sessionId).success)
      throw new InstallationError("INVALID_INPUT", "session");
  }
  private async authorize(
    authority: unknown,
    action: InstallationAction,
    reference?: InstalledContentReference,
  ): Promise<AuthorizationGrant> {
    try {
      const grant = await (this.dependencies.authorizer ?? deny).assert(
        authority,
        action,
        reference ? structuredClone(reference) : undefined,
      );
      if (
        !grant ||
        typeof grant.actorId !== "string" ||
        !grant.actorId.length ||
        grant.actorId.length > 160 ||
        typeof grant.localToken !== "string" ||
        !grant.localToken.length
      )
        throw new Error();
      return { actorId: grant.actorId, localToken: grant.localToken };
    } catch {
      throw new InstallationError("NOT_AUTHORIZED", "authorization");
    }
  }
  private validate(
    files: ReadonlyMap<string, Uint8Array>,
    stage: InstallationStage,
  ): PackageValidationResult {
    const environment = this.verifiedEnvironment(files);
    try {
      const validated = validateExternalPackageFiles(files, { environment });
      if (!validated.prepared || !validated.report.technicallyValid || !validated.report.compatible)
        throw new InstallationError("INVALID_PACKAGE", stage);
      return validated;
    } catch (error) {
      if (error instanceof InstallationError) throw error;
      throw new InstallationError("INVALID_PACKAGE", stage);
    }
  }
  private verifiedEnvironment(files: ReadonlyMap<string, Uint8Array>) {
    const environment = structuredClone(this.dependencies.environment ?? {});
    environment.resources = { ...environment.resources };
    for (const path of files.keys())
      if (!path.endsWith(".json")) environment.resources[path] = { state: "available" };
    return environment;
  }
  private async verify(
    installation: Installation,
    stage: InstallationStage,
  ): Promise<PackageValidationResult> {
    if (
      installation.inventory.length > packageLimits.files ||
      !installation.inventory.every((file) => packageFileSchema.safeParse(file).success)
    )
      throw new InstallationError("ARTIFACT_INTEGRITY", stage);
    const files = new Map<string, Uint8Array>();
    let total = 0;
    for (const file of installation.inventory) {
      if (files.has(file.path)) throw new InstallationError("ARTIFACT_INTEGRITY", stage);
      const bytes = new Uint8Array(
        await this.storage(() =>
          this.dependencies.store.readFile(installation.reference, file.path),
        ),
      );
      total += bytes.byteLength;
      if (total > packageLimits.totalBytes || bytes.byteLength !== file.bytes)
        throw new InstallationError("ARTIFACT_INTEGRITY", stage);
      files.set(file.path, bytes);
    }
    if (
      hashArtifact(files) !== installation.reference.artifactHash ||
      artifactInventory(files).some(
        (file, index) =>
          file.path !== installation.inventory[index].path ||
          file.bytes !== installation.inventory[index].bytes ||
          file.sha256 !== installation.inventory[index].sha256,
      )
    )
      throw new InstallationError("ARTIFACT_INTEGRITY", stage);
    const validated = this.validate(files, stage);
    const identity = identifyArtifact(files, validated.prepared!.manifest);
    if (
      !sameContentReference(installation.reference, {
        ...identity,
        installationId: installation.reference.installationId,
      })
    )
      throw new InstallationError("ARTIFACT_INTEGRITY", stage);
    return validated;
  }
  private async catalog<T>(stage: InstallationStage, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof InstallationError) throw error;
      throw new InstallationError("CATALOG_FAILED", stage);
    }
  }
  private async storage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof InstallationError) throw error;
      throw new InstallationError("STORAGE_FAILED", "storage");
    }
  }
  private cloneJson(value: unknown): JsonValue {
    let nodes = 0;
    const visit = (item: unknown, depth: number): JsonValue => {
      if (++nodes > packageLimits.jsonNodes || depth > packageLimits.jsonDepth) throw new Error();
      if (item === null || typeof item === "boolean" || typeof item === "string") return item;
      if (typeof item === "number" && Number.isFinite(item)) return item;
      if (Array.isArray(item)) return item.map((child) => visit(child, depth + 1));
      if (
        item &&
        typeof item === "object" &&
        [Object.prototype, null].includes(Object.getPrototypeOf(item))
      ) {
        const output: Record<string, JsonValue> = Object.create(null);
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
          if (
            ["__proto__", "prototype", "constructor"].includes(key) ||
            descriptor.get ||
            descriptor.set ||
            !descriptor.enumerable
          )
            throw new Error();
          output[key] = visit(descriptor.value, depth + 1);
        }
        return output;
      }
      throw new Error();
    };
    try {
      const text = JSON.stringify(visit(value, 0));
      if (Buffer.byteLength(text) > packageLimits.jsonBytes) throw new Error();
      return parsePackageJson(Buffer.from(text)) as JsonValue;
    } catch {
      throw new InstallationError("INVALID_INPUT", "evidence");
    }
  }
}
export { InstallationError } from "./contracts";
