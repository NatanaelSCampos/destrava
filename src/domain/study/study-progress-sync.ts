import type { StudyState } from "./study-state";

export type ProgressLoadStatus = "loading" | "loaded" | "absent" | "failed";

export type StudySyncRepository = {
  load: () => Promise<StudyState | null>;
  save: (state: StudyState) => Promise<void>;
};

export type CompiledPendingScope = { courseId: string; contentVersion: string };
export type CompiledPendingBase = CompiledPendingScope & {
  schemaVersion: 1;
  source: "compiled";
  userId: string;
  base: string;
  pending: string;
  transmitted?: string;
};

/** Complete JSON semantics: only object key order and JSON-omitted undefined fields differ. */
export function canonicalStudyState(value: StudyState | null): string {
  const ordered = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(ordered);
    if (input && typeof input === "object") return Object.fromEntries(Object.entries(input)
      .filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, ordered(item)]));
    return input;
  };
  return JSON.stringify(ordered(value));
}
export function matchingCompiledPendingBase(
  value: unknown, pending: StudyState | null, userId: string | null, scope: CompiledPendingScope,
): value is CompiledPendingBase {
  if (!value || typeof value !== "object" || Array.isArray(value) || !pending || !userId) return false;
  const entry = value as Partial<CompiledPendingBase>;
  if (Object.keys(value).some(key => !["schemaVersion", "source", "userId", "courseId", "contentVersion", "base", "pending", "transmitted"].includes(key)) ||
    entry.schemaVersion !== 1 || entry.source !== "compiled" || entry.userId !== userId ||
    entry.courseId !== scope.courseId || entry.contentVersion !== scope.contentVersion ||
    pending.courseId !== scope.courseId || typeof entry.base !== "string" ||
    entry.pending !== canonicalStudyState(pending)) return false;
  try {
    const validFingerprint = (fingerprint: string, allowNull: boolean) => {
      const state: unknown = JSON.parse(fingerprint);
      return ((state === null && allowNull) || (state !== null && typeof state === "object" && !Array.isArray(state) &&
        (state as { courseId?: unknown }).courseId === scope.courseId)) &&
        canonicalStudyState(state as StudyState | null) === fingerprint;
    };
    return validFingerprint(entry.base, true) && (entry.transmitted === undefined ||
      (typeof entry.transmitted === "string" && validFingerprint(entry.transmitted, false)));
  } catch { return false; }
}

export type StudySyncCacheEntry = {
  state: StudyState | null;
  pending: StudyState | null;
  recovery: StudyState[];
  compiledPendingBase?: CompiledPendingBase | null;
};

export type StudySyncCache = {
  read: (userId: string | null) => StudySyncCacheEntry | Promise<StudySyncCacheEntry>;
  write: (userId: string | null, entry: StudySyncCacheEntry) => void | Promise<void>;
};

export type StudySyncSnapshot = {
  state: StudyState;
  userId: string | null;
  generation: number;
  loadStatus: ProgressLoadStatus;
  dirty: boolean;
  saving: boolean;
  loadError: string;
  saveError: string;
  cacheError: string;
  recovery: StudyState[];
};

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** A session owns its load permission and queue. Readiness of the UI is not write permission. */
export class StudyProgressSync {
  private snapshot: StudySyncSnapshot;
  private readonly serverSnapshot: StudySyncSnapshot;
  private listeners = new Set<() => void>();
  private repository: StudySyncRepository | null = null;
  private queue: Promise<void> = Promise.resolve();
  private cacheQueue: Promise<void> | null = null;
  private cacheRevision = 0;
  private loadSequence = 0;
  private confirmedBase: { userId: string; fingerprint: string } | null = null;
  private transmittedIntent: { userId: string; fingerprint: string } | null = null;

