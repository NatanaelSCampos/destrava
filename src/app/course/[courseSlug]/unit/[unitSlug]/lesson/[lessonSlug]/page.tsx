"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { ActivityRenderer } from "@/components/activities/activity-renderer";
import { AssessmentResult } from "@/components/activities/assessment-result";

function LessonContent() {
  const { courseSlug, unitSlug, lessonSlug } = useParams<{
    courseSlug: string;
    unitSlug: string;
    lessonSlug: string;
  }>();
  const { course, state } = useStudy();
  const searchParams = useSearchParams();
  const unit = course.units.find(
    (item) => item.slug === unitSlug || String(item.number) === unitSlug,
  );
  const lesson = unit?.lessons.find((item) => item.slug === lessonSlug);
  const requestedActivity = searchParams.get("activity");
  const requestedIndex =
    lesson?.activities.findIndex((activity) => activity.id === requestedActivity) ?? -1;
  const routeKey = `${lessonSlug}:${requestedActivity ?? ""}`;
  const [selection, setSelection] = useState({ routeKey, index: Math.max(0, requestedIndex) });
  const index = selection.routeKey === routeKey ? selection.index : Math.max(0, requestedIndex);
  const setIndex = (next: number | ((current: number) => number)) =>
    setSelection({ routeKey, index: typeof next === "function" ? next(index) : next });
  if (courseSlug !== course.slug || !unit || !lesson)
    return <div className="empty-state">Lição não encontrada.</div>;
  const active = lesson.activities[index] ?? lesson.activities[0];
  const complete = lesson.activities.filter((activity) =>
    state.completedActivityIds.includes(activity.id),
  ).length;
  const lessonIndex = unit.lessons.findIndex((item) => item.id === lesson.id);
  const nextLesson = unit.lessons[lessonIndex + 1];
  const previousLesson = unit.lessons[lessonIndex - 1];
  return (
    <div className="lesson-page">
      <Link href={`/course/${course.slug}/unit/${unit.number}`} className="back-link">
        <ArrowLeft size={16} /> Voltar à unidade
      </Link>
      <div className="lesson-header">
        <div>
          <span className="eyebrow">
            UNIDADE {unit.number} <ChevronRight size={13} /> {lesson.eyebrow}
          </span>
          <h1>{lesson.title}</h1>
          <p>{lesson.description}</p>
        </div>
        <span className="pill">
          {complete}/{lesson.activities.length} atividades
        </span>
      </div>
      <div className="lesson-layout">
        <aside className="lesson-sidebar panel">
          <span className="eyebrow">NESTA LIÇÃO</span>
          <div className="lesson-mini-progress">
            <div className="progress-track">
              <span
                style={{ width: `${Math.round((100 * complete) / lesson.activities.length)}%` }}
              />
            </div>
            <small>{Math.round((100 * complete) / lesson.activities.length)}% concluído</small>
          </div>
          <nav aria-label="Atividades da lição">
            {lesson.activities.map((activity, activityIndex) => (
              <button
                type="button"
                key={activity.id}
                className={`lesson-nav-item ${index === activityIndex ? "active" : ""}`}
                onClick={() => setIndex(activityIndex)}
              >
                <span>
                  {state.completedActivityIds.includes(activity.id) ? (
                    <Check size={15} />
                  ) : (
                    <Circle size={14} />
                  )}
                </span>
                <span>{activity.title}</span>
              </button>
            ))}
          </nav>
          <div className="lesson-sidebar-footer">
            Estude no seu ritmo. Você pode voltar a qualquer atividade.
          </div>
        </aside>
        <div className="lesson-main">
          <ActivityRenderer key={active.id} activity={active} />
          {lesson.activities.some((activity) => activity.type === "quiz") && (
            <AssessmentResult lesson={lesson} unitId={unit.id} />
          )}
          <div className="lesson-controls">
            <button
              className="ghost-button"
              disabled={index === 0}
              onClick={() => setIndex((current) => current - 1)}
            >
              <ChevronLeft size={17} /> Anterior
            </button>
            {index < lesson.activities.length - 1 ? (
              <button className="primary-button" onClick={() => setIndex((current) => current + 1)}>
                Próxima atividade <ChevronRight size={17} />
              </button>
            ) : nextLesson ? (
              <Link
                className="primary-button"
                href={`/course/${course.slug}/unit/${unit.number}/lesson/${nextLesson.slug}`}
              >
                Próxima lição <ArrowRight size={17} />
              </Link>
            ) : (
              <Link className="primary-button" href={`/course/${course.slug}/unit/${unit.number}`}>
                Voltar à unidade <ArrowRight size={17} />
              </Link>
            )}
          </div>
          <div className="lesson-neighbors">
            {previousLesson && (
              <Link
                href={`/course/${course.slug}/unit/${unit.number}/lesson/${previousLesson.slug}`}
              >
                <ChevronLeft size={15} /> {previousLesson.title}
              </Link>
            )}
            {nextLesson && (
              <Link href={`/course/${course.slug}/unit/${unit.number}/lesson/${nextLesson.slug}`}>
                {nextLesson.title} <ChevronRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LessonPage() {
  return (
    <Suspense fallback={<div className="page-loading">Abrindo lição…</div>}>
      <LessonContent />
    </Suspense>
  );
}
