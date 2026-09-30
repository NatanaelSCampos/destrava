import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { AIUsage } from "./ai-provider";

const windows = new Map<string, { count: number; resetAt: number }>();

export async function guardAIRequest(request: Request) {
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
    if (client) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await client
        .from("ai_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", hourAgo);
      if ((count ?? 0) >= 20) {
        return {
          error: NextResponse.json(
            { error: "Limite de IA por hora atingido. Tente mais tarde." },
            { status: 429 },
          ),
        };
      }
    }
    return { userId: user.id };
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
  return { userId: null };
}

export async function logAIRequest(feature: string, usage: AIUsage, userId: string | null) {
  const client = userId ? await createSupabaseServerClient() : null;
  if (client && userId) {
    await client.from("ai_requests").insert({
      user_id: userId,
      feature,
      model: usage.model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      estimated_cost_usd: usage.estimatedCostUsd,
    });
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
