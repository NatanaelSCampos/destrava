"use client";
import { TrailReturn } from "@/components/trail/trail-return";
import { trailReturnHref } from "@/lib/trail-location";
import type { LivingTrailMoment } from "@/domain/study/living-trail";
import Link from "@/components/navigation-link";
import {
  resolveLessonStages,
  lessonStagePosition,
  lessonStageComplete,
} from "@/engine/presentation/lesson-stages";
import { useLayoutEffect, useRef } from "react";
import "./lesson-experience.css";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Ear,
  BookOpen,
  Puzzle,
  MessageCircle,
  Brain,
  PenLine,
  MapPin,
  Volume2,
  X,
} from "lucide-react";
import type { PublicActivity, PublicLesson, PublicUnit } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import { ActivityRenderer, activityEligibility } from "./activity-renderer";
import { LessonSupport } from "./lesson-support";

export function activityStage(activity: PublicActivity) {
  if (activity.type === "lesson_content")
    return activity.teaching?.diagram || (activity.scene && activity.teaching?.kind !== "dialogue")
      ? { label: "A cena", Icon: MapPin }
      : activity.teaching?.kind === "dialogue"
        ? { label: "Uma conversa", Icon: MessageCircle }
        : { label: "Aprenda", Icon: BookOpen };
  if (activity.type === "listening") return { label: "Ouça", Icon: Ear };
  if (activity.type === "ordering") return { label: "Monte", Icon: Puzzle };
  if (activity.type === "flashcard" || activity.type === "review")
    return { label: "Retome", Icon: Brain };
  if (activity.type === "writing" || activity.type === "speaking")
    return { label: "Aplique", Icon: PenLine };
  return { label: "Pratique", Icon: MessageCircle };
}
function LessonAudioInformation({ lesson }: { lesson: PublicLesson }) {
  const { course } = useStudy();
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = lesson.activities.flatMap((activity) => [
    ...(activity.scene?.cue?.audioMediaId ? [activity.scene.cue.audioMediaId] : []),
    ...(activity.type === "lesson_content"
      ? (activity.teaching?.lines.flatMap((line) =>
          line.audioMediaId ? [line.audioMediaId] : [],
        ) ?? [])
      : activity.type === "flashcard"
        ? [
            ...(activity.recordedBack ? [activity.recordedBack.audioMediaId] : []),
            ...(activity.recallScene?.model.lines.flatMap((line) =>
              line.audioMediaId ? [line.audioMediaId] : [],
            ) ?? []),
          ]
        : []),
  ]);
  const assets = course.teachingMedia?.filter((asset) => ids.includes(asset.id)) ?? [];
  const sources = [
    ...new Map(assets.map((asset) => [asset.sourceUrl + asset.licenseUrl, asset])).values(),
  ];
  if (!assets.length) return null;
  return (
    <div className="le-audio-information">
      <button type="button" onClick={() => dialog.current?.showModal()}>
        <Volume2 size={14} aria-hidden="true" /> Áudios
      </button>
      <dialog ref={dialog} className="le-audio-dialog">
        <div className="le-dialog-heading">
          <h2>Áudios desta lição</h2>
          <button
            type="button"
            aria-label="Fechar informações dos áudios"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>Áudios de apoio desta lição. Consulte a autoria da voz e as condições de uso abaixo.</p>
        {sources.map((asset) => (
          <p key={asset.sourceUrl + asset.licenseUrl}>
            <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
              Autoria da voz
            </a>
            {" · "}
            <a href={asset.licenseUrl} target="_blank" rel="noreferrer">
              Permissão de uso
            </a>
          </p>
        ))}
      </dialog>
    </div>
  );
}

