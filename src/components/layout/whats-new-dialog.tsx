"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { featureAnnouncements } from "@/content/feature-announcements";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function WhatsNewDialog({ userId }: { userId: string | null }) {
  const [unseenIds, setUnseenIds] = useState<string[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    const client = createSupabaseBrowserClient();
    const ids = featureAnnouncements.map((entry) => entry.id);
    if (!ids.length) return;
    const timer = window.setTimeout(() => {
      if (client && userId) {
        void client.rpc("claim_feature_announcements", { p_ids: ids }).then(({ data, error }) => {
          if (active && !error && Array.isArray(data) && data.length) setUnseenIds(data);
        });
      } else if (!client) {
        const key = `destrava:feature-announcements:${userId ?? "demo"}`;
        try {
          const seen = new Set<string>(JSON.parse(window.localStorage.getItem(key) ?? "[]"));
          const unseen = ids.filter((id) => !seen.has(id));
          window.localStorage.setItem(key, JSON.stringify([...seen, ...unseen]));
          if (active && unseen.length) setUnseenIds(unseen);
        } catch {
          /* Storage disabled: skip the announcement. */
        }
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [userId]);

  useEffect(() => {
    if (!unseenIds.length) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUnseenIds([]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [unseenIds]);

  const entries = featureAnnouncements.filter((entry) => unseenIds.includes(entry.id));
  if (!entries.length) return null;
  return (
    <div
      className="whats-new-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setUnseenIds([]);
      }}
    >
      <section
        className="whats-new-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
      >
        <button
          ref={closeButton}
          type="button"
          className="icon-button whats-new-close"
          aria-label="Fechar novidades"
          onClick={() => setUnseenIds([])}
        >
          <X size={19} />
        </button>
        <span className="eyebrow">
          <Sparkles size={15} /> NOVIDADES DO DESTRAVA
        </span>
        <h2 id="whats-new-title">Tem novidade para você</h2>
        {entries.map((entry) => (
          <div key={entry.id} className="whats-new-entry">
            <h3>{entry.title}</h3>
            <p>{entry.summary}</p>
            <ul>
              {entry.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link className="primary-button" href={entry.href} onClick={() => setUnseenIds([])}>
              {entry.linkLabel}
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