  constructor(
    private freshState: () => StudyState,
    private cache: StudySyncCache,
    private compiledPendingScope?: CompiledPendingScope,
  ) {
    this.snapshot = {
      state: freshState(), userId: null, generation: 0, loadStatus: "loading",
      dirty: false, saving: false, loadError: "", saveError: "", cacheError: "", recovery: [],
    };
    this.serverSnapshot = this.snapshot;
  }

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.serverSnapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  isCurrent = (generation: number) => generation === this.snapshot.generation;
  private isContext(generation: number, owner: string | null) {
    return this.isCurrent(generation) && this.snapshot.userId === owner;
  }

  beginLoading() {
    this.repository = null;
    this.confirmedBase = null;
    this.transmittedIntent = null;
    this.publish({ ...this.snapshot, generation: this.snapshot.generation + 1,
      loadStatus: "loading", saving: false, loadError: "", saveError: "" });
    return this.snapshot.generation;
  }

  invalidate(generation: number) {
    if (this.isCurrent(generation)) this.beginLoading();
  }

  block(generation: number, error = "", userId: string | null = null) {
    if (!this.isCurrent(generation)) return;
    this.repository = null;
    this.publish({ ...this.snapshot, state: this.freshState(), userId,
      loadStatus: "failed", dirty: false, recovery: [], loadError: error });
  }

  async load(generation: number, userId: string | null, repository: StudySyncRepository | null) {
    if (!this.isCurrent(generation)) return;
    const sequence = ++this.loadSequence;
    const current = () => this.isCurrent(generation) && sequence === this.loadSequence;
    this.repository = null;
    let cached: StudySyncCacheEntry;
    try {
      // A reload must observe earlier captured local writes, even after an owner change.
      if (this.cacheQueue) {
        await this.cacheQueue;
        if (!current()) return;
      }
      const local = this.cache.read(userId);
      cached = "then" in local ? await local : local;
      if (!current()) return;
    } catch {
      if (!current()) return;
      const sameUser = this.snapshot.userId === userId;
      this.publish({ ...this.snapshot, userId,
        state: sameUser ? this.snapshot.state : this.freshState(),
        dirty: sameUser && this.snapshot.dirty,
        recovery: sameUser ? this.snapshot.recovery : [],
        loadStatus: "failed", cacheError: "Não foi possível ler a cópia local do progresso.",
        loadError: "Não foi possível confirmar a cópia local do progresso." });
      return;
    }
    const sameUser = this.snapshot.userId === userId;
    const pending = sameUser && this.snapshot.dirty ? this.snapshot.state : cached.pending;
    const recovery = sameUser && this.snapshot.recovery.length ? this.snapshot.recovery : cached.recovery;
    this.publish({ ...this.snapshot, userId, state: pending ?? cached.state ?? this.freshState(),
      loadStatus: "loading", dirty: Boolean(pending), recovery, cacheError: "" });
    if (!repository) {
      this.publish({ ...this.snapshot, loadStatus: cached.state || pending ? "loaded" : "absent" });
      return;
    }
    try {
      await this.queue;
      if (!current()) return;
      const remote = await repository.load();
      if (!current()) return;
      const compiled = Boolean(this.compiledPendingScope);
      const resumable = Boolean(compiled && pending && this.compiledPendingScope &&
        matchingCompiledPendingBase(cached.compiledPendingBase, pending, userId, this.compiledPendingScope) &&
        (cached.compiledPendingBase.base === canonicalStudyState(remote) ||
          cached.compiledPendingBase.transmitted === canonicalStudyState(remote)));
      const conflict = compiled && Boolean(pending) && !resumable;
      const restored = conflict ? (remote ?? this.freshState()) :
        resumable ? pending! : remote ?? pending ?? cached.state ?? this.freshState();
      const dirty = conflict ? false : resumable || (remote === null && !(compiled && recovery.length));
      const backups = (remote || conflict) && pending && !resumable &&
        !recovery.some(draft => JSON.stringify(draft) === JSON.stringify(pending))
        ? [...recovery, pending] : recovery;
      this.repository = repository;
      this.confirmedBase = compiled && userId ? { userId, fingerprint: canonicalStudyState(remote) } : null;
      const uncertain = resumable ? cached.compiledPendingBase?.transmitted : undefined;
      this.transmittedIntent = userId && uncertain && uncertain !== canonicalStudyState(remote)
        ? { userId, fingerprint: uncertain } : null;
      this.publish({ ...this.snapshot, state: restored, loadStatus: remote === null ? "absent" : "loaded",
        dirty, loadError: "", saveError: "", recovery: backups });
      await this.persistCache();
      if (!current()) return;
    } catch (error) {
      if (!current()) return;
      this.repository = null;
      this.publish({ ...this.snapshot, loadStatus: "failed",
        loadError: message(error, "Não foi possível carregar seu progresso.") });
    }
  }

