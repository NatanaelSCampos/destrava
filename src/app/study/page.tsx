"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { buildPracticeHistory, sessionComparisons } from "@/domain/study/practice-history";
import type { SessionMode } from "@/domain/study/study-state";

type Duration = 5 | 15 | 30 | "full";
const durationOptions: Array<{ value: Duration; label: string }> = [
  { value: 5, label: "5 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: "full", label: "Completa" },
];

function studyHref(duration: Duration, mode: SessionMode) {
  return `/study?duration=${duration}&mode=${mode}`;
}

function StudyContent() {
  const searchParams = useSearchParams();
  const { course, state, vocabularyItems, ready, startSession, finishSession } = useStudy();
  const mode: SessionMode = searchParams.get("mode") === "difficulties" ? "difficulties" : "guided";
  const durationValue = searchParams.get("duration");
  const duration: Duration =
    durationValue === "5" || durationValue === "15" || durationValue === "30"
      ? (Number(durationValue) as 5 | 15 | 30)
      : "full";
  const targetMinutes = duration === "full" ? state.profile.dailyMinutes : duration;
  const unit = currentUnit(course, state)!;
  const planned = useMemo(
    () => buildStudyPlan(course, state, targetMinutes, vocabularyItems, new Date(), mode),
    [course, state, targetMinutes, vocabularyItems, mode],
  );
  const activeSession = state.sessions.find((session) => session.id === state.activeSessionId);
  const sessionUnit = course.units.find((entry) => entry.id === activeSession?.unitId) ?? unit;
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
  const item = plan[index];
  const activity =
    item?.kind === "activity"
      ? course.units
          .flatMap((entry) => entry.lessons.flatMap((lesson) => lesson.activities))
          .find((entry) => entry.id === item.id)
      : undefined;
  const lastSession = state.sessions.find((session) => session.finishedAt);
  const practiceHistory = useMemo(
    () => buildPracticeHistory(course, state, vocabularyItems),
    [course, state, vocabularyItems],
  );
  const comparisons = lastSession ? sessionComparisons(lastSession, practiceHistory) : [];
  const improved = comparisons.filter((item) => item.before !== null && item.after > item.before);
  if (!ready) return <div className="page-loading">Montando sua aula…</div>;

  if (!activeSession)
    return (
      <div className="study-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              <Sparkles size={13} /> SEU PLANO DE ESTUDO
            </span>
            <h1 className="page-title">
              {mode === "difficulties" ? "Treinar minhas dificuldades" : "Aula de hoje"}
            </h1>
            <p className="page-subtitle">
              {mode === "difficulties"
                ? "Pratique os erros, palavras difíceis e pontos de fala que seu histórico mostrou."
                : "Uma sessão feita a partir do seu progresso, das revisões pendentes e da sua meta diária."}
            </p>
          </div>
          <span className="pill">
            <Clock3 size={13} /> Até {targetMinutes} min estimados
          </span>
        </div>
        <div className="study-session-options panel">
          <div>
            <strong>Quanto tempo você tem?</strong>
            <div className="study-option-list">
              {durationOptions.map((option) => (
                <Link
                  key={option.value}
                  href={studyHref(option.value, mode)}
                  aria-current={duration === option.value ? "page" : undefined}
                  className={duration === option.value ? "active" : ""}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <strong>Como prefere estudar?</strong>
            <div className="study-option-list">
              <Link
                href={studyHref(duration, "guided")}
                className={mode === "guided" ? "active" : ""}
                aria-current={mode === "guided" ? "page" : undefined}
              >
                Continuar a trilha
              </Link>
              <Link
                href={studyHref(duration, "difficulties")}
                className={mode === "difficulties" ? "active" : ""}
                aria-current={mode === "difficulties" ? "page" : undefined}
              >
                Treinar dificuldades
              </Link>
            </div>
          </div>
        </div>
        <div className="study-start-grid">
          <section className="study-start-card">
            <span className="eyebrow">PRONTO PARA COMEÇAR?</span>
            <h2>
              {mode === "difficulties" ? "Seu treino, seu ritmo" : "Um roteiro claro para"}
              <br />
              {mode === "difficulties" ? "e seus pontos de atenção." : "seguir em frente."}
            </h2>
            <p>
              {mode === "difficulties"
                ? "A sessão usa apenas dificuldades já registradas. No fim, você verá os resultados avaliados."
                : "Você verá cada atividade na sequência. Seu desempenho e tempo serão registrados ao encerrar a sessão."}
            </p>
            <button
              className="study-start-button"
              disabled={!plan.length}
              onClick={() => {
                setIndex(0);
                const firstActivity = plan.find((entry) => entry.kind === "activity");
                const planUnit = course.units.find((entry) =>
                  entry.lessons.some((lesson) =>
                    lesson.activities.some((activity) => activity.id === firstActivity?.id),
                  ),
                );
                startSession(planUnit?.id ?? unit.id, plan, mode, targetMinutes);
              }}
            >
              <Play size={17} fill="currentColor" /> Começar sessão <ArrowRight size={17} />
            </button>
          </section>
          <div className="panel study-plan-card">
            <div className="section-head">
              <div>
                <span className="eyebrow">SEQUÊNCIA PERSONALIZADA</span>
                <h2 className="section-title">O que você vai fazer</h2>
              </div>
              <strong>
                ≈ {formatMinutes(plan.reduce((sum, entry) => sum + entry.minutes, 0))}
              </strong>
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
                <strong>
                  {mode === "difficulties"
                    ? "Ainda não há dificuldades para treinar"
                    : "Nenhuma atividade cabe neste tempo"}
                </strong>
                <span>
                  {mode === "difficulties"
                    ? "Faça uma aula ou marque palavras difíceis; suas próximas sessões focadas aparecerão aqui."
                    : "Escolha uma sessão mais longa ou continue pela trilha do curso."}
                </span>
                <Link href={studyHref(duration, "guided")} className="secondary-button">
                  Continuar a trilha
                </Link>
              </div>
            )}
          </div>
        </div>
        {lastSession && (
          <section className="panel study-session-result">
            <span className="eyebrow">SUA ÚLTIMA SESSÃO</span>
            <h2>O que mudou depois da prática?</h2>
            <p>
              {formatMinutes(lastSession.durationSeconds / 60)} estudados · {lastSession.correct}{" "}
              acertos · {lastSession.wrong} erros
            </p>
            {comparisons.length ? (
              <>
                <strong>
                  {improved.length
                    ? `${improved.length} ${improved.length === 1 ? "item melhorou" : "itens melhoraram"} nesta sessão.`
                    : "Resultados registrados para acompanhar sua evolução."}
                </strong>
                <div className="session-comparison-list">
                  {comparisons.slice(0, 5).map((item) => (
                    <div key={item.id}>
                      <span>
                        {item.title} · {item.measure}
                      </span>
                      <b>
                        {item.before === null
                          ? `Primeira marca: ${item.after}`
                          : `${item.before} → ${item.after}`}
                      </b>
                    </div>
                  ))}
                </div>
                <Link href="/history" className="text-link">
                  Ver evolução por tentativa <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <p>
                Esta sessão não teve resultados avaliados. Pratique e responda às atividades para
                comparar as próximas tentativas.
              </p>
            )}
          </section>
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
            {activeSession.mode === "difficulties"
              ? "Treino de dificuldades"
              : `Unidade ${sessionUnit.number} · ${sessionUnit.title}`}{" "}
            · meta de {activeSession.targetMinutes ?? state.profile.dailyMinutes} min
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
              plannedItems={item.reviewItems}
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

export default function StudyPage() {
  return (
    <Suspense fallback={<div className="page-loading">Montando sua aula…</div>}>
      <StudyContent />
    </Suspense>
  );
}
