"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, LockKeyhole, Play } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { courseStudyProgress, unitProgress } from "@/domain/study/progress";
import { policyStatusLabels } from "@/components/activities/policy-checklist";

export default function CoursePage() {
  const { courseSlug } = useParams<{ courseSlug: string }>();
  const { course, state, vocabularyItems, learningAccess } = useStudy();
  if (courseSlug !== course.slug) return <div className="empty-state">Curso não encontrado.</div>;
  const progress = courseStudyProgress(course, state);
  return (
    <div className="course-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MEU CURSO · {course.level}</span>
          <h1 className="page-title">{course.title}</h1>
          <p className="page-subtitle">{course.description}</p>
        </div>
        <span className="pill">Nível {course.level}</span>
      </div>
      <section className="course-overview panel">
        <div>
          <span className="eyebrow">CONTINUE SUA JORNADA</span>
          <h2>Uma unidade de cada vez.</h2>
          <p>Construa uma base sólida para conversar com naturalidade.</p>
          <Link href="/study" className="primary-button">
            <Play size={16} fill="currentColor" /> Começar aula de hoje
          </Link>
        </div>
        <div className="course-overview-score">
          <strong>{progress}%</strong>
          <span>do conteúdo estudado</span>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>
      <div className="section-head">
        <div>
          <span className="eyebrow">SUA TRILHA</span>
          <h2 className="section-title">Unidades do curso</h2>
        </div>
        <span className="muted">
          {course.units.filter((unit) => unit.active).length} unidade disponível
        </span>
      </div>
      <div className="unit-list">
        {course.units
          .filter((unit) => unit.active)
          .map((unit) => {
            const locked = Boolean(unit.access && !learningAccess?.units[unit.id]?.allowed);
            const item = unitProgress(unit, state, vocabularyItems, course);
            return (
              <Link
                key={unit.id}
                href={`/course/${course.slug}/unit/${unit.number}`}
                className="unit-row panel"
              >
                <span className="unit-row-number">{String(unit.number).padStart(2, "0")}</span>
                <div className="unit-row-main">
                  <span className="eyebrow">UNIDADE {unit.number}</span>
                  <h3>{unit.title}</h3>
                  <p>{unit.description}</p>
                  <div>
                    <span>
                      <BookOpen size={14} /> {unit.lessons.length} lições
                    </span>
                    <span>
                      <Clock3 size={14} />{" "}
                      {unit.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)} min
                    </span>
                  </div>
                </div>
                <div className="unit-row-end">
                  <span
                    className={`pill ${item.isMastered ? "" : item.isCompleted ? "amber" : "gray"}`}
                  >
                    {locked
                      ? "Aguardando a prova anterior"
                      : item.isMastered
                        ? "Domínio estimado"
                        : item.isCompleted
                          ? "Concluída"
                          : policyStatusLabels[item.completion.status]}
                  </span>
                  <strong>{item.participationPercentage}%</strong>
                  <div className="progress-track">
                    <span style={{ width: `${item.participationPercentage}%` }} />
                  </div>
                </div>
                {locked ? <LockKeyhole size={18} /> : <ArrowRight size={18} />}
              </Link>
            );
          })}
      </div>
      <div className="upcoming-note">
        <LockKeyhole size={17} />
        <span>
          As próximas unidades serão adicionadas à trilha conforme o conteúdo for preparado.
        </span>
        <CheckCircle2 size={16} />
      </div>
    </div>
  );
}
