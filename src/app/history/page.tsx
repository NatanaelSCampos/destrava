"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Clock3, History, RotateCcw, X } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { formatDate, formatMinutes } from "@/lib/utils";
import { buildPracticeHistory } from "@/domain/study/practice-history";

export default function HistoryPage() {
  const { state, course, vocabularyItems } = useStudy();
  const [showAllSeries, setShowAllSeries] = useState(false);
  const practiceHistory = useMemo(
    () => buildPracticeHistory(course, state, vocabularyItems),
    [course, state, vocabularyItems],
  );
  const visibleSeries = showAllSeries ? practiceHistory : practiceHistory.slice(0, 6);
  const sessions = state.sessions
    .filter((item) => item.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const totalMinutes = sessions.reduce((sum, item) => sum + item.durationSeconds / 60, 0);
  const totalActivities = sessions.reduce((sum, item) => sum + item.activityIds.length, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      key: date.toLocaleDateString("en-CA"),
      label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""),
    };
  });
  const daily = days.map((day) => ({
    ...day,
    minutes: Math.round(
      sessions
        .filter((session) => new Date(session.startedAt).toLocaleDateString("en-CA") === day.key)
        .reduce((sum, session) => sum + session.durationSeconds / 60, 0),
    ),
  }));
  const max = Math.max(20, ...daily.map((item) => item.minutes));
  return (
    <div className="history-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <History size={13} /> SEU CAMINHO ATÉ AQUI
          </span>
          <h1 className="page-title">Histórico de estudo</h1>
          <p className="page-subtitle">
            Veja o tempo investido e as pequenas vitórias que constroem sua fluência.
          </p>
        </div>
        <Link href="/study" className="secondary-button">
          Nova sessão <ArrowRight size={16} />
        </Link>
      </div>
      <div className="history-summary">
        <div className="panel">
          <Clock3 size={18} />
          <strong>{formatMinutes(totalMinutes)}</strong>
          <span>tempo total</span>
        </div>
        <div className="panel">
          <CalendarDays size={18} />
          <strong>{sessions.length}</strong>
          <span>sessões concluídas</span>
        </div>
        <div className="panel">
          <Check size={18} />
          <strong>{totalActivities}</strong>
          <span>atividades praticadas</span>
        </div>
      </div>
      <div className="history-grid">
        <section>
          <div className="section-head">
            <div>
              <span className="eyebrow">LINHA DO TEMPO</span>
              <h2 className="section-title">Sessões recentes</h2>
            </div>
          </div>
          {sessions.length ? (
            <div className="session-list">
              {sessions.map((session) => (
                <article className="session-card panel" key={session.id}>
                  <span className="session-date">
                    <strong>{new Date(session.startedAt).getDate()}</strong>
                    <small>
                      {new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
                        new Date(session.startedAt),
                      )}
                    </small>
                  </span>
                  <div className="session-main">
                    <h3>
                      {course.units.find((unit) => unit.id === session.unitId)?.title ??
                        "Estudo de espanhol"}
                    </h3>
                    <p>
                      <Clock3 size={14} /> {formatMinutes(session.durationSeconds / 60)}{" "}
                      <span>·</span> {session.activityIds.length} atividades
                    </p>
                    <div>
                      <span>
                        <Check size={14} /> {session.correct} acertos
                      </span>
                      <span>
                        <X size={14} /> {session.wrong} erros
                      </span>
                      <span>
                        <RotateCcw size={14} /> {session.wordsReviewed} palavras revistas
                      </span>
                    </div>
                  </div>
                  <span className="session-full-date">{formatDate(session.startedAt)}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state panel">
              <History size={29} />
              <strong>Sua história começa na primeira aula.</strong>
              <span>Ao concluir uma sessão, ela aparecerá aqui.</span>
              <Link href="/study" className="primary-button">
                Começar aula <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
        <aside className="panel weekly-panel">
          <span className="eyebrow">ÚLTIMOS 7 DIAS</span>
          <h3>Tempo de estudo</h3>
          <div
            className="weekly-chart"
            role="img"
            aria-label={`Tempo estudado nos últimos sete dias: ${daily.map((item) => `${item.label} ${item.minutes} minutos`).join(", ")}`}
          >
            {daily.map((item) => (
              <div key={item.key} className="weekly-column">
                <span>{item.minutes ? `${item.minutes}m` : ""}</span>
                <div>
                  <i
                    style={{
                      height: `${Math.max(item.minutes ? 8 : 3, (100 * item.minutes) / max)}%`,
                    }}
                  />
                </div>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
          <p>
            {sessions.length
              ? "A consistência vale mais do que uma sessão perfeita."
              : "Seu gráfico vai crescer com cada sessão concluída."}
          </p>
        </aside>
      </div>
      <section className="practice-history-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">EVOLUÇÃO REAL</span>
            <h2 className="section-title">Seu resultado em cada tentativa</h2>
            <p className="section-subtitle">
              Compare acertos, escrita, pronúncia, fluência e recordação ao longo do tempo.
            </p>
          </div>
        </div>
        {practiceHistory.length ? (
          <>
            <div className="practice-history-grid">
              {visibleSeries.map((series) => {
                const latest = series.points.at(-1)!;
                const previous = series.points.at(-2);
                return (
                  <article className="panel practice-history-card" key={series.id}>
                    <div className="practice-history-card-head">
                      <div>
                        <span className="eyebrow">{series.measure}</span>
                        <h3>{series.title}</h3>
                      </div>
                      <strong>{latest.score}/100</strong>
                    </div>
                    <p>
                      {previous
                        ? latest.score > previous.score
                          ? `Melhorou ${latest.score - previous.score} pontos desde a tentativa anterior.`
                          : latest.score < previous.score
                            ? "O resultado caiu na última tentativa; vale praticar novamente."
                            : "Mesmo resultado da tentativa anterior."
                        : "Primeira medida registrada para este item."}
                    </p>
                    <ol className="practice-attempt-list">
                      {[...series.points.slice(-5)].reverse().map((point) => (
                        <li key={point.id}>
                          <time dateTime={point.at}>{formatDate(point.at)}</time>
                          <span className="progress-track">
                            <i style={{ width: `${point.score}%` }} />
                          </span>
                          <b>{point.score}</b>
                        </li>
                      ))}
                    </ol>
                    {series.points.length > 5 && (
                      <details className="practice-older-attempts">
                        <summary>Ver {series.points.length - 5} tentativas anteriores</summary>
                        <ol className="practice-attempt-list">
                          {[...series.points.slice(0, -5)].reverse().map((point) => (
                            <li key={point.id}>
                              <time dateTime={point.at}>{formatDate(point.at)}</time>
                              <span className="progress-track">
                                <i style={{ width: `${point.score}%` }} />
                              </span>
                              <b>{point.score}</b>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                    <Link href={series.href} className="text-link">
                      Praticar novamente <ArrowRight size={15} />
                    </Link>
                  </article>
                );
              })}
            </div>
            {practiceHistory.length > 6 && (
              <button
                className="secondary-button practice-history-more"
                onClick={() => setShowAllSeries((current) => !current)}
              >
                {showAllSeries ? "Mostrar menos" : `Ver todos os ${practiceHistory.length} itens`}
              </button>
            )}
          </>
        ) : (
          <div className="empty-state panel">
            <History size={26} />
            <strong>Suas tentativas aparecerão aqui.</strong>
            <span>Responda atividades ou revise cartões para acompanhar sua evolução.</span>
            <Link href="/study" className="secondary-button">
              Começar aula
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
