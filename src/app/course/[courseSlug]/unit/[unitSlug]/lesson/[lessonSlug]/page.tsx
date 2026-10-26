"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "@/components/navigation-link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { ActivityRenderer } from "@/components/activities/activity-renderer";
import { LessonExperience } from "@/components/activities/lesson-experience";
import { LessonSupport } from "@/components/activities/lesson-support";
import { AssessmentResult } from "@/components/activities/assessment-result";
import { lessonWritingScopeKey } from "@/lib/lesson-writing-scope";
import { resolveAssessment } from "@/content/assessment-references";
import { assessmentsForLesson } from "@/lib/assessment-lesson";
import { AssessmentSession } from "@/components/activities/assessment-session";
import { courseLessonPath } from "@/lib/course-lesson-navigation";

function LessonContent() {
  const { course, authUserId, runtime } = useStudy();
  const { unitSlug, lessonSlug } = useParams<{ unitSlug: string; lessonSlug: string }>();
  const unit = course.units.find(item => item.slug === unitSlug || String(item.number) === unitSlug);
  const lesson = unit?.lessons.find(item => item.slug === lessonSlug);
  const scopeKey = lessonWritingScopeKey({
    userId: authUserId, courseId: course.id, contentVersion: course.contentVersion,
    source: runtime ? "installed" : "compiled",
    installationId: runtime?.reference.installationId,
    artifactHash: runtime?.reference.artifactHash,
    versionSessionId: runtime?.versionSessionId,
    unitId: unit?.id ?? unitSlug, lessonId: lesson?.id ?? lessonSlug,
  });
  return <LessonWithDrafts key={scopeKey} />;
}

function LessonWithDrafts() {
  const { courseSlug, unitSlug, lessonSlug } = useParams<{
    courseSlug: string;
    unitSlug: string;
    lessonSlug: string;
  }>();
  const { course, state } = useStudy();
  const [writingDrafts, setWritingDrafts] = useState<Map<string, string>>(() => new Map());
  const router = useRouter();
  const searchParams = useSearchParams();
  const unit = course.units.find(
    (item) => item.slug === unitSlug || String(item.number) === unitSlug,
  );
  const lesson = unit?.lessons.find((item) => item.slug === lessonSlug);
  const lessonAssessments = unit && lesson ? assessmentsForLesson(course, unit, lesson) : [];
  const guidedHref = unit && lesson ? courseLessonPath(course, unit, lesson) + "/guided" : undefined;
  useEffect(() => {
    if (!lessonAssessments.length && lesson?.interactiveLessonRef && guidedHref && courseSlug === course.slug)
      router.replace(guidedHref);
  }, [lessonAssessments.length, lesson?.interactiveLessonRef, guidedHref, courseSlug, course.slug, router]);
  const requestedActivity = searchParams.get("activity");
  const requestedIndex =
    lesson?.activities.findIndex((activity) => activity.id === requestedActivity) ?? -1;
  const routeKey = `${lessonSlug}:${requestedActivity ?? ""}`;
  const [selection, setSelection] = useState({ routeKey, index: Math.max(0, requestedIndex) });
  const index = selection.routeKey === routeKey ? selection.index : Math.max(0, requestedIndex);
  const setIndex = (next: number | ((current: number) => number)) => {
    const selected = typeof next === "function" ? next(index) : next;
    const activity = lesson?.activities[selected];
    if (!activity) return;
    setSelection({ routeKey, index: selected });
    const url = new URL(window.location.href);
    url.searchParams.set("activity", activity.id);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };
  if (courseSlug !== course.slug || !unit || !lesson)
    return <div className="empty-state">Lição não encontrada.</div>;
  if (!lesson.activities.length) return <div className="empty-state">As atividades desta lição estão indisponíveis. Os requisitos da unidade permanecem pendentes.</div>;
  const lessonIndex = unit.lessons.findIndex(item => item.id === lesson.id);
  const nextLesson = unit.lessons[lessonIndex + 1];
  const previousLesson = unit.lessons[lessonIndex - 1];
  if (lessonAssessments.length) {
    const requestedAssessment = searchParams.get("assessmentId");
    const assessment = requestedAssessment
      ? lessonAssessments.find(item => item.id === requestedAssessment)
      : lessonAssessments[0];
    return <div className="lesson-page">
      <Link href={`/course/${course.slug}/unit/${unit.number}`} className="back-link"><ArrowLeft size={16} /> Voltar à unidade</Link>
      {lessonAssessments.length > 1 && <nav aria-label="Avaliações desta lição" className="lesson-neighbors">
        {lessonAssessments.map(item => <Link key={item.id} href={courseLessonPath(course, unit, lesson) + "?assessmentId=" + encodeURIComponent(item.id)}>{item.title}</Link>)}
      </nav>}
      {!unit.active || !lesson.active || course.availability?.unavailableUnitIds?.includes(unit.id)
        ? <section className="panel" role="status">Esta lição está indisponível. Nenhuma nota será registrada.</section>
        : assessment ? <AssessmentSession key={assessment.id} assessmentId={assessment.id} />
        : <section className="panel" role="alert">A avaliação solicitada não pertence a esta lição.</section>}
      <nav className="lesson-neighbors" aria-label="Continuar unidade">
        {previousLesson && <Link href={courseLessonPath(course, unit, previousLesson)}><ChevronLeft size={15} /> Lição anterior</Link>}
        {nextLesson && <Link href={courseLessonPath(course, unit, nextLesson)}>Próxima lição <ChevronRight size={15} /></Link>}
      </nav>
    </div>;
  }
  if (lesson.interactiveLessonRef) return <div className="page-loading">Abrindo a prática desta lição…</div>;
  const active = lesson.activities[index] ?? lesson.activities[0];
  const finalAssessment = resolveAssessment(course.assessments, unit.assessmentRefs.final, "summative");
  const complete = lesson.activities.filter((activity) =>
    state.completedActivityIds.includes(activity.id),
  ).length;
  if (lesson.objectiveLabels || lesson.stages) return <LessonExperience lesson={lesson} unit={unit} index={index} onSelect={next => setIndex(next)} nextLesson={nextLesson} previousLesson={previousLesson} />;
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
            <small>{Math.round((100 * complete) / lesson.activities.length)}% das atividades realizadas</small>
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
          {active.type !== "lesson_content" && (
            <LessonSupport
              lesson={lesson}
              activity={active}
              unavailableActivityIds={course.availability?.unavailableActivityIds}
            />
          )}
          <ActivityRenderer
            key={active.id}
            activity={active}
            writingDraft={active.type === "writing" ? {
              text: writingDrafts.get(active.id) ??
                state.writing.find(item => item.activityId === active.id)?.text ?? "",
              onChange: text => setWritingDrafts(current => new Map(current).set(active.id, text)),
            } : undefined}
          />
          {finalAssessment?.lessonId === lesson.id && (
            <AssessmentResult assessmentId={finalAssessment.id} />
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
