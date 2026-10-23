import { interactiveLessonProgressReceiptSchema } from "./progress-receipt";
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { findCourseBundle } from "@/content/course-registry";
import { publicCourse } from "@/content/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canonicalJson, type LessonEvidenceScope } from "./evidence";
import { LessonIntegrityError, recoverLegacyRuntime } from "./integrity";
import { initialRuntime, type LessonRuntimeState } from "./runtime";
import { runtimeSchema } from "./session-state";

export const digestLessonInput = (input: unknown) => createHash("sha256").update(canonicalJson(input)).digest("hex");
export function resolveLessonContext(courseId: string, lessonId: string) {
  const bundle = findCourseBundle(courseId);
  const ownerUnit = bundle?.course.units.find((unit) => unit.lessons.some((item) => item.id === lessonId));
  const lesson = ownerUnit?.lessons.find((item) => item.id === lessonId);
  const definition = bundle?.coursePackage.interactiveLessons.find((item) => item.id === lesson?.interactiveLessonRef);
  if (!bundle || !ownerUnit?.active || !lesson?.active || !definition) throw new LessonIntegrityError("LESSON_NOT_FOUND", 404);
  // Pin all private grading inputs, including normalization and course variant policy.
  const definitionHash = digestLessonInput({ definition, course: bundle.coursePackage, language: bundle.language });
  return { bundle, lesson, definition, definitionHash };
}
export function assertLessonAvailable(context: ReturnType<typeof resolveLessonContext>, activityId?: string) {
  const course = publicCourse(context.bundle.course, context.bundle.language);
  const availability = course.availability;
  const ownerUnit = course.units.find((unit) => unit.lessons.some((lesson) => lesson.id === context.lesson.id));
  if (!ownerUnit || availability?.unavailableUnitIds?.includes(ownerUnit.id) ||
    availability?.unavailableInteractiveLessonIds?.includes(context.definition.id) ||
    (activityId && availability?.unavailableActivityIds.includes(activityId)))
    throw new LessonIntegrityError("LESSON_UNAVAILABLE", 503);
}
export async function assertCompiledLessonSelected(userId: string) {
  if (process.env.DESTRAVA_LOCAL_ONLY === "1" && process.env.NODE_ENV !== "production") {
    const { isSelectedInstalled } = await import("@/lib/application-course-runtime");
    if (await isSelectedInstalled(userId)) throw new LessonIntegrityError("INSTALLED_LESSON_UNSUPPORTED", 422);
  }
}
export type LessonSession = { id: string; revision: number; content_version: string;
  definition_hash: string | null; runtime_state: unknown };
