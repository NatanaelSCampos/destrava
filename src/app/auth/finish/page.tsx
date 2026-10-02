"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { canAccessWithMfa } from "@/lib/auth/mfa-access";

export default function FinishAuthPage() {
  const [message, setMessage] = useState("Verificando a segurança da sua conta…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = createSupabaseBrowserClient();
      if (!client) {
        setMessage("A autenticação está indisponível. Recarregue a página.");
        return;
      }
      const { data, error } = await client.auth.getUser();
      if (cancelled) return;
      if (error || !data.user) {
        window.location.replace("/login?authError=1");
        return;
      }
      const access = await canAccessWithMfa(client);
      if (cancelled) return;
      if (access.error) {
        setMessage("Não foi possível verificar a segurança da sessão. Recarregue a página.");
        return;
      }
      window.location.replace(access.allowed ? "/dashboard" : "/mfa");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="auth-step-page">
      <div className="panel auth-step-card" role="status">
        <ShieldCheck size={30} aria-hidden="true" />
        <h1>Finalizando o acesso</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}
