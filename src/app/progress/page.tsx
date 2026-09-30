"use client";

import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, Check, Circle, Target } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { courseProgress, currentUnit, skillProgress, unitProgress } from "@/domain/study/progress";
import type { Skill } from "@/content/schema";

const skillLabels: Array<{ id: Skill; label: string }> = [
  { id: "vocabulary", label: "Vocabulário" },
  { id: "grammar", label: "Gramática" },
  { id: "listening", label: "Listening" },
  { id: "reading", label: "Leitura" },
  { id: "writing", label: "Writing" },
  { id: "speaking", label: "Speaking" },
];

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
          <span className="eyebrow">FRECUENCIAS A1</span>
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
