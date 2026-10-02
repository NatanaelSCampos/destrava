"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import { SpeakButton } from "@/components/audio/speak-button";
import type { PlannedReviewItem } from "@/domain/study/study-state";
import { wordReviewCard } from "@/domain/review/review-card";
import { findReviewStructure, reviewStructures } from "@/content/review-structures";

type ReviewItem = {
  kind: "word" | "mistake" | "structure";
  id: string;
  front: string;
  back: string;
  example: string;
  frontLabel: string;
  backLabel: string;
  spokenText: string;
  activityHref?: string;
  category?: string;
  presentation?: "standard" | "reverse" | "audio" | "cloze";
};

export function ReviewQueue({
  mode = "due",
  plannedItems,
  onComplete,
}: {
  mode?: "due" | "new";
  plannedItems?: PlannedReviewItem[];
  onComplete?: () => void;
}) {
  const { course, vocabularyItems, state, reviewWord, reviewError, reviewStructureCard } =
    useStudy();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finishedIds, setFinishedIds] = useState<string[]>([]);
  const items = useMemo<ReviewItem[]>(() => {
    const activityHref = (id: string) => {
      for (const unit of course.units)
        for (const lesson of unit.lessons)
          if (lesson.activities.some((activity) => activity.id === id))
            return (
              "/course/" +
              course.slug +
              "/unit/" +
              unit.number +
              "/lesson/" +
              lesson.slug +
              "?activity=" +
              encodeURIComponent(id)
            );
      return undefined;
    };
    const wordCard = (id: string): ReviewItem[] => {
      const word = vocabularyItems.find((entry) => entry.id === id);
      return word
        ? [
            {
              kind: "word",
              id: word.id,
              ...wordReviewCard(word, state.vocabulary[id]?.schedule.reviewCount ?? 0),
            },
          ]
        : [];
    };
    const mistakeCard = (id: string): ReviewItem[] => {
      const mistake = state.mistakes[id];
      const href = activityHref(id);
      return mistake && href
        ? [
            {
              kind: "mistake",
              id: mistake.activityId,
              front: mistake.originalAnswer,
              back: mistake.correctAnswer,
              example: mistake.explanation,
              frontLabel: mistake.category === "speaking" ? "O QUE FOI OUVIDO" : "SUA RESPOSTA",
              backLabel: "FORMA ESPERADA",
              spokenText: mistake.correctAnswer,
              activityHref: href,
              category: mistake.category,
            },
          ]
        : [];
    };
    const structureCard = (id: string): ReviewItem[] => {
      const structure = findReviewStructure(id);
      if (!structure || !course.languageCode.startsWith("es")) return [];
      return [
        {
          kind: "structure",
          id: structure.id,
          front: structure.prompt,
          back: structure.answer,
          example: structure.explanation,
          frontLabel: "ESTRUTURA · CRIE SUA FRASE",
          backLabel: "UM EXEMPLO POSSÍVEL",
          spokenText: structure.answer,
          category: "structure",
        },
      ];
    };
    if (plannedItems) {
      return plannedItems.flatMap((selected): ReviewItem[] =>
        selected.kind === "word"
          ? wordCard(selected.id)
          : selected.kind === "structure"
            ? structureCard(selected.id)
            : mistakeCard(selected.id),
      );
    }
    const words = vocabularyItems
      .filter((word) =>
        mode === "new"
          ? !state.vocabulary[word.id]
          : state.vocabulary[word.id] && ReviewScheduler.isDue(state.vocabulary[word.id].schedule),
      )
      .flatMap((word) => wordCard(word.id));
    const mistakes =
      mode === "new"
        ? []
        : Object.values(state.mistakes)
            .filter((item) => ReviewScheduler.isDue(item.schedule))
            .flatMap((item) => mistakeCard(item.activityId));
    const structures = course.languageCode.startsWith("es")
      ? reviewStructures
          .filter((entry) =>
            mode === "new"
              ? !state.structureReviews?.[entry.id]
              : state.structureReviews?.[entry.id] &&
                ReviewScheduler.isDue(state.structureReviews[entry.id].schedule),
          )
          .flatMap((entry) => structureCard(entry.id))
      : [];
    return [...mistakes, ...structures, ...words];
  }, [
    mode,
    plannedItems,
    state.vocabulary,
    state.mistakes,
    state.structureReviews,
    vocabularyItems,
    course,
  ]);
  const pending = items.filter((item) => !finishedIds.includes(`${item.kind}-${item.id}`));
  const item = pending[index] ?? pending[0];

  function answer(correct: boolean) {
    if (!item) return;
    if (item.kind === "word") reviewWord(item.id, correct);
    else if (item.kind === "structure") reviewStructureCard(item.id, correct);
    else reviewError(item.id, correct);
    setFinishedIds((current) => [...current, `${item.kind}-${item.id}`]);
    setIndex(0);
    setFlipped(false);
  }

  if (!item)
    return (
      <div className="review-finished panel">
        <span className="review-finished-icon">
          <Check size={27} />
        </span>
        <h3>
          {finishedIds.length
            ? "Revisão concluída!"
            : mode === "new"
              ? "Todos os cartões novos já foram apresentados"
              : "Nada pendente por agora"}
        </h3>
        <p>
          {finishedIds.length
            ? `Você praticou ${finishedIds.length} itens nesta rodada.`
            : "Volte depois para fortalecer o que aprendeu."}
        </p>
        {onComplete && (
          <button className="primary-button" onClick={onComplete}>
            Continuar aula <ArrowRight size={16} />
          </button>
        )}
      </div>
    );

  return (
    <div className="review-queue">
      <div className="review-queue-top">
        <span className="eyebrow">{mode === "new" ? "NOVOS CARTÕES" : "REVISÃO INTELIGENTE"}</span>
        <span>
          {finishedIds.length + 1} de{" "}
          {plannedItems ? items.length : items.length + finishedIds.length}
        </span>
      </div>
      <button
        type="button"
        className={`flashcard ${flipped ? "flipped" : ""}`}
        onClick={() => setFlipped((current) => !current)}
        aria-label={flipped ? "Mostrar frente do cartão" : "Virar cartão"}
      >
        <span className="flashcard-label">{flipped ? item.backLabel : item.frontLabel}</span>
        <strong>{flipped ? item.back : item.front}</strong>
        <p>{flipped ? item.example : "Toque para ver a resposta"}</p>
        <span className="flashcard-flip">
          <RotateCcw size={14} /> Virar cartão
        </span>
      </button>
      <div className="flashcard-audio">
        {((item.kind === "word" &&
          (item.presentation === "standard" || item.presentation === "audio")) ||
          flipped) && (
          <SpeakButton
            text={item.spokenText}
            label="Ouvir palavra ou frase em espanhol"
            withLabel
          />
        )}
        {flipped && item.kind === "word" && (
          <SpeakButton text={item.example} label="Ouvir frase de exemplo" withLabel />
        )}
      </div>
      {item.category === "speaking" && item.activityHref && (
        <p className="review-pronunciation-note">
          Este cartão verifica se você lembrou a frase. Para medir a pronúncia,{" "}
          <Link href={item.activityHref}>grave uma nova tentativa</Link>.
        </p>
      )}
      <div className="flashcard-actions">
        <button className="ghost-button" disabled={!flipped} onClick={() => answer(false)}>
          <X size={16} /> Ainda difícil
        </button>
        <button className="primary-button" disabled={!flipped} onClick={() => answer(true)}>
          <Check size={16} /> Lembrei
        </button>
      </div>
    </div>
  );
}
