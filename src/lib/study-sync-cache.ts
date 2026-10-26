import { readPersistedCourseState } from "@/domain/study/course-state-storage";
import { matchingCompiledPendingBase, type StudySyncCache, type StudySyncCacheEntry } from "@/domain/study/study-progress-sync";
import type { InstalledRuntimeContext } from "@/lib/installed-runtime-types";
import { indexedDbStudySyncStore } from "./indexeddb-study-sync-store";

const storageKey = "destrava-study:v2:demo";
const legacyStorageKey = "frecuencias-study:v1:demo";

export function browserStudySyncCache(
  courseId: string,
  languageCode: string,
  runtime?: InstalledRuntimeContext,
  compiledContentVersion?: string,
): StudySyncCache {
  // A caller mutating its runtime object cannot retarget already queued writes.
  runtime = runtime ? { ...runtime, reference: { ...runtime.reference } } : undefined;
  const keyFor = (userId: string | null) =>
    runtime
      ? `destrava-installed-study:v1:${userId}:${runtime.reference.installationId}:${runtime.reference.artifactHash}:${runtime.versionSessionId}`
      : userId
        ? `${storageKey}:${userId}:${courseId}`
        : `${storageKey}:${courseId}`;
  const compiledScope = !runtime && compiledContentVersion ? { courseId, contentVersion: compiledContentVersion } : null;
  const baseKey = (userId: string | null) => compiledScope && userId ?
    `${keyFor(userId)}:pending-base:v1:${encodeURIComponent(compiledScope.contentVersion)}` : null;
  const read = (key: string, legacy = false) => {
    const value = window.localStorage.getItem(key);
    return value === null ? null : readPersistedCourseState(JSON.parse(value), courseId, languageCode, legacy);
  };
  const empty = (): StudySyncCacheEntry => ({ state: null, pending: null, recovery: [] });
  const legacy = {
    read(userId: string | null): StudySyncCacheEntry {
      if (runtime && userId !== runtime.userId) return empty();
      const key = keyFor(userId), pending = read(`${key}:pending`), sidecarKey = baseKey(userId);
      let compiledPendingBase: unknown = null;
      if (sidecarKey) {
        try { compiledPendingBase = JSON.parse(window.localStorage.getItem(sidecarKey) ?? "null"); }
        catch { /* Unreadable metadata never authorizes local restoration. */ }
      }
      const raw = window.localStorage.getItem(`${key}:recovery`), recovery: unknown = raw === null ? [] : JSON.parse(raw);
      if (!Array.isArray(recovery)) throw new Error("Cópia local de recuperação ilegível.");
      return {
        state: read(key) ?? (runtime ? null : userId
          ? (read(`${legacyStorageKey}:${userId}:${courseId}`, true) ?? read(`${legacyStorageKey}:${userId}`, true))
          : (read(`${legacyStorageKey}:${courseId}`, true) ?? read(legacyStorageKey, true))),
        pending,
        recovery: recovery.map(value => readPersistedCourseState(value, courseId, languageCode)!),
        ...(compiledScope ? { compiledPendingBase: matchingCompiledPendingBase(compiledPendingBase, pending, userId, compiledScope) ? compiledPendingBase : null } : {}),
      };
    },
    write(userId: string | null, entry: StudySyncCacheEntry) {
      if (runtime && userId !== runtime.userId) throw new Error("O contexto local não pertence à conta atual.");
      const key = keyFor(userId);
      if (entry.recovery.length) window.localStorage.setItem(`${key}:recovery`, JSON.stringify(entry.recovery));
      if (entry.pending) window.localStorage.setItem(`${key}:pending`, JSON.stringify(entry.pending));
      else window.localStorage.removeItem(`${key}:pending`);
      const sidecarKey = baseKey(userId);
      if (sidecarKey && compiledScope) {
        if (matchingCompiledPendingBase(entry.compiledPendingBase, entry.pending, userId, compiledScope))
          window.localStorage.setItem(sidecarKey, JSON.stringify(entry.compiledPendingBase));
        else window.localStorage.removeItem(sidecarKey);
      }
      if (entry.state) window.localStorage.setItem(key, JSON.stringify(entry.state));
    },
  };
  // Tests and older environments can retain synchronous storage. Operational IDB
  // failures do not silently fall back to a possibly obsolete localStorage copy.
  const factory = typeof window === "undefined" ? undefined : window.indexedDB;
  if (!factory) return legacy;
  const store = indexedDbStudySyncStore(factory);
  const scopeFor = (userId: string | null) => JSON.stringify(runtime
    ? ["installed", userId, courseId, languageCode, runtime.reference.installationId,
      runtime.reference.artifactHash, runtime.versionSessionId]
    : ["compiled", userId, courseId, languageCode, compiledContentVersion ?? null]);
  const encode = (scope: string, entry: StudySyncCacheEntry) => JSON.stringify({ schemaVersion: 1, scope, entry });
  const decode = (scope: string, text: string, userId: string | null): StudySyncCacheEntry => {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      (value as { schemaVersion?: unknown }).schemaVersion !== 1 || (value as { scope?: unknown }).scope !== scope)
      throw new Error("O contexto da cópia local não corresponde à sessão atual.");
    const raw = (value as { entry?: unknown }).entry;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Cópia local de progresso ilegível.");
    const entry = raw as StudySyncCacheEntry;
    if (!Array.isArray(entry.recovery)) throw new Error("Cópia local de recuperação ilegível.");
    const pending = entry.pending === null ? null : readPersistedCourseState(entry.pending, courseId, languageCode);
    return {
      state: entry.state === null ? null : readPersistedCourseState(entry.state, courseId, languageCode),
      pending,
      recovery: entry.recovery.map(item => readPersistedCourseState(item, courseId, languageCode)!),
      ...(compiledScope ? { compiledPendingBase: matchingCompiledPendingBase(entry.compiledPendingBase, pending, userId, compiledScope) ? entry.compiledPendingBase : null } : {}),
    };
  };
  return {
    async read(userId) {
      if (runtime && userId !== runtime.userId) return empty();
      const scope = scopeFor(userId), key = `study:${scope}`;
      const current = await store.read(key);
      if (current !== null) return decode(scope, current, userId);
      const imported = encode(scope, legacy.read(userId));
      await store.initialize(key, imported);
      const verified = await store.read(key);
      if (verified === null) throw new Error("Não foi possível confirmar a migração da cópia local.");
      // Keep legacy copies, including pending/recovery and multi-course globals.
      // initialize never replaces a newer IDB entry created by another reader.
      return decode(scope, verified, userId);
    },
    write(userId, entry) {
      if (runtime && userId !== runtime.userId) throw new Error("O contexto local não pertence à conta atual.");
      const scope = scopeFor(userId);
      return store.write(`study:${scope}`, encode(scope, entry));
    },
  };
}
