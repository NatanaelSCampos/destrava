import voiceProfiles from "@/content/azure-voice-profiles.json";
/** Public voice identities only. Subscription keys and endpoints stay on the server. */
export type AzureVoiceGender = "female" | "male";
export const azureVoices: Record<string, { female: string; male: string }> = voiceProfiles;
export const azureAudioRevision = "v1";
export function azureLocale(value: string) {
  return (
    Object.keys(azureVoices).find(
      (locale) => locale.toLowerCase() === value.replaceAll("_", "-").toLowerCase(),
    ) ?? null
  );
}
export function canonicalSpeechText(text: string) {
  return text
    .trim()
    .replace(/\s*\/\s*/g, ", ")
    .replace(/\s+/g, " ")
    .normalize("NFC");
}
export function azureVoice(locale: string, gender: AzureVoiceGender) {
  const key = azureLocale(locale);
  return key ? azureVoices[key][gender] : null;
}
export function azureAudioPath(locale: string, gender: AzureVoiceGender, textHash: string) {
  const key = azureLocale(locale);
  return key && /^[a-f0-9]{64}$/.test(textHash)
    ? "/media/azure/" + azureAudioRevision + "/" + key + "/" + gender + "/" + textHash + ".mp3"
    : null;
}
export function azureAudioGenderSource(src: string, gender: AzureVoiceGender) {
  return src.replace(
    /^(\/media\/azure\/v1\/[A-Za-z-]+\/)(?:female|male)(\/[a-f0-9]{64}\.mp3)$/,
    "$1" + gender + "$2",
  );
}
