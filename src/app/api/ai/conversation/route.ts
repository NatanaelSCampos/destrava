import { NextResponse } from "next/server";
import { z } from "zod";
import { featureFlags } from "@/lib/feature-flags";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { getAIProvider } from "@/domain/ai/ai-provider";
import { findConversationScenario } from "@/content/conversation-scenarios";
import { frecuenciasA1 } from "@/content/frecuencias-a1";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { spanishRegion, spanishRegions } from "@/content/spanish-regions";
import type { StudyState } from "@/domain/study/study-state";
import { buildLearningMemory } from "@/domain/study/learning-memory";

const inputSchema = z.object({
  mode: z.enum(["free", "mission"]),
  scenarioId: z.string().max(50).nullable(),
  topic: z.string().trim().max(80),
  pace: z.enum(["beginner", "intermediate", "natural"]),
  correction: z.enum(["instant", "important_only", "end_of_conversation", "off"]),
  history: z
    .array(
      z.object({ role: z.enum(["student", "partner"]), text: z.string().trim().min(1).max(500) }),
    )
    .max(16),
  message: z.string().trim().min(1).max(400),
});

export async function POST(request: Request) {
  if (!featureFlags.AI_TUTOR)
    return NextResponse.json({ error: "Conversas indisponíveis." }, { status: 503 });
  const guard = await guardAIRequest(request, "conversation");
  if (guard.error) return guard.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Mensagem ou configuração inválida." }, { status: 400 });
  const input = parsed.data;
  const scenario =
    input.mode === "mission" ? findConversationScenario(input.scenarioId) : undefined;
  if ((input.mode === "mission" && !scenario) || (input.mode === "free" && input.topic.length < 3))
    return NextResponse.json({ error: "Escolha uma missão ou um assunto." }, { status: 400 });

  try {
    const client = guard.userId ? await createSupabaseServerClient() : null;
    const { data } = client
      ? await client
          .from("user_study_state")
          .select("state")
          .eq("user_id", guard.userId)
          .maybeSingle()
      : { data: null };
    const state = data?.state as StudyState | null | undefined;
    const region = spanishRegion(state?.profile?.spanishRegion);
    const currentUnit = frecuenciasA1.units.find((unit) =>
      unit.lessons.some((lesson) =>
        lesson.activities.some((activity) => !state?.completedActivityIds?.includes(activity.id)),
      ),
    );
    const result = await getAIProvider().conversationTurn({
      ...input,
      scenario,
      context: {
        course: frecuenciasA1.title,
        level: frecuenciasA1.level,
        unit: currentUnit?.title ?? frecuenciasA1.units.at(-1)?.title ?? "Curso A1",
        goal: (state?.profile?.goal ?? "Praticar conversação").slice(0, 120),
        knownWords: Object.values(state?.vocabulary ?? {}).filter((item) => item.status === "known")
          .length,
        difficulty: Object.values(state?.mistakes ?? {})
          .sort((a, b) => b.timesMissed - a.timesMissed)
          .slice(0, 3)
          .map((item) => item.correctAnswer.slice(0, 100)),
        region: spanishRegions.find((item) => item.id === region)?.label ?? "Geral",
        memory: state ? buildLearningMemory(state, frecuenciasA1.id) : undefined,
      },
    });
    const allowed = new Set(scenario?.objectives.map((item) => item.id) ?? []);
    await logAIRequest("conversation", result.usage, guard.reservationId ?? null);
    return NextResponse.json({
      reply: result.feedback.reply.trim().slice(0, 800),
      correction: input.correction === "off" ? "" : result.feedback.correction.trim().slice(0, 400),
      correctionCategory:
        input.correction === "off" || !result.feedback.correction.trim()
          ? "none"
          : result.feedback.correctionCategory,
      completedObjectiveIds: result.feedback.completedObjectiveIds.filter((id) => allowed.has(id)),
    });
  } catch {
    return NextResponse.json(
      { error: "A conversa está indisponível agora. Tente novamente." },
      { status: 503 },
    );
  }
}
