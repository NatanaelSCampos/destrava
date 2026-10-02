import { NextResponse } from "next/server";
import { z } from "zod";
import { frecuenciasA1 } from "@/content/frecuencias-a1";
import { findActivity } from "@/content/schema";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { getAIProvider } from "@/domain/ai/ai-provider";
import type { Mistake, StudyState } from "@/domain/study/study-state";
import { featureFlags } from "@/lib/feature-flags";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const inputSchema = z.object({
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
  const activity = findActivity(frecuenciasA1, parsed.data.activityId);
  if (!activity) return NextResponse.json({ error: "Atividade não encontrada." }, { status: 404 });

  let mistake: Pick<Mistake, "originalAnswer" | "correctAnswer" | "explanation"> | undefined;
  if (isSupabaseConfigured() && guard.userId) {
    const client = await createSupabaseServerClient();
    if (!client) return NextResponse.json({ error: "Progresso indisponível." }, { status: 503 });
    const { data, error } = await client
      .from("user_study_state")
      .select("state")
      .eq("user_id", guard.userId)
      .maybeSingle();
    if (error)
      return NextResponse.json({ error: "Não foi possível ler seu caderno." }, { status: 503 });
    mistake = (data?.state as StudyState | undefined)?.mistakes?.[parsed.data.activityId];
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
      course: frecuenciasA1.title,
      languageCode: frecuenciasA1.languageCode,
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
