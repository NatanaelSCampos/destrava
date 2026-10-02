"use client";

import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { canAccessWithMfa } from "@/lib/auth/mfa-access";

export default function MfaPage() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    let cancelled = false;
    void (async () => {
      const { data: userResult } = await client.auth.getUser();
      if (cancelled) return;
      if (!userResult.user) {
        // Reload to reset the account-scoped study provider.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login");
        return;
      }
      const access = await canAccessWithMfa(client);
      if (cancelled) return;
      if (access.error) {
        setMessage("Não foi possível verificar sua sessão. Recarregue a página.");
        return;
      }
      if (access.allowed) {
        // Reload to reset the account-scoped study provider.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/dashboard");
        return;
      }
      const { data, error } = await client.auth.mfa.listFactors();
      if (cancelled) return;
      if (error || !data?.totp[0]) {
        setMessage("Nenhum aplicativo autenticador foi encontrado nesta conta.");
        return;
      }
      setFactorId(data.totp[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    const client = createSupabaseBrowserClient();
    if (!client || !factorId || (!mfaVerified && !/^\d{6}$/.test(code))) return;
    setBusy(true);
    setMessage("");
    if (!mfaVerified) {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) {
        setBusy(false);
        setMessage("Código inválido ou expirado. Confira o aplicativo e tente novamente.");
        return;
      }
      setMfaVerified(true);
    }
    if (rememberDevice) {
      try {
        const response = await fetch("/api/auth/trusted-device", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "remember", factorId }),
        });
        if (!response.ok) {
          setBusy(false);
          setMessage("Código confirmado, mas não foi possível salvar este dispositivo. Tente novamente ou desmarque a opção para continuar.");
          return;
        }
      } catch {
        setBusy(false);
        setMessage("Código confirmado, mas não foi possível salvar este dispositivo. Tente novamente ou desmarque a opção para continuar.");
        return;
      }
    }
    // Reload to load the now-authorized study data.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/dashboard");
  }

  async function returnToLogin() {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      // Reload to clear the account-scoped study state before another login.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } catch {
      setBusy(false);
      setMessage("Não foi possível sair desta sessão. Tente novamente.");
    }
  }

  return (
    <main className="auth-step-page">
      <form className="panel auth-step-card" onSubmit={(event) => void verify(event)}>
        <LockKeyhole size={30} aria-hidden="true" />
        <span className="eyebrow">PROTEÇÃO DA CONTA</span>
        <h1>Confirme que é você</h1>
        <p>Digite o código de seis números do seu aplicativo autenticador.</p>
        <div className="field">
          <label htmlFor="mfa-code">Código de verificação</label>
          <input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            required={!mfaVerified}
            autoFocus
            disabled={mfaVerified || busy}
          />
        </div>
        <button className="primary-button" disabled={!factorId || busy || (!mfaVerified && code.length !== 6)}>
          {busy ? "Verificando…" : mfaVerified ? "Continuar" : "Confirmar e entrar"}
        </button>
        <label className="auth-step-remember">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(event.target.checked)}
            disabled={busy}
          />
          Confiar neste dispositivo por 30 dias
        </label>
        <small>Neste navegador, inclusive após sair, o código volta a ser pedido em até 30 dias ou se você remover a confiança. Use apenas no seu dispositivo.</small>
        {message && (
          <p className="inline-error" role="status">
            {message}
          </p>
        )}
        <button type="button" className="auth-step-exit" onClick={() => void returnToLogin()} disabled={busy}>
          Sair e voltar ao login
        </button>
      </form>
    </main>
  );
}
