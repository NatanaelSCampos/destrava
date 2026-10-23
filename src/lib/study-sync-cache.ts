import { readPersistedCourseState } from "@/domain/study/course-state-storage";
import type { StudySyncCache } from "@/domain/study/study-progress-sync";
import type { InstalledRuntimeContext } from "@/lib/installed-runtime-types";

const storageKey = "destrava-study:v2:demo";
const legacyStorageKey = "frecuencias-study:v1:demo";

export function browserStudySyncCache(
  courseId: string,
  languageCode: string,
  runtime?: InstalledRuntimeContext,
): StudySyncCache {
  const keyFor = (userId: string | null) =>
    runtime
      ? `destrava-installed-study:v1:${userId}:${runtime.reference.installationId}:${runtime.reference.artifactHash}:${runtime.versionSessionId}`
      : userId
        ? `${storageKey}:${userId}:${courseId}`
        : `${storageKey}:${courseId}`;
  const read = (key: string, legacy = false) => {
    const value = window.localStorage.getItem(key);
    return value === null
      ? null
      : readPersistedCourseState(JSON.parse(value), courseId, languageCode, legacy);
  };
  return {
    read(userId) {
      if (runtime && userId !== runtime.userId) return { state: null, pending: null, recovery: [] };
      const key = keyFor(userId);
      const pending = read(`${key}:pending`);
      const recoveryValue = window.localStorage.getItem(`${key}:recovery`);
      const recovery = recoveryValue === null ? [] : JSON.parse(recoveryValue);
      if (!Array.isArray(recovery)) throw new Error("Cópia local de recuperação ilegível.");
      return {
        state:
          read(key) ??
          (runtime
            ? null
            : userId
              ? (read(`${legacyStorageKey}:${userId}:${courseId}`, true) ??
                read(`${legacyStorageKey}:${userId}`, true))
              : (read(`${legacyStorageKey}:${courseId}`, true) ?? read(legacyStorageKey, true))),
        pending,
        recovery: recovery.map((raw) => readPersistedCourseState(raw, courseId, languageCode)!),
      };
    },
    write(userId, entry) {
      if (runtime && userId !== runtime.userId)
        throw new Error("O contexto local não pertence à conta atual.");
      const key = keyFor(userId);
      // Save recovery copies first; a storage quota failure must not replace them with remote state.
      if (entry.recovery.length)
        window.localStorage.setItem(`${key}:recovery`, JSON.stringify(entry.recovery));
      if (entry.pending)
        window.localStorage.setItem(`${key}:pending`, JSON.stringify(entry.pending));
      else window.localStorage.removeItem(`${key}:pending`);
      if (entry.state) window.localStorage.setItem(key, JSON.stringify(entry.state));
    },
  };
}
