"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { ReviewScheduler } from "@/domain/review/review-scheduler";

type ReviewItem = {
  kind: "word" | "mistake";
  id: string;
  front: string;
  back: string;
  example: string;
};

export function ReviewQueue({
  mode = "due",
  onComplete,
}: {
  mode?: "due" | "new";
  onComplete?: () => void;
}) {
  const { vocabularyItems, state, reviewWord, reviewError } = useStudy();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finishedIds, setFinishedIds] = useState<string[]>([]);
  const items = useMemo<ReviewItem[]>(() => {
    const words = vocabularyItems
      .filter((word) =>
        mode === "new"
          ? !state.vocabulary[word.id]
          : state.vocabulary[word.id] && ReviewScheduler.isDue(state.vocabulary[word.id].schedule),
      )
      .map((word) => ({
        kind: "word" as const,
        id: word.id,
        front: word.spanish,
        back: word.translation,
        example: word.example,
      }));
    const mistakes =
      mode === "new"
        ? []
        : Object.values(state.mistakes)
            .filter((item) => ReviewScheduler.isDue(item.schedule))
            .map((item) => ({
              kind: "mistake" as const,
              id: item.activityId,
              front: item.originalAnswer,
              back: item.correctAnswer,
              example: item.explanation,
            }));
    return [...mistakes, ...words];
  }, [mode, state.vocabulary, state.mistakes, vocabularyItems]);
  const pending = items.filter((item) => !finishedIds.includes(`${item.kind}-${item.id}`));
  const item = pending[index] ?? pending[0];

  function answer(correct: boolean) {
    if (!item) return;
    if (item.kind === "word") reviewWord(item.id, correct);
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
              ? "Todas as palavras já foram apresentadas"
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
        <span className="eyebrow">{mode === "new" ? "NOVAS PALAVRAS" : "REVISÃO INTELIGENTE"}</span>
        <span>
          {finishedIds.length + 1} de {items.length + finishedIds.length}
        </span>
      </div>
      <button
        type="button"
        className={`flashcard ${flipped ? "flipped" : ""}`}
        onClick={() => setFlipped((current) => !current)}
        aria-label={flipped ? "Mostrar frente do cartão" : "Virar cartão"}
      >
        <span className="flashcard-label">
          {flipped ? "VERSO" : item.kind === "word" ? "ESPANHOL" : "SUA RESPOSTA"}
        </span>
        <strong>{flipped ? item.back : item.front}</strong>
        <p>{flipped ? item.example : "Toque para ver a resposta"}</p>
        <span className="flashcard-flip">
          <RotateCcw size={14} /> Virar cartão
        </span>
      </button>
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
