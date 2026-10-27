import "server-only";
import {
  azureLocale,
  azureVoice,
  canonicalSpeechText,
  type AzureVoiceGender,
} from "./azure-voices";
export function azureTtsEndpoint() {
  try {
    const configured = new URL(process.env.AZURE_SPEECH_ENDPOINT ?? "");
    if (
      configured.protocol !== "https:" ||
      configured.username ||
      configured.password ||
      configured.port
    )
      return null;
    const regional = /^([a-z0-9-]+)\.api\.cognitive\.microsoft\.com$/.exec(configured.hostname);
    if (regional)
      return new URL("https://" + regional[1] + ".tts.speech.microsoft.com/cognitiveservices/v1");
    if (/^[a-z0-9-]+\.cognitiveservices\.azure\.com$/.test(configured.hostname))
      return new URL("/tts/cognitiveservices/v1", configured);
  } catch {
    /* Configuration is not a healthy provider. */
  }
  return null;
}
const escapeXml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export async function synthesizeAzure(
  text: string,
  locale: string,
  gender: AzureVoiceGender,
  signal?: AbortSignal,
) {
  const endpoint = azureTtsEndpoint(),
    key = process.env.AZURE_SPEECH_KEY,
    voice = azureVoice(locale, gender),
    language = azureLocale(locale);
  const normalized = canonicalSpeechText(text);
  if (!endpoint || !key || !voice || !language || !normalized || normalized.length > 4000)
    throw new Error("SPEECH_UNAVAILABLE");
  const body =
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' +
    language +
    '"><voice name="' +
    voice +
    '"><prosody rate="-8%">' +
    escapeXml(normalized) +
    "</prosody></voice></speak>";
  const response = await fetch(endpoint, {
    method: "POST",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(25000)])
      : AbortSignal.timeout(25000),
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      "User-Agent": "Destrava",
    },
    body,
  });
  if (!response.ok)
    throw new Error(
      response.status === 429 || response.status === 403 ? "SPEECH_QUOTA" : "SPEECH_UNAVAILABLE",
    );
  const audio = new Uint8Array(await response.arrayBuffer());
  if (audio.byteLength < 100 || audio.byteLength > 8_000_000) throw new Error("SPEECH_UNAVAILABLE");
  return audio;
}
