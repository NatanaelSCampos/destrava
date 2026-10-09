import { NextResponse } from "next/server";
import { z } from "zod";
import { boardElementSchema } from "@/content/contracts";
import { findCourseBundle } from "@/content/course-registry";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { deriveLessonEvents } from "@/domain/interactive-lesson/telemetry";

const boardSchema = z.object({
  elements: z.array(boardElementSchema).max(24), highlightedIds: z.array(z.string()).max(8),
  translationVisible: z.boolean(), caption: z.string().max(300),
  teacherState: z.enum(["speaking", "paused", "listening"]),
});
const runtimeSchema = z.object({
  phase: z.enum(["idle", "presenting", "paused", "intervening", "checkpoint", "speaking", "reinforcement", "completed", "error"]),
  segmentIndex: z.number().int().nonnegative(), positionMs: z.number().int().nonnegative(),
  board: boardSchema, completedSegmentIds: z.array(z.string()).max(32),
  checkpointPassed: z.boolean(), speakingSaved: z.boolean(), checkpointFailures: z.number().int().nonnegative().max(20),
  slowdownCount: z.number().int().nonnegative().max(100),
  resumePoint: z.object({ segmentId: z.string(), playbackPositionMs: z.number().int().nonnegative(),
    anchorMs: z.number().int().nonnegative(), board: boardSchema, reason: z.string().max(40) }).nullable(),
  runtimePath: z.array(z.object({ id: z.string(), segmentId: z.string(), kind: z.enum(["canonical", "reinforcement"]), reason: z.string().optional() })).max(40),
  message: z.string().max(1500),
});
const inputSchema = z.object({ courseId: z.string().min(1), lessonId: z.string().min(1),
  revision: z.number().int().positive().nullable(), runtime: runtimeSchema });

function resolve(courseId: string, lessonId: string) {
  const bundle = findCourseBundle(courseId);
  const lesson = bundle?.coursePackage.units.flatMap((unit) => unit.lessons).find((item) => item.id === lessonId);
  const definition = bundle?.coursePackage.interactiveLessons.find((item) => item.id === lesson?.interactiveLessonRef);
  return bundle && lesson && definition ? { bundle, definition } : null;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  const db = await createSupabaseServerClient();
  if (!user || !db) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId") ?? "";
  const lessonId = url.searchParams.get("lessonId") ?? "";
  if (!resolve(courseId, lessonId)) return NextResponse.json({ error: "Aula não encontrada." }, { status: 404 });
  const { data, error } = await db.from("interactive_lesson_sessions").select("id,revision,content_version,runtime_state")
    .eq("user_id", user.id).eq("course_id", courseId).eq("lesson_id", lessonId).maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível carregar a aula." }, { status: 503 });
  if (!data) return NextResponse.json({ session: null });
  const runtime = runtimeSchema.safeParse(data.runtime_state);
  return NextResponse.json({ session: { ...data, runtime_state: runtime.success ? runtime.data : null } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const db = await createSupabaseServerClient();
  if (!user || !db) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const userId = user.id;
  const client = db;
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 16000) return NextResponse.json({ error: "Estado da aula muito grande." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw || "null"); }
  catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Estado da aula inválido." }, { status: 400 });
  const { courseId, lessonId, runtime, revision } = parsed.data;
  const resolved = resolve(courseId, lessonId);
  if (!resolved) return NextResponse.json({ error: "Aula não encontrada." }, { status: 404 });
  const { bundle, definition } = resolved;
  const segment = definition.segments[runtime.segmentIndex];
  const segmentIds = new Set(definition.segments.map((item) => item.id));
  const canonicalPath = runtime.runtimePath.filter((node) => node.kind === "canonical").map((node) => node.segmentId);
  const expectedPath = definition.segments.map((item) => item.id);
  if (!segment || runtime.positionMs > (segment.presentation?.durationMs ?? 0) ||
      runtime.completedSegmentIds.some((id) => !segmentIds.has(id)) ||
      runtime.completedSegmentIds.some((id, index) => id !== expectedPath[index]) ||
      JSON.stringify(canonicalPath) !== JSON.stringify(expectedPath) ||
      runtime.runtimePath.filter((node) => node.kind === "reinforcement").length > 1 ||
      runtime.runtimePath.some((node) => !segmentIds.has(node.segmentId)) ||
      (runtime.resumePoint && (runtime.phase !== "intervening" || runtime.resumePoint.segmentId !== segment.id)) ||
      (runtime.phase === "checkpoint" && segment.type !== "checkpoint") ||
      (runtime.phase === "speaking" && segment.type !== "speaking") ||
      (runtime.phase === "completed" && (runtime.completedSegmentIds.length !== expectedPath.length ||
        (definition.segments.some((item) => item.type === "checkpoint" && item.required) && !runtime.checkpointPassed) ||
        (definition.segments.some((item) => item.type === "speaking" && item.required) && !runtime.speakingSaved))))
    return NextResponse.json({ error: "Segmento inválido." }, { status: 400 });
  const now = new Date().toISOString();
  const values = { content_version: bundle.coursePackage.contentVersion,
    status: runtime.phase === "completed" ? "completed" : runtime.phase === "paused" || runtime.phase === "intervening" ? "paused" : "in_progress",
    runtime_phase: runtime.phase, current_segment_id: segment.id, playback_position_ms: runtime.positionMs,
    completed_segment_ids: runtime.completedSegmentIds, runtime_path: runtime.runtimePath,
    board_snapshot: runtime.board, resume_anchor_ms: runtime.resumePoint?.anchorMs ?? null,
    runtime_state: runtime, updated_at: now, completed_at: runtime.phase === "completed" ? now : null };
  if (revision === null) {
    const { data, error } = await db.from("interactive_lesson_sessions").insert({
      user_id: user.id, course_id: courseId, lesson_id: lessonId,
      revision: 1, ...values,
    }).select("id,revision").single();
    if (error) return NextResponse.json({ error: "A aula já foi iniciada em outra aba. Recarregue para continuar." }, { status: 409 });
    await logOperationalEvents(null, runtime, data.id);
    return NextResponse.json({ revision: data.revision });
  }
  const { data: previous } = await db.from("interactive_lesson_sessions").select("runtime_state")
    .eq("user_id", user.id).eq("course_id", courseId).eq("lesson_id", lessonId).eq("revision", revision).maybeSingle();
  const { data, error } = await db.from("interactive_lesson_sessions").update({
    ...values, revision: revision + 1,
  }).eq("user_id", user.id).eq("course_id", courseId).eq("lesson_id", lessonId)
    .eq("revision", revision).select("id,revision").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível salvar a aula." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "A aula foi alterada em outra aba ou sua versão mudou. Recarregue." }, { status: 409 });
  const oldRuntime = runtimeSchema.safeParse(previous?.runtime_state);
  await logOperationalEvents(oldRuntime.success ? oldRuntime.data : null, runtime, data.id);
  return NextResponse.json({ revision: data.revision });

  async function logOperationalEvents(previous: z.infer<typeof runtimeSchema> | null,
    current: z.infer<typeof runtimeSchema>, sessionId: string) {
    const events = deriveLessonEvents(previous, current, definition);
    if (!events.length) return;
    const { error } = await client.from("study_events").insert(events.map((event) => ({
      user_id: userId, course_id: courseId, event_type: event.type,
      activity_id: event.activityId ?? null,
      metadata: { courseId, lessonSessionId: sessionId, contentVersion: bundle.coursePackage.contentVersion,
        segmentId: event.segmentId },
    })));
    if (error) console.warn("Interactive lesson telemetry unavailable", { code: error.code });
  }
}
