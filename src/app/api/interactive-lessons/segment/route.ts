import { readBoundedLessonBody } from "@/domain/interactive-lesson/request-body";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { unsupportedVersionScope } from "@/lib/versioned-operation-guard";
import { gradeActivity } from "@/domain/activities/grader";
import { evaluateWritingText, assertWellFormedText } from "@/engine/text/representation";
import { userCourseVariant } from "@/lib/user-course-variant";
import { validWav } from "@/lib/azure-speech";
import { LessonIntegrityError } from "@/domain/interactive-lesson/integrity";
import { reduceRuntime } from "@/domain/interactive-lesson/runtime";
import { segmentInputSchema } from "@/domain/interactive-lesson/session-state";
import type { SegmentEvidence } from "@/domain/interactive-lesson/evidence";
import { assertCompiledLessonSelected, assertLessonAvailable, authenticatedLessonDb, digestLessonInput,
  lessonWriter, readLessonSession, resolveLessonContext, saveLessonSession, sessionScope,
  trustedSessionRuntime, publicProgressReceipt } from "@/domain/interactive-lesson/server";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  try {
    // Bound both JSON and multipart bodies before parsing untrusted form fields.
    const bytes = await readBoundedLessonBody(request, 750000);
    let body: unknown;
    let audio: Buffer | undefined;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
      body = Object.fromEntries([...form.entries()].filter(([key]) => key !== "audio"));
      const file = form.get("audio");
      // Canonical mono PCM16 at 16 kHz: 20 s * 16000 samples/s * 2 bytes + 44-byte header.
      if (file instanceof File && file.size <= 640044) audio = Buffer.from(await file.arrayBuffer());
      else throw new LessonIntegrityError("LESSON_INVALID_AUDIO", 400);
    } else {
      try { body = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { throw new LessonIntegrityError("LESSON_INVALID_INPUT", 400); }
    }
    const versionScope = unsupportedVersionScope(body, request);
    if (versionScope) return versionScope;
    await assertCompiledLessonSelected(user.id);
    const parsed = segmentInputSchema.safeParse(body);
    if (!parsed.success) throw new LessonIntegrityError("LESSON_INVALID_INPUT", 400);
    const input = parsed.data;
    const context = resolveLessonContext(input.courseId, input.lessonId);
    assertLessonAvailable(context, input.activityId);
    if (context.bundle.coursePackage.contentVersion !== input.contentVersion) throw new LessonIntegrityError("LESSON_VERSION_CONFLICT");
    const db = await authenticatedLessonDb();
    const row = await readLessonSession(db, user.id, input.courseId, input.lessonId);
    if (!row || row.id !== input.sessionId) throw new LessonIntegrityError("LESSON_SESSION_CONFLICT");
    const scope = sessionScope(context, user.id, row.id);
    const runtime = trustedSessionRuntime(context, row, scope);
    const writer = lessonWriter();
    const inputHash = digestLessonInput({ ...input, userId: user.id,
      definitionHash: scope.definitionHash, ...(audio ? { audioHash: digestLessonInput(audio.toString("base64")) } : {}) });
    const { data: prior, error: readError } = await writer.from("interactive_lesson_receipts")
      .select("input_hash,result").eq("session_id", row.id).eq("attempt_id", input.attemptId).maybeSingle();
    if (readError) throw new LessonIntegrityError("LESSON_READ_FAILED", 503);
    if (prior) {
      if (prior.input_hash !== inputHash) throw new LessonIntegrityError("LESSON_ATTEMPT_CONFLICT");
      return NextResponse.json({ sessionId: row.id, revision: row.revision, runtime, ...prior.result, progressReceipt: publicProgressReceipt(prior.result) },
        { headers: { "Cache-Control": "private, no-store" } });
    }
    if (row.revision !== input.revision) throw new LessonIntegrityError("LESSON_REVISION_CONFLICT");
    const segment = context.definition.segments[runtime.segmentIndex];
    const activity = context.lesson.activities.find((item) => item.id === input.activityId);
    if (!activity || segment.id !== input.segmentId || segment.activityRef !== activity.id ||
      !["checkpoint", "speaking"].includes(runtime.phase) ||
      (runtime.phase === "speaking") !== (segment.type === "speaking")) throw new LessonIntegrityError("LESSON_INVALID_SEGMENT", 400);
    assertWellFormedText(input.answer);
    const preference = await userCourseVariant(user.id, input.courseId, context.bundle.language, context.bundle.course, activity.variant);
    let grade: ReturnType<typeof gradeActivity> = null;
    let kind: SegmentEvidence["kind"];
    let accepted: boolean;
    if (segment.type === "speaking") {
      if (activity.type !== "speaking" || !input.answer.trim() || !audio || !validWav(audio) ||
        audio.readUInt32LE(4) !== audio.length - 8 || audio.readUInt32LE(16) !== 16 ||
        audio.readUInt32LE(28) !== 32000 || audio.readUInt16LE(32) !== 2 || (audio.length - 44) % 2 !== 0)
        throw new LessonIntegrityError("LESSON_INVALID_AUDIO", 400);
      kind = "speaking_submitted";
      accepted = true; // Submitted audio + self-reported transcript; no pronunciation/STT claim.
    } else if (activity.type === "writing") {
      if (audio || !evaluateWritingText(input.answer, activity).accepted) throw new LessonIntegrityError("LESSON_WRITING_INCOMPLETE", 422);
      kind = "writing_submitted";
      accepted = true; // Delivery only, never an objective grade.
    } else {
      if (audio) throw new LessonIntegrityError("LESSON_INVALID_INPUT", 400);
      grade = gradeActivity(activity, input.answer, context.bundle.language.normalization,
        { language: context.bundle.language, course: context.bundle.course, preference });
      if (!grade) throw new LessonIntegrityError("LESSON_CHECKPOINT_UNSUPPORTED", 422);
      kind = "objective_correct";
      accepted = grade.correct;
    }
    const evidence: SegmentEvidence = { ...scope, segmentId: segment.id, activityId: activity.id,
      attemptId: input.attemptId, sequence: input.revision + 1, kind, accepted };
    const next = reduceRuntime(context.definition, runtime, { type: "SEGMENT_EVIDENCE", evidence });
    const saved = await saveLessonSession(writer, scope, input.revision, next, {
      attemptId: input.attemptId, inputHash, evidence, answer: input.answer,
      ...(grade ? { grade } : {}), ...(audio ? { audioBase64: audio.toString("base64") } : {}) });
    return NextResponse.json(saved, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof LessonIntegrityError ? error.code : "LESSON_ATTEMPT_FAILED" },
      { status: error instanceof LessonIntegrityError ? error.status : 503 });
  }
}
