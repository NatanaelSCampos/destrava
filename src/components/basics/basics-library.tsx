"use client";

import Link from "next/link";
import { BookOpen, CaseUpper, Hash } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { spanishAlphabet } from "@/content/spanish-alphabet";
import { numberPrompts } from "@/domain/numbers/number-practice";
import { AlphabetGuide } from "./alphabet-guide";
import { NumberGuide } from "./number-guide";

type BasicsTopic = "alphabet" | "numbers";

const topics = [
  {
    id: "alphabet" as const,
    title: "Alfabeto",
    description: "Letras, nomes e palavras com áudio.",
    count: spanishAlphabet.length,
    countLabel: "letras",
    icon: CaseUpper,
  },
  {
    id: "numbers" as const,
    title: "Números",
    description: "Números do cotidiano, exemplos e prática.",
    count: numberPrompts.length,
    countLabel: "exemplos",
    icon: Hash,
  },
];

export function BasicsLibrary({ topic }: { topic: BasicsTopic }) {
  const { course } = useStudy();
  const supported = course.languageCode.startsWith("es");

  return (
    <div className="basics-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <BookOpen size={13} /> FUNDAMENTOS DO IDIOMA
          </span>
          <h1 className="page-title">Comece pelo essencial.</h1>
          <p className="page-subtitle">
            Consulte o alfabeto e os números em um só lugar. Novos temas básicos podem entrar aqui
            conforme o curso crescer.
          </p>
        </div>
      </div>

      {!supported ? (
        <div className="empty-state panel">
          <BookOpen size={28} />
          <strong>Os fundamentos deste idioma estão em preparação.</strong>
          <span>O conteúdo disponível agora é o do curso de espanhol.</span>
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
          <div className="basics-selected" aria-labelledby={`basics-tab-${topic}`}>
            {topic === "alphabet" ? <AlphabetGuide embedded /> : <NumberGuide />}
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
