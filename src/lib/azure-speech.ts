export function speechEndpoint() {
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

export function validWav(audio: Buffer) {
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
