import type { StudySyncRepository } from "@/domain/study/study-progress-sync";
import type { StudyState } from "@/domain/study/study-state";
import { readCourseState, readPersistedCourseState } from "@/domain/study/course-state-storage";
import { z } from "zod";
import type {
  InstalledProgressEnvelope,
  InstalledProgressWrite,
} from "@/domain/installed-study/contracts";
import type { PublicCourse } from "@/content/public";
import type { InstalledRuntimeContext } from "@/lib/installed-runtime-types";
import { matchingInstalledReference } from "@/lib/installed-runtime-types";

/** Bound to one mounted context. No direct legacy/global table writes. */
export class InstalledStudyHttpRepository implements StudySyncRepository {
  private loaded = false;
  private revision = 0;
  private pending: { key: string; command: InstalledProgressWrite } | null = null;
  constructor(
    private context: InstalledRuntimeContext,
    private course: PublicCourse,
    private request: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private envelope(raw: unknown): InstalledProgressEnvelope {
    const value = raw as InstalledProgressEnvelope;
    if (
      !value ||
      value.schemaVersion !== 1 ||
      value.versionSessionId !== this.context.versionSessionId ||
      !value.reference ||
      !matchingInstalledReference(value.reference, this.context.reference) ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0 ||
      !("state" in value)
    )
      throw new Error("A referência do progresso não corresponde à sessão atual.");
    if (
      !("updatedAt" in value) ||
      (value.updatedAt !== null &&
        !z.iso.datetime({ offset: true }).safeParse(value.updatedAt).success) ||
      (value.revision > 0 && value.updatedAt === null) ||
      (value.state === null && (value.revision !== 0 || value.updatedAt !== null))
    )
      throw new Error("A revisão do progresso não pôde ser confirmada.");
    if (value.state !== null) {
      if (
        !value.state ||
        value.state.courseId !== this.course.id ||
        value.state.languageCode !== this.course.languageCode ||
        Object.keys(readCourseState(null, this.course.id, this.course.languageCode)).some(
          (key) => !(key in value.state!),
        ) ||
        !readPersistedCourseState(value.state, this.course.id, this.course.languageCode)
      )
        throw new Error("O progresso recebido não pôde ser validado.");
    }
    return value;
  }
  async load(): Promise<StudyState | null> {
    this.loaded = false;
    const response = await this.request(
      `/api/course-installations/progress?versionSessionId=${encodeURIComponent(this.context.versionSessionId)}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(
        "Não foi possível ler o progresso desta versão. Nenhuma gravação foi liberada.",
      );
    const result = this.envelope(await response.json());
    this.revision = result.revision;
    this.loaded = true;
    this.pending = null;
    return result.state === null
      ? null
      : readPersistedCourseState(result.state, this.course.id, this.course.languageCode);
  }
  async save(state: StudyState): Promise<void> {
    if (!this.loaded)
      throw new Error("Uma leitura confirmada é necessária antes de gravar o progresso.");
    const key = JSON.stringify(state);
    // Confirm an earlier uncertain write before sending a newer edit with its successor revision.
    if (this.pending && this.pending.key !== key) await this.commitPending();
    if (!this.pending || this.pending.key !== key)
      this.pending = {
        key,
        command: {
          versionSessionId: this.context.versionSessionId,
          expectedRevision: this.revision,
          operationId: crypto.randomUUID(),
          state: JSON.parse(key) as StudyState,
        },
      };
    await this.commitPending();
  }
  private async commitPending(): Promise<void> {
    if (!this.pending) return;
    const command = this.pending.command;
    const response = await this.request("/api/course-installations/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        body?.code === "PROGRESS_CONFLICT"
          ? "PROGRESS_CONFLICT: outra aba atualizou esta versão. Releia o progresso para continuar; sua edição foi preservada."
          : "Não foi possível gravar o progresso desta versão. Sua edição continua pendente.",
      );
    const result = this.envelope(body);
    if (
      !result.state ||
      result.revision <= this.revision ||
      result.revision !== command.expectedRevision + 1
    )
      throw new Error("A gravação não foi confirmada. Sua edição continua pendente.");
    this.revision = result.revision;
    this.pending = null;
  }
}
