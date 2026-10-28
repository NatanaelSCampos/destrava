"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LocateFixed,
  LockKeyhole,
  MapPin,
  Play,
  Route,
  Trophy,
  X,
} from "lucide-react";
import Link from "@/components/navigation-link";
import { useStudy } from "@/components/study-provider";
import type { LivingTrailMoment } from "@/domain/study/living-trail";
import { journeyText } from "@/lib/journey-text";
import { trailReturnHref } from "@/lib/trail-location";
import { useLivingTrail } from "./use-living-trail";
import { TrailIcon } from "./trail-icon";
import { TrailArtwork } from "./trail-artwork";
import { TrailMemory } from "./trail-memory";
import "./living-trail.css";
import "./living-trail-path.css";
function WindingPath({
  moments,
  nextId,
  nextHref,
  onBlocked,
}: {
  moments: LivingTrailMoment[];
  nextId?: string;
  nextHref?: string;
  onBlocked: (moment: LivingTrailMoment) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [route, setRoute] = useState({ width: 1, height: 1, d: "" });
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
  }, [moments]);
  return (
    <ol ref={list} className="tv-winding-path">
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
            strokeWidth="7"
            strokeDasharray="1 13"
            strokeLinecap="round"
          />
        </svg>
      </li>
      {moments.map((moment, index) => {
        const locked = ["locked", "unavailable"].includes(moment.status),
          current = nextId === moment.id;
        const content = (
          <>
            <span className="tv-stop-icon" aria-hidden="true">
              {moment.status === "completed" && !moment.isExam ? (
                <Check size={27} />
              ) : locked ? (
                <LockKeyhole size={28} />
              ) : (
                <TrailIcon name={moment.icon} size={28} />
              )}
            </span>
            {current && (
              <span className="tv-node-play" aria-hidden="true">
                <Play size={11} fill="currentColor" />
              </span>
            )}
            <span className="tv-stop-caption">
              <strong>{journeyText(moment.title)}</strong>
              <small>
                {moment.kind === "guided"
                  ? "Áudio e quadro"
                  : moment.isExam
                    ? "Desafio final"
                    : moment.total + " atividades"}
              </small>
              {current && <em>Você está aqui</em>}
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
          <li
            key={moment.id}
            id={"moment-" + moment.id}
            className={
              "tv-path-node tv-moment tv-tone-" +
              moment.tone +
              (current ? " is-current" : "") +
              (locked ? " is-locked" : "") +
              (moment.status === "completed" ? " is-completed" : "")
            }
            style={{ "--tv-node-x": [30, 66, 48, 25, 59, 73][index % 6] + "%" } as CSSProperties}
            aria-current={current ? "step" : undefined}
          >
            {locked ? (
              <button
                type="button"
                className="tv-path-stop"
                aria-label={journeyText(moment.title) + ": " + moment.label + ". Entender o acesso"}
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
                aria-label={moment.title + ": " + moment.label}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
export function LivingTrailView({ unitSlug }: { unitSlug?: string }) {
  const { course } = useStudy();
  const { trail, continuation, ready } = useLivingTrail();
  const requestedUnit =
    unitSlug && course.units.find((u) => u.slug === unitSlug || String(u.number) === unitSlug);
  const selected =
    trail.chapters.find(
      (c) => c.unitId === (requestedUnit ? requestedUnit.id : continuation?.chapter.unitId),
    ) ??
    trail.chapters.find((c) => c.id === trail.currentChapterId) ??
    trail.chapters[0];
  const chapters = trail.chapters;
  useEffect(() => {
    if (!ready || !window.location.hash.startsWith("#moment-")) return;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        let id: string;
        try {
          id = decodeURIComponent(window.location.hash.slice(1));
        } catch {
          return;
        }
        const target = document.getElementById(id);
        if (!target || !target.closest(".tv-page")) return;
        target.querySelector<HTMLElement>(".tv-path-stop")?.focus({ preventScroll: true });
        target.scrollIntoView({ block: "center", behavior: "instant" });
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready]);

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
  const next = continuation?.moment;
  const nextHref = continuation?.href;
  const milestone = selected.moments.find((m) => m.isExam) ?? selected.moments.at(-1);
  return (
    <div className="tv-page" data-trail-version={trail.presentationVersion ?? "default"}>
      <header className="tv-page-heading">
        <div>
          <span className="tv-kicker">
            <Route size={15} /> {course.title}
          </span>
          <h1>Seu caminho ganha vida.</h1>
          <p>Conversas, descobertas e pequenos desafios. Um momento de cada vez.</p>
        </div>
        <Link className="tv-quiet-link" href="/dashboard">
          <ArrowLeft size={15} /> Visão geral
        </Link>
      </header>
      <div className="tv-layout">
        <section className="tv-path-area" aria-label="Percurso de aprendizagem">
          {continuation && (
            <Link className="tv-mobile-continue" href={continuation.href}>
              <span>
                <small>Seu próximo momento</small>
                {journeyText(continuation.moment.title)}
              </span>
              <ArrowRight size={19} />
            </Link>
          )}
          <nav className="tv-path-toolbar" aria-label="Navegar na trilha">
            <span>
              <Route size={16} /> Seu caminho, um momento de cada vez
            </span>
            {continuation && (
              <Link
                href={trailReturnHref(
                  course.slug,
                  continuation.chapter.number,
                  continuation.moment.id,
                )}
              >
                <LocateFixed size={16} /> Onde parei
              </Link>
            )}
          </nav>
          {chapters.map((chapter) => (
            <section
              key={chapter.id}
              className="tv-chapter"
              id={"chapter-" + chapter.id}
              aria-labelledby={"heading-" + chapter.id}
            >
              <header className={"tv-chapter-hero tv-tone-" + chapter.tone}>
                <div>
                  <span className="tv-kicker">SUA HISTÓRIA CONTINUA</span>
                  <h2 id={"heading-" + chapter.id}>{journeyText(chapter.title)}</h2>
                  <p>
                    {journeyText(
                      chapter.description ||
                        course.units.find((u) => u.id === chapter.unitId)?.description ||
                        "",
                    )}
                  </p>
                  {chapter.setting && (
                    <span className="tv-setting">
                      <MapPin size={14} />
                      {chapter.setting}
                    </span>
                  )}
                  <div className="tv-chapter-progress">
                    <div className="tv-progress">
                      <span style={{ width: chapter.progress.participationPercentage + "%" }} />
                    </div>
                    <small>
                      {chapter.progress.participationPercentage.toLocaleString("pt-BR")}% do
                      conteúdo estudado
                    </small>
                  </div>
                </div>
                {chapter.illustration ? (
                  <Image
                    src={chapter.illustration.src}
                    alt={chapter.illustration.alt}
                    width={300}
                    height={220}
                  />
                ) : (
                  <TrailArtwork compact />
                )}
              </header>
              {!chapter.access.allowed && (
                <div className="tv-chapter-lock" role="status">
                  <LockKeyhole size={21} />
                  <div>
                    <strong>Esta parte do caminho abre após o desafio anterior</strong>
                    <p>{chapter.access.message}</p>
                  </div>
                </div>
              )}
              {chapter.moments
                .reduce<
                  Array<{
                    key: string;
                    title: string;
                    description: string;
                    moments: LivingTrailMoment[];
                  }>
                >((groups, moment) => {
                  const previous = groups.at(-1),
                    lesson = course.units
                      .flatMap((u) => u.lessons)
                      .find((l) => l.id === moment.lessonId),
                    key = moment.lessonId ?? moment.id;
                  if (previous?.key === key) previous.moments.push(moment);
                  else
                    groups.push({
                      key,
                      title: lesson?.title ?? moment.title,
                      description: lesson?.description ?? moment.description,
                      moments: [moment],
                    });
                  return groups;
                }, [])
                .map((group) => (
                  <section
                    className="tv-part-group"
                    key={group.key}
                    aria-label={journeyText(group.title)}
                  >
                    <header className="tv-part-header">
                      <span className="tv-part-icon" aria-hidden="true">
                        <TrailIcon name={group.moments[0].icon} size={24} />
                      </span>
                      <div>
                        <h3>{journeyText(group.title)}</h3>
                        <p>{journeyText(group.description)}</p>
                      </div>
                      <small>
                        {group.moments.length} {group.moments.length === 1 ? "momento" : "momentos"}
                        <br />
                        {group.moments.reduce((total, moment) => total + moment.total, 0)}{" "}
                        atividades
                      </small>
                    </header>
                    <WindingPath
                      moments={group.moments}
                      nextId={next?.id}
                      nextHref={nextHref}
                      onBlocked={setBlocked}
                    />
                  </section>
                ))}
              <footer className="tv-chapter-finish">
                <FlagMark />
                <div>
                  <strong>Uma conversa abre caminho para a próxima.</strong>
                  <p>Você pode voltar e explorar o que já estudou.</p>
                </div>
              </footer>
            </section>
          ))}
        </section>
        <aside className="tv-context-rail">
          <section className="tv-next-card">
            <span className="tv-kicker">SEU PRÓXIMO MOMENTO</span>
            <div className="tv-next-icon">
              <TrailIcon name={next?.icon ?? "compass"} size={25} />
            </div>
            <h2>{journeyText(next?.title ?? "Seu percurso continua aberto")}</h2>
            <p>
              {next?.objective ??
                next?.description ??
                "Revisite as conversas e os desafios que já estudou."}
            </p>
            {continuation ? (
              <Link href={continuation.href} className="primary-button">
                Continuar aprendendo <ArrowRight size={16} />
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
              <p>
                {milestone.result?.passed
                  ? "Você já conquistou este marco. O resultado e as tentativas continuam guardados."
                  : milestone.isExam
                    ? "A prova reúne o que você praticou nesta parte do caminho."
                    : (milestone.objective ?? milestone.description)}
              </p>
              <span>{milestone.label}</span>
            </section>
          )}
          <p className="tv-context-note">
            Você pode explorar o caminho e revisitar o que já estudou. Os requisitos aparecem no
            próprio momento.
          </p>
        </aside>
      </div>
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
function FlagMark() {
  return (
    <span className="tv-finish-icon">
      <Check size={22} aria-hidden="true" />
    </span>
  );
}
