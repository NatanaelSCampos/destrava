"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import type { UserIdentity } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function identityLabel(provider: string) {
  if (provider === "email") return "E-mail e senha";
  if (provider === "google") return "Google";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function identityEmail(identity: UserIdentity) {
  const email = identity.identity_data?.email;
  return typeof email === "string" ? email : null;
}

export function LinkedAccounts() {
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const client = createSupabaseBrowserClient();
    if (!client) return;
    void client.auth.getUserIdentities().then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error) {
        setMessageIsError(true);
        setMessage("Não foi possível carregar as contas vinculadas. Recarregue a página.");
      } else {
        setIdentities(data.identities);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function unlinkGoogle(identityId: string) {
    const client = createSupabaseBrowserClient();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    const current = await client.auth.getUserIdentities();
    const identity = current.data?.identities.find(
      (item) => item.id === identityId && item.provider === "google",
    );
    const hasEmailLogin = current.data?.identities.some((item) => item.provider === "email");
    if (current.error || !identity || !hasEmailLogin || current.data.identities.length < 2) {
      setMessageIsError(true);
      setMessage("Não foi possível confirmar outra forma de entrada para esta conta.");
      setBusy(false);
      setConfirmId(null);
      return;
    }
    const { error } = await client.auth.unlinkIdentity(identity);
    setBusy(false);
    setConfirmId(null);
    if (error) {
      setMessageIsError(true);
      setMessage("Não foi possível desvincular o Google. Verifique se o gerenciamento de identidades está habilitado no Supabase.");
      return;
    }
    setIdentities((previous) => previous.filter((item) => item.id !== identityId));
    const refreshed = await client.auth.getUserIdentities();
    if (!refreshed.error) setIdentities(refreshed.data.identities);
    setMessageIsError(false);
    setMessage("Conta Google desvinculada. Entre com seu e-mail e senha na próxima vez.");
  }

  const hasEmailLogin = identities.some((identity) => identity.provider === "email");

  return (
    <section className="panel account-security account-identities">
      <span className="eyebrow">
        <Link2 size={14} /> ACESSO À CONTA
      </span>
      <h2>Contas vinculadas</h2>
      <p>Veja as formas de entrar na sua conta Destrava.</p>
      {loading && <p>Carregando contas…</p>}
      {identities.map((identity) => (
        <div className="security-method" key={identity.id}>
          <span className="security-identity-details">
            <strong>{identityLabel(identity.provider)}</strong>
            {identityEmail(identity) && <small>{identityEmail(identity)}</small>}
          </span>
          {identity.provider === "google" && hasEmailLogin && identities.length > 1 && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setConfirmId(identity.id);
                setMessage("");
              }}
            >
              Desvincular
            </button>
          )}
          {identity.provider === "google" && !hasEmailLogin && (
            <small>Única forma de entrada</small>
          )}
        </div>
      ))}
      {confirmId && (
        <div className="security-unlink-confirmation">
          <p>
            Desvincular o Google impede novos acessos por ele. Confirme que você sabe sua senha para
            continuar entrando nesta conta.
          </p>
          <div className="security-unlink-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setConfirmId(null)}
            >
              Cancelar
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void unlinkGoogle(confirmId)}
            >
              {busy ? "Desvinculando…" : "Confirmar desvinculação"}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className={messageIsError ? "inline-error" : "inline-success"} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
