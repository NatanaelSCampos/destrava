"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, LogOut, Settings2 } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  spanishRegion,
  spanishRegions,
  spanishSpeechLocale,
  type SpanishRegion,
} from "@/content/spanish-regions";
import { AccountSecurity } from "@/components/auth/account-security";
import { LinkedAccounts } from "@/components/auth/linked-accounts";
import { SpeakButton } from "@/components/audio/speak-button";
import {
  normalizedVoiceLocale,
  readSpanishVoicePreference,
  saveSpanishVoicePreference,
  spanishVoiceId,
} from "@/lib/speech-voice-preference";

export default function SettingsPage() {
  const { ready } = useStudy();
  return ready ? <SettingsContent /> : <div className="page-loading">Carregando preferências…</div>;
}

function SettingsContent() {
  const { state, authUserId, updateProfile } = useStudy();
  const [saved, setSaved] = useState(false);
  const [goal, setGoal] = useState(state.profile.goal);
  const [dailyMinutes, setDailyMinutes] = useState(state.profile.dailyMinutes);
  const [daysPerWeek, setDaysPerWeek] = useState(state.profile.daysPerWeek);
  const [priorKnowledge, setPriorKnowledge] = useState(state.profile.priorKnowledge);
  const [region, setRegion] = useState(state.profile.spanishRegion ?? "general");
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const [preferredVoiceId, setPreferredVoiceId] = useState("");
  const [voiceSaveError, setVoiceSaveError] = useState(false);
  const speechLocale = spanishSpeechLocale(spanishRegion(region));
  const matchingVoices = useMemo(
    () =>
      browserVoices
        .filter(
          (voice) => normalizedVoiceLocale(voice.lang) === normalizedVoiceLocale(speechLocale),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [browserVoices, speechLocale],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreferredVoiceId(readSpanishVoicePreference(speechLocale));
      setVoiceSaveError(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [speechLocale]);

  useEffect(() => {
    if (!window.speechSynthesis) {
      const timer = window.setTimeout(() => setVoiceSupported(false), 0);
      return () => window.clearTimeout(timer);
    }
    const synthesis = window.speechSynthesis;
    const refreshVoices = () => {
      setVoiceSupported(true);
      setBrowserVoices(synthesis.getVoices());
    };
    const timer = window.setTimeout(refreshVoices, 0);
    synthesis.addEventListener("voiceschanged", refreshVoices);
    return () => {
      window.clearTimeout(timer);
      synthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, []);
  function save() {
    updateProfile({
      goal,
      dailyMinutes,
      daysPerWeek,
      priorKnowledge,
      spanishRegion: region,
      onboarded: true,
    });
    setSaved(true);
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "destrava-meus-dados.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  async function signOut() {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    await client.auth.signOut();
    // Reload the document to clear the previous account's in-memory study state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <Settings2 size={13} /> SEU ESPAÇO
          </span>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">
            Ajuste sua meta para que a aula de hoje caiba na sua rotina.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <span className="eyebrow">MEU PLANO</span>
          <h2>Objetivo de estudo</h2>
          <div className="settings-form">
            <div className="field">
              <label htmlFor="goal">Por que você quer aprender espanhol?</label>
              <input
                id="goal"
                value={goal}
                onChange={(event) => {
                  setGoal(event.target.value);
                  setSaved(false);
                }}
                maxLength={120}
              />
            </div>
            <div className="settings-form-row">
              <div className="field">
                <label htmlFor="daily-minutes">Tempo por dia</label>
                <select
                  id="daily-minutes"
                  value={dailyMinutes}
                  onChange={(event) => {
                    setDailyMinutes(Number(event.target.value));
                    setSaved(false);
                  }}
                >
                  {[15, 30, 45, 60].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutos
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="days-week">Dias por semana</label>
                <select
                  id="days-week"
                  value={daysPerWeek}
                  onChange={(event) => {
                    setDaysPerWeek(Number(event.target.value));
                    setSaved(false);
                  }}
                >
                  {[2, 3, 4, 5, 6, 7].map((days) => (
                    <option key={days} value={days}>
                      {days} dias
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="prior-knowledge">Conhecimento atual</label>
              <select
                id="prior-knowledge"
                value={priorKnowledge}
                onChange={(event) => {
                  setPriorKnowledge(event.target.value as typeof priorKnowledge);
                  setSaved(false);
                }}
              >
                <option value="none">Estou começando</option>
                <option value="some">Conheço algumas palavras</option>
                <option value="returning">Estou retomando os estudos</option>
              </select>
            </div>
            <div className="field">
              <label>Nível do curso</label>
              <div className="read-only-field">A1 · Iniciante</div>
            </div>
            <div className="field">
              <label htmlFor="spanish-region">Variante de espanhol para estudar</label>
              <select
                id="spanish-region"
                value={region}
                onChange={(event) => {
                  setRegion(event.target.value as SpanishRegion);
                  setSaved(false);
                }}
              >
                {spanishRegions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <small>
                Usada nos exemplos regionais, no áudio disponível no navegador e no professor IA.
              </small>
              {region === "argentina" && (
                <small>
                  A avaliação de pronúncia do Azure usa o modelo configurado para o app, pois não há
                  avaliação es-AR disponível.
                </small>
              )}
            </div>
            <button className="primary-button" onClick={save}>
              <Check size={16} /> Salvar alterações
            </button>
            {saved && (
              <p className="inline-success" role="status">
                Suas preferências foram salvas.
              </p>
            )}
          </div>
        </section>
        <aside>
          <div className="panel settings-data">
            <span className="eyebrow">SEUS DADOS</span>
            <h3>Uma cópia do seu percurso</h3>
            <p>Baixe suas sessões, respostas, vocabulário e progresso deste navegador.</p>
            <button className="secondary-button" onClick={exportData}>
              <Download size={16} /> Exportar dados
            </button>
          </div>
          <div className="settings-note">
            {authUserId
              ? "Seu progresso é salvo nesta conta e uma cópia fica neste navegador."
              : "Os dados desta demonstração ficam neste navegador. A sincronização entre dispositivos dependerá de um projeto Supabase conectado."}
          </div>
          {authUserId && (
            <button className="secondary-button" onClick={() => void signOut()}>
              <LogOut size={16} /> Sair da conta
            </button>
          )}
        </aside>
      </div>
      <section className="panel settings-panel audio-settings-panel">
        <span className="eyebrow">ÁUDIO DE ESTUDO</span>
        <h2>Escolha a voz que você prefere ouvir</h2>
        <p>
          As vozes vêm do navegador e do dispositivo. Por isso, os áudios podem soar diferentes no
          celular e no computador. A pronúncia de letras como C e Z também muda entre regiões do
          espanhol; as duas variantes podem estar corretas.
        </p>
        <div className="settings-form">
          <div className="field">
            <label htmlFor="spanish-voice">Voz para {spanishLocaleLabel(speechLocale)}</label>
            <select
              id="spanish-voice"
              value={
                matchingVoices.some((voice) => spanishVoiceId(voice) === preferredVoiceId)
                  ? preferredVoiceId
                  : ""
              }
              disabled={!voiceSupported}
              onChange={(event) => {
                const next = event.target.value;
                const didSave = saveSpanishVoicePreference(speechLocale, next);
                setVoiceSaveError(!didSave);
                if (didSave) setPreferredVoiceId(next);
              }}
            >
              <option value="">Automática do navegador</option>
              {matchingVoices.map((voice) => (
                <option key={spanishVoiceId(voice)} value={spanishVoiceId(voice)}>
                  {voice.name}
                </option>
              ))}
            </select>
            {voiceSupported === null ? (
              <small>Carregando as vozes deste dispositivo…</small>
            ) : !voiceSupported ? (
              <small>Este navegador não oferece leitura de texto por voz.</small>
            ) : matchingVoices.length === 0 ? (
              <small>
                Nenhuma voz {speechLocale} apareceu neste dispositivo. O navegador tentará outra voz
                espanhola disponível; instale uma voz dessa região para poder escolhê-la aqui.
              </small>
            ) : preferredVoiceId &&
              !matchingVoices.some((voice) => spanishVoiceId(voice) === preferredVoiceId) ? (
              <small>
                A voz salva não está disponível neste dispositivo. Será usada outra voz.
              </small>
            ) : (
              <small>
                A escolha é salva neste dispositivo e aplicada aos botões de áudio do app. Em outro
                dispositivo, escolha a voz novamente.
              </small>
            )}
            {voiceSaveError && (
              <small role="alert">Não foi possível salvar a voz neste navegador.</small>
            )}
          </div>
          <div className="audio-settings-preview">
            <span lang="es">Hola, ¿cómo estás? La casa está cerca.</span>
            <SpeakButton
              text="Hola, ¿cómo estás? La casa está cerca."
              label="Ouvir exemplo com a voz escolhida"
              locale={speechLocale}
              withLabel
            />
          </div>
        </div>
      </section>
      {authUserId && <LinkedAccounts />}
      {authUserId && <AccountSecurity />}
    </div>
  );
}

function spanishLocaleLabel(locale: string) {
  return (
    {
      "es-ES": "espanhol da Espanha",
      "es-MX": "espanhol do México",
      "es-AR": "espanhol da Argentina",
    }[locale] ?? "espanhol"
  );
}
