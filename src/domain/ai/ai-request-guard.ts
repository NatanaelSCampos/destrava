import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { AIUsage } from "./ai-provider";

const windows = new Map<string, { count: number; resetAt: number }>();

export async function guardAIRequest(request: Request, feature: string) {
  if (isSupabaseConfigured()) {
    const user = await getAuthenticatedUser();
    if (!user)
      return {
        error: NextResponse.json(
          { error: "Entre na sua conta para usar o professor IA." },
          { status: 401 },
        ),
      };
    const client = await createSupabaseServerClient();
    if (!client)
      return {
        error: NextResponse.json({ error: "Limite de IA indisponível." }, { status: 503 }),
      };
    const { data: assurance, error: assuranceError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || !assurance)
      return {
        error: NextResponse.json(
          { error: "Não foi possível verificar sua sessão." },
          { status: 503 },
        ),
      };
    if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2")
      return {
        error: NextResponse.json(
          { error: "Conclua a verificação em duas etapas." },
          { status: 403 },
        ),
      };
    const { data: reservationId, error } = await client.rpc("reserve_ai_request", {
      p_feature: feature,
    });
    if (error)
      return {
        error: NextResponse.json(
          { error: "Não foi possível verificar o limite de IA. Tente novamente." },
          { status: 503 },
        ),
      };
    if (!reservationId)
      return {
        error: NextResponse.json(
          { error: "Limite de IA por hora atingido. Tente mais tarde." },
          { status: 429 },
        ),
      };
    return { userId: user.id, reservationId: reservationId as string };
  }
  if (process.env.NODE_ENV !== "development")
    return {
      error: NextResponse.json(
        { error: "Configure a autenticação antes de publicar a IA." },
        { status: 503 },
      ),
    };
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const current = windows.get(ip);
  const now = Date.now();
  const next =
    !current || current.resetAt < now
      ? { count: 1, resetAt: now + 60 * 60 * 1000 }
      : { ...current, count: current.count + 1 };
  windows.set(ip, next);
  if (next.count > 20)
    return {
      error: NextResponse.json(
        { error: "Limite temporário de IA atingido. Tente mais tarde." },
        { status: 429 },
      ),
    };
  return { userId: null, reservationId: null };
}

export async function logAIRequest(feature: string, usage: AIUsage, reservationId: string | null) {
  if (reservationId) {
    const client = await createSupabaseServerClient();
    if (!client) throw new Error("Supabase indisponível ao registrar uso de IA");
    const { error } = await client.rpc("complete_ai_request", {
      p_request_id: reservationId,
      p_model: usage.model,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
      p_estimated_cost_usd: usage.estimatedCostUsd,
    });
    if (error) throw error;
  } else {
    console.info("ai_request", {
      feature,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: usage.estimatedCostUsd,
    });
  }
}
