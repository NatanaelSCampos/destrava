"use client";

import { useState } from "react";
import { Check, Download, LogOut, Settings2 } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SettingsPage() {
  const { state, authUserId, updateProfile } = useStudy();
  const [saved, setSaved] = useState(false);
  const [goal, setGoal] = useState(state.profile.goal);
  const [dailyMinutes, setDailyMinutes] = useState(state.profile.dailyMinutes);
  const [daysPerWeek, setDaysPerWeek] = useState(state.profile.daysPerWeek);
  const [priorKnowledge, setPriorKnowledge] = useState(state.profile.priorKnowledge);
  function save() {
    updateProfile({ goal, dailyMinutes, daysPerWeek, priorKnowledge, onboarded: true });
    setSaved(true);
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "frecuencias-meus-dados.json";
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
    </div>
  );
}
