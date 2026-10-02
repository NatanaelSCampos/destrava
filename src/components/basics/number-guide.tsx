"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Hash, Search } from "lucide-react";
import { SpeakButton } from "@/components/audio/speak-button";
import {
  numberCategoryLabels,
  numberPracticeLink,
  numberPrompts,
  type NumberCategory,
} from "@/domain/numbers/number-practice";

type CategoryFilter = NumberCategory | "all";
const categories = Object.keys(numberCategoryLabels) as NumberCategory[];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function NumberGuide() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const examples = useMemo(() => {
    const search = normalize(query.trim());
    return numberPrompts.filter((item) => {
      const matchesCategory = filter === "all" || item.category === filter;
      const matchesSearch =
        !search ||
        normalize(
          `${item.display} ${item.spoken} ${item.example} ${item.exampleTranslation} ${numberCategoryLabels[item.category]}`,
        ).includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [query, filter]);

  return (
    <section className="number-guide" aria-labelledby="number-guide-title">
      <div className="section-head basics-section-head">
        <div>
          <span className="eyebrow">
            <Hash size={13} /> NÚMEROS EM ESPANHOL
          </span>
          <h2 className="section-title" id="number-guide-title">
            Um número em cada situação.
          </h2>
          <p className="section-subtitle">
            Veja como se escreve e se usa, escute o número e depois pratique.
          </p>
        </div>
        <Link href="/numbers" className="primary-button">
          Praticar números <ArrowRight size={16} />
        </Link>
      </div>

      <div className="alphabet-summary number-guide-summary">
        <div className="panel">
          <strong>{numberPrompts.length}</strong>
          <span>exemplos com áudio</span>
        </div>
        <div className="panel">
          <strong>{categories.length}</strong>
          <span>situações do dia a dia</span>
        </div>
        <div className="panel">
          <strong>3</strong>
          <span>formas de praticar</span>
        </div>
      </div>

      <div className="vocab-toolbar">
        <div className="vocab-search">
          <Search size={17} />
          <input
            aria-label="Buscar número ou exemplo"
            placeholder="Buscar número ou exemplo…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="vocab-filters number-guide-filters" aria-label="Filtrar números">
          <button
            type="button"
            className={filter === "all" ? "active" : ""}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              className={filter === category ? "active" : ""}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {numberCategoryLabels[category]}
            </button>
          ))}
        </div>
      </div>

      {examples.length ? (
        <div className="vocab-grid basics-number-grid">
          {examples.map((item) => (
            <article className="panel basics-number-card" key={item.id}>
              <div className="alphabet-card-top">
                <span className="pill gray">
                  {numberCategoryLabels[item.category].toUpperCase()}
                </span>
                <span className="alphabet-position">
                  {String(numberPrompts.indexOf(item) + 1).padStart(2, "0")} /{" "}
                  {numberPrompts.length}
                </span>
              </div>
              <div className="basics-number-value">
                <strong>{item.display}</strong>
                <SpeakButton text={item.spoken} label={`Ouvir ${item.display} em espanhol`} />
              </div>
              <div className="basics-number-name">
                <span>POR EXTENSO</span>
                <strong lang="es">{item.spoken}</strong>
              </div>
              <div className="basics-number-example">
                <span>EM UMA FRASE</span>
                <div>
                  <p lang="es">“{item.example}”</p>
                  <SpeakButton text={item.example} label={`Ouvir exemplo de ${item.display}`} />
                </div>
                <small>{item.exampleTranslation}</small>
              </div>
              <Link href={numberPracticeLink(item.id)} className="text-link">
                Praticar este número <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state panel">
          <Search size={27} />
          <strong>Nenhum número encontrado</strong>
          <span>Tente outra busca ou categoria.</span>
        </div>
      )}
    </section>
  );
}