export async function readLessonSession(db: SupabaseClient, userId: string, courseId: string, lessonId: string) {
  const { data, error } = await db.from("interactive_lesson_sessions")
    .select("id,revision,content_version,definition_hash,runtime_state")
    .eq("user_id", userId).eq("course_id", courseId).eq("lesson_id", lessonId).maybeSingle();
  if (error) throw new LessonIntegrityError("LESSON_READ_FAILED", 503);
  return data as LessonSession | null;
}
export function sessionScope(context: ReturnType<typeof resolveLessonContext>, userId: string, sessionId: string): LessonEvidenceScope {
  return { userId, sessionId, courseId: context.bundle.course.id, lessonId: context.lesson.id,
    contentVersion: context.bundle.coursePackage.contentVersion, definitionHash: context.definitionHash };
}
export function trustedSessionRuntime(context: ReturnType<typeof resolveLessonContext>, row: LessonSession | null,
  scope: LessonEvidenceScope): LessonRuntimeState {
  if (!row) return initialRuntime(context.definition, scope);
  if (row.content_version !== scope.contentVersion || (row.definition_hash && row.definition_hash !== scope.definitionHash))
    throw new LessonIntegrityError("LESSON_VERSION_CONFLICT");
  if (!row.definition_hash) return recoverLegacyRuntime(context.definition, scope);
  const parsed = runtimeSchema.safeParse(row.runtime_state);
  if (!parsed.success) throw new LessonIntegrityError("LESSON_STATE_UNREADABLE", 503);
  return parsed.data as LessonRuntimeState;
}
// A private server client is required only after the authenticated owner/MFA guard.
export function lessonWriter() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new LessonIntegrityError("LESSON_WRITER_UNAVAILABLE", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function authenticatedLessonDb() {
  const db = await createSupabaseServerClient();
  if (!db) throw new LessonIntegrityError("LESSON_READ_FAILED", 503);
  return db;
}
export type LessonAttempt = { attemptId: string; inputHash: string; evidence: unknown; answer: string;
  grade?: unknown; audioBase64?: string };
export async function saveLessonSession(writer: SupabaseClient, scope: LessonEvidenceScope, revision: number | null,
  runtime: LessonRuntimeState, attempt: LessonAttempt | null = null) {
  const { data, error } = await writer.rpc("save_interactive_lesson_session", {
    p_user_id: scope.userId, p_session_id: scope.sessionId, p_course_id: scope.courseId,
    p_lesson_id: scope.lessonId, p_content_version: scope.contentVersion, p_definition_hash: scope.definitionHash,
    p_expected_revision: revision, p_runtime: runtime, p_attempt: attempt,
  });
  if (error) {
    const conflict = /LESSON_(REVISION|VERSION|ATTEMPT)_CONFLICT/.test(error.message);
    throw new LessonIntegrityError(conflict ? "LESSON_CONFLICT" : "LESSON_SAVE_FAILED", conflict ? 409 : 503);
  }
  if (!data?.id || !Number.isInteger(data.revision) || !runtimeSchema.safeParse(data.runtime_state).success)
    throw new LessonIntegrityError("LESSON_SAVE_FAILED", 503);
  return { sessionId: data.id as string, revision: data.revision as number,
    runtime: data.runtime_state as LessonRuntimeState, ...(data.receipt ? { ...data.receipt, progressReceipt: publicProgressReceipt(data.receipt) } : {}) };
}
export function newLessonSessionId() { return randomUUID(); }

/** Only own, current receipts; no bytea, Storage path or private activity definition crosses HTTP. */
export function publicProgressReceipt(result: unknown) {
  const parsed = interactiveLessonProgressReceiptSchema.omit({ recordingIds: true }).parse(result);
  const activityId = parsed.evidence.activityId;
  const keys = ["mistake:", "schedule:"].map((prefix) => prefix + activityId).concat(
    ["exercise_correct", "exercise_wrong", "exercise_answered", "lesson_completed"].map((event) => "event:" + event + ":" + activityId));
  const recordingIds = Object.fromEntries(keys.map((key) => {
    const hex = digestLessonInput(parsed.evidence.attemptId + ":" + key);
    return [key, hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16) + "-8" + hex.slice(17, 20) + "-" + hex.slice(20, 32)];
  }));
  return interactiveLessonProgressReceiptSchema.parse({ ...parsed, recordingIds });
}
export async function readCourseLessonProgressReceipts(writer: SupabaseClient, userId: string, courseId: string) {
  if (!findCourseBundle(courseId)) throw new LessonIntegrityError("LESSON_NOT_FOUND", 404);
  const rows: { result: unknown }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await writer.from("interactive_lesson_receipts").select("result")
      .eq("user_id", userId).eq("result->evidence->>courseId", courseId)
      .order("created_at", { ascending: true }).order("attempt_id", { ascending: true }).range(offset, offset + 499);
    if (error || !data) throw new LessonIntegrityError("LESSON_READ_FAILED", 503);
    rows.push(...data);
    if (data.length < 500) break;
    if (rows.length >= 20000) throw new LessonIntegrityError("LESSON_RECEIPT_LIMIT", 503);
  }
  const contexts = new Map<string, ReturnType<typeof resolveLessonContext>>();
  return rows.flatMap((row) => {
    const receipt = publicProgressReceipt(row.result);
    const evidence = receipt.evidence;
    if (evidence.userId !== userId || evidence.courseId !== courseId) throw new LessonIntegrityError("LESSON_INVALID_SCOPE", 503);
    let context = contexts.get(evidence.lessonId);
    if (!context) {
      try { context = resolveLessonContext(courseId, evidence.lessonId); }
      catch (error) {
        if (error instanceof LessonIntegrityError && error.status === 404) return [];
        throw error;
      }
      contexts.set(evidence.lessonId, context);
    }
    if (evidence.contentVersion !== context.bundle.coursePackage.contentVersion || evidence.definitionHash !== context.definitionHash) return [];
    return [receipt];
  });
}
