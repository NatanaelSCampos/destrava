import { NextResponse } from "next/server";
import { findImageDescriptionScene } from "@/content/image-description-scenes";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { getAIProvider } from "@/domain/ai/ai-provider";
import { SpeechTranscriptionError, transcribeSpanishWav } from "@/lib/transcribe-speech";
import { userSpanishRegion } from "@/lib/user-spanish-region";
import { featureFlags } from "@/lib/feature-flags";

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
    try {
      transcript = await transcribeSpanishWav(file, guard.userId ?? null);
    } catch (error) {
      if (error instanceof SpeechTranscriptionError)
        return NextResponse.json({ error: error.message }, { status: error.status });
      return NextResponse.json({ error: "Transcrição indisponível agora." }, { status: 502 });
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
