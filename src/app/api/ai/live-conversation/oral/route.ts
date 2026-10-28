import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { liveUser, liveCourseContext, liveAdmin, LiveFailure } from "@/lib/live-conversation-store";
import { liveBody, liveError, liveHeaders } from "@/lib/live-conversation-http";
import {
  estimateOralCredits,
  oralCreditAccess,
  ORAL_PRICING,
} from "@/domain/conversation/oral-credits";
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("quote"),
      courseId: z.string().min(1).max(100),
      sessionIds: z
        .array(z.uuid())
        .min(1)
        .max(10)
        .refine((v) => new Set(v).size === v.length),
    })
    .strict(),
  z
    .object({
      action: z.literal("analyse"),
      courseId: z.string().min(1).max(100),
      quoteId: z.uuid(),
    })
    .strict(),
]);
export const runtime = "nodejs";
async function balance(owner: string) {
  const r = await liveAdmin()
    .from("conversation_credit_wallets")
    .select("balance")
    .eq("owner_id", owner)
    .maybeSingle();
  if (r.error) throw new LiveFailure(503, "Não foi possível consultar seus créditos.");
  return r.data?.balance ?? 0;
}
export async function GET(request: Request) {
  try {
    const user = await liveUser(request),
      courseId = new URL(request.url).searchParams.get("courseId") ?? "";
    await liveCourseContext(user.id, courseId, "free");
    const admin = liveAdmin(),
      r = await admin
        .from("live_conversation_sessions")
        .select("id,topic,started_at,ended_at,seconds_used")
        .eq("owner_id", user.id)
        .eq("course_id", courseId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(100);
    if (r.error) throw new LiveFailure(503, "Não foi possível consultar suas conversas.");
    const a = r.data.length
      ? await admin
          .from("conversation_audio_assets")
          .select("session_id,status,seconds,expires_at")
          .eq("owner_id", user.id)
          .in(
            "session_id",
            r.data.map((s) => s.id),
          )
      : { data: [], error: null };
    if (a.error) throw new LiveFailure(503, "Não foi possível conferir suas gravações.");
    const assets = new Map((a.data ?? []).map((s) => [s.session_id, s]));
    return NextResponse.json(
      {
        balance: await balance(user.id),
        purchaseAvailable: false,
        executionAvailable: false,
        pricingVersion: ORAL_PRICING.version,
        baseline: estimateOralCredits(600),
        sessions: r.data.map((s) => {
          const asset = assets.get(s.id),
            ready = asset?.status === "ready" && Date.parse(asset.expires_at) > Date.now();
          return {
            id: s.id,
            title: s.topic?.title ?? "Conversa",
            startedAt: s.started_at,
            seconds: Math.max(
              0,
              Math.min(480, Math.ceil(ready ? Number(asset.seconds) : s.seconds_used)),
            ),
            audioReady: ready,
            audioReason: ready
              ? "Gravação disponível"
              : asset?.status === "awaiting_upload"
                ? "Gravação não recebida"
                : asset
                  ? "Gravação indisponível"
                  : "Esta conversa não tem áudio salvo",
          };
        }),
      },
      { headers: liveHeaders },
    );
  } catch (error) {
    return liveError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await liveUser(request),
      input = await liveBody(request, schema, 2500);
    await liveCourseContext(user.id, input.courseId, "free");
    const admin = liveAdmin();
    if (input.action === "analyse") {
      const q = await admin
        .from("conversation_oral_quotes")
        .select("*")
        .eq("id", input.quoteId)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (q.error) throw new LiveFailure(503, "Não foi possível conferir a estimativa.");
      if (!q.data) throw new LiveFailure(404, "Estimativa não encontrada.");
      if (Date.parse(q.data.expires_at) <= Date.now())
        throw new LiveFailure(409, "Esta estimativa expirou. Selecione as conversas novamente.");
      const access = oralCreditAccess(await balance(user.id), q.data.credits, q.data.audio_ready);
      return NextResponse.json(
        {
          error:
            access.reason === "insufficient_credits"
              ? "Você ainda não possui créditos suficientes. A compra será disponibilizada em breve."
              : access.reason === "audio_unavailable"
                ? "As conversas selecionadas não têm gravação disponível."
                : "A análise oral ainda está em preparação.",
          access,
        },
        { status: access.reason === "insufficient_credits" ? 402 : 409, headers: liveHeaders },
      );
    }
    const r = await admin
      .from("live_conversation_sessions")
      .select("id,course_id,seconds_used,ended_at")
      .eq("owner_id", user.id)
      .eq("course_id", input.courseId)
      .in("id", input.sessionIds);
    if (r.error) throw new LiveFailure(503, "Não foi possível conferir suas conversas.");
    if (r.data.length !== input.sessionIds.length || r.data.some((s) => !s.ended_at))
      throw new LiveFailure(404, "Selecione conversas encerradas deste curso.");
    const a = await admin
      .from("conversation_audio_assets")
      .select("session_id,status,seconds,sha256,expires_at")
      .eq("owner_id", user.id)
      .in("session_id", input.sessionIds);
    if (a.error) throw new LiveFailure(503, "Não foi possível conferir as gravações.");
    const assets = new Map(a.data.map((v) => [v.session_id, v]));
    const audioReady = r.data.every((s) => {
      const v = assets.get(s.id);
      return v?.status === "ready" && Date.parse(v.expires_at) > Date.now();
    });
    const seconds = r.data.reduce(
      (n, s) =>
        n +
        Math.max(0, Math.min(480, Number(audioReady ? assets.get(s.id)!.seconds : s.seconds_used))),
      0,
    );
    if (seconds <= 0)
      throw new LiveFailure(422, "Ainda não há duração suficiente para estimar esta seleção.");
    const estimate = estimateOralCredits(seconds, r.data.length),
      ids = [...input.sessionIds].sort();
    const quote = await admin
      .from("conversation_oral_quotes")
      .insert({
        owner_id: user.id,
        session_ids: ids,
        fingerprint: createHash("sha256")
          .update(JSON.stringify(ids.map((id) => ({ id, sha: assets.get(id)?.sha256 ?? null }))))
          .digest("hex"),
        pricing_version: estimate.pricingVersion,
        credits: estimate.credits,
        estimated_provider_usd: estimate.estimatedProviderUsd,
        audio_ready: audioReady,
      })
      .select("id,expires_at")
      .single();
    if (quote.error) throw new LiveFailure(503, "Não foi possível guardar sua estimativa.");
    return NextResponse.json(
      {
        quoteId: quote.data.id,
        expiresAt: quote.data.expires_at,
        ...estimate,
        audioReady,
        previewOnly: !audioReady,
        access: oralCreditAccess(await balance(user.id), estimate.credits, audioReady),
      },
      { headers: liveHeaders },
    );
  } catch (error) {
    return liveError(error);
  }
}
