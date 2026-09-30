"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Search, Star, Volume2 } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { formatDate } from "@/lib/utils";

export default function VocabularyPage() {
  const { vocabularyItems, state, markVocabulary } = useStudy();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const items = useMemo(
    () =>
      vocabularyItems.filter((item) => {
        const status = state.vocabulary[item.id]?.status ?? "new";
        return (
          (filter === "all" || filter === status) &&
          `${item.spanish} ${item.translation}`.toLowerCase().includes(query.toLowerCase())
        );
      }),
    [vocabularyItems, state.vocabulary, query, filter],
  );
  const known = Object.values(state.vocabulary).filter((item) => item.status === "known").length;
  const difficult = Object.values(state.vocabulary).filter(
    (item) => item.status === "difficult",
  ).length;
  return (
    <div className="vocabulary-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <BookOpen size={13} /> MEU VOCABULÁRIO
          </span>
          <h1 className="page-title">Palavras que ficam com você.</h1>
          <p className="page-subtitle">
            Explore os termos do curso e escolha quais quer aprender ou revisar.
          </p>
        </div>
        <Link href="/review" className="primary-button">
          Abrir flashcards <ArrowRight size={16} />
        </Link>
      </div>
      <div className="vocab-summary">
        <div className="panel">
          <strong>{vocabularyItems.length}</strong>
          <span>palavras disponíveis</span>
        </div>
        <div className="panel">
          <strong>{known}</strong>
          <span>conhecidas</span>
        </div>
        <div className="panel">
          <strong>{difficult}</strong>
          <span>para praticar mais</span>
        </div>
      </div>
      <div className="vocab-toolbar">
        <div className="vocab-search">
          <Search size={17} />
          <input
            aria-label="Buscar palavra"
            placeholder="Buscar palavra ou tradução…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="vocab-filters">
          {[
            { key: "all", label: "Todas" },
            { key: "new", label: "Novas" },
            { key: "learning", label: "Aprendendo" },
            { key: "known", label: "Conhecidas" },
            { key: "difficult", label: "Difíceis" },
          ].map((item) => (
            <button
              type="button"
              key={item.key}
              className={filter === item.key ? "active" : ""}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="vocab-grid">
        {items.map((item) => {
          const progress = state.vocabulary[item.id];
          const status = progress?.status ?? "new";
          return (
            <article className="vocab-card panel" key={item.id}>
              <div className="vocab-card-top">
                <span className="pill gray">UNIDADE 01</span>
                <button
                  className="vocab-sound"
                  aria-label={`Ouvir ${item.spanish}`}
                  onClick={() => {
                    if ("speechSynthesis" in window) {
                      const utterance = new SpeechSynthesisUtterance(
                        item.spanish.replace(" / ", ", "),
                      );
                      utterance.lang = "es-ES";
                      window.speechSynthesis.speak(utterance);
                    }
                  }}
                >
                  <Volume2 size={17} />
                </button>
              </div>
              <h3>{item.spanish}</h3>
              <p className="vocab-translation">{item.translation}</p>
              <p className="vocab-example">“{item.example}”</p>
              <div className="vocab-card-footer">
                <span className={`vocab-status ${status}`}>
                  {status === "new"
                    ? "Nova"
                    : status === "learning"
                      ? "Aprendendo"
                      : status === "known"
                        ? "Conhecida"
                        : "Difícil"}
                </span>
                <div>
                  <button
                    aria-label={`Marcar ${item.spanish} como difícil`}
                    title="Marcar como difícil"
                    onClick={() => markVocabulary(item.id, "difficult")}
                  >
                    <Star size={16} fill={status === "difficult" ? "currentColor" : "none"} />
                  </button>
                  <button
                    aria-label={`Marcar ${item.spanish} como conhecida`}
                    title="Marcar como conhecida"
                    onClick={() => markVocabulary(item.id, "known")}
                  >
                    <Check size={17} />
                  </button>
                </div>
              </div>
              {progress && (
                <small className="vocab-due">
                  Próxima revisão: {formatDate(progress.schedule.nextReviewAt)}
                </small>
              )}
            </article>
          );
        })}
      </div>
      {!items.length && (
        <div className="empty-state panel">
          <Search size={27} />
          <strong>Nenhuma palavra encontrada</strong>
          <span>Tente outra busca ou filtro.</span>
        </div>
      )}
    </div>
  );
}
