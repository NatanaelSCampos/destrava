"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Check, KeyRound, LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { TurnstileChallenge } from "@/components/auth/turnstile-challenge";
import { canAccessWithMfa } from "@/lib/auth/mfa-access";

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true";
const passkeysEnabled = process.env.NEXT_PUBLIC_PASSKEYS_ENABLED === "true";
const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

function AuthNotice() {
  const params = useSearchParams();
  const notice =
    params.get("googleDisabled") === "1" || params.get("authError") === "googleDisabled"
      ? "O login pelo Google está desativado nesta conta. Entre com e-mail e senha."
      : params.has("authError")
        ? "Não foi possível concluir o acesso. Tente novamente."
        : "";
  return notice ? <p className="inline-error" role="status">{notice}</p> : null;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const supabase = createSupabaseBrowserClient();
  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaReset((value) => value + 1);
  }

  async function finishLogin() {
    if (!supabase) return;
    const access = await canAccessWithMfa(supabase);
    if (access.error) {
      setMessage("Não foi possível verificar a segurança da sessão.");
      return;
    }
    window.location.assign(access.allowed ? "/dashboard" : "/mfa");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (captchaEnabled && !captchaToken) {
      setMessage("Conclua a verificação de segurança.");
      return;
    }
    setLoading(true);
    setMessage("");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({
            email,
            password,
            options: { captchaToken: captchaToken ?? undefined },
          })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              captchaToken: captchaToken ?? undefined,
              emailRedirectTo: `${window.location.origin}/dashboard`,
            },
          });
    setLoading(false);
    resetCaptcha();
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Confira seu e-mail para confirmar a conta.");
      return;
    }
    await finishLogin();
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMessage(error.message);
  }

  async function signInWithPasskey() {
    if (!supabase) return;
    if (captchaEnabled && !captchaToken) {
      setMessage("Conclua a verificação de segurança.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPasskey({
      options: { captchaToken: captchaToken ?? undefined },
    });
    setLoading(false);
    resetCaptcha();
    if (error) {
      setMessage("Não foi possível entrar com a chave de acesso. Tente sua senha.");
      return;
    }
    await finishLogin();
  }
  return (
    <div className="login-page">
      <div className="login-art">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">
            D<span>.</span>
          </span>
          <span>
            <strong>Destrava</strong>
            <small>Aprenda. Pratique. Destrave.</small>
          </span>
        </Link>
        <div>
          <span className="eyebrow">UM CAMINHO MAIS CLARO</span>
          <h1>Seu espanhol começa com uma conversa.</h1>
          <p>Aprenda no seu ritmo, pratique com intenção e veja cada passo do seu progresso.</p>
          <div className="login-art-words">
            <span>¡Hola!</span>
            <span>¿Cómo te llamas?</span>
            <span>Mucho gusto.</span>
          </div>
        </div>
        <small>Destrava · Aprenda espanhol no seu ritmo</small>
      </div>
      <div className="login-main">
        <div className="login-card">
          <span className="login-icon">
            <BookOpen size={24} />
          </span>
          <span className="eyebrow">BEM-VINDO DE VOLTA</span>
          <h2>
            {supabase
              ? mode === "login"
                ? "Entre no seu espaço"
                : "Crie sua conta"
              : "Comece a estudar"}
          </h2>
          <p>
            {supabase
              ? "Seu curso e seu progresso em um só lugar."
              : "O modo de demonstração salva seu progresso neste navegador."}
          </p>
          {supabase ? (
            <form onSubmit={(event) => void submit(event)}>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="password">Senha</label>
                <input
                  id="password"
                  type="password"
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {captchaEnabled && (
                <TurnstileChallenge onToken={setCaptchaToken} resetKey={captchaReset} />
              )}
              <button className="primary-button" disabled={loading}>
                {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}{" "}
                <ArrowRight size={16} />
              </button>
              {message && (
                <p className="inline-error" role="status">
                  {message}
                </p>
              )}
              {!message && mode === "login" && (
                <Suspense fallback={null}><AuthNotice /></Suspense>
              )}
            </form>
          ) : (
            <Link href="/dashboard" className="primary-button login-demo">
              Explorar demonstração <ArrowRight size={16} />
            </Link>
          )}
          {supabase && (googleEnabled || passkeysEnabled) && (
            <div className="login-alternatives">
              {googleEnabled && (
                <button className="secondary-button" onClick={() => void signInWithGoogle()}>
                  Entrar com Google
                </button>
              )}
              {passkeysEnabled && (
                <button className="secondary-button" onClick={() => void signInWithPasskey()}>
                  <KeyRound size={16} /> Entrar com chave de acesso
                </button>
              )}
            </div>
          )}
          {supabase && (
            <button
              className="login-switch"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMessage("");
              }}
            >
              {mode === "login" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
            </button>
          )}
          <div className="login-assurance">
            {supabase ? (
              <>
                <LockKeyhole size={15} /> Progresso privado por conta
              </>
            ) : (
              <>
                <Check size={15} /> Sem cadastro para experimentar
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
