"use client";
import { useSyncExternalStore } from "react";
import recordings from "@/content/azure-recordings.json";
import { azureAudioGenderSource } from "@/lib/azure-voices";
import { readVoicePreference } from "@/lib/speech-voice-preference";
const aliases = recordings.aliases as Record<string, string>;
export function recordedAzureSource(src: string, gender: "male" | "female") {
  return azureAudioGenderSource(aliases[src] ?? src, gender);
}
export function useAzureAudioSource(source: string) {
  const canonical = aliases[source] ?? source;
  const locale = /^\/media\/azure\/v1\/([A-Za-z-]+)\//.exec(canonical)?.[1] ?? "";
  const gender = useSyncExternalStore(
    (changed) => {
      window.addEventListener("destrava:voice-preference", changed);
      window.addEventListener("storage", changed);
      return () => {
        window.removeEventListener("destrava:voice-preference", changed);
        window.removeEventListener("storage", changed);
      };
    },
    () => readVoicePreference(locale),
    () => "female" as const,
  );
  return recordedAzureSource(source, gender);
}
