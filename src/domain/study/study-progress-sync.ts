import type { StudyState } from "./study-state";

export type ProgressLoadStatus = "loading" | "loaded" | "absent" | "failed";

export type StudySyncRepository = {
  load: () => Promise<StudyState | null>;
  save: (state: StudyState) => Promise<void>;
};

export type StudySyncCacheEntry = {
  state: StudyState | null;
  pending: StudyState | null;
  recovery: StudyState[];
};

export type StudySyncCache = {
  read: (userId: string | null) => StudySyncCacheEntry;
  write: (userId: string | null, entry: StudySyncCacheEntry) => void;
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

  constructor(
    private freshState: () => StudyState,
    private cache: StudySyncCache,
  ) {
    this.snapshot = {
      state: freshState(),
      userId: null,
      generation: 0,
      loadStatus: "loading",
      dirty: false,
      saving: false,
      loadError: "",
      saveError: "",
      cacheError: "",
      recovery: [],
    };
    this.serverSnapshot = this.snapshot;
  }

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.serverSnapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  isCurrent = (generation: number) => generation === this.snapshot.generation;

  beginLoading() {
    this.repository = null;
    this.publish({
      ...this.snapshot,
      generation: this.snapshot.generation + 1,
      loadStatus: "loading",
      saving: false,
      loadError: "",
      saveError: "",
    });
    return this.snapshot.generation;
  }

  invalidate(generation: number) {
    if (this.isCurrent(generation)) this.beginLoading();
  }

  block(generation: number, error = "", userId: string | null = null) {
    if (!this.isCurrent(generation)) return;
    this.repository = null;
    this.publish({
      ...this.snapshot,
      state: this.freshState(),
      userId,
      loadStatus: "failed",
      dirty: false,
      recovery: [],
      loadError: error,
    });
  }

  async load(generation: number, userId: string | null, repository: StudySyncRepository | null) {
    if (!this.isCurrent(generation)) return;
    let cached: StudySyncCacheEntry = { state: null, pending: null, recovery: [] };
    let cacheError = "";
    try {
      cached = this.cache.read(userId);
    } catch {
      cacheError = "Não foi possível ler a cópia local do progresso.";
    }
    const sameUser = this.snapshot.userId === userId;
    const pending = sameUser && this.snapshot.dirty ? this.snapshot.state : cached.pending;
    const recovery =
      sameUser && this.snapshot.recovery.length ? this.snapshot.recovery : cached.recovery;
    this.publish({
      ...this.snapshot,
      userId,
      state: pending ?? cached.state ?? this.freshState(),
      dirty: Boolean(pending),
      recovery,
      cacheError,
    });

    if (!repository) {
      this.publish({ ...this.snapshot, loadStatus: cached.state || pending ? "loaded" : "absent" });
      return;
    }
    try {
      // Let a write already sent finish before rereading. Queued obsolete writes are skipped.
      await this.queue;
      if (!this.isCurrent(generation)) return;
      const remote = await repository.load();
      if (!this.isCurrent(generation)) return;
      const restored = remote ?? pending ?? cached.state ?? this.freshState();
      const backups =
        remote &&
        pending &&
        !recovery.some((draft) => JSON.stringify(draft) === JSON.stringify(pending))
          ? [...recovery, pending]
          : recovery;
      this.repository = repository;
      // State and permission are published together: subscribers never see loaded + stale cache.
      this.publish({
        ...this.snapshot,
        state: restored,
        loadStatus: remote === null ? "absent" : "loaded",
        dirty: remote === null,
        loadError: "",
        saveError: "",
        recovery: backups,
      });
      this.persistCache();
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      this.repository = null;
      this.publish({
        ...this.snapshot,
        loadStatus: "failed",
        loadError: message(error, "Não foi possível carregar seu progresso."),
      });
    }
  }

  update(updater: StudyState | ((state: StudyState) => StudyState)) {
    if (this.snapshot.loadStatus === "loading") return;
    const state = typeof updater === "function" ? updater(this.snapshot.state) : updater;
    if (state === this.snapshot.state) return;
    this.publish({ ...this.snapshot, state, dirty: true });
    this.persistCache();
  }

  canSaveRemote() {
    return (
      this.repository !== null &&
      (this.snapshot.loadStatus === "loaded" || this.snapshot.loadStatus === "absent")
    );
  }

  async flush(generation = this.snapshot.generation) {
    this.assertWritable(generation);
    if (!this.repository) {
      this.persistCache();
      if (this.snapshot.cacheError) throw new Error(this.snapshot.cacheError);
      this.publish({ ...this.snapshot, dirty: false });
      return;
    }
    const repository = this.repository;
    const operation = this.queue.then(async () => {
      this.assertWritable(generation);
      if (!this.snapshot.dirty) {
        this.persistCache();
        if (this.snapshot.cacheError) throw new Error(this.snapshot.cacheError);
        return;
      }
      const state = this.snapshot.state;
      this.publish({ ...this.snapshot, saving: true });
      try {
        await repository.save(state);
        this.assertWritable(generation);
        this.publish({
          ...this.snapshot,
          saving: false,
          saveError: "",
          dirty: this.snapshot.state !== state,
        });
        this.persistCache();
      } catch (error) {
        if (this.isCurrent(generation)) {
          this.publish({
            ...this.snapshot,
            saving: false,
            saveError: message(error, "Não foi possível sincronizar seu progresso."),
          });
          this.persistCache();
        }
        throw error;
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  private assertWritable(generation: number) {
    if (!this.isCurrent(generation))
      throw new Error("A sessão mudou. A sincronização anterior foi cancelada.");
    if (this.snapshot.loadStatus !== "loaded" && this.snapshot.loadStatus !== "absent")
      throw new Error(
        "O progresso remoto não foi confirmado. Tente carregá-lo novamente antes de sincronizar.",
      );
  }

  private persistCache() {
    try {
      this.cache.write(this.snapshot.userId, {
        state: this.snapshot.state,
        pending: this.snapshot.dirty ? this.snapshot.state : null,
        recovery: this.snapshot.recovery,
      });
      if (this.snapshot.cacheError) this.publish({ ...this.snapshot, cacheError: "" });
    } catch {
      this.publish({
        ...this.snapshot,
        cacheError:
          "A cópia local não pôde ser salva. Mantenha esta página aberta para preservar alterações pendentes.",
      });
    }
  }

  private publish(snapshot: StudySyncSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
