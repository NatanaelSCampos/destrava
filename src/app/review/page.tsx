"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, RotateCcw, Sparkles } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { ReviewQueue } from "@/components/review/review-queue";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import { currentUnit } from "@/domain/study/progress";
import { featureFlags } from "@/lib/feature-flags";

export default function ReviewPage() {
  const { state, vocabularyItems, course } = useStudy();
  const unit = currentUnit(course, state);
  const [mode, setMode] = useState<"due" | "new">("due");
  const dueWords = Object.values(state.vocabulary).filter((item) =>
    ReviewScheduler.isDue(item.schedule),
  ).length;
  const dueMistakes = Object.values(state.mistakes).filter((item) =>
    ReviewScheduler.isDue(item.schedule),
  ).length;
  const newWords = vocabularyItems.filter((item) => !state.vocabulary[item.id]).length;
  if (!featureFlags.SPACED_REPETITION)
    return <div className="empty-state">A revisão espaçada está temporariamente indisponível.</div>;
  return (
    <div className="review-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <RotateCcw size={13} /> REVISÃO ESPAÇADA
          </span>
          <h1 className="page-title">Revisar fortalece a memória.</h1>
          <p className="page-subtitle">
            O sistema traz de volta palavras e erros no momento certo para você lembrar por mais
            tempo.
          </p>
        </div>
        <Link href="/vocabulary" className="secondary-button">
          <BookOpen size={16} /> Meu vocabulário
        </Link>
      </div>
      <div className="review-summary">
        <div className="panel">
          <span>PALAVRAS PARA REVISAR</span>
          <strong>{dueWords}</strong>
          <small>Prontas para um novo encontro</small>
        </div>
        <div className="panel">
          <span>ERROS PARA REVISAR</span>
          <strong>{dueMistakes}</strong>
          <small>Transforme dúvidas em acertos</small>
        </div>
        <div className="panel">
          <span>PALAVRAS NOVAS</span>
          <strong>{newWords}</strong>
          <small>Prontas para conhecer</small>
        </div>
      </div>
      <div className="review-layout">
        <div>
          <div className="review-tabs" role="tablist" aria-label="Modo de revisão">
            <button
              role="tab"
              aria-selected={mode === "due"}
              className={mode === "due" ? "active" : ""}
              onClick={() => setMode("due")}
            >
              Revisões pendentes <span>{dueWords + dueMistakes}</span>
            </button>
            <button
              role="tab"
              aria-selected={mode === "new"}
              className={mode === "new" ? "active" : ""}
              onClick={() => setMode("new")}
            >
              Aprender palavras novas <span>{newWords}</span>
            </button>
          </div>
          <ReviewQueue key={mode} mode={mode} />
        </div>
        <aside className="panel review-how">
          <span className="eyebrow">
            <Sparkles size={13} /> COMO FUNCIONA
          </span>
          <h3>Um cartão de cada vez</h3>
          <ol>
            <li>Leia a frente e tente lembrar sozinho.</li>
            <li>Vire o cartão para conferir.</li>
            <li>Marque se lembrou ou se ainda está difícil.</li>
          </ol>
          <p>Cada resposta ajusta a próxima data de revisão.</p>
          <Link
            href={unit ? `/course/${course.slug}/unit/${unit.number}` : `/course/${course.slug}`}
            className="text-link"
          >
            Voltar à unidade <ArrowRight size={14} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
