import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  InstalledContentReference,
  ActiveSelection,
  VersionSession,
  VersionEvidence,
} from "@/domain/course-installations/contracts";
import type { StudyState } from "@/domain/study/study-state";
import {
  installedReferenceSchema,
  runtimeSelectionCommandSchema,
  runtimeSelectionEnvelopeSchema,
} from "@/domain/installed-study/service";
import {
  InstalledStudyError,
  type InstalledStudyErrorCode,
  type InstalledStudyCatalog,
  type RuntimeSelectionCommand,
  type RuntimeSelectionEnvelope,
  type SelectionReceipt,
  type StoredInstalledProgress,
  type InstalledProgressWrite,
} from "@/domain/installed-study/contracts";

const state = z.custom<StudyState>((value) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value)),
);
const storedSchema = z
  .object({
    userId: z.uuid(),
    reference: installedReferenceSchema,
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    state,
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
const evidenceSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    sessionId: z.uuid(),
    reference: installedReferenceSchema,
    kind: z.enum(["activity", "assessment", "learning_policy"]),
    definitionId: z.string().min(1).max(1024),
    input: z.json(),
    result: z.json(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();
const codes = new Set<InstalledStudyErrorCode>([
  "INVALID_INPUT",
  "NOT_AUTHORIZED",
  "SELECTION_CONFLICT",
  "PROGRESS_CONFLICT",
  "OPERATION_CONFLICT",
  "SESSION_CONFLICT",
  "INTEGRATION_UNAVAILABLE",
  "READ_FAILED",
  "WRITE_FAILED",
  "NO_ACTIVE_VERSION",
]);

/** Service-role server adapter. Browser clients never receive these RPC privileges. */
export class SupabaseInstalledStudyCatalog implements InstalledStudyCatalog {
  constructor(private readonly db: SupabaseClient) {}
  private async rpc<T>(
    name: string,
    args: Record<string, unknown>,
    schema: z.ZodType<T>,
    fallback: "READ_FAILED" | "WRITE_FAILED" = "READ_FAILED",
  ): Promise<T> {
    try {
      const { data, error } = await this.db.rpc(name, args);
      if (error) {
        const candidate = /^I8_([A-Z_]+)$/.exec(error.message)?.[1] as
          InstalledStudyErrorCode | undefined;
        throw new InstalledStudyError(candidate && codes.has(candidate) ? candidate : fallback);
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new InstalledStudyError(fallback);
      return parsed.data;
    } catch (error) {
      if (error instanceof InstalledStudyError) throw error;
      throw new InstalledStudyError(fallback);
    }
  }
  getSelection(userId: string): Promise<RuntimeSelectionEnvelope> {
    return this.rpc("i8_selection_get", { p_user_id: userId }, runtimeSelectionEnvelopeSchema);
  }
  getSelectionReceipt(userId: string, operationId: string): Promise<SelectionReceipt | null> {
    return this.rpc(
      "i8_selection_receipt",
      { p_user_id: userId, p_operation_id: operationId },
      z
        .object({ command: runtimeSelectionCommandSchema, result: runtimeSelectionEnvelopeSchema })
        .strict()
        .nullable(),
    );
  }
  select(
    userId: string,
    command: RuntimeSelectionCommand,
    active?: { selection: ActiveSelection; reference: InstalledContentReference },
  ): Promise<RuntimeSelectionEnvelope> {
    return this.rpc(
      "i8_selection_select",
      {
        p_user_id: userId,
        p_command: command,
        p_active_selection: active?.selection ?? null,
        p_reference: active?.reference ?? null,
      },
      runtimeSelectionEnvelopeSchema,
      "WRITE_FAILED",
    );
  }
  listActive(): Promise<ActiveSelection[]> {
    return this.rpc(
      "i8_active_list",
      {},
      z.array(
        z
          .object({
            courseId: z.string().min(1).max(128),
            installationId: z.uuid().nullable(),
            revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
          })
          .strict(),
      ),
    );
  }
  readProgress(
    userId: string,
    reference: InstalledContentReference,
  ): Promise<StoredInstalledProgress | null> {
    return this.rpc(
      "i8_progress_read",
      { p_user_id: userId, p_reference: reference },
      storedSchema.nullable(),
    );
  }
  writeProgress(
    userId: string,
    session: VersionSession,
    command: InstalledProgressWrite,
    canonicalState: StudyState,
  ): Promise<StoredInstalledProgress> {
    return this.rpc(
      "i8_progress_write",
      {
        p_user_id: userId,
        p_session_id: session.id,
        p_reference: session.reference,
        p_command: command,
        p_state: canonicalState,
      },
      storedSchema,
      "WRITE_FAILED",
    );
  }
  listVersionEvidence(
    userId: string,
    reference: InstalledContentReference,
  ): Promise<VersionEvidence[]> {
    return this.rpc(
      "i8_version_evidence_list",
      { p_user_id: userId, p_reference: reference },
      z.array(evidenceSchema),
    );
  }
}
