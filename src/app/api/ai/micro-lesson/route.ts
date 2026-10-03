import { NextResponse } from "next/server";
import { z } from "zod";
import { findCourseBundle } from "@/content/course-registry";
import { findActivity } from "@/content/schema";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { getAIProvider } from "@/domain/ai/ai-provider";
import type { Mistake } from "@/domain/study/study-state";
import { readCourseState } from "@/domain/study/course-state-storage";
import { featureFlags } from "@/lib/feature-flags";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const inputSchema = z.object({
  courseId: z.string().min(1).max(80),
  activityId: z.string().min(1).max(120),
  localMistake: z
    .object({
      originalAnswer: z.string().max(500),
      correctAnswer: z.string().max(500),
      explanation: z.string().max(1200),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (!featureFlags.AI_TUTOR)
    return NextResponse.json({ error: "Microlições indisponíveis." }, { status: 503 });
  const guard = await guardAIRequest(request, "micro_lesson");
  if (guard.error) return guard.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Erro de estudo inválido." }, { status: 400 });
  const bundle = findCourseBundle(parsed.data.courseId);
  if (!bundle) return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
  const activity = findActivity(bundle.course, parsed.data.activityId);
  if (!activity) return NextResponse.json({ error: "Atividade não encontrada." }, { status: 404 });

  let mistake: Pick<Mistake, "originalAnswer" | "correctAnswer" | "explanation"> | undefined;
  if (isSupabaseConfigured() && guard.userId) {
    const client = await createSupabaseServerClient();
    if (!client) return NextResponse.json({ error: "Progresso indisponível." }, { status: 503 });
    const { data, error } = await client
      .from("user_course_state")
      .select("state")
      .eq("user_id", guard.userId)
      .eq("course_id", bundle.course.id)
      .maybeSingle();
    if (error)
      return NextResponse.json({ error: "Não foi possível ler seu caderno." }, { status: 503 });
    mistake = data?.state
      ? readCourseState(data.state, bundle.course.id, bundle.course.languageCode).mistakes[parsed.data.activityId]
      : undefined;
  } else if (process.env.NODE_ENV === "development") {
    mistake = parsed.data.localMistake;
  }
  if (!mistake)
    return NextResponse.json(
      { error: "Este erro ainda não está salvo no seu caderno." },
      { status: 404 },
    );

  try {
    const result = await getAIProvider().generateMicroLesson({
      course: bundle.course.title,
      languageCode: bundle.course.languageCode,
      sourceLanguage: bundle.coursePackage.sourceLanguage,
      activityTitle: activity.title,
      activityType: activity.type,
      activityPrompt: activity.prompt.slice(0, 400),
      originalAnswer: mistake.originalAnswer.slice(0, 500),
      correctAnswer: mistake.correctAnswer.slice(0, 500),
      explanation: mistake.explanation.slice(0, 1200),
    });
    await logAIRequest("micro_lesson", result.usage, guard.reservationId ?? null);
    return NextResponse.json({ lesson: result.feedback });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar a microlição agora. Tente novamente." },
      { status: 503 },
    );
  }
}
