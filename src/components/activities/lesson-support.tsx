"use client";
import { useId, useRef } from "react";
import { LifeBuoy, ArrowUpRight, X } from "lucide-react";
import { TeachingCard } from "./teaching-card";
import type { PublicActivity, PublicLesson } from "@/content/public";
import { LearningText } from "@/components/learning/text-presentation";

export function LessonSupport({ lesson, activity: current, unavailableActivityIds = [] }: {
  lesson: PublicLesson; activity?: PublicActivity; unavailableActivityIds?: readonly string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const contextual = lesson.activities.some(item => item.type === "lesson_content" && item.teaching);
  const references = current?.supportActivityIds;
  const explanations = lesson.activities
    .filter(item => references ? references.includes(item.id) : !contextual)
    .filter(item => item.type === "lesson_content")
    .filter(item => !unavailableActivityIds.includes(item.id))
    .filter(item => item.body.trim() || item.highlights.some(text => text.trim()) || item.teaching);
  if (!explanations.length) return null;
  return <div className="lesson-help" data-lesson-support>
    <button className="lesson-help-trigger" type="button" aria-haspopup="dialog"
      onClick={() => dialog.current?.showModal()}>
      <span className="lesson-help-icon"><LifeBuoy aria-hidden="true" /></span>
      <span><strong>Precisa de ajuda?</strong><small>Reveja os exemplos sem sair da conversa</small></span>
      <ArrowUpRight aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="lesson-help-dialog" aria-labelledby={heading}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      onClose={() => dialog.current?.querySelectorAll("audio").forEach(audio => audio.pause())}>
      <div className="lesson-help-surface">
        <header className="lesson-help-heading"><div><span className="le-eyebrow">UM APOIO PARA CONTINUAR</span>
          <h2 id={heading}>Vamos lembrar juntos</h2></div>
          <button autoFocus type="button" aria-label="Fechar ajuda" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button>
        </header>
        <div className="lesson-help-body">
          {explanations.map(item => <section key={item.id}>
            <LearningText as="h3" presentation={item.presentation} textRole="source" text={item.title} />
            {item.teaching && <TeachingCard teaching={item.teaching} presentation={item.presentation} scene={item.scene} />}
            {!(item.teaching && item.scene) && item.body.split("\n\n").map((paragraph, index) =>
              <LearningText key={index} as="p" presentation={item.presentation} field="body" itemIndex={index} textRole="source" text={paragraph} />)}
            {!(item.teaching && item.scene) && !!item.highlights.length && <ul>{item.highlights.map((text, index) =>
              <LearningText key={text} as="li" presentation={item.presentation} field="highlights" itemIndex={index} text={text} />)}</ul>}
          </section>)}
        </div>
        <footer><button type="button" className="primary-button" onClick={() => dialog.current?.close()}>Voltar à minha resposta</button></footer>
      </div>
    </dialog>
  </div>;
}
