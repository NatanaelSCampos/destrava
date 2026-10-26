"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type SpeakingDraftScope = {
  ownerId: string | null;
  courseId: string;
  contentVersion: string;
  source: "compiled" | "installed";
  installationId?: string;
  artifactHash?: string;
  versionSessionId?: string;
  activityId: string;
  practiceMode: string;
  numberPromptId?: string;
};
export type SpeakingDraft = {
  blob: Blob | null;
  transcription: string;
  updatedAt: number;
  revision: string;
};
type Snapshot = { draft: SpeakingDraft | null; loaded: boolean; pending: boolean; reloadSafe: boolean };
const empty: Snapshot = { draft: null, loaded: false, pending: false, reloadSafe: true };
const snapshots = new Map<string, Snapshot>();
const listeners = new Map<string, Set<() => void>>();
const queues = new Map<string, Promise<unknown>>();

export function speakingDraftKey(scope: SpeakingDraftScope): string {
  return scope.ownerId && scope.courseId && scope.contentVersion ? "destrava:speaking-draft:v1:" + JSON.stringify([
    scope.ownerId, scope.courseId, scope.contentVersion, scope.source,
    scope.installationId ?? null, scope.artifactHash ?? null, scope.versionSessionId ?? null,
    scope.activityId, scope.practiceMode, scope.numberPromptId ?? null,
  ]) : "";
}
function valid(value: unknown): value is SpeakingDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as SpeakingDraft;
  return (draft.blob === null || draft.blob instanceof Blob) && typeof draft.transcription === "string" &&
    typeof draft.updatedAt === "number" && Number.isFinite(draft.updatedAt) && typeof draft.revision === "string";
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Local audio storage unavailable"));
    const request = indexedDB.open("destrava-speaking-drafts", 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("drafts")) request.result.createObjectStore("drafts");
    };
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error("Local audio storage blocked")); };
  });
}
async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("drafts", mode);
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Local audio storage failed"));
      work(tx.objectStore("drafts"), (value) => { result = value; });
    });
  } finally { db.close(); }
}
function queue<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(operation);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => undefined);
  return next;
}
export async function readSpeakingDraft(scope: SpeakingDraftScope): Promise<SpeakingDraft | null> {
  const key = speakingDraftKey(scope);
  if (!key) return null;
  return transaction<SpeakingDraft | null>("readonly", (store, result) => {
    const request = store.get(key);
    request.onsuccess = () => result(valid(request.result) ? request.result : null);
  });
}
export async function writeSpeakingDraft(scope: SpeakingDraftScope, draft: SpeakingDraft): Promise<boolean> {
  const key = speakingDraftKey(scope);
  if (!key || !valid(draft)) return false;
  return queue(key, async () => {
    try { return await transaction<boolean>("readwrite", (store, result) => { store.put(draft, key); result(true); }); }
    catch { return false; }
  });
}
/** Delete only the revision that was explicitly saved; a newer draft remains intact. */
export async function deleteSpeakingDraft(scope: SpeakingDraftScope, expectedRevision: string): Promise<boolean> {
  const key = speakingDraftKey(scope);
  if (!key) return false;
  return queue(key, async () => {
    try {
      return await transaction<boolean>("readwrite", (store, result) => {
        const request = store.get(key);
        request.onsuccess = () => {
          if (!request.result) return result(true);
          if (!valid(request.result) || request.result.revision !== expectedRevision) return result(false);
          store.delete(key); result(true);
        };
      });
    } catch { return false; }
  });
}
function publish(key: string, value: Snapshot) {
  snapshots.set(key, value);
  for (const notify of listeners.get(key) ?? []) notify();
}
export function useSpeakingDraft(scope: SpeakingDraftScope) {
  const key = speakingDraftKey(scope);
  const [anonymous, setAnonymous] = useState<Snapshot>(empty);
  const subscribe = useCallback((notify: () => void) => {
    const set = listeners.get(key) ?? new Set<() => void>();
    set.add(notify); listeners.set(key, set);
    return () => { set.delete(notify); if (!set.size) listeners.delete(key); };
  }, [key]);
  const snapshot = useCallback(() => key ? snapshots.get(key) ?? empty : anonymous, [key, anonymous]);
  const value = useSyncExternalStore(subscribe, snapshot, () => empty);
  useEffect(() => {
    if (!key || snapshots.get(key)?.loaded) return;
    const before = snapshots.get(key) ?? empty;
    let active = true;
    void readSpeakingDraft(scope).then((draft) => {
      if (active && (snapshots.get(key) ?? empty) === before)
        publish(key, { draft, loaded: true, pending: false, reloadSafe: true });
    }).catch(() => {
      if (active && (snapshots.get(key) ?? empty) === before)
        publish(key, { ...before, loaded: true, reloadSafe: false });
    });
    return () => { active = false; };
  }, [key, scope]);
  const update = (change: Partial<Pick<SpeakingDraft, "blob" | "transcription">>) => {
    if (key && !(snapshots.get(key) ?? empty).loaded) return;
    const stamp = { updatedAt: Date.now(), revision: crypto.randomUUID() };
    if (!key) {
      setAnonymous((current) => ({ draft: { blob: null, transcription: "", ...current.draft, ...change, ...stamp }, loaded: true, pending: false, reloadSafe: false }));
      return;
    }
    const current = snapshots.get(key) ?? empty;
    const draft: SpeakingDraft = { blob: null, transcription: "", ...current.draft, ...change, ...stamp };
    const next: Snapshot = { draft, loaded: true, pending: true, reloadSafe: false };
    publish(key, next);
    void writeSpeakingDraft(scope, draft).then((ok) => {
      const latest = snapshots.get(key);
      if (latest?.draft?.revision === draft.revision) publish(key, { ...latest, pending: false, reloadSafe: ok });
    });
  };
  const clearSaved = async (revision: string) => {
    if (!key) return false;
    const ok = await deleteSpeakingDraft(scope, revision);
    const latest = snapshots.get(key);
    if (latest?.draft?.revision !== revision) return false;
    if (ok) publish(key, { draft: null, loaded: true, pending: false, reloadSafe: true });
    return true;
  };
  return { ...value, update, clearSaved };
}
