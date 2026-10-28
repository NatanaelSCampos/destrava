"use client";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Check,
  LocateFixed,
  LockKeyhole,
  Play,
  Route,
  Trophy,
  X,
} from "lucide-react";
import Link from "@/components/navigation-link";
import { useStudy } from "@/components/study-provider";
import type { LivingTrailChapter, LivingTrailMoment } from "@/domain/study/living-trail";
import { journeyText } from "@/lib/journey-text";
import { useTrailPosition } from "./use-trail-position";
import { useLivingTrail } from "./use-living-trail";
import { TrailIcon } from "./trail-icon";
import { TrailArtwork } from "./trail-artwork";
import { TrailMemory } from "./trail-memory";
import { SceneIllustration } from "@/components/activities/lesson-illustrations";
import "./living-trail.css";
import "./living-trail-path.css";

/** A single measured connector follows every teaching stop, including story transitions. */
function WindingPath({
  chapters,
  nextId,
  nextHref,
  onBlocked,
}: {
  chapters: LivingTrailChapter[];
  nextId?: string;
  nextHref?: string;
  onBlocked: (moment: LivingTrailMoment) => void;
}) {
  const { course } = useStudy();
  const list = useRef<HTMLOListElement>(null);
  const [route, setRoute] = useState({ width: 1, height: 1, d: "" });
  const moments = chapters.flatMap((chapter) => chapter.moments);
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const draw = () => {
      const box = element.getBoundingClientRect();
      const points = [...element.querySelectorAll<HTMLElement>(".tv-path-stop")].map((node) => {
        const r = node.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      });
      const d = points.reduce((path, point, i) => {
        if (!i) return "M " + point.x + " " + point.y;
        const previous = points[i - 1],
          dy = (point.y - previous.y) * 0.55;
        return (
          path +
          " C " +
          previous.x +
          " " +
          (previous.y + dy) +
          ", " +
          point.x +
          " " +
          (point.y - dy) +
          ", " +
          point.x +
          " " +
          point.y
        );
      }, "");
      setRoute({ width: box.width || 1, height: box.height || 1, d });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [chapters]);
  return (
    <ol ref={list} className="tv-winding-path" aria-label="Etapas do seu caminho">
      <li className="tv-route-layer" aria-hidden="true">
        <svg
          className="tv-route-svg"
          viewBox={"0 0 " + route.width + " " + route.height}
          preserveAspectRatio="none"
        >
          <path
            d={route.d}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray="1 13"
            strokeLinecap="round"
          />
        </svg>
      </li>
      {moments.map((moment, index) => {
        const chapter = chapters.find((item) => item.moments[0]?.id === moment.id);
        const lesson = course.units
          .flatMap((unit) => unit.lessons)
          .find((item) => item.id === moment.lessonId);
        const startsStory = moment.lessonId !== moments[index - 1]?.lessonId;
        const locked = ["locked", "unavailable"].includes(moment.status),
          current = nextId === moment.id;
        const x = [44, 65, 70, 58, 37, 26, 31][index % 7];
        const content = (
          <>
            <span className="tv-stop-icon" aria-hidden="true">
              {moment.status === "completed" && !moment.isExam ? (
                <Check size={28} />
              ) : locked ? (
                <LockKeyhole size={26} />
              ) : (
                <TrailIcon name={moment.icon} size={28} />
              )}
            </span>
            {current && <span className="tv-start-label">Continuar</span>}
            {current && (
              <span className="tv-node-play" aria-hidden="true">
                <Play size={11} fill="currentColor" />
              </span>
            )}
            <span className="tv-stop-caption">
              <strong>{journeyText(moment.title)}</strong>
              {moment.result && (
                <small>
                  {typeof moment.result.objectiveScore === "number"
                    ? moment.result.objectiveScore + "%"
                    : "Sem nota"}{" "}
                  · {moment.historyCount} {moment.historyCount === 1 ? "tentativa" : "tentativas"}
                </small>
              )}
            </span>
          </>
        );
        return (
          <Fragment key={moment.id}>
            {chapter && (
              <li
                className={"tv-chapter tv-chapter-hero tv-tone-" + chapter.tone}
                id={"chapter-" + chapter.id}
              >
                <div>
                  <h2>{journeyText(chapter.title)}</h2>
                  <div
                    className="tv-progress"
                    role="progressbar"
                    aria-label={"Progresso: " + journeyText(chapter.title)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={chapter.progress.participationPercentage}
                  >
                    <span style={{ width: chapter.progress.participationPercentage + "%" }} />
                  </div>
                </div>
                <div className="tv-story-art" aria-hidden="true">
                  {chapter.illustration ? (
                    <Image src={chapter.illustration.src} alt="" width={140} height={100} />
                  ) : (
                    <TrailArtwork compact />
                  )}
                </div>
              </li>
            )}
            {startsStory && !chapter && (
              <li className="tv-story-divider">
                <span>{journeyText(lesson?.title ?? moment.title)}</span>
              </li>
            )}
            <li
              id={"moment-" + moment.id}
              className={
                "tv-path-node tv-moment tv-tone-" +
                moment.tone +
                (current ? " is-current" : "") +
                (locked ? " is-locked" : "") +
                (moment.status === "completed" ? " is-completed" : "")
              }
              style={
                {
                  "--tv-node-x": x + "%",
                  "--tv-node-progress": moment.percentage + "%",
                } as CSSProperties
              }
              aria-current={current ? "step" : undefined}
            >
              {index % 7 === 3 && (
                <div
                  className={"tv-path-decoration " + (x < 50 ? "on-right" : "on-left")}
                  aria-hidden="true"
                >
                  <SceneIllustration
                    kind={
                      moment.icon === "coffee" || moment.icon === "shopping-bag"
                        ? "cafe"
                        : moment.icon === "map-pin"
                          ? "neighborhood"
                          : "message"
                    }
                    label=""
                  />
                </div>
              )}
              {locked ? (
                <button
                  type="button"
                  className="tv-path-stop"
                  aria-label={
                    journeyText(moment.title) + ": " + moment.label + ". Entender o acesso"
                  }
                  aria-haspopup="dialog"
                  onClick={() => onBlocked(moment)}
                >
                  {content}
                </button>
              ) : (
                <Link
                  className="tv-path-stop"
                  href={current && nextHref ? nextHref : moment.href}
                  scroll={false}
                  aria-haspopup="dialog"
                  aria-label={journeyText(moment.title) + ": " + moment.label}
                >
                  {content}
                </Link>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
export function LivingTrailView({
  unitSlug,
  background = false,
}: {
  unitSlug?: string;
  background?: boolean;
}) {
  const { course } = useStudy();
  const { trail, continuation, ready } = useLivingTrail();
  const requestedUnit =
    unitSlug &&
    course.units.find((unit) => unit.slug === unitSlug || String(unit.number) === unitSlug);
  const selected =
    trail.chapters.find(
      (chapter) =>
        chapter.unitId === (requestedUnit ? requestedUnit.id : continuation?.chapter.unitId),
    ) ??
    trail.chapters.find((chapter) => chapter.id === trail.currentChapterId) ??
    trail.chapters[0];
  const next = continuation?.moment;
  const position = useTrailPosition(
    trail,
    next?.id,
    ready && !background,
    course.id + ":" + course.contentVersion,
  );
  const [blocked, setBlocked] = useState<LivingTrailMoment | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (blocked && !dialog.current?.open) dialog.current?.showModal();
  }, [blocked]);
  if (!ready) return <div className="page-loading">Encontrando seu lugar na trilha…</div>;
  if ((unitSlug && !requestedUnit) || !selected)
    return (
      <section className="panel">
        <h1>Este trecho do caminho não foi encontrado</h1>
        <Link className="secondary-button" href={"/course/" + course.slug}>
          Ver minha trilha
        </Link>
      </section>
    );
  const milestone = selected.moments.find((moment) => moment.isExam) ?? selected.moments.at(-1);
  return (
    <div className="tv-page" data-trail-version={trail.presentationVersion ?? "default"}>
      <header className="tv-page-heading">
        <div>
          <span className="tv-kicker">
            <Route size={15} /> {course.title}
          </span>
          <h1>Minha trilha</h1>
        </div>
        <Link className="tv-quiet-link" href="/dashboard">
          <ArrowLeft size={15} /> Visão geral
        </Link>
      </header>
      <div className="tv-layout">
        <section className="tv-path-area" aria-label="Percurso de aprendizagem">
          <nav className="tv-path-toolbar" aria-label="Navegar na trilha">
            <span>
              <Route size={16} /> Siga seu caminho
            </span>
            {next && (
              <button type="button" onClick={position.returnToCurrent}>
                <LocateFixed size={16} /> Onde parei
              </button>
            )}
          </nav>
          <WindingPath
            chapters={trail.chapters}
            nextId={next?.id}
            nextHref={continuation?.href}
            onBlocked={setBlocked}
          />
        </section>
        <aside className="tv-context-rail">
          <section className="tv-next-card">
            <span className="tv-kicker">VAMOS CONTINUAR?</span>
            <div className="tv-next-icon">
              <TrailIcon name={next?.icon ?? "compass"} size={25} />
            </div>
            <h2>{journeyText(next?.title ?? "Seu caminho continua aberto")}</h2>
            {continuation ? (
              <Link href={continuation.href} className="primary-button" scroll={false}>
                Continuar <ArrowRight size={16} />
              </Link>
            ) : (
              <Link className="secondary-button" href="/history">
                Ver meu histórico <ArrowRight size={16} />
              </Link>
            )}
          </section>
          <TrailMemory />
          {milestone && (
            <section className="tv-milestone">
              <Trophy size={22} />
              <span className="tv-kicker">MAIS ADIANTE</span>
              <h2>{journeyText(milestone.title)}</h2>
              <span>{milestone.label}</span>
            </section>
          )}
        </aside>
      </div>
      {position.direction && !background && (
        <button
          type="button"
          className={"tv-return-current points-" + position.direction}
          aria-label="Voltar ao ponto para continuar"
          onClick={position.returnToCurrent}
        >
          {position.direction === "up" ? <ArrowUp size={21} /> : <ArrowDown size={21} />}
          <span>Voltar ao meu ponto</span>
        </button>
      )}
      <dialog
        ref={dialog}
        className="tv-access-dialog"
        onClose={() => setBlocked(null)}
        aria-labelledby="tv-access-title"
      >
        <div className="tv-dialog-heading">
          <span className="tv-dialog-icon">
            <LockKeyhole size={24} />
          </span>
          <button
            type="button"
            aria-label="Fechar detalhes do acesso"
            onClick={() => dialog.current?.close()}
          >
            <X size={21} />
          </button>
        </div>
        <span className="tv-kicker">UM PASSO DE CADA VEZ</span>
        <h2 id="tv-access-title">{blocked?.title}</h2>
        <p>{blocked?.blockedReason ?? blocked?.reasons.join(" ")}</p>
        {blocked?.access.total !== undefined && (
          <div className="tv-access-count">
            <strong>
              {blocked.access.completed} de {blocked.access.required} práticas necessárias
            </strong>
            <small>{blocked.access.total} práticas consideradas neste requisito</small>
          </div>
        )}
        <button type="button" className="primary-button" onClick={() => dialog.current?.close()}>
          Voltar ao percurso <ArrowRight size={16} />
        </button>
      </dialog>
    </div>
  );
}
