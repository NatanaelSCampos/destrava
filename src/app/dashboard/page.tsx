"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { buildStudyPlan } from "@/domain/study/study-planner";
import { courseProgress, currentUnit, unitProgress } from "@/domain/study/progress";
import { dueReviewCounts } from "@/domain/review/due-review-counts";
import { buildLearningProfile } from "@/domain/study/learning-profile";
import { LearningRecommendationEngine } from "@/domain/study/learning-recommendation-engine";
import { formatMinutes } from "@/lib/utils";
import { featureFlags } from "@/lib/feature-flags";
import { recommendationLink } from "@/lib/recommendation-link";

function currentStreak(dates: string[]) {
  const days = new Set(dates.map((value) => new Date(value).toLocaleDateString("en-CA")));
  const cursor = new Date();
  if (!days.has(cursor.toLocaleDateString("en-CA"))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(cursor.toLocaleDateString("en-CA"))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export default function DashboardPage() {
  const { course, state, ready, updateProfile, vocabularyItems } = useStudy();
  const unit = currentUnit(course, state)!;
  const progress = unitProgress(unit, state, vocabularyItems);
  const totalProgress = courseProgress(course, state);
  const learningProfile = buildLearningProfile(course, state, vocabularyItems);
  const focus = LearningRecommendationEngine.recommend(
    course,
    state,
    learningProfile,
    vocabularyItems,
    { includeReviews: featureFlags.SPACED_REPETITION },
  )[0];
  const plan = buildStudyPlan(course, state, state.profile.dailyMinutes, vocabularyItems);
  const minutes = Math.round(
    state.sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60,
  );
  const { words: dueWords, mistakes: dueErrors } = dueReviewCounts(state, vocabularyItems);
  const streak = currentStreak(
    state.sessions.filter((session) => session.finishedAt).map((session) => session.finishedAt!),
  );
  const last = state.attempts[0];
  if (!ready) return <div className="page-loading">Preparando seu espaço de estudo…</div>;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-dot" /> SEU ESPAÇO DE ESTUDO
          </span>
          <h1 className="page-title">¡Hola! Vamos continuar?</h1>
          <p className="page-subtitle">
            Um passo de cada vez. Veja o que faz sentido estudar hoje.
          </p>
        </div>
        <div className="date-chip">
          <CalendarDays size={16} />{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(new Date())}
        </div>
      </div>
      {!state.profile.onboarded && (
        <section className="onboarding-panel">
          <div>
            <span className="eyebrow">ANTES DE COMEÇAR</span>
            <h2>Monte seu ritmo de estudo</h2>
            <p>Uma meta pequena e constante ajuda a transformar prática em hábito.</p>
          </div>
          <div className="onboarding-fields">
            <label>
              Meu objetivo
              <input
                defaultValue={state.profile.goal}
                onBlur={(event) => updateProfile({ goal: event.target.value })}
              />
            </label>
            <label>
              Minutos por dia
              <select
                value={state.profile.dailyMinutes}
                onChange={(event) => updateProfile({ dailyMinutes: Number(event.target.value) })}
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
            </label>
            <label>
              Dias por semana
              <select
                value={state.profile.daysPerWeek}
                onChange={(event) => updateProfile({ daysPerWeek: Number(event.target.value) })}
              >
                {[2, 3, 4, 5, 6, 7].map((day) => (
                  <option key={day} value={day}>
                    {day} dias
                  </option>
                ))}
              </select>
            </label>
            <label>
              Conhecimento atual
              <select
                value={state.profile.priorKnowledge}
                onChange={(event) =>
                  updateProfile({
                    priorKnowledge: event.target.value as typeof state.profile.priorKnowledge,
                  })
                }
              >
                <option value="none">Estou começando</option>
                <option value="some">Conheço algumas palavras</option>
                <option value="returning">Estou retomando os estudos</option>
              </select>
            </label>
            <button className="primary-button" onClick={() => updateProfile({ onboarded: true })}>
              Salvar meta <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <section className="course-hero">
            <div className="hero-content">
              <span className="hero-kicker">
                <span /> SEU CURSO ATUAL
              </span>
              <h2>
                Aprenda espanhol
                <br />
                <em>com direção.</em>
              </h2>
              <p>
                Unidade {unit.number} · {unit.title}
              </p>
              <div className="hero-actions">
                <Link href="/study" className="hero-button">
                  <Play size={16} fill="currentColor" /> Começar aula de hoje{" "}
                  <ArrowRight size={16} />
                </Link>
                <Link href={`/course/${course.slug}/unit/${unit.number}`} className="hero-link">
                  Ver trilha do curso
                </Link>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span className="hero-ring ring-one" />
              <span className="hero-ring ring-two" />
              <div className="hero-word">¡Hola!</div>
              <div className="hero-star star-one">✦</div>
              <div className="hero-star star-two">✳</div>
              <div className="hero-note">vamos conversar</div>
            </div>
          </section>
          <section className="quick-session-panel panel">
            <div>
              <span className="eyebrow">
                <Clock3 size={13} /> SESSÃO SOB MEDIDA
              </span>
              <h2>Quanto tempo você tem?</h2>
              <p>
                Escolha o tempo; o Destrava monta o roteiro com o que faz sentido praticar agora.
              </p>
            </div>
            <div className="quick-session-actions">
              {[5, 15, 30].map((minutes) => (
                <Link
                  key={minutes}
                  href={`/study?duration=${minutes}&mode=guided`}
                  className="quick-session-time"
                >
                  {minutes} min <ArrowRight size={14} />
                </Link>
              ))}
              <Link href="/study?duration=full&mode=guided" className="quick-session-time">
                Completa <ArrowRight size={14} />
              </Link>
              <Link href="/study?duration=15&mode=difficulties" className="quick-session-focus">
                <Target size={15} /> Treinar minhas dificuldades
              </Link>
            </div>
          </section>
          <div className="stats-grid">
            <div className="stat-card panel">
              <span className="stat-icon green">
                <BookOpen size={18} />
              </span>
              <span>Progresso geral</span>
              <strong>{totalProgress}%</strong>
              <small>
                {progress.completed} de {progress.total} atividades concluídas
              </small>
            </div>
            <div className="stat-card panel">
              <span className="stat-icon peach">
                <Clock3 size={18} />
              </span>
              <span>Tempo estudado</span>
              <strong>{formatMinutes(minutes)}</strong>
              <small>
                {state.sessions.filter((session) => session.finishedAt).length} sessões finalizadas
              </small>
            </div>
            <div className="stat-card panel">
              <span className="stat-icon amber">
                <Flame size={18} />
              </span>
              <span>Sequência atual</span>
              <strong>
                {streak} {streak === 1 ? "dia" : "dias"}
              </strong>
              <small>Estude hoje para manter o ritmo</small>
            </div>
          </div>
          <section className="today-section">
            <div className="section-head">
              <div>
                <span className="eyebrow">PLANO PERSONALIZADO</span>
                <h2 className="section-title">Sua aula de hoje</h2>
                <p className="section-subtitle">
                  Uma seleção baseada na sua meta e no que falta praticar.
                </p>
              </div>
              <Link href="/study" className="text-link">
                Abrir aula <ArrowRight size={15} />
              </Link>
            </div>
            <div className="today-list panel">
              {plan.length ? (
                plan.slice(0, 5).map((item, index) => (
                  <div className="today-item" key={`${item.kind}-${item.id}`}>
                    <span className="today-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className={`today-icon ${item.kind === "review" ? "review" : ""}`}>
                      {item.kind === "review" ? <RotateCcw size={17} /> : <BookOpen size={17} />}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {item.kind === "review" ? "Revisão inteligente" : "Atividade da unidade"}
                      </small>
                    </div>
                    <span className="today-time">{item.minutes} min</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <CheckCircle2 size={26} />
                  <strong>Você concluiu a trilha disponível.</strong>
                  <span>Revise palavras e erros para consolidar o conteúdo.</span>
                </div>
              )}
            </div>
          </section>
        </div>
        <aside className="dashboard-rail">
          <div className="rail-progress panel">
            <div className="rail-progress-top">
              <span className="eyebrow">UNIDADE ATUAL</span>
              <span className="unit-number">{String(unit.number).padStart(2, "0")}</span>
            </div>
            <h3>{unit.title}</h3>
            <p>{unit.description}</p>
            <div className="rail-progress-label">
              <span>Progresso da unidade</span>
              <strong>{progress.percentage}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress.percentage}%` }} />
            </div>
            <span className="rail-progress-foot">
              {progress.completed} de {progress.total} atividades
            </span>
            <Link href={`/course/${course.slug}/unit/${unit.number}`} className="text-link">
              Explorar unidade <ArrowRight size={15} />
            </Link>
          </div>
          <div className="rail-focus panel">
            <span className="eyebrow">
              <Target size={13} /> SEU FOCO AGORA
            </span>
            <h3>{focus?.title ?? "Continue praticando"}</h3>
            <p>{focus?.reason ?? "Sua trilha disponível está em dia."}</p>
            <Link
              href={focus ? recommendationLink(course.slug, focus) : "/progress"}
              className="secondary-button"
            >
              {focus?.kind === "review" ? "Revisar agora" : "Praticar agora"}{" "}
              <ArrowRight size={15} />
            </Link>
          </div>
          <div className="rail-review">
            <div>
              <span className="rail-review-icon">
                <RotateCcw size={19} />
              </span>
              <strong>Para revisar</strong>
            </div>
            <p>
              <b>{dueWords}</b> palavras · <b>{dueErrors}</b> erros pendentes
            </p>
            <Link href="/review">
              Revisar agora <ArrowRight size={14} />
            </Link>
          </div>
          <div className="rail-tip">
            <Lightbulb size={18} />
            <div>
              <strong>Uma dica para hoje</strong>
              <p>Fale em voz alta as frases novas. Seu ouvido também aprende com a repetição.</p>
            </div>
          </div>
          {last && (
            <div className="last-activity">
              <Sparkles size={15} /> Última atividade:{" "}
              {unit.lessons
                .flatMap((item) => item.activities)
                .find((item) => item.id === last.activityId)?.title ?? "Prática"}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
