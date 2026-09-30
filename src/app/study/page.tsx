"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { buildStudyPlan } from "@/domain/study/study-planner";
import { currentUnit } from "@/domain/study/progress";
import { ActivityRenderer } from "@/components/activities/activity-renderer";
import { ReviewQueue } from "@/components/review/review-queue";
import { formatMinutes } from "@/lib/utils";

export default function StudyPage() {
  const { course, state, ready, startSession, finishSession } = useStudy();
  const unit = currentUnit(course, state)!;
  const planned = buildStudyPlan(course, state, state.profile.dailyMinutes);
  const activeSession = state.sessions.find((session) => session.id === state.activeSessionId);
  const plan = activeSession?.plan ?? planned;
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!activeSession) return;
    const update = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000)),
      );
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [activeSession]);
  if (!ready) return <div className="page-loading">Montando sua aula…</div>;
  const item = plan[index];
  const activity =
    item?.kind === "activity"
      ? course.units
          .flatMap((entry) => entry.lessons.flatMap((lesson) => lesson.activities))
          .find((entry) => entry.id === item.id)
      : undefined;
  const lastSession = state.sessions.find((session) => session.finishedAt);

  if (!activeSession)
    return (
      <div className="study-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              <Sparkles size={13} /> SEU PLANO DE ESTUDO
            </span>
            <h1 className="page-title">Aula de hoje</h1>
            <p className="page-subtitle">
              Uma sessão feita a partir do seu progresso, das revisões pendentes e da sua meta
              diária.
            </p>
          </div>
          <span className="pill">
            <Clock3 size={13} /> Meta: {state.profile.dailyMinutes} min
          </span>
        </div>
        <div className="study-start-grid">
          <section className="study-start-card">
            <span className="eyebrow">PRONTO PARA COMEÇAR?</span>
            <h2>
              Um roteiro claro para
              <br />
              seguir em frente.
            </h2>
            <p>
              Você verá cada atividade na sequência. Seu desempenho e tempo serão registrados ao
              encerrar a sessão.
            </p>
            <button
              className="study-start-button"
              disabled={!plan.length}
              onClick={() => {
                setIndex(0);
                startSession(unit.id, plan);
              }}
            >
              <Play size={17} fill="currentColor" /> Começar aula <ArrowRight size={17} />
            </button>
          </section>
          <div className="panel study-plan-card">
            <div className="section-head">
              <div>
                <span className="eyebrow">SEQUÊNCIA DE HOJE</span>
                <h2 className="section-title">O que você vai fazer</h2>
              </div>
              <strong>{formatMinutes(plan.reduce((sum, entry) => sum + entry.minutes, 0))}</strong>
            </div>
            <div className="study-plan-list">
              {plan.map((entry, itemIndex) => (
                <div key={`${entry.kind}-${entry.id}`}>
                  <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                  <span>
                    {entry.title}
                    <small>
                      {entry.kind === "review" ? "Revisão espaçada" : "Atividade guiada"}
                    </small>
                  </span>
                  <b>{entry.minutes} min</b>
                </div>
              ))}
            </div>
            {!plan.length && (
              <div className="empty-state">
                <Check size={24} />
                <strong>Trilha disponível concluída</strong>
                <span>Você pode continuar revisando seu vocabulário.</span>
                <Link href="/review" className="secondary-button">
                  Ir para revisão
                </Link>
              </div>
            )}
          </div>
        </div>
        {lastSession && (
          <div className="study-last">
            <Check size={16} /> Sua última sessão: {formatMinutes(lastSession.durationSeconds / 60)}
            , {lastSession.correct} acertos e {lastSession.wrong} erros.
          </div>
        )}
      </div>
    );

  return (
    <div className="study-page">
      <div className="study-running-head">
        <div>
          <span className="eyebrow">AULA EM ANDAMENTO</span>
          <h1>{item?.title ?? "Sessão concluída"}</h1>
          <p>
            Unidade {unit.number} · {unit.title}
          </p>
        </div>
        <div className="study-timer">
          <Clock3 size={16} /> {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")}
        </div>
      </div>
      <div className="study-running-grid">
        <div>
          <div className="study-step-line">
            <span>
              ETAPA {Math.min(index + 1, plan.length)} DE {plan.length}
            </span>
            <strong>{Math.round((100 * index) / Math.max(1, plan.length))}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${Math.round((100 * index) / Math.max(1, plan.length))}%` }} />
          </div>
          {item?.kind === "review" ? (
            <ReviewQueue
              key={item.id}
              onComplete={() => setIndex((current) => Math.min(current + 1, plan.length))}
            />
          ) : activity ? (
            <ActivityRenderer key={activity.id} activity={activity} />
          ) : (
            <div className="review-finished panel">
              <span className="review-finished-icon">
                <Check size={26} />
              </span>
              <h2>Você chegou ao final da aula.</h2>
              <p>Feche a sessão para registrar seu tempo e desempenho.</p>
            </div>
          )}
          <div className="lesson-controls">
            <button
              className="ghost-button"
              disabled={index === 0}
              onClick={() => setIndex((current) => current - 1)}
            >
              <ChevronLeft size={17} /> Voltar
            </button>
            {index < plan.length - 1 ? (
              <button className="primary-button" onClick={() => setIndex((current) => current + 1)}>
                Próxima etapa <ChevronRight size={17} />
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={() => {
                  finishSession();
                  setIndex(0);
                }}
              >
                Encerrar aula <Check size={17} />
              </button>
            )}
          </div>
        </div>
        <aside className="study-agenda panel">
          <span className="eyebrow">ROTEIRO DA AULA</span>
          {plan.map((entry, itemIndex) => (
            <button
              key={`${entry.kind}-${entry.id}`}
              onClick={() => setIndex(itemIndex)}
              className={`study-agenda-item ${itemIndex === index ? "active" : ""}`}
            >
              <span className="study-agenda-step">
                {itemIndex < index ? <Check size={14} /> : String(itemIndex + 1).padStart(2, "0")}
              </span>
              <span>
                {entry.title}
                <small>{entry.minutes} min</small>
              </span>
            </button>
          ))}
          <div className="study-agenda-foot">
            <RotateCcw size={15} /> Você pode rever qualquer etapa.
          </div>
        </aside>
      </div>
    </div>
  );
}
