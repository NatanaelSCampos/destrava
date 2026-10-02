import { NextResponse } from "next/server";
import { z } from "zod";
import { findImageDescriptionScene } from "@/content/image-description-scenes";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { getAIProvider } from "@/domain/ai/ai-provider";
import { speechEndpoint, validWav } from "@/lib/azure-speech";
import { userSpanishRegion } from "@/lib/user-spanish-region";
import { featureFlags } from "@/lib/feature-flags";

const azureSchema = z.object({
  RecognitionStatus: z.string(),
  DisplayText: z.string().optional(),
  NBest: z.array(z.object({ Display: z.string().optional() })).optional(),
});

export async function POST(request: Request) {
  if (!featureFlags.AI_TUTOR)
    return NextResponse.json({ error: "Atividade indisponível." }, { status: 503 });
  const guard = await guardAIRequest(request, "image_description");
  if (guard.error) return guard.error;
  const form = await request.formData().catch(() => null);
  const sceneId = form?.get("sceneId");
  const scene = typeof sceneId === "string" ? findImageDescriptionScene(sceneId) : undefined;
  const file = form?.get("audio");
  const text = form?.get("text");
  if (!scene || (file instanceof File && typeof text === "string"))
    return NextResponse.json({ error: "Escolha uma cena e envie uma resposta." }, { status: 400 });

  let transcript = typeof text === "string" ? text.trim() : "";
  if (file instanceof File) {
    const endpoint = speechEndpoint();
    const key = process.env.AZURE_SPEECH_KEY;
    if (!endpoint || !key)
      return NextResponse.json({ error: "Transcrição de áudio indisponível." }, { status: 503 });
    if (file.size > 700_000)
      return NextResponse.json({ error: "A gravação passou de 20 segundos." }, { status: 400 });
    const audio = Buffer.from(await file.arrayBuffer());
    if (!validWav(audio))
      return NextResponse.json({ error: "Gravação inválida. Grave novamente." }, { status: 400 });
    const region = await userSpanishRegion(guard.userId ?? null);
    const locale =
      region === "mexico"
        ? "es-MX"
        : region === "spain"
          ? "es-ES"
          : process.env.AZURE_SPEECH_LOCALE === "es-MX"
            ? "es-MX"
            : "es-ES";
    endpoint.searchParams.set("language", locale);
    endpoint.searchParams.set("format", "detailed");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
          Accept: "application/json",
        },
        body: audio,
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
      if (!response.ok)
        return NextResponse.json(
          {
            error:
              response.status === 429
                ? "Limite do Azure Speech atingido."
                : "Transcrição indisponível agora.",
          },
          { status: response.status === 429 ? 429 : 502 },
        );
      const parsed = azureSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.RecognitionStatus !== "Success")
        return NextResponse.json(
          { error: "Não consegui reconhecer sua fala. Tente novamente em um lugar silencioso." },
          { status: 422 },
        );
      transcript = (parsed.data.NBest?.[0]?.Display ?? parsed.data.DisplayText ?? "").trim();
    } catch {
      return NextResponse.json(
        { error: "Não foi possível consultar o Azure Speech agora." },
        { status: 502 },
      );
    }
  }
  if (transcript.length < 5 || transcript.length > 600)
    return NextResponse.json(
      { error: "Descreva a imagem em uma frase de 5 a 600 caracteres." },
      { status: 400 },
    );
  try {
    const region = await userSpanishRegion(guard.userId ?? null);
    const result = await getAIProvider().evaluateImageDescription({
      sceneTitle: scene.title,
      sceneFacts: scene.facts,
      transcript,
      region,
    });
    await logAIRequest("image_description", result.usage, guard.reservationId ?? null);
    return NextResponse.json({
      transcript,
      feedback: result.feedback,
      inputMode: file instanceof File ? "speech" : "text",
    });
  } catch {
    return NextResponse.json(
      { error: "A análise está indisponível agora. Tente novamente." },
      { status: 503 },
    );
  }
}
