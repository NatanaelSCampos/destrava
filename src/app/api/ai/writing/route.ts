import { NextResponse } from "next/server";
import { z } from "zod";
import { featureFlags } from "@/lib/feature-flags";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { getAIProvider } from "@/domain/ai/ai-provider";
import { frecuenciasA1 } from "@/content/frecuencias-a1";
import { findActivity } from "@/content/schema";

const inputSchema = z.object({
  activityId: z.string().min(1),
  text: z.string().trim().min(20).max(3000),
});

export async function POST(request: Request) {
  if (!featureFlags.AI_WRITING)
    return NextResponse.json({ error: "Correção por IA indisponível." }, { status: 503 });
  const guard = await guardAIRequest(request);
  if (guard.error) return guard.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Escreva um texto entre 20 e 3000 caracteres." },
      { status: 400 },
    );
  const activity = findActivity(frecuenciasA1, parsed.data.activityId);
  if (activity?.type !== "writing")
    return NextResponse.json({ error: "Atividade de escrita não encontrada." }, { status: 404 });
  try {
    const result = await getAIProvider().correctWriting(parsed.data);
    await logAIRequest("writing", result.usage, guard.userId ?? null);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "A correção não está disponível agora. Seu texto pode ser salvo sem IA." },
      { status: 503 },
    );
  }
}