function LessonContext({ lesson, active }: { lesson: PublicLesson; active: PublicActivity }) {
  const { state } = useStudy();
  const shown = lesson.activities.filter(
    (activity) =>
      activity.type === "lesson_content" &&
      (activity.id === active.id || state.completedActivityIds.includes(activity.id)),
  );
  const phrases = [
    ...new Map(
      shown.flatMap((activity) =>
        activity.type === "lesson_content"
          ? (activity.teaching?.lines ?? []).map((line) => [line.text, line] as const)
          : [],
      ),
    ).values(),
  ];
  return (
    <>
      <section className="le-objectives">
        <span className="le-eyebrow">HOJE VOCÊ VAI</span>
        <h2>Um passo de cada vez</h2>
        <ul>
          {Object.values(lesson.objectiveLabels ?? {}).map((text) => (
            <li key={text}>
              <Check aria-hidden="true" size={15} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>
      {phrases.length > 0 &&
        !["short_answer", "flashcard", "writing", "speaking"].includes(active.type) &&
        !(active.type === "review" && active.reviewMode === "recall") && (
          <section className="le-repertoire">
            <span className="le-eyebrow">SEU REPERTÓRIO</span>
            <h2>Frases que já apareceram</h2>
            <div className="le-repertoire-entries">
              {phrases.map((line) => (
                <div className="le-entry" key={line.text}>
                  <strong>{line.text}</strong>
                  {line.translation && <small>{line.translation}</small>}
                </div>
              ))}
            </div>
          </section>
        )}
    </>
  );
}
export function LessonExperience({
  lesson,
  unit,
  index,
  onSelect,
  nextLesson,
  previousLesson,
  trailMoment,
}: {
  lesson: PublicLesson;
  unit: PublicUnit;
  index: number;
  onSelect: (index: number) => void;
  nextLesson?: PublicLesson;
  previousLesson?: PublicLesson;
  trailMoment?: LivingTrailMoment;
}) {
  const { course, language, state, completeActivity } = useStudy();
  const activityIndex = lesson.activities[index] ? index : 0;
  const active = lesson.activities[activityIndex];
  const momentEnd = trailMoment
    ? Math.max(
        ...trailMoment.activityIds.map((id) => lesson.activities.findIndex((a) => a.id === id)),
      )
    : lesson.activities.length - 1;
  const momentEndsHere = Boolean(trailMoment && activityIndex === momentEnd);
  const committedActivity = useRef(active.id);
  const contextDialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    committedActivity.current = active.id;
    const current = document.querySelector<HTMLButtonElement>(
      ".le-stage-parts button[aria-current]",
    );
    const rail = current?.closest("ol");
    if (!current || !rail) return;
    const center = () => {
      if (rail.scrollWidth > rail.clientWidth)
        rail.scrollTo({
          left: Math.max(0, current.offsetLeft - (rail.clientWidth - current.offsetWidth) / 2),
          behavior: "instant",
        });
    };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [active.id]);
  const stages = resolveLessonStages(lesson).filter(
    (stage) => !trailMoment || trailMoment.stageIds.includes(stage.id),
  );
  const { stageIndex, partIndex } = lessonStagePosition(stages, activityIndex);
  const stage = stages[stageIndex];
  const { label, Icon } = activityStage(lesson.activities[stage.startIndex]);
  const canComplete =
    active.type === "lesson_content" &&
    activityEligibility(active, { course, language, preference: state.profile.variantId }).eligible;
  const total = stages.length;
  const done = new Set(state.completedActivityIds);
  const hasMoreParts = activityIndex < stage.endIndex;
  const select = (next: number) => {
    onSelect(next);
    window.requestAnimationFrame(() => {
      const target = document.getElementById("activity-" + lesson.activities[next].id);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    });
  };
  return (
    <div className="lesson-experience">
      <TrailReturn lessonId={lesson.id} unitId={unit.id} />
      {!trailMoment && (
        <header className="le-intro">
          <div>
            <span className="le-crumb">{course.title}</span>
            <h1>{lesson.title}</h1>
            <p>{lesson.description}</p>
          </div>
          <span className="le-duration">
            <Clock3 size={14} /> {lesson.minutes} min · no seu ritmo
          </span>
        </header>
      )}
      {!trailMoment && (
        <details className="le-mobile-context">
          <summary>Objetivos e frases apresentadas</summary>
          <LessonContext lesson={lesson} active={active} />
        </details>
      )}
      {trailMoment && (
        <div className="le-moment-purpose">
          <span>
            <BookOpen size={17} aria-hidden="true" />
            {trailMoment.objective ?? trailMoment.description}
          </span>
          <button type="button" onClick={() => contextDialog.current?.showModal()}>
            O que vou praticar
          </button>
          <dialog
            ref={contextDialog}
            className="le-audio-dialog le-context-dialog"
            aria-label="Objetivos e frases apresentadas"
          >
            <div className="le-dialog-heading">
              <h2>Um momento de cada vez</h2>
              <button
                type="button"
                aria-label="Fechar objetivos"
                onClick={() => contextDialog.current?.close()}
              >
                <X size={20} />
              </button>
            </div>
            <LessonContext lesson={lesson} active={active} />
          </dialog>
        </div>
      )}
      <div className="le-layout">
        {!trailMoment && (
          <aside className="le-path">
            <div className="le-path-heading">
              <span className="le-eyebrow">SEU PERCURSO</span>
              <h2>{lesson.title}</h2>
              <small>{total} etapas curtas</small>
            </div>
            <nav aria-label="Etapas desta lição">
              {stages.map((item, position) => {
                const itemStage = activityStage(lesson.activities[item.startIndex]);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => select(item.startIndex)}
                    aria-current={stageIndex === position ? "step" : undefined}
                    className={stageIndex === position ? "current" : ""}
                  >
                    <span
                      className={
                        lessonStageComplete(item, done) ? "le-number completed" : "le-number"
                      }
                    >
                      {lessonStageComplete(item, done) ? (
                        <Check size={15} />
                      ) : (
                        String(position + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>
                      <b>{itemStage.label}</b>
                      <small>
                        {item.title}
                        {item.activityIds.length > 1 && (
                          <span className="le-stage-part-count">
                            {item.activityIds.length} partes
                          </span>
                        )}
                      </small>
                    </span>
                  </button>
                );
              })}
            </nav>
            <p className="le-path-note">Volte às etapas quando quiser.</p>
          </aside>
        )}
        <section className="le-paper" aria-label="Atividade atual">
          <div className="le-top">
            <span className="le-eyebrow">
              <Icon size={14} /> {label}
            </span>
            <span>
              {String(stageIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>
          <div
            className="le-progress"
            role="progressbar"
            aria-label={trailMoment ? "Progresso desta atividade" : "Etapa do percurso"}
            aria-valuemin={1}
            aria-valuemax={trailMoment ? stage.activityIds.length : total}
            aria-valuenow={trailMoment ? partIndex + 1 : stageIndex + 1}
          >
            <span
              style={{
                width:
                  (trailMoment
                    ? (partIndex + 1) / stage.activityIds.length
                    : (stageIndex + 1) / total) *
                    100 +
                  "%",
              }}
            />
          </div>
          <div className="le-body">
            <span className="le-tag">
              {String(stageIndex + 1).padStart(2, "0")} · {label}
            </span>
            {!trailMoment && stage.activityIds.length > 1 && (
              <section className="le-stage-parts" aria-label="Partes desta etapa">
                <header>
                  <div>
                    <span className="le-eyebrow">Nesta etapa</span>
                    <h2>{stage.title}</h2>
                  </div>
                  <span className="le-part-position" role="status">
                    Parte {partIndex + 1} de {stage.activityIds.length}
                  </span>
                </header>
                <ol>
                  {stage.activityIds.map((id, part) => (
                    <li key={id}>
                      <button
                        type="button"
                        aria-current={partIndex === part ? "step" : undefined}
                        onClick={() => select(stage.startIndex + part)}
                        aria-label={`Parte ${part + 1}: ${lesson.activities[stage.startIndex + part].title}`}
                      >
                        <span
                          className={done.has(id) ? "le-part-number completed" : "le-part-number"}
                        >
                          {done.has(id) ? <Check size={13} /> : part + 1}
                        </span>
                        <span>{lesson.activities[stage.startIndex + part].title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <ActivityRenderer
              key={active.id}
              activity={active}
              hideContentCompletion={active.type === "lesson_content"}
              onActivityComplete={(activityId) => {
                if (activityId !== committedActivity.current || activityIndex >= momentEnd) return;
                select(activityIndex + 1);
              }}
            />
            {active.type !== "lesson_content" && (
              <LessonSupport
                lesson={lesson}
                activity={active}
                unavailableActivityIds={course.availability?.unavailableActivityIds}
              />
            )}
          </div>
          <footer className="le-controls">
            <button
              type="button"
              className="secondary-button"
              disabled={
                activityIndex ===
                (trailMoment
                  ? lesson.activities.findIndex((a) => a.id === trailMoment.activityIds[0])
                  : 0)
              }
              onClick={() => select(activityIndex - 1)}
            >
              <ChevronLeft size={16} /> {"Anterior"}
            </button>
            {momentEndsHere ? (
              <Link
                className="primary-button"
                href={trailReturnHref(course.slug, unit.number, trailMoment?.id)}
                onClick={() => {
                  if (canComplete) completeActivity(active.id);
                }}
              >
                Voltar ao percurso <ArrowRight size={16} />
              </Link>
            ) : activityIndex < lesson.activities.length - 1 ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (canComplete) completeActivity(active.id);
                  select(activityIndex + 1);
                }}
              >
                {hasMoreParts
                  ? "Continuar"
                  : stage.activityIds.length > 1
                    ? "Continuar percurso"
                    : stageIndex === 0
                      ? "Começar lição"
                      : "Continuar"}{" "}
                <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <span>
                  {canComplete && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => completeActivity(active.id)}
                    >
                      {done.has(active.id) ? "Conteúdo estudado" : "Marcar como estudado"}
                    </button>
                  )}
                </span>
                <Link
                  className="primary-button"
                  href={
                    nextLesson
                      ? `/course/${course.slug}/unit/${unit.number}/lesson/${nextLesson.slug}`
                      : `/course/${course.slug}/unit/${unit.number}`
                  }
                >
                  {nextLesson ? "Próxima lição" : "Voltar ao caminho"} <ArrowRight size={16} />
                </Link>
              </>
            )}
          </footer>
        </section>
        <aside className="le-context">
          <LessonContext lesson={lesson} active={active} />
        </aside>
      </div>
      <LessonAudioInformation lesson={lesson} />
      {!trailMoment && (
        <div className="le-neighbors">
          {previousLesson && (
            <Link href={`/course/${course.slug}/unit/${unit.number}/lesson/${previousLesson.slug}`}>
              <ChevronLeft size={14} />
              {previousLesson.title}
            </Link>
          )}
          <small>
            {stages.filter((item) => lessonStageComplete(item, done)).length} de {total} etapas
            concluídas.
          </small>
          {nextLesson && (
            <Link href={`/course/${course.slug}/unit/${unit.number}/lesson/${nextLesson.slug}`}>
              {nextLesson.title}
              <ChevronRight size={14} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
