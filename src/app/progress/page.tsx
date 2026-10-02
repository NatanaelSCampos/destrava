"use client";

import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, Check, Circle, Target } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { courseProgress, currentUnit, skillProgress, unitProgress } from "@/domain/study/progress";
import { buildLearningProfile, type MasteryMetric } from "@/domain/study/learning-profile";
import { LearningRecommendationEngine } from "@/domain/study/learning-recommendation-engine";
import type { Skill } from "@/content/schema";
import { featureFlags } from "@/lib/feature-flags";
import { recommendationLink } from "@/lib/recommendation-link";
import { ReviewScheduler } from "@/domain/review/review-scheduler";

const skillLabels: Array<{ id: Skill; label: string }> = [
  { id: "vocabulary", label: "Vocabulário" },
  { id: "grammar", label: "Gramática" },
  { id: "listening", label: "Listening" },
  { id: "reading", label: "Leitura" },
  { id: "writing", label: "Writing" },
  { id: "speaking", label: "Speaking" },
];

function MasteryColumn({ title, items }: { title: string; items: MasteryMetric[] }) {
  const practiced = items
    .filter((item) => item.score !== null)
    .sort((a, b) => a.score! - b.score!)
    .slice(0, 6);
  return (
    <div className="mastery-column">
      <h3>{title}</h3>
      {practiced.length ? (
        practiced.map((item) => (
          <div className="mastery-metric" key={item.id}>
            <div>
              <span>{item.label}</span>
              <strong>{item.score}</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${item.score}%` }} />
            </div>
          </div>
        ))
      ) : (
        <p>Os resultados aparecerão depois das primeiras práticas avaliadas.</p>
      )}
    </div>
  );
}

export default function ProgressPage() {
  const { course, state, vocabularyItems } = useStudy();
  const unit = currentUnit(course, state)!;
  const progress = unitProgress(unit, state, vocabularyItems);
  const totalProgress = courseProgress(course, state);
  const skillData = skillLabels.map((item) => ({
    ...item,
    ...skillProgress(course, state, item.id),
  }));
  const weakSkills = skillData.filter((item) => item.performance !== null && item.performance < 80);
  const learningProfile = buildLearningProfile(course, state, vocabularyItems);
  const activityIds = new Set(
    course.units.flatMap((entry) =>
      entry.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id)),
    ),
  );
  const firstDueMistake = Object.values(state.mistakes).find(
    (mistake) => activityIds.has(mistake.activityId) && ReviewScheduler.isDue(mistake.schedule),
  );
  const improvements = LearningRecommendationEngine.recommend(
    course,
    state,
    learningProfile,
    vocabularyItems,
    { includeReviews: featureFlags.SPACED_REPETITION },
  )
    .filter((item) => item.source !== "curriculum")
    .slice(0, 3);
  return (
    <div className="progress-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <ChartNoAxesCombined size={13} /> SEU DESENVOLVIMENTO
          </span>
          <h1 className="page-title">Seu progresso em perspectiva.</h1>
          <p className="page-subtitle">
            Acompanhe atividades concluídas, desempenho e domínio por habilidade.
          </p>
        </div>
        <Link href="/review" className="secondary-button">
          Revisar pontos fracos <ArrowRight size={16} />
        </Link>
      </div>
      <div className="progress-top-grid">
        <section className="progress-main-card">
          <span className="eyebrow">{course.title.toUpperCase()}</span>
          <h2>
            Você já percorreu <strong>{totalProgress}%</strong> do curso disponível.
          </h2>
          <p>Continue praticando para transformar conhecimento em confiança.</p>
          <div className="progress-track">
            <span style={{ width: `${totalProgress}%` }} />
          </div>
          <div>
            <span>
              Unidade {unit.number} · {unit.title}
            </span>
            <strong>
              {progress.completed} de {progress.total} atividades
            </strong>
          </div>
        </section>
        <section className="panel mastery-status">
          <span className="eyebrow">
            <Target size={13} /> DOMÍNIO DA UNIDADE
          </span>
          <h3>
            {progress.isMastered
              ? "Dominada"
              : progress.isCompleted
                ? "Concluída, em revisão"
                : "Em construção"}
          </h3>
          <p>Completar a trilha é o primeiro passo; domínio pede prática e revisão.</p>
          <div className="mastery-checks">
            {[
              { label: "Trilha concluída", done: progress.isCompleted },
              { label: "Exercícios ≥ 80%", done: progress.exerciseScore >= 80 },
              { label: "Revisão ≥ 80%", done: progress.reviewScore >= 80 },
              { label: "Writing e speaking", done: progress.writingDone && progress.speakingDone },
              {
                label: "Teste final ≥ 75%",
                done: progress.assessmentFinished && progress.assessmentScore >= 75,
              },
            ].map((item) => (
              <div key={item.label}>
                {item.done ? <Check size={16} /> : <Circle size={15} />}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel improvement-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">RECOMENDAÇÕES DO SEU HISTÓRICO</span>
            <h2 className="section-title">O que preciso melhorar?</h2>
            <p className="section-subtitle">
              Revisões vencidas, erros repetidos e pronúncia avaliada definem suas prioridades.
            </p>
          </div>
        </div>
        {improvements.length ? (
          <div className="improvement-list">
            {improvements.map((item, index) => (
              <div className="improvement-item" key={`${item.kind}-${item.id}`}>
                <span className="improvement-rank">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.reason}</p>
                </div>
                <div className="improvement-actions">
                  <Link href={recommendationLink(course.slug, item)} className="secondary-button">
                    Praticar agora <ArrowRight size={15} />
                  </Link>
                  {item.kind === "activity" && state.mistakes[item.id] && (
                    <>
                      <details className="improvement-explanation">
                        <summary>Ver explicação</summary>
                        <p>
                          {state.mistakes[item.id].explanation ||
                            "Compare sua resposta com a forma esperada no caderno de erros."}
                        </p>
                        <p>
                          <strong>Forma esperada:</strong> {state.mistakes[item.id].correctAnswer}
                        </p>
                      </details>
                      {featureFlags.AI_TUTOR && (
                        <Link
                          href={`/micro-lesson?activity=${encodeURIComponent(item.id)}`}
                          className="text-link"
                        >
                          Fazer microlição <ArrowRight size={15} />
                        </Link>
                      )}
                    </>
                  )}
                  {item.kind === "review" && firstDueMistake && (
                    <>
                      <details className="improvement-explanation">
                        <summary>Ver um erro pendente</summary>
                        <p>{firstDueMistake.explanation}</p>
                        <p>
                          <strong>Forma esperada:</strong> {firstDueMistake.correctAnswer}
                        </p>
                      </details>
                      {featureFlags.AI_TUTOR && (
                        <Link
                          href={`/micro-lesson?activity=${encodeURIComponent(firstDueMistake.activityId)}`}
                          className="text-link"
                        >
                          Fazer microlição <ArrowRight size={15} />
                        </Link>
                      )}
                    </>
                  )}
                  {item.kind === "number" && (
                    <span className="helper-note">O treino inclui escuta, ditado e fala.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="improvement-empty">
            <p>
              {learningProfile.skills.some((item) => item.evidenceCount > 0)
                ? "Nenhuma dificuldade específica foi detectada agora. Continue a trilha para manter o ritmo."
                : "Ainda não há tentativas avaliadas. Comece uma aula para receber recomendações pessoais."}
            </p>
            <Link href="/study" className="secondary-button">
              Abrir aula <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </section>
      <section className="panel learning-profile-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">PERFIL DE APRENDIZADO</span>
            <h2 className="section-title">Domínio estimado</h2>
            <p className="section-subtitle">
              Uma leitura de acertos, revisões e avaliações disponíveis para este curso.
            </p>
          </div>
        </div>
        <div className="mastery-columns">
          <MasteryColumn title="Habilidades" items={learningProfile.skills} />
          <MasteryColumn title="Tópicos" items={learningProfile.topics} />
          <MasteryColumn title="Conceitos" items={learningProfile.concepts} />
          <MasteryColumn title="Palavras e sons" items={learningProfile.items} />
        </div>
        <p className="helper-note">
          Estes números orientam a prática; não são notas de aprovação. Resultados antigos perdem
          peso até uma nova revisão.
        </p>
      </section>
      <div className="progress-bottom-grid">
        <section className="panel skill-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">HABILIDADES</span>
              <h2 className="section-title">Onde você está crescendo</h2>
            </div>
          </div>
          <div className="skill-list">
            {skillData.map((item) => (
              <div className="skill-row" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <span>
                    {item.completed}/{item.total} atividades
                  </span>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${item.total ? Math.round((100 * item.completed) / item.total) : 0}%`,
                    }}
                  />
                </div>
                <b>{item.performance === null ? "Sem nota" : `${item.performance}%`}</b>
              </div>
            ))}
          </div>
          <p className="helper-note">
            A barra mostra conclusão; a nota mostra acertos nas atividades corrigidas. Produções
            livres ficam sem nota automática.
          </p>
        </section>
        <section className="panel assessment-panel">
          <span className="eyebrow">AVALIAÇÃO FINAL</span>
          <h2>
            {progress.assessmentFinished
              ? `${progress.assessmentScore}% de acertos`
              : "Um teste para fechar o ciclo"}
          </h2>
          <p>
            {progress.assessmentFinished
              ? "Veja os pontos que merecem outra revisão."
              : "Ao terminar as lições, confira o que já consegue usar sem consultar o conteúdo."}
          </p>
          <Link
            href={`/course/${course.slug}/unit/${unit.number}/lesson/${unit.lessons.find((lesson) => lesson.activities.some((activity) => activity.type === "quiz"))?.slug ?? unit.lessons.at(-1)?.slug}`}
            className="primary-button"
          >
            {progress.assessmentFinished ? "Refazer avaliação" : "Abrir avaliação"}{" "}
            <ArrowRight size={16} />
          </Link>
          {progress.assessmentFinished && (
            <div className="assessment-strength">
              <strong>{weakSkills.length ? "Para revisar" : "Seu ponto forte"}</strong>
              <p>
                {weakSkills.length
                  ? weakSkills.map((skill) => skill.label).join(", ")
                  : "Você alcançou pelo menos 80% nas habilidades avaliadas."}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
