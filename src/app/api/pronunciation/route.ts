import { NextResponse } from "next/server";
import { z } from "zod";
import { frecuenciasA1 } from "@/content/frecuencias-a1";
import { findActivity } from "@/content/schema";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import type { PronunciationFeedback } from "@/domain/activities/pronunciation";

const azureResultSchema = z.object({
  RecognitionStatus: z.string(),
  NBest: z
    .array(
      z.object({
        Display: z.string().optional(),
        AccuracyScore: z.number().optional(),
        FluencyScore: z.number().optional(),
        CompletenessScore: z.number().optional(),
        Words: z
          .array(
            z.object({
              Word: z.string(),
              AccuracyScore: z.number().optional(),
              ErrorType: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

function speechEndpoint() {
  const configured = process.env.AZURE_SPEECH_ENDPOINT;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname.endsWith(".cognitiveservices.azure.com"))
      return new URL("/stt/speech/recognition/conversation/cognitiveservices/v1", url);
    const regional = /^([a-z0-9-]+)\.api\.cognitive\.microsoft\.com$/.exec(url.hostname);
    if (regional)
      return new URL(
        `https://${regional[1]}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
      );
    return null;
  } catch {
    return null;
  }
}

function validWav(audio: Buffer) {
  if (audio.length < 44 || audio.length > 700_000) return false;
  if (audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE")
    return false;
  if (audio.toString("ascii", 12, 16) !== "fmt " || audio.toString("ascii", 36, 40) !== "data")
    return false;
  return (
    audio.readUInt16LE(20) === 1 &&
    audio.readUInt16LE(22) === 1 &&
    audio.readUInt32LE(24) === 16_000 &&
    audio.readUInt16LE(34) === 16 &&
    audio.readUInt32LE(40) === audio.length - 44 &&
    audio.length >= 44 + 16_000
  );
}

export async function POST(request: Request) {
  const endpoint = speechEndpoint();
  const key = process.env.AZURE_SPEECH_KEY;
  if (!endpoint || !key)
    return NextResponse.json(
      { error: "Avaliação de pronúncia ainda não configurada." },
      { status: 503 },
    );

  const guard = await guardAIRequest(request);
  if (guard.error) return guard.error;

  const form = await request.formData().catch(() => null);
  const activityId = form?.get("activityId");
  const file = form?.get("audio");
  if (typeof activityId !== "string" || !(file instanceof File))
    return NextResponse.json({ error: "Envie a gravação da atividade." }, { status: 400 });

  const activity = findActivity(frecuenciasA1, activityId);
  if (activity?.type !== "speaking" || !activity.referenceText)
    return NextResponse.json({ error: "Frase de repetição não encontrada." }, { status: 404 });

  if (file.size > 700_000)
    return NextResponse.json({ error: "A gravação passou de 20 segundos." }, { status: 400 });
  const audio = Buffer.from(await file.arrayBuffer());
  if (!validWav(audio))
    return NextResponse.json({ error: "Gravação inválida. Grave novamente." }, { status: 400 });

  const locale = process.env.AZURE_SPEECH_LOCALE === "es-MX" ? "es-MX" : "es-ES";
  endpoint.searchParams.set("language", locale);
  endpoint.searchParams.set("format", "detailed");
  const config = Buffer.from(
    JSON.stringify({
      ReferenceText: activity.referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Word",
      Dimension: "Comprehensive",
      EnableMiscue: true,
    }),
    "utf8",
  ).toString("base64");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Pronunciation-Assessment": config,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        Accept: "application/json",
      },
      body: audio,
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const message =
        response.status === 429
          ? "Limite do Azure Speech atingido. Tente mais tarde."
          : "O serviço de pronúncia está indisponível agora.";
      return NextResponse.json({ error: message }, { status: response.status === 429 ? 429 : 502 });
    }

    await logAIRequest(
      "pronunciation",
      { model: `azure-speech-${locale}`, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null },
      guard.userId ?? null,
    );
    const parsed = azureResultSchema.safeParse(await response.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Resposta inesperada do Azure Speech." }, { status: 502 });
    const result = parsed.data.NBest?.[0];
    if (
      !result ||
      parsed.data.RecognitionStatus !== "Success" ||
      result.AccuracyScore === undefined ||
      result.FluencyScore === undefined ||
      result.CompletenessScore === undefined
    )
      return NextResponse.json(
        { error: "Não consegui reconhecer a frase. Grave novamente em um lugar silencioso." },
        { status: 422 },
      );

    const feedback: PronunciationFeedback = {
      referenceText: activity.referenceText,
      recognizedText: result.Display ?? "",
      accuracy: result.AccuracyScore,
      fluency: result.FluencyScore,
      completeness: result.CompletenessScore,
      words: (result.Words ?? []).map((word) => ({
        text: word.Word,
        accuracy: word.AccuracyScore ?? null,
        errorType: word.ErrorType ?? "None",
      })),
    };
    return NextResponse.json({ feedback });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível consultar o Azure Speech agora." },
      { status: 502 },
    );
  }
}
