"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Search, Star } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { formatDate } from "@/lib/utils";
import { SpeakButton } from "@/components/audio/speak-button";
import { vocabularyContext, vocabularyOccurrences } from "@/content/vocabulary-context";
import { spanishRegion } from "@/content/spanish-regions";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, "")
    .trim()
    .toLowerCase();
}

export default function VocabularyPage() {
  const {
    course,
    vocabularyItems,
    state,
    markVocabulary,
    recordVocabularySearch,
    recordVocabularyAudio,
  } = useStudy();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const searched = normalizeSearch(query);
    const exact = vocabularyItems.find((word) =>
      word.spanish.split("/").some((form) => normalizeSearch(form) === searched),
    );
    if (!searched || !exact) return;
    const timeout = window.setTimeout(() => recordVocabularySearch(exact.id), 900);
    return () => window.clearTimeout(timeout);
  }, [query, vocabularyItems, recordVocabularySearch]);
  const items = useMemo(
    () =>
      vocabularyItems.filter((item) => {
        const status = state.vocabulary[item.id]?.status ?? "new";
        return (
          (filter === "all" || filter === status) &&
          normalizeSearch(`${item.spanish} ${item.translation}`).includes(normalizeSearch(query))
        );
      }),
    [vocabularyItems, state.vocabulary, query, filter],
  );
  const known = Object.values(state.vocabulary).filter((item) => item.status === "known").length;
  const difficult = Object.values(state.vocabulary).filter(
    (item) => item.status === "difficult",
  ).length;
  const recentSearches = state.events
    .filter((event) => event.type === "vocabulary_search" && event.itemId)
    .slice(0, 5)
    .flatMap((event) => {
      const word = vocabularyItems.find((item) => item.id === event.itemId);
      return word ? [{ id: event.id, at: event.createdAt, word }] : [];
    });
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
      {recentSearches.length > 0 && (
        <div className="vocab-recent-searches panel">
          <strong>Buscas recentes</strong>
          <div>
            {recentSearches.map((entry) => (
              <button key={entry.id} onClick={() => setQuery(entry.word.spanish)}>
                {entry.word.spanish} <small>{formatDate(entry.at)}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="vocab-grid">
        {items.map((item) => {
          const progress = state.vocabulary[item.id];
          const status = progress?.status ?? "new";
          const context = vocabularyContext(
            item,
            course.languageCode,
            spanishRegion(state.profile.spanishRegion),
          );
          const occurrences = vocabularyOccurrences(course, item);
          const unit = course.units.find((entry) =>
            entry.lessons.some((lesson) => lesson.id === item.lessonId),
          );
          const searches = state.events.filter(
            (event) => event.type === "vocabulary_search" && event.itemId === item.id,
          ).length;
          const audioPlays = state.events.filter(
            (event) => event.type === "vocabulary_audio" && event.itemId === item.id,
          ).length;
          const lastReview = state.reviews.find(
            (review) => review.scheduleId === progress?.schedule.id,
          );
          const relatedActivityIds = new Set(
            occurrences
              .map((occurrence) =>
                new URL(occurrence.href, "https://destrava.local").searchParams.get("activity"),
              )
              .filter(Boolean),
          );
          const errors = Object.values(state.mistakes)
            .filter((mistake) => relatedActivityIds.has(mistake.activityId))
            .reduce((sum, mistake) => sum + mistake.timesMissed, 0);
          return (
            <article className="vocab-card panel" key={item.id}>
              <div className="vocab-card-top">
                <span className="pill gray">
                  {unit ? `UNIDADE ${String(unit.number).padStart(2, "0")}` : course.level}
                </span>
                <SpeakButton
                  text={item.spanish}
                  label={`Ouvir ${item.spanish}`}
                  className="vocab-sound"
                  onPlay={() => recordVocabularyAudio(item.id)}
                />
              </div>
              <h3 lang={course.languageCode}>{item.spanish}</h3>
              <p className="vocab-translation">{item.translation}</p>
              <div className="text-audio-row vocab-example-row">
                <p className="vocab-example" lang={course.languageCode}>
                  “{item.example}”
                </p>
                <SpeakButton
                  text={item.example}
                  label="Ouvir frase de exemplo"
                  onPlay={() => recordVocabularyAudio(item.id)}
                />
              </div>
              <details className="vocab-context">
                <summary>Contextos e meu progresso</summary>
                <small>
                  {context.className ? `${context.className} · ${course.level}` : course.level}
                </small>
                <ol>
                  {context.senses.map((sense, index) => (
                    <li key={index}>
                      <strong>{sense.meaning}</strong>
                      <span lang={course.languageCode}>{sense.example}</span>
                      <SpeakButton
                        text={sense.example}
                        label="Ouvir exemplo"
                        onPlay={() => recordVocabularyAudio(item.id)}
                      />
                    </li>
                  ))}
                </ol>
                {context.regionalNote && (
                  <p>
                    {context.regionalNote}{" "}
                    <Link href="/basics?topic=regions">Ver variações regionais</Link>
                  </p>
                )}
                {occurrences.length > 0 && (
                  <div className="vocab-occurrences">
                    <strong>Onde apareceu no curso</strong>
                    {occurrences.slice(0, 4).map((occurrence) => (
                      <Link href={occurrence.href} key={occurrence.href}>
                        {occurrence.title}
                      </Link>
                    ))}
                  </div>
                )}
                <p>
                  Buscas: {searches} · áudios: {audioPlays} · erros relacionados: {errors}
                  {lastReview ? ` · última revisão: ${formatDate(lastReview.reviewedAt)}` : ""}
                </p>
                {searches + audioPlays >= 3 && status === "learning" && (
                  <p className="vocab-memory-note">
                    Você voltou a este termo várias vezes; ele entrou na fila de revisão.
                  </p>
                )}
              </details>
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
