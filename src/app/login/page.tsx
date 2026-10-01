"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createSupabaseBrowserClient();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Confira seu e-mail para confirmar a conta.");
      return;
    }
    // Reload the document so the account-scoped study provider loads the new session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/dashboard");
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
                  minLength={6}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <button className="primary-button" disabled={loading}>
                {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}{" "}
                <ArrowRight size={16} />
              </button>
              {message && (
                <p className="inline-error" role="status">
                  {message}
                </p>
              )}
            </form>
          ) : (
            <Link href="/dashboard" className="primary-button login-demo">
              Explorar demonstração <ArrowRight size={16} />
            </Link>
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
