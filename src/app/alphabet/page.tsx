"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CaseUpper, Search } from "lucide-react";
import { SpeakButton } from "@/components/audio/speak-button";
import { spanishAlphabet } from "@/content/spanish-alphabet";

type LetterFilter = "all" | "vowel" | "consonant";
const vowelCount = spanishAlphabet.filter((item) => item.kind === "vowel").length;

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function AlphabetPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LetterFilter>("all");
  const letters = useMemo(() => {
    const search = normalizeSearch(query.trim());
    return spanishAlphabet.filter((item) => {
      const matchesFilter = filter === "all" || item.kind === filter;
      const matchesSearch =
        !search ||
        normalizeSearch(`${item.letter} ${item.name} ${item.word} ${item.translation}`).includes(
          search,
        );
      return matchesFilter && matchesSearch;
    });
  }, [query, filter]);

  return (
    <div className="alphabet-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <CaseUpper size={13} /> ALFABETO ESPANHOL
          </span>
          <h1 className="page-title">Uma letra de cada vez.</h1>
          <p className="page-subtitle">
            Ouça o nome de cada letra, conheça uma palavra e pratique com uma frase curta.
          </p>
        </div>
        <Link href="/vocabulary" className="secondary-button">
          <BookOpen size={16} /> Ir para o vocabulário <ArrowRight size={16} />
        </Link>
      </div>

      <div className="alphabet-summary">
        <div className="panel">
          <strong>{spanishAlphabet.length}</strong>
          <span>letras</span>
        </div>
        <div className="panel">
          <strong>{vowelCount}</strong>
          <span>vogais</span>
        </div>
        <div className="panel">
          <strong>{spanishAlphabet.length - vowelCount}</strong>
          <span>consoantes</span>
        </div>
      </div>

      <p className="alphabet-note">
        A letra Ñ faz parte do alfabeto. CH e LL continuam nas palavras, mas são combinações de duas
        letras.
      </p>

      <div className="vocab-toolbar">
        <div className="vocab-search">
          <Search size={17} />
          <input
            aria-label="Buscar letra ou palavra"
            placeholder="Buscar letra ou palavra…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="vocab-filters" aria-label="Filtrar letras">
          {[
            { key: "all", label: "Todas" },
            { key: "vowel", label: "Vogais" },
            { key: "consonant", label: "Consoantes" },
          ].map((item) => (
            <button
              type="button"
              key={item.key}
              className={filter === item.key ? "active" : ""}
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key as LetterFilter)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="vocab-grid alphabet-grid">
        {letters.map((item) => (
          <article className="alphabet-card panel" key={item.letter}>
            <div className="alphabet-card-top">
              <span className="pill gray">{item.kind === "vowel" ? "VOGAL" : "CONSOANTE"}</span>
              <span className="alphabet-position">
                {String(spanishAlphabet.indexOf(item) + 1).padStart(2, "0")} /{" "}
                {spanishAlphabet.length}
              </span>
            </div>
            <div className="alphabet-letter-row">
              <div className="alphabet-symbol" lang="es">
                {item.letter}
                <span>{item.letter.toLowerCase()}</span>
              </div>
              <div className="alphabet-name">
                <span>NOME DA LETRA</span>
                <strong lang="es">{item.name}</strong>
                <SpeakButton
                  text={`La letra ${item.name}.`}
                  label={`Ouvir o nome da letra ${item.letter}`}
                  withLabel
                />
              </div>
            </div>
            <div className="alphabet-word-row">
              <div>
                <span>EXEMPLO</span>
                <strong lang="es">{item.word}</strong>
                <small>{item.translation}</small>
              </div>
              <SpeakButton text={item.word} label={`Ouvir a palavra ${item.word}`} />
            </div>
            <div className="alphabet-example-row">
              <p lang="es">“{item.example}”</p>
              <SpeakButton text={item.example} label={`Ouvir a frase ${item.example}`} />
            </div>
            {item.note && <p className="alphabet-tip">{item.note}</p>}
          </article>
        ))}
      </div>
      {!letters.length && (
        <div className="empty-state panel">
          <Search size={27} />
          <strong>Nenhuma letra encontrada</strong>
          <span>Tente outra busca ou filtro.</span>
        </div>
      )}
    </div>
  );
}