  update(updater: StudyState | ((state: StudyState) => StudyState)) {
    if (this.snapshot.loadStatus === "loading") return;
    const state = typeof updater === "function" ? updater(this.snapshot.state) : updater;
    if (state === this.snapshot.state) return;
    this.publish({ ...this.snapshot, state, dirty: true });
    void this.persistCache().catch(() => undefined);
  }

  canSaveRemote() {
    return this.repository !== null &&
      (this.snapshot.loadStatus === "loaded" || this.snapshot.loadStatus === "absent");
  }

  async flush(generation = this.snapshot.generation) {
    const owner = this.snapshot.userId;
    this.assertWritable(generation, owner);
    if (!this.repository) {
      const state = this.snapshot.state;
      await this.persistCache();
      this.assertWritable(generation, owner);
      this.publish({ ...this.snapshot, dirty: this.snapshot.state !== state });
      await this.persistCache();
      this.assertWritable(generation, owner);
      return;
    }
    const repository = this.repository;
    const operation = this.queue.then(async () => {
      this.assertWritable(generation, owner);
      if (!this.snapshot.dirty) {
        await this.persistCache();
        this.assertWritable(generation, owner);
        return;
      }
      let state = this.snapshot.state;
      let transmittedBase = this.compiledPendingScope ? canonicalStudyState(state) : null;
      this.publish({ ...this.snapshot, saving: true });
      try {
        if (this.compiledPendingScope) {
          if (!owner || this.confirmedBase?.userId !== owner)
            throw new Error("Não foi possível confirmar sua conta e o progresso. Recarregue a página antes de tentar novamente.");
          const uncertain = this.transmittedIntent;
          if (uncertain) {
            const remote = await repository.load();
            this.assertWritable(generation, owner);
            const fingerprint = canonicalStudyState(remote);
            if (uncertain.userId !== owner || (fingerprint !== this.confirmedBase.fingerprint && fingerprint !== uncertain.fingerprint))
              throw new Error("O progresso mudou em outra sessão. Recarregue a página; sua alteração foi preservada.");
            this.confirmedBase = { userId: owner, fingerprint };
            this.transmittedIntent = null;
            state = this.snapshot.state;
            transmittedBase = canonicalStudyState(state);
          }
          this.transmittedIntent = { userId: owner, fingerprint: transmittedBase! };
          // The atomic intent/pending pair must commit before any remote save I/O.
          await this.persistCache();
          this.assertWritable(generation, owner);
          let persisted: StudySyncCacheEntry;
          try { persisted = await this.cache.read(owner); }
          catch (error) {
            if (this.isContext(generation, owner)) this.publish({ ...this.snapshot,
              cacheError: "Não foi possível confirmar a cópia local antes do envio." });
            throw new Error("Não foi possível confirmar a cópia local antes do envio. Mantenha esta página aberta e tente novamente.", { cause: error });
          }
          this.assertWritable(generation, owner);
          const metadata = persisted.compiledPendingBase;
          if (!matchingCompiledPendingBase(metadata, persisted.pending, owner, this.compiledPendingScope) ||
            metadata.transmitted !== transmittedBase || metadata.base !== this.confirmedBase.fingerprint)
            throw new Error("Não foi possível confirmar a cópia local antes do envio. Mantenha esta página aberta e tente novamente.");
          // A newer queued edit may be the durable pending state. Its own canonical
          // fingerprint is checked above; the transmitted intent still pins state A.
        } else {
          await this.persistCache();
          this.assertWritable(generation, owner);
        }
        await repository.save(state);
        this.assertWritable(generation, owner);
        if (transmittedBase !== null && owner) {
          this.confirmedBase = { userId: owner, fingerprint: transmittedBase };
          if (this.transmittedIntent?.userId === owner && this.transmittedIntent.fingerprint === transmittedBase)
            this.transmittedIntent = null;
        }
        this.publish({ ...this.snapshot, saving: false, saveError: "", dirty: this.snapshot.state !== state });
        await this.persistCache();
        this.assertWritable(generation, owner);
      } catch (error) {
        if (this.isContext(generation, owner)) this.publish({ ...this.snapshot, saving: false,
          saveError: message(error, "Não foi possível sincronizar seu progresso.") });
        throw error;
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  private assertWritable(generation: number, owner: string | null) {
    if (!this.isContext(generation, owner))
      throw new Error("A sessão mudou. A sincronização anterior foi cancelada.");
    if (this.snapshot.loadStatus !== "loaded" && this.snapshot.loadStatus !== "absent")
      throw new Error("O progresso remoto não foi confirmado. Tente carregá-lo novamente antes de sincronizar.");
  }

  private persistCache(): Promise<void> {
    const snapshot = this.snapshot, owner = snapshot.userId, generation = snapshot.generation;
    const revision = ++this.cacheRevision;
    const current = () => this.isContext(generation, owner) && revision === this.cacheRevision;
    const success = () => { if (current() && this.snapshot.cacheError) this.publish({ ...this.snapshot, cacheError: "" }); };
    const cacheMessage = "A cópia local não pôde ser salva. Mantenha esta página aberta para preservar alterações pendentes.";
    const failure = () => { if (current()) this.publish({ ...this.snapshot, cacheError: cacheMessage }); };
    let entry: StudySyncCacheEntry;
    try {
      // Capture complete immutable data and scope now, before entering the FIFO.
      const state = structuredClone(snapshot.state);
      entry = { state, pending: snapshot.dirty ? state : null, recovery: structuredClone(snapshot.recovery) };
      if (this.compiledPendingScope) entry.compiledPendingBase = owner && entry.pending && this.confirmedBase?.userId === owner ? {
        schemaVersion: 1, source: "compiled", userId: owner, ...this.compiledPendingScope,
        base: this.confirmedBase.fingerprint, pending: canonicalStudyState(entry.pending),
        ...(this.transmittedIntent?.userId === owner ? { transmitted: this.transmittedIntent.fingerprint } : {}),
      } : null;
    } catch (error) { failure(); return Promise.reject(new Error(cacheMessage, { cause: error })); }
    let operation: Promise<void>;
    if (this.cacheQueue) operation = this.cacheQueue.then(() => this.cache.write(owner, entry));
    else {
      try {
        const result = this.cache.write(owner, entry);
        // Preserve synchronous cache fixtures and synchronous UI notification.
        if (!result) { success(); return Promise.resolve(); }
        operation = Promise.resolve(result);
      } catch (error) { failure(); return Promise.reject(new Error(cacheMessage, { cause: error })); }
    }
    const completion = operation.then(success, error => { failure(); throw new Error(cacheMessage, { cause: error }); });
    const settled = completion.then(() => undefined, () => undefined);
    this.cacheQueue = settled;
    void settled.then(() => { if (this.cacheQueue === settled) this.cacheQueue = null; });
    return completion;
  }

  private publish(snapshot: StudySyncSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
