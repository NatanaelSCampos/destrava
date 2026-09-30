"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Play, Target } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { unitProgress } from "@/domain/study/progress";

export default function UnitPage() {
  const { courseSlug, unitSlug } = useParams<{ courseSlug: string; unitSlug: string }>();
  const { course, state, vocabularyItems } = useStudy();
  const unit = course.units.find(
    (item) => item.slug === unitSlug || String(item.number) === unitSlug,
  );
  if (courseSlug !== course.slug || !unit)
    return <div className="empty-state">Unidade não encontrada.</div>;
  const progress = unitProgress(unit, state, vocabularyItems);
  const nextLesson = unit.lessons.find((lesson) =>
    lesson.activities.some((activity) => !state.completedActivityIds.includes(activity.id)),
  );
  return (
    <div className="unit-page">
      <Link href={`/course/${course.slug}`} className="back-link">
        <ArrowLeft size={16} /> Todas as unidades
      </Link>
      <div className="unit-hero">
        <div>
          <span className="eyebrow">
            UNIDADE {String(unit.number).padStart(2, "0")} · FRECUENCIAS A1
          </span>
          <h1>{unit.title}</h1>
          <p>{unit.description}</p>
          <div className="unit-hero-meta">
            <span>
              <Clock3 size={15} /> {unit.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)}{" "}
              minutos
            </span>
            <span>
              <Target size={15} /> {unit.objectives.length} objetivos
            </span>
          </div>
          <Link
            href={
              nextLesson
                ? `/course/${course.slug}/unit/${unit.number}/lesson/${nextLesson.slug}`
                : "/review"
            }
            className="primary-button"
          >
            <Play size={15} fill="currentColor" />{" "}
            {nextLesson ? "Continuar unidade" : "Revisar unidade"} <ArrowRight size={15} />
          </Link>
        </div>
        <div className="unit-hero-score">
          <strong>{progress.percentage}%</strong>
          <span>da trilha concluída</span>
          <div className="progress-track">
            <span style={{ width: `${progress.percentage}%` }} />
          </div>
        </div>
      </div>
      <div className="unit-content-grid">
        <section>
          <div className="section-head">
            <div>
              <span className="eyebrow">PASSO A PASSO</span>
              <h2 className="section-title">Trilha da unidade</h2>
            </div>
            <span className="muted">{unit.lessons.length} etapas</span>
          </div>
          <div className="lesson-list">
            {unit.lessons.map((lesson, index) => {
              const completed = lesson.activities.every((activity) =>
                state.completedActivityIds.includes(activity.id),
              );
              const partial = lesson.activities.some((activity) =>
                state.completedActivityIds.includes(activity.id),
              );
              return (
                <Link
                  key={lesson.id}
                  href={`/course/${course.slug}/unit/${unit.number}/lesson/${lesson.slug}`}
                  className="lesson-row"
                >
                  <span className={`lesson-step ${completed ? "done" : partial ? "current" : ""}`}>
                    {completed ? <Check size={18} /> : String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <span className="eyebrow">{lesson.eyebrow}</span>
                    <h3>{lesson.title}</h3>
                    <p>{lesson.description}</p>
                  </div>
                  <span className="lesson-row-time">
                    <Clock3 size={14} /> {lesson.minutes} min
                  </span>
                  <ChevronRight size={18} />
                </Link>
              );
            })}
          </div>
        </section>
        <aside className="unit-aside">
          <div className="panel objectives-panel">
            <span className="eyebrow">
              <Target size={13} /> AO FINAL DESTA UNIDADE
            </span>
            <h3>Você vai conseguir…</h3>
            <ul>
              {unit.objectives.map((objective) => (
                <li key={objective}>
                  <Check size={15} /> {objective}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel mastery-panel">
            <span className="eyebrow">SEU DOMÍNIO</span>
            <h3>
              {progress.isMastered
                ? "Unidade dominada"
                : progress.isCompleted
                  ? "Trilha concluída"
                  : "Em construção"}
            </h3>
            <p>Concluir atividades e dominar o conteúdo são marcos diferentes.</p>
            <div>
              <span>Exercícios</span>
              <strong>{progress.exerciseScore}%</strong>
            </div>
            <div>
              <span>Revisão</span>
              <strong>{progress.reviewScore}%</strong>
            </div>
            <div>
              <span>Teste final</span>
              <strong>
                {progress.assessmentFinished ? `${progress.assessmentScore}%` : "Pendente"}
              </strong>
            </div>
            <div>
              <span>Escrita e fala</span>
              <strong>
                {progress.writingDone && progress.speakingDone ? "Concluídas" : "Pendentes"}
              </strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
