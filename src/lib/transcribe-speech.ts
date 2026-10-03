import { z } from "zod";
import { speechEndpoint, validWav } from "@/lib/azure-speech";
import { findCourseBundle } from "@/content/course-registry";
import { userCourseVariant } from "@/lib/user-course-variant";
import { speechLocale } from "@/content/language-variant";

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

export async function transcribeWav(file: File, userId: string | null, courseId: string): Promise<string> {
  const bundle = findCourseBundle(courseId);
  if (!bundle) throw new SpeechTranscriptionError("Curso não encontrado.", 404);
  const variant = await userCourseVariant(userId, courseId, bundle.language);
  const locale = speechLocale(bundle.language, variant, "recognitionLocale");
  if (!bundle.language.capabilities.speechRecognition || !locale)
    throw new SpeechTranscriptionError("Transcrição indisponível para este idioma.", 503);
  const endpoint = speechEndpoint();
  const key = process.env.AZURE_SPEECH_KEY;
  if (!endpoint || !key)
    throw new SpeechTranscriptionError("Transcrição de áudio indisponível.", 503);
  if (file.size > 700_000)
    throw new SpeechTranscriptionError("A gravação passou de 20 segundos.", 400);
  const audio = Buffer.from(await file.arrayBuffer());
  if (!validWav(audio))
    throw new SpeechTranscriptionError("Gravação inválida. Grave novamente.", 400);
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
