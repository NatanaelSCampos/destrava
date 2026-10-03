import { NextResponse } from "next/server";
import { z } from "zod";
import { featureFlags } from "@/lib/feature-flags";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { getAIProvider } from "@/domain/ai/ai-provider";
import { userSpanishRegion } from "@/lib/user-spanish-region";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { frecuenciasA1 } from "@/content/frecuencias-a1";
import { buildLearningMemory } from "@/domain/study/learning-memory";
import { readCourseState } from "@/domain/study/course-state-storage";

const inputSchema = z.object({
  question: z.string().trim().min(3).max(500),
  activityId: z.string().optional(),
  mistakes: z
    .array(
      z.object({
        activityId: z.string(),
        originalAnswer: z.string().max(150),
        correctAnswer: z.string().max(150),
      }),
    )
    .max(3)
    .default([]),
});

export async function POST(request: Request) {
  if (!featureFlags.AI_TUTOR)
    return NextResponse.json({ error: "Professor IA indisponível." }, { status: 503 });
  const guard = await guardAIRequest(request, "tutor");
  if (guard.error) return guard.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Faça uma pergunta de até 500 caracteres." },
      { status: 400 },
    );
  try {
    const region = await userSpanishRegion(guard.userId ?? null);
    const client = guard.userId ? await createSupabaseServerClient() : null;
    const { data } = client
      ? await client
          .from("user_course_state")
          .select("state")
          .eq("user_id", guard.userId)
          .eq("course_id", frecuenciasA1.id)
          .maybeSingle()
      : { data: null };
    const state = data?.state ? readCourseState(data.state, frecuenciasA1.id) : null;
    const relevantMistakes = state
      ? Object.values(state.mistakes ?? {})
          .sort(
            (a, b) =>
              Number(b.activityId === parsed.data.activityId) -
                Number(a.activityId === parsed.data.activityId) || b.timesMissed - a.timesMissed,
          )
          .slice(0, 3)
          .map((item) => ({
            activityId: item.activityId,
            originalAnswer: item.originalAnswer.slice(0, 150),
            correctAnswer: item.correctAnswer.slice(0, 150),
          }))
      : parsed.data.mistakes;
    const result = await getAIProvider().tutor({
      ...parsed.data,
      mistakes: relevantMistakes,
      region,
      memory: state ? buildLearningMemory(state, frecuenciasA1.id) : undefined,
      studentContext: state
        ? {
            goal: (state.profile?.goal ?? "Praticar espanhol").slice(0, 120),
            knownWords: Object.values(state.vocabulary ?? {}).filter(
              (item) => item.status === "known",
            ).length,
            recentDifficulties: relevantMistakes.map((item) => item.correctAnswer.slice(0, 80)),
          }
        : undefined,
    });
    await logAIRequest("tutor", result.usage, guard.reservationId ?? null);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "O professor está indisponível agora. Tente novamente mais tarde." },
      { status: 503 },
    );
  }
}
