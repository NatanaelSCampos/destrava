"use client";

import Link from "next/link";
import { ArrowRight, Check, NotebookPen, RotateCcw } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import { formatDate } from "@/lib/utils";
import { SpeakButton } from "@/components/audio/speak-button";
import { featureFlags } from "@/lib/feature-flags";

const skillNames: Record<string, string> = {
  grammar: "Gramática",
  vocabulary: "Vocabulário",
  spelling: "Ortografia",
  listening: "Escuta",
  writing: "Escrita",
  speaking: "Pronúncia e fala",
  reading: "Leitura",
};

export default function MistakesPage() {
  const { course, state } = useStudy();
  const contexts = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) =>
        lesson.activities.map(
          (activity) =>
            [
              activity.id,
              {
                activity,
                href: `/course/${course.slug}/unit/${unit.number}/lesson/${lesson.slug}?activity=${encodeURIComponent(activity.id)}`,
              },
            ] as const,
        ),
      ),
    ),
  );
  const mistakes = Object.values(state.mistakes)
    .filter((item) => contexts.has(item.activityId))
    .sort((a, b) => b.lastMissedAt.localeCompare(a.lastMissedAt));
  const due = mistakes.filter((item) => ReviewScheduler.isDue(item.schedule)).length;
  const improving = mistakes.filter((item) => item.schedule.masteryScore >= 50).length;
  return (
    <div className="mistakes-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <NotebookPen size={13} /> CADERNO AUTOMÁTICO
          </span>
          <h1 className="page-title">Meus erros</h1>
          <p className="page-subtitle">
            Cada dúvida registrada vira uma oportunidade de praticar com intenção.
          </p>
        </div>
        <Link href="/review" className="primary-button">
          <RotateCcw size={16} /> Revisar agora
        </Link>
      </div>
      <div className="mistake-summary">
        <div className="panel">
          <strong>{mistakes.length}</strong>
          <span>erros registrados</span>
        </div>
        <div className="panel">
          <strong>{due}</strong>
          <span>para revisar hoje</span>
        </div>
        <div className="panel">
          <strong>{improving}</strong>
          <span>em evolução</span>
        </div>
      </div>
      <div className="section-head">
        <div>
          <span className="eyebrow">SEUS PONTOS DE ATENÇÃO</span>
          <h2 className="section-title">Aprenda com cada tentativa</h2>
        </div>
      </div>
      {mistakes.length ? (
        <div className="mistake-list">
          {mistakes.map((item) => {
            const context = contexts.get(item.activityId);
            return (
              <article className="mistake-card panel" key={item.id}>
                <div className="mistake-card-header">
                  <span className="pill red">{skillNames[item.category] ?? item.category}</span>
                  <span>{formatDate(item.lastMissedAt)}</span>
                </div>
                <h3>{context?.activity.title ?? "Atividade"}</h3>
                <div className="mistake-comparison">
                  <div>
                    <span>SUA RESPOSTA</span>
                    <p>{item.originalAnswer}</p>
                  </div>
                  <div>
                    <span>FORMA ESPERADA</span>
                    <p>
                      <Check size={16} /> {item.correctAnswer}
                      <SpeakButton text={item.correctAnswer} label="Ouvir forma esperada" />
                    </p>
                  </div>
                </div>
                <p className="mistake-explanation">{item.explanation}</p>
                <div className="mistake-card-footer">
                  <span>
                    Errou {item.timesMissed}x · acertou {item.timesCorrect}x
                  </span>
                  <span>Próxima revisão: {formatDate(item.schedule.nextReviewAt)}</span>
                </div>
                {context && (
                  <div className="mistake-actions">
                    <Link href={context.href} className="text-link">
                      {item.category === "speaking"
                        ? "Gravar nova tentativa"
                        : "Praticar novamente"}{" "}
                      <ArrowRight size={15} />
                    </Link>
                    {featureFlags.AI_TUTOR && (
                      <Link
                        href={`/micro-lesson?activity=${encodeURIComponent(item.activityId)}`}
                        className="text-link"
                      >
                        Fazer microlição <ArrowRight size={15} />
                      </Link>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state panel">
          <NotebookPen size={29} />
          <strong>Seu caderno está em branco.</strong>
          <span>Quando uma resposta precisar de ajuste, ela aparecerá aqui com a explicação.</span>
          <Link href="/study" className="secondary-button">
            Começar a estudar <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
