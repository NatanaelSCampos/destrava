"use client";
import { useEffect, useState } from "react";
import { Mic2, UserRound, Volume2, Check } from "lucide-react";
import { SpeakButton } from "./speak-button";
import { azureLocale, type AzureVoiceGender } from "@/lib/azure-voices";
import { readVoicePreference, saveVoicePreference } from "@/lib/speech-voice-preference";
export function AzureVoiceSettings({
  locale,
  label,
  preview,
}: {
  locale: string;
  label: string;
  preview: string;
}) {
  const [voice, setVoice] = useState<AzureVoiceGender>("female"),
    [error, setError] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVoice(readVoicePreference(locale)), 0);
    return () => clearTimeout(timer);
  }, [locale]);
  if (!azureLocale(locale)) return null;
  return (
    <section className="panel settings-panel audio-settings-panel">
      <span className="eyebrow">
        <Volume2 size={14} aria-hidden="true" /> ÁUDIO DE ESTUDO
      </span>
      <h2>{label}</h2>
      <p>
        Escolha a voz que acompanha seu estudo. A mesma gravação funciona no celular e no
        computador.
      </p>
      <div className="azure-voice-options" role="radiogroup" aria-label={label}>
        {(["female", "male"] as const).map((gender) => (
          <button
            key={gender}
            type="button"
            role="radio"
            aria-checked={voice === gender}
            className={"azure-voice-option" + (voice === gender ? " selected" : "")}
            onClick={() => {
              const ok = saveVoicePreference(locale, gender);
              setError(!ok);
              if (ok) setVoice(gender);
            }}
          >
            <span className="azure-voice-avatar">
              {gender === "female" ? <Mic2 aria-hidden="true" /> : <UserRound aria-hidden="true" />}
            </span>
            <span>
              <strong>Voz {gender === "female" ? "feminina" : "masculina"}</strong>
              <small>Clara, em ritmo de estudo</small>
            </span>
            {voice === gender && <Check size={18} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="audio-settings-preview">
        <p lang={locale}>{preview}</p>
        <SpeakButton locale={locale} text={preview} withLabel label="Ouvir a voz escolhida" />
      </div>
      <small>Preferência salva neste dispositivo, separadamente para cada idioma.</small>
      {error && <p role="alert">Não foi possível salvar sua escolha. Tente novamente.</p>}
    </section>
  );
}
