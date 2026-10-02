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
    setMessage("Login Google reativado. Você poderá entrar com Google novamente.");
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
    setMessage("Vínculo removido. O login continua bloqueado; uma nova tentativa pelo Google pode recriar o vínculo sem permitir o acesso.");
  }

  const hasEmailLogin = identities.some((identity) => identity.provider === "email");
  const googleIdentity = identities.find((identity) => identity.provider === "google");

  return (
    <section className="panel account-security account-identities">
      <span className="eyebrow">
        <Link2 size={14} /> ACESSO À CONTA
      </span>
      <h2>Formas de acesso</h2>
      <p>Confira quais formas de login estão permitidas na sua conta Destrava.</p>
      {loading && <p>Carregando contas…</p>}
      {identities.filter((identity) => identity.provider !== "google").map((identity) => (
        <div className="security-method" key={identity.id}>
          <span className="security-identity-details">
            <strong>{identityLabel(identity.provider)}</strong>
            {identityEmail(identity) && <small>{identityEmail(identity)}</small>}
          </span>
        </div>
      ))}
      {googleBlocked !== null && (hasEmailLogin || googleIdentity) && (
        <div className="security-method">
          <span className="security-identity-details">
            <strong>Google</strong>
            {googleIdentity && identityEmail(googleIdentity) && (
              <small>{identityEmail(googleIdentity)}</small>
            )}
            <small>
              {!hasEmailLogin
                ? "Única forma de entrada"
                : googleBlocked && googleIdentity
                  ? "Login bloqueado. Uma tentativa pelo Google pode recriar o vínculo, mas não permite entrar."
                  : googleBlocked
                    ? "Login bloqueado; sem vínculo ativo."
                    : googleIdentity
                      ? "Vinculado; login permitido."
                      : "Login permitido; o vínculo será criado no próximo acesso."}
            </small>
          </span>
          {hasEmailLogin && (
            <div className="security-identity-actions">
              {googleBlocked && googleIdentity && (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void removeBlockedIdentity(googleIdentity.id)}
                >
                  Remover vínculo
                </button>
              )}
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setMessage("");
                  if (googleBlocked) void enableGoogle();
                  else setConfirmDisable(true);
                }}
              >
                {googleBlocked ? "Reativar" : googleIdentity ? "Desvincular e bloquear" : "Bloquear entrada"}
              </button>
            </div>
          )}
        </div>
      )}
      {confirmDisable && (
        <div className="security-unlink-confirmation">
          <p>
            O login pelo Google ficará bloqueado até você reativá-lo com e-mail e senha.
            {googleIdentity ? " O vínculo atual será removido." : ""} As sessões em outros
            dispositivos também serão encerradas. Confirme que sabe sua senha antes de continuar.
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
