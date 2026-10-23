"use client";
import { useState } from "react";
import type { RuntimeCourseOption, RuntimeUnavailable } from "@/lib/installed-runtime-types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function RuntimeUnavailablePanel({
  courses,
  revision,
  unavailable,
}: {
  courses: RuntimeCourseOption[];
  revision: number;
  unavailable: RuntimeUnavailable;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function select(option: RuntimeCourseOption) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/course/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: option.id,
          source: option.source,
          expectedRevision: revision,
          operationId: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível selecionar o curso.");
      window.location.assign(new URL("/dashboard", window.location.origin).href);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Falha ao selecionar o curso.");
      setBusy(false);
    }
  }
  return (
    <main className="main-content">
      <section className="panel" role="status">
        <span className="eyebrow">SEU CURSO</span>
        <h1>Vamos recuperar seu espaço de estudo</h1>
        <p>{unavailable.error}</p>
        {courses.map((option) => (
          <button
            key={option.id}
            className="secondary-button"
            disabled={busy}
            onClick={() => void select(option)}
          >
            {option.title} · {option.language}
          </button>
        ))}
        <p>
          <button className="text-link" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </p>
        <button
          className="text-link"
          onClick={async () => {
            await createSupabaseBrowserClient()?.auth.signOut();
            window.location.assign(new URL("/login", window.location.origin).href);
          }}
        >
          Sair da conta
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
