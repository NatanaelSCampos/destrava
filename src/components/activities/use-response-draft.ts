"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useStudy } from "@/components/study-provider";

type ResponseDraft = { answer?: string; ordered?: string[]; writing?: string };
const fallback = new Map<string, string>();
const event = "destrava-response-draft";
function read(key: string) {
  if (!key) return "";
  if (fallback.has(key)) return fallback.get(key)!;
  try { return sessionStorage.getItem(key) ?? ""; }
  catch { return fallback.get(key) ?? ""; }
}
function valid(value: unknown): value is ResponseDraft {
  if (!value || typeof value !== "object") return false;
  const data = value as ResponseDraft;
  return (data.answer === undefined || typeof data.answer === "string") &&
    (data.writing === undefined || typeof data.writing === "string") &&
    (data.ordered === undefined || (Array.isArray(data.ordered) && data.ordered.every(item => typeof item === "string")));
}
export function useResponseDraft(activityId: string) {
  const { authUserId, course, runtime } = useStudy();
  const key = authUserId ? "destrava:draft:v1:" + JSON.stringify([
    authUserId, course.id, course.contentVersion, runtime ? "installed" : "compiled",
    runtime?.reference.installationId ?? null, runtime?.reference.artifactHash ?? null,
    runtime?.versionSessionId ?? null, activityId,
  ]) : "";
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(event, notify);
    window.addEventListener("storage", notify);
    return () => { window.removeEventListener(event, notify); window.removeEventListener("storage", notify); };
  }, []);
  const snapshot = useCallback(() => read(key), [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const value = useMemo<ResponseDraft>(() => {
    try { const data: unknown = JSON.parse(raw); return valid(data) ? data : {}; } catch { return {}; }
  }, [raw]);
  const update = useCallback((change: Partial<ResponseDraft> | ((current: ResponseDraft) => Partial<ResponseDraft>)) => {
    if (!key) return;
    let current: ResponseDraft = {};
    try { const parsed: unknown = JSON.parse(read(key)); if (valid(parsed)) current = parsed; } catch { /* New draft. */ }
    const next = JSON.stringify({ ...current, ...(typeof change === "function" ? change(current) : change) });
    fallback.set(key, next);
    try { sessionStorage.setItem(key, next); } catch { /* In-memory fallback does not promise reload durability. */ }
    window.dispatchEvent(new Event(event));
  }, [key]);
  const persistence = useCallback(() => {
    if (!key || !read(key)) return true;
    try { return sessionStorage.getItem(key) === read(key); } catch { return false; }
  }, [key]);
  const reloadSafe = useSyncExternalStore(subscribe, persistence, () => true);
  return { value, update, reloadSafe };
}
