"use client";

import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import type { PasskeyListItem } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { canAccessWithMfa } from "@/lib/auth/mfa-access";

type TotpFactor = { id: string; friendly_name?: string };
type TrustedDevice = { id: string; created_at: string; last_used_at: string | null; expires_at: string };
const passkeysEnabled = process.env.NEXT_PUBLIC_PASSKEYS_ENABLED === "true";

export function AccountSecurity() {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) {
      setMessage("Não foi possível carregar os métodos de segurança.");
      return;
    }
    setFactors(data?.totp ?? []);
    const devices = await client.rpc("list_trusted_devices");
    if (!devices.error) setTrustedDevices((devices.data ?? []) as TrustedDevice[]);
    if (passkeysEnabled) {
      const result = await client.auth.passkey.list();
      if (!result.error) setPasskeys(result.data ?? []);
    }
  }

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    void client.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) setMessage("Não foi possível carregar os métodos de segurança.");
      else setFactors(data?.totp ?? []);
    });
    void client.rpc("list_trusted_devices").then(({ data, error }) => {
      if (!error) setTrustedDevices((data ?? []) as TrustedDevice[]);
    });
    if (passkeysEnabled)
      void client.auth.passkey.list().then(({ data, error }) => {
        if (!error) setPasskeys(data ?? []);
      });
  }, []);

  async function startMfa() {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Aplicativo autenticador",
    });
    setBusy(false);
    if (error || !data?.totp) {
      setMessage("Não foi possível iniciar a verificação em duas etapas.");
      return;
    }
    setPendingFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function confirmMfa() {
    const client = createSupabaseBrowserClient();
    if (!client || !pendingFactorId || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: pendingFactorId, code });
    setBusy(false);
    if (error) {
      setMessage("Código inválido ou expirado. Tente novamente.");
      return;
    }
    setPendingFactorId(null);
    setQrCode("");
    setSecret("");
    setCode("");
    setMessage("Verificação em duas etapas ativada.");
    await refresh();
  }

  async function removeMfa(factorId: string) {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.mfa.unenroll({ factorId });
    if (!error) await client.auth.refreshSession();
    setBusy(false);
    if (error) {
      setMessage("Entre novamente com o código para remover este método.");
      return;
    }
    setMessage("Verificação em duas etapas removida.");
    await refresh();
  }

  async function addPasskey() {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.registerPasskey();
    setBusy(false);
    if (error) {
      setMessage(
        "Não foi possível criar a chave. Confirme seu e-mail e use um dispositivo compatível.",
      );
      return;
    }
    setMessage("Chave de acesso criada.");
    await refresh();
  }

  async function removePasskey(passkeyId: string) {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.passkey.delete({ passkeyId });
    setBusy(false);
    if (error) {
      setMessage("Não foi possível remover a chave de acesso.");
      return;
    }
    setMessage("Chave de acesso removida.");
    await refresh();
  }

  async function revokeTrustedDevice(deviceId: string) {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await client.rpc("revoke_trusted_device", { p_device_id: deviceId });
    setBusy(false);
    if (error || data !== true) {
      setMessage("Não foi possível remover o dispositivo confiável.");
      return;
    }
    const access = await canAccessWithMfa(client);
    if (!access.allowed) {
      // The current browser was revoked; clear previously loaded study data.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/mfa");
      return;
    }
    setMessage("Dispositivo confiável removido.");
    await refresh();
  }

  return (
    <section className="panel account-security">
      <span className="eyebrow">
        <ShieldCheck size={14} /> SEGURANÇA DA CONTA
      </span>
      <h2>Verificação em duas etapas</h2>
      <p>
        Use um aplicativo autenticador para proteger seu progresso. Depois de ativar, o código será
        pedido ao entrar.
      </p>
      {factors.map((factor) => (
        <div className="security-method" key={factor.id}>
          <span>{factor.friendly_name || "Aplicativo autenticador"}</span>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void removeMfa(factor.id)}
          >
            Remover
          </button>
        </div>
      ))}
      {!pendingFactorId && (
        <button className="secondary-button" disabled={busy} onClick={() => void startMfa()}>
          {factors.length ? "Adicionar outro aplicativo" : "Ativar verificação em duas etapas"}
        </button>
      )}
      {pendingFactorId && (
        <div className="security-enrollment">
          <p>Escaneie o QR code no aplicativo autenticador e digite o código gerado.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`}
            alt="QR code para configurar o autenticador"
          />
          <small>
            Se não conseguir escanear, use a chave: <code>{secret}</code>
          </small>
          <div className="field">
            <label htmlFor="enroll-mfa-code">Código de seis números</label>
            <input
              id="enroll-mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <button
            className="primary-button"
            disabled={busy || code.length !== 6}
            onClick={() => void confirmMfa()}
          >
            Confirmar código
          </button>
        </div>
      )}
      {passkeysEnabled && (
        <div className="security-passkeys">
          <h3>
            <KeyRound size={18} /> Chaves de acesso
          </h3>
          <p>Entre com biometria, PIN ou chave de segurança, sem digitar a senha.</p>
          {passkeys.map((passkey) => (
            <div className="security-method" key={passkey.id}>
              <span>{passkey.friendly_name || "Chave de acesso"}</span>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void removePasskey(passkey.id)}
              >
                Remover
              </button>
            </div>
          ))}
          <button className="secondary-button" disabled={busy} onClick={() => void addPasskey()}>
            Adicionar chave de acesso
          </button>
        </div>
      )}
      {trustedDevices.length > 0 && (
        <div className="security-passkeys">
          <h3>Dispositivos confiáveis</h3>
          <p>Dispensam o código por até 30 dias. Remova um dispositivo se você não o usa mais.</p>
          {trustedDevices.map((device) => (
            <div className="security-method" key={device.id}>
              <span>
                Confiável até {new Date(device.expires_at).toLocaleDateString("pt-BR")}
                {device.last_used_at && (
                  <small> · último acesso em {new Date(device.last_used_at).toLocaleDateString("pt-BR")}</small>
                )}
              </span>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void revokeTrustedDevice(device.id)}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
      {message && (
        <p
          className={
            message.includes("ativada") ||
            message.includes("criada") ||
            message.includes("removida")
              ? "inline-success"
              : "inline-error"
          }
          role="status"
        >
          {message}
        </p>
      )}
    </section>
  );
}
