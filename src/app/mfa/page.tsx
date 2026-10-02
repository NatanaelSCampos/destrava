"use client";

import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function MfaPage() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
      const { data: assurance, error: assuranceError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (assuranceError || !assurance) {
        setMessage("Não foi possível verificar sua sessão. Recarregue a página.");
        return;
      }
      if (assurance.nextLevel !== "aal2" || assurance.currentLevel === "aal2") {
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
    if (!client || !factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) {
      setMessage("Código inválido ou expirado. Confira o aplicativo e tente novamente.");
      return;
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
            required
            autoFocus
          />
        </div>
        <button className="primary-button" disabled={!factorId || busy || code.length !== 6}>
          {busy ? "Verificando…" : "Confirmar e entrar"}
        </button>
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
