import { assertLessonLearningAccess } from "@/domain/interactive-lesson/server";
import { readBoundedLessonBody } from "@/domain/interactive-lesson/request-body";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { unsupportedVersionScope } from "@/lib/versioned-operation-guard";
import { deriveLessonEvents } from "@/domain/interactive-lesson/telemetry";
import {
  LessonIntegrityError,
  validateRuntimeProgress,
} from "@/domain/interactive-lesson/integrity";
import { sessionInputSchema } from "@/domain/interactive-lesson/session-state";
import {
  assertCompiledLessonSelected,
  assertLessonAvailable,
  authenticatedLessonDb,
  lessonWriter,
  newLessonSessionId,
  readLessonSession,
  resolveLessonContext,
  saveLessonSession,
  sessionScope,
  trustedSessionRuntime,
  readCourseLessonProgressReceipts,
} from "@/domain/interactive-lesson/server";

function failure(error: unknown) {
  return NextResponse.json(
    { error: error instanceof LessonIntegrityError ? error.code : "LESSON_UNAVAILABLE" },
    { status: error instanceof LessonIntegrityError ? error.status : 503 },
  );
}
export async function GET(request: Request) {
  const versionScope = unsupportedVersionScope(null, request);
  if (versionScope) return versionScope;
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  try {
    await assertCompiledLessonSelected(user.id);
    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId") ?? "";
    if (url.searchParams.get("receipts") === "1") {
      const receipts = await readCourseLessonProgressReceipts(lessonWriter(), user.id, courseId);
      return NextResponse.json({ receipts }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const lessonId = url.searchParams.get("lessonId") ?? "";
    const context = resolveLessonContext(courseId, lessonId);
    await assertLessonLearningAccess(context, user.id);
    const db = await authenticatedLessonDb();
    const row = await readLessonSession(db, user.id, courseId, lessonId);
    if (!row)
      return NextResponse.json(
        { session: null },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const scope = sessionScope(context, user.id, row.id);
    const runtime = trustedSessionRuntime(context, row, scope);
    // Never project receipt payloads, grading inputs or recorded audio through session reads.
    return NextResponse.json(
      {
        session: {
          id: row.id,
          revision: row.revision,
          content_version: row.content_version,
          runtime_state: runtime,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  try {
    const raw = new TextDecoder().decode(await readBoundedLessonBody(request, 160000));
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }
    const versionScope = unsupportedVersionScope(body, request);
    if (versionScope) return versionScope;
    await assertCompiledLessonSelected(user.id);
    const parsed = sessionInputSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Estado da aula inválido." }, { status: 400 });
    const input = parsed.data;
    const context = resolveLessonContext(input.courseId, input.lessonId);
    await assertLessonLearningAccess(context, user.id);
    assertLessonAvailable(context);
    if (input.contentVersion !== context.bundle.coursePackage.contentVersion)
      throw new LessonIntegrityError("LESSON_VERSION_CONFLICT");
    const db = await authenticatedLessonDb();
    const row = await readLessonSession(db, user.id, input.courseId, input.lessonId);
    if ((row?.revision ?? null) !== input.revision)
      throw new LessonIntegrityError("LESSON_REVISION_CONFLICT");
    const scope = sessionScope(context, user.id, row?.id ?? newLessonSessionId());
    const trusted = trustedSessionRuntime(context, row, scope);
    const runtime = { ...input.runtime, evidenceScope: input.runtime.evidenceScope ?? scope };
    validateRuntimeProgress(context.definition, runtime, trusted, scope);
    const saved = await saveLessonSession(lessonWriter(), scope, input.revision, runtime);
    const events = deriveLessonEvents(row ? trusted : null, saved.runtime, context.definition);
    if (events.length) {
      const { error } = await db
        .from("study_events")
        .insert(
          events.map((event) => ({
            user_id: user.id,
            course_id: input.courseId,
            event_type: event.type,
            activity_id: event.activityId ?? null,
            metadata: {
              courseId: input.courseId,
              lessonSessionId: scope.sessionId,
              contentVersion: scope.contentVersion,
              segmentId: event.segmentId,
            },
          })),
        );
      if (error) console.warn("Interactive lesson telemetry unavailable", { code: error.code });
    }
    return NextResponse.json(saved, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return failure(error);
  }
}
