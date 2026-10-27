import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getAuthenticatedUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { readBoundedLessonBody } from "@/domain/interactive-lesson/request-body";
import { synthesizeAzure, azureTtsEndpoint } from "@/lib/azure-speech-tts";
import { azureLocale, azureVoice } from "@/lib/azure-voices";
export const runtime = "nodejs";
const input = z
  .object({
    text: z.string().trim().min(1).max(4000),
    locale: z.string().max(20),
    voice: z.enum(["female", "male"]),
    courseId: z.string().max(100).optional(),
  })
  .strict();
const cache = new Map<string, { audio: Uint8Array; expires: number }>();
export async function POST(request: Request) {
  const origin = process.env.APP_ORIGIN;
  if (!origin || request.headers.get("origin") !== new URL(origin).origin)
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para ouvir." }, { status: 401 });
  let data: z.infer<typeof input>;
  try {
    data = input.parse(
      JSON.parse(new TextDecoder().decode(await readBoundedLessonBody(request, 20_000))),
    );
  } catch {
    return NextResponse.json({ error: "Texto de áudio inválido." }, { status: 400 });
  }
  if (!azureLocale(data.locale) || !azureVoice(data.locale, data.voice))
    return NextResponse.json({ error: "Não há voz para este idioma." }, { status: 422 });
  const key = createHash("sha256")
    .update(JSON.stringify([user.id, data.locale, data.voice, data.text]))
    .digest("hex");
  const stored = cache.get(key);
  if (stored && stored.expires > Date.now())
    return new Response(stored.audio.slice().buffer, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" },
    });
  if (!azureTtsEndpoint() || !process.env.AZURE_SPEECH_KEY)
    return NextResponse.json({ error: "Áudio indisponível neste momento." }, { status: 503 });
  const client = await createSupabaseServerClient();
  const reserved = client
    ? await client.rpc("reserve_ai_request", { p_feature: "speech_synthesis" })
    : null;
  if (!reserved || reserved.error)
    return NextResponse.json(
      { error: "Não foi possível conferir o limite de áudio." },
      { status: 503 },
    );
  if (!reserved.data)
    return NextResponse.json(
      { error: "Limite de áudio atingido. Tente mais tarde." },
      { status: 429 },
    );
  try {
    const audio = await synthesizeAzure(data.text, data.locale, data.voice, request.signal);
    if (cache.size >= 24) cache.delete(cache.keys().next().value!);
    cache.set(key, { audio, expires: Date.now() + 15 * 60_000 });
    await client!.rpc("complete_ai_request", {
      p_request_id: reserved.data,
      p_model: "azure-neural-tts",
      p_input_tokens: 0,
      p_output_tokens: 0,
      p_estimated_cost_usd: null,
    });
    return new Response(audio.slice().buffer, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const quota = error instanceof Error && error.message === "SPEECH_QUOTA";
    return NextResponse.json(
      {
        error: quota
          ? "A cota de áudio foi atingida. Tente mais tarde."
          : "Não foi possível preparar o áudio agora.",
      },
      { status: quota ? 429 : 503 },
    );
  }
}
