import { NextResponse } from "next/server";
import { z } from "zod";
import { featureFlags } from "@/lib/feature-flags";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { getAIProvider } from "@/domain/ai/ai-provider";
import { userSpanishRegion } from "@/lib/user-spanish-region";

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
    const result = await getAIProvider().tutor({ ...parsed.data, region });
    await logAIRequest("tutor", result.usage, guard.reservationId ?? null);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "O professor está indisponível agora. Tente novamente mais tarde." },
      { status: 503 },
    );
  }
}
