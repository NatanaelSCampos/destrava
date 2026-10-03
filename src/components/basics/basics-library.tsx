"use client";

import Link from "next/link";
import { BookOpen, CaseUpper, Globe2, Hash } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { AlphabetGuide } from "./alphabet-guide";
import { NumberGuide } from "./number-guide";
import { RegionalGuide } from "./regional-guide";

type BasicsTopic = "alphabet" | "numbers" | "regions";

const topicDefinitions = [
  {
    id: "alphabet" as const,
    title: "Alfabeto",
    description: "Letras, nomes e palavras com áudio.",
    countKey: "alphabet",
    countLabel: "letras",
    icon: CaseUpper,
  },
  {
    id: "numbers" as const,
    title: "Números",
    description: "Números do cotidiano, exemplos e prática.",
    countKey: "numbers",
    countLabel: "exemplos",
    icon: Hash,
  },
  {
    id: "regions" as const,
    title: "Variações regionais",
    description: "Expressões, exemplos e formas de tratamento.",
    countKey: "regionalTopics",
    countLabel: "comparações",
    icon: Globe2,
  },
];

export function BasicsLibrary({ topic }: { topic: BasicsTopic }) {
  const { resources } = useStudy();
  const counts: Record<string, number> = { alphabet: resources.alphabet.length, numbers: resources.numbers.length, regionalTopics: resources.regionalTopics.length };
  const topics = topicDefinitions.filter((item) => counts[item.countKey] > 0).map((item) => ({ ...item, count: counts[item.countKey] }));
  const supported = topics.length > 0;

  return (
    <div className="basics-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <BookOpen size={13} /> FUNDAMENTOS DO IDIOMA
          </span>
          <h1 className="page-title">Comece pelo essencial.</h1>
          <p className="page-subtitle">
            Consulte o alfabeto, os números e as variações regionais em um só lugar. Novos temas
            básicos podem entrar aqui conforme o curso crescer.
          </p>
        </div>
      </div>

      {!supported ? (
        <div className="empty-state panel">
          <BookOpen size={28} />
          <strong>Os fundamentos deste idioma estão em preparação.</strong>
          <span>Este curso ainda não inclui módulos de fundamentos.</span>
          <Link href="/dashboard" className="secondary-button">
            Voltar à visão geral
          </Link>
        </div>
      ) : (
        <>
          <nav className="basics-topic-grid" aria-label="Temas fundamentais">
            {topics.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  id={`basics-tab-${item.id}`}
                  href={`/basics?topic=${item.id}`}
                  scroll={false}
                  className={`basics-topic-card panel ${topic === item.id ? "active" : ""}`}
                  aria-current={topic === item.id ? "page" : undefined}
                >
                  <span className="basics-topic-icon">
                    <Icon size={21} />
                  </span>
                  <span className="basics-topic-copy">
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="basics-topic-count">
                    <strong>{item.count}</strong>
                    <small>{item.countLabel}</small>
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="basics-selected" aria-labelledby={`basics-tab-${topics.some((item) => item.id === topic) ? topic : topics[0].id}`}>
            {(topics.some((item) => item.id === topic) ? topic : topics[0].id) === "alphabet" ? (
              <AlphabetGuide embedded />
            ) : (topics.some((item) => item.id === topic) ? topic : topics[0].id) === "numbers" ? (
              <NumberGuide />
            ) : (
              <RegionalGuide />
            )}
          </div>
          <p className="basics-future-note">
            Este espaço reúne o conteúdo básico do idioma atual. Novos temas poderão ser adicionados
            sem misturar seus exercícios com os do curso.
          </p>
        </>
      )}
    </div>
  );
}
