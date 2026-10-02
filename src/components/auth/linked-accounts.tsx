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
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [googleBlocked, setGoogleBlocked] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const client = createSupabaseBrowserClient();
    if (!client) return;
    void Promise.all([
      client.auth.getUserIdentities(),
      client.rpc("google_login_is_blocked"),
    ]).then(([identityResult, preferenceResult]) => {
      if (cancelled) return;
      setLoading(false);
      if (identityResult.error || preferenceResult.error) {
        setMessageIsError(true);
        setMessage("Não foi possível carregar as contas vinculadas. Recarregue a página.");
      } else {
        setIdentities(identityResult.data.identities);
        setGoogleBlocked(preferenceResult.data === true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function disableGoogle() {
    const client = createSupabaseBrowserClient();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    const current = await client.auth.getUserIdentities();
    const hasEmailLogin = current.data?.identities.some((item) => item.provider === "email");
    if (current.error || !hasEmailLogin) {
      setMessageIsError(true);
      setMessage("Não foi possível confirmar outra forma de entrada para esta conta.");
      setBusy(false);
      setConfirmDisable(false);
      return;
    }
    const block = await client.rpc("set_google_login_blocked", { p_blocked: true });
    if (block.error || block.data !== true) {
      setMessageIsError(true);
      setMessage("Não foi possível desativar a entrada pelo Google.");
      setBusy(false);
      setConfirmDisable(false);
      return;
    }
    setGoogleBlocked(true);
    for (const identity of current.data.identities.filter((item) => item.provider === "google")) {
      const { error } = await client.auth.unlinkIdentity(identity);
      if (error) {
        setMessageIsError(true);
        setMessage("A entrada pelo Google foi bloqueada, mas o vínculo antigo não pôde ser removido. Entre com sua senha para conferir a conta.");
        setBusy(false);
        setConfirmDisable(false);
        return;
      }
    }
    const refreshed = await client.auth.getUserIdentities();
    if (!refreshed.error) setIdentities(refreshed.data.identities);
    const { error: signOutError } = await client.auth.signOut();
    setBusy(false);
    setConfirmDisable(false);
    if (signOutError) {
      setMessageIsError(true);
      setMessage("Google desativado. Não foi possível encerrar a sessão; clique em Sair da conta.");
      return;
    }
    // Reload the document to clear account-scoped study state after sign-out.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login?googleDisabled=1");
  }

  async function enableGoogle() {
    const client = createSupabaseBrowserClient();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await client.rpc("set_google_login_blocked", { p_blocked: false });
    setBusy(false);
    if (error || data !== true) {
      setMessageIsError(true);
      setMessage("Entre com e-mail e senha para reativar o Google nesta conta.");
      return;
    }
    setGoogleBlocked(false);
    setMessageIsError(false);
    setMessage("Login Google reativado. Ele será vinculado novamente no próximo acesso.");
  }

  async function removeBlockedIdentity(identityId: string) {
    const client = createSupabaseBrowserClient();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    const current = await client.auth.getUserIdentities();
    const identity = current.data?.identities.find(
      (item) => item.id === identityId && item.provider === "google",
    );
    if (current.error || !identity || !current.data.identities.some((item) => item.provider === "email")) {
      setBusy(false);
      setMessageIsError(true);
      setMessage("Não foi possível confirmar outra forma de entrada nesta conta.");
      return;
    }
    const { error } = await client.auth.unlinkIdentity(identity);
    setBusy(false);
    if (error) {
      setMessageIsError(true);
      setMessage("Não foi possível remover o vínculo. A entrada pelo Google continua bloqueada.");
      return;
    }
    setIdentities((previous) => previous.filter((item) => item.id !== identityId));
    setMessageIsError(false);
    setMessage("Vínculo Google removido. A entrada por ele continua bloqueada.");
  }

  const hasEmailLogin = identities.some((identity) => identity.provider === "email");

  return (
    <section className="panel account-security account-identities">
      <span className="eyebrow">
        <Link2 size={14} /> ACESSO À CONTA
      </span>
      <h2>Contas vinculadas</h2>
      <p>Veja as formas de entrar na sua conta Destrava. O Supabase vincula novamente um Google com o mesmo e-mail, a menos que você bloqueie essa entrada.</p>
      {loading && <p>Carregando contas…</p>}
      {identities.map((identity) => (
        <div className="security-method" key={identity.id}>
          <span className="security-identity-details">
            <strong>{identityLabel(identity.provider)}</strong>
            {identityEmail(identity) && <small>{identityEmail(identity)}</small>}
          </span>
          {identity.provider === "google" && !hasEmailLogin && (
            <small>Única forma de entrada</small>
          )}
          {identity.provider === "google" && hasEmailLogin && googleBlocked && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void removeBlockedIdentity(identity.id)}
            >
              Remover vínculo
            </button>
          )}
        </div>
      ))}
      {hasEmailLogin && googleBlocked !== null && (
        <div className="security-method">
          <span className="security-identity-details">
            <strong>Entrada pelo Google</strong>
            <small>{googleBlocked ? "Desativada nesta conta" : "Permitida nesta conta"}</small>
          </span>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setMessage("");
              if (googleBlocked) void enableGoogle();
              else setConfirmDisable(true);
            }}
          >
            {googleBlocked ? "Reativar" : "Desvincular e bloquear"}
          </button>
        </div>
      )}
      {confirmDisable && (
        <div className="security-unlink-confirmation">
          <p>
            O Google será desvinculado e não poderá entrar novamente nesta conta. As sessões em
            outros dispositivos também serão encerradas. Confirme que sabe sua senha antes de continuar.
          </p>
          <div className="security-unlink-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setConfirmDisable(false)}
            >
              Cancelar
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void disableGoogle()}
            >
              {busy ? "Desativando…" : "Confirmar bloqueio"}
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
