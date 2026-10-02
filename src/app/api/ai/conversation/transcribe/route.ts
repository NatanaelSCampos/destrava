import { NextResponse } from "next/server";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { featureFlags } from "@/lib/feature-flags";
import { SpeechTranscriptionError, transcribeSpanishWav } from "@/lib/transcribe-speech";

export async function POST(request: Request) {
  if (!featureFlags.AI_TUTOR)
    return NextResponse.json({ error: "Conversas indisponíveis." }, { status: 503 });
  const guard = await guardAIRequest(request, "conversation_transcription");
  if (guard.error) return guard.error;
  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Envie uma gravação válida." }, { status: 400 });
  try {
    const transcript = await transcribeSpanishWav(file, guard.userId ?? null);
    if (transcript.length > 400)
      return NextResponse.json(
        { error: "A fala ficou longa. Grave uma resposta mais curta." },
        { status: 400 },
      );
    await logAIRequest(
      "conversation_transcription",
      {
        model: "azure-speech",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: null,
      },
      guard.reservationId ?? null,
    );
    return NextResponse.json({ transcript });
  } catch (error) {
    if (error instanceof SpeechTranscriptionError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Transcrição indisponível agora." }, { status: 502 });
  }
}
