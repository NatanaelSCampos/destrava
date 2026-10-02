import { z } from "zod";
import { speechEndpoint, validWav } from "@/lib/azure-speech";
import { userSpanishRegion } from "@/lib/user-spanish-region";

const azureSchema = z.object({
  RecognitionStatus: z.string(),
  DisplayText: z.string().optional(),
  NBest: z.array(z.object({ Display: z.string().optional() })).optional(),
});

export class SpeechTranscriptionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function transcribeSpanishWav(file: File, userId: string | null): Promise<string> {
  const endpoint = speechEndpoint();
  const key = process.env.AZURE_SPEECH_KEY;
  if (!endpoint || !key)
    throw new SpeechTranscriptionError("Transcrição de áudio indisponível.", 503);
  if (file.size > 700_000)
    throw new SpeechTranscriptionError("A gravação passou de 20 segundos.", 400);
  const audio = Buffer.from(await file.arrayBuffer());
  if (!validWav(audio))
    throw new SpeechTranscriptionError("Gravação inválida. Grave novamente.", 400);
  const region = await userSpanishRegion(userId);
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
  let response: Response;
  try {
    response = await fetch(endpoint, {
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
  } catch {
    throw new SpeechTranscriptionError("Não foi possível consultar o Azure Speech agora.", 502);
  }
  if (!response.ok)
    throw new SpeechTranscriptionError(
      response.status === 429
        ? "Limite do Azure Speech atingido."
        : "Transcrição indisponível agora.",
      response.status === 429 ? 429 : 502,
    );
  const parsed = azureSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success || parsed.data.RecognitionStatus !== "Success")
    throw new SpeechTranscriptionError(
      "Não consegui reconhecer sua fala. Tente novamente em um lugar silencioso.",
      422,
    );
  const transcript = (parsed.data.NBest?.[0]?.Display ?? parsed.data.DisplayText ?? "").trim();
  if (!transcript) throw new SpeechTranscriptionError("Não consegui reconhecer sua fala.", 422);
  return transcript;
}
