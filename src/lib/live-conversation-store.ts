import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { featureFlags } from "./feature-flags";
import { createSupabaseServerClient, getAuthenticatedUser } from "./supabase/server";
import { resolveApplicationRuntime } from "./application-course-runtime";
import { findCourseBundle } from "@/content/course-registry";
import { loadLearningAccess, activityEvidence } from "./learning-access-server";
import { verifyLearningEvidence } from "./signed-learning-evidence";
import { readCourseState } from "@/domain/study/course-state-storage";
import { studiedLiveTopics } from "@/domain/conversation/live-topics";
import { liveReportSchema, type LiveReport, type LiveSettings, type LiveTopicContext, type LiveTurn } from "@/domain/conversation/live-contract";
import { userCourseVariant } from "./user-course-variant";
import { variantLabel } from "@/content/language-variant";
export class LiveFailure extends Error { constructor(public status: number, message: string) { super(message); } }
export function liveAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new LiveFailure(503, "Não foi possível abrir sua conversa agora.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
export async function liveUser(request?: Request) {
  if (!featureFlags.AI_TUTOR) throw new LiveFailure(503, "As conversas estão indisponíveis agora.");
  if (request && request.method !== "GET") {
    const origin = process.env.APP_ORIGIN;
    if (!origin || request.headers.get("origin") !== new URL(origin).origin) throw new LiveFailure(403, "Abra a conversa pelo Destrava.");
  }
  const user = await getAuthenticatedUser();
  if (!user) throw new LiveFailure(401, "Entre na sua conta para conversar.");
  return user;
}
export type LiveRow = {
  id: string; owner_id: string; course_id: string; content_version: string; topic_id: string;
  topic: LiveTopicContext; settings: LiveSettings; status: string; provider_id: string | null;
  started_at: string; deadline_at: string; ended_at: string | null; transcript: LiveTurn[];
  report: LiveReport | null; report_error: string | null; seconds_used: number;
  closure_confirmed: boolean; reservation_id: string;
};
export async function liveRow(owner: string, id: string): Promise<LiveRow> {
  const r = await liveAdmin().from("live_conversation_sessions").select("*").eq("owner_id", owner).eq("id", id).maybeSingle();
  if (r.error) throw new LiveFailure(503, "Não foi possível consultar a conversa.");
  if (!r.data) throw new LiveFailure(404, "Conversa não encontrada.");
  return r.data as LiveRow;
}
export async function patchLive(row: Pick<LiveRow,"id"|"owner_id">, patch: Record<string, unknown>, onlyOpen = false) {
  let q = liveAdmin().from("live_conversation_sessions").update(patch).eq("id", row.id).eq("owner_id", row.owner_id);
  if (onlyOpen) q = q.is("ended_at", null);
  const r = await q;
  if (r.error) throw new LiveFailure(503, "Não foi possível guardar a conversa.");
}
export async function liveCourseContext(userId: string, courseId: string) {
  const selected = await resolveApplicationRuntime(userId, (await cookies()).get("destrava-active-course")?.value);
  if (selected.source !== "compiled" || selected.bundle?.course.id !== courseId)
    throw new LiveFailure(422, "Escolha este curso no seu espaço antes de conversar. Cursos instalados ainda não oferecem conversa por voz.");
  const bundle = findCourseBundle(courseId);
  if (!bundle) throw new LiveFailure(404, "Curso não encontrado.");
  const client = await createSupabaseServerClient();
  if (!client) throw new LiveFailure(503, "Não foi possível conferir seu percurso.");
  const { data, error } = await client.from("user_course_state").select("state").eq("user_id",userId).eq("course_id",courseId).maybeSingle();
  if (error) throw new LiveFailure(503, "Não foi possível conferir o que você já estudou.");
  const state = readCourseState(data?.state ?? {}, courseId, bundle.course.languageCode);
  const access = await loadLearningAccess(userId, bundle.course, bundle.language);
  const studied = new Set<string>();
  const known = new Set(bundle.course.units.flatMap(u=>u.lessons.flatMap(l=>l.activities.map(a=>a.id))));
  const definitions = new Map<string, ReturnType<typeof activityEvidence>>();
  for (const attempt of state.attempts ?? []) {
    if (!known.has(attempt.activityId) || !attempt.serverReceipt) continue;
    let definition = definitions.get(attempt.activityId);
    if (!definition) { definition = activityEvidence(bundle.course, userId, attempt.activityId); definitions.set(attempt.activityId,definition); }
    if (verifyLearningEvidence(attempt.serverReceipt, definition, process.env.SUPABASE_SECRET_KEY ?? "")) studied.add(attempt.activityId);
  }
  const topics = studiedLiveTopics(bundle.course, studied, access);
  const preference = await userCourseVariant(userId, courseId, bundle.language, bundle.course);
  return { bundle, topics, client, language: bundle.resources.languageLabel,
    sourceLanguage: bundle.coursePackage.sourceLanguage,
    variant: variantLabel(bundle.language, preference, bundle.course) };
}
export function livePublicTopic(topic: LiveTopicContext) {
  const { examples: _examples, objectives: _objectives, ...publicTopic } = topic;
  void _examples; void _objectives; return publicTopic;
}
export function liveHistoryRow(row: LiveRow) {
  return { id: row.id, title: row.topic.title, level: row.settings.level, correction: row.settings.correction,
    startedAt: row.started_at, endedAt: row.ended_at, status: row.status,
    report: row.report ? liveReportSchema.parse(row.report) : null,
    transcript: row.transcript, reportError: row.report_error ?? undefined };
}
export const ownerSafetyId = (owner: string) => createHash("sha256").update("destrava-live:"+owner).digest("hex");
