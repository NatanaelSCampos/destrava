"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import type { UserIdentity } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { rememberGoogleUnlink } from "@/lib/auth/google-consent";

function identityEmail(identity: UserIdentity) {
  const email = identity.identity_data?.email;
  return typeof email === "string" ? email : null;
}

export function LinkedAccounts() {
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const client = createSupabaseBrowserClient();
    if (!client) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setLoading(false);
        setMessageIsError(true);
        setMessage("A autenticação está indisponível. Recarregue a página.");
      });
      return () => {
        cancelled = true;
      };
    }
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
    const googleIdentity = current.data?.identities.find(
      (identity) => identity.id === identityId && identity.provider === "google",
    );
    const hasEmailLogin = current.data?.identities.some((identity) => identity.provider === "email");
    if (current.error || !googleIdentity || !hasEmailLogin) {
      setMessageIsError(true);
      setMessage("Confirme que esta conta também possui entrada por e-mail e senha.");
      setBusy(false);
      return;
    }
    const { error } = await client.auth.unlinkIdentity(googleIdentity);
    setBusy(false);
    if (error) {
      setMessageIsError(true);
      setMessage("Não foi possível desvincular o Google. Tente novamente.");
      return;
    }
    rememberGoogleUnlink();
    setIdentities((previous) => previous.filter((identity) => identity.id !== identityId));
    setMessageIsError(false);
    setMessage("Google desvinculado. No próximo acesso pelo Google neste navegador, você escolherá a conta e autorizará novamente.");
  }

  async function linkGoogle() {
    const client = createSupabaseBrowserClient();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "consent select_account" },
      },
    });
    if (error) {
      setBusy(false);
      setMessageIsError(true);
      setMessage("Não foi possível iniciar a vinculação com o Google. Tente novamente.");
    }
  }

  const emailIdentity = identities.find((identity) => identity.provider === "email");
  const googleIdentity = identities.find((identity) => identity.provider === "google");

  return (
    <section className="panel account-security account-identities">
      <span className="eyebrow">
        <Link2 size={14} /> ACESSO À CONTA
      </span>
      <h2>Contas vinculadas</h2>
      <p>Entre com sua senha ou com o Google quando ele estiver vinculado.</p>
      {loading && <p>Carregando contas…</p>}
      {emailIdentity && (
        <div className="security-method">
          <span className="security-identity-details">
            <strong>E-mail e senha</strong>
            {identityEmail(emailIdentity) && <small>{identityEmail(emailIdentity)}</small>}
          </span>
        </div>
      )}
      {!loading && (emailIdentity || googleIdentity) && (
        <div className="security-method">
          <span className="security-identity-details">
            <strong>Google</strong>
            <small>{googleIdentity ? identityEmail(googleIdentity) ?? "Conta vinculada" : "Não vinculado"}</small>
          </span>
          {googleIdentity && emailIdentity && (
            <button className="secondary-button" disabled={busy} onClick={() => void unlinkGoogle(googleIdentity.id)}>
              {busy ? "Desvinculando…" : "Desvincular"}
            </button>
          )}
          {!googleIdentity && emailIdentity && (
            <button className="secondary-button" disabled={busy} onClick={() => void linkGoogle()}>
              {busy ? "Abrindo Google…" : "Vincular Google"}
            </button>
          )}
          {googleIdentity && !emailIdentity && <small>Única forma de entrada</small>}
        </div>
      )}
      {message && <p className={messageIsError ? "inline-error" : "inline-success"} role="status">{message}</p>}
    </section>
  );
}
