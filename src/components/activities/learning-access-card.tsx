"use client";
import { LockKeyhole, ArrowRight, RefreshCw, Clock3 } from "lucide-react";
import Link from "@/components/navigation-link";
import { useStudy } from "@/components/study-provider";
import type { AccessDecision } from "@/domain/study/learning-access";
export function LearningAccessCard({
  decision,
  title = "Seu próximo passo",
}: {
  decision?: AccessDecision;
  title?: string;
}) {
  const { course, refreshLearningAccess, learningAccessError } = useStudy();
  const checking = !decision && !learningAccessError;
  return (
    <section className="panel assessment-access-card" role="status" aria-busy={checking}>
      <span className="assessment-icon">
        {checking ? <Clock3 size={24} aria-hidden="true" /> : <LockKeyhole size={24} aria-hidden="true" />}
      </span>
      <div>
        <span className="eyebrow">No seu ritmo</span>
        <h2>{checking ? "Conferindo seu percurso…" : title}</h2>
        <p>{decision?.message || learningAccessError || "Conferindo seu percurso…"}</p>
        {decision?.total !== undefined && (
          <>
            <div className="progress-track">
              <span style={{ width: ((decision.completed ?? 0) / decision.total) * 100 + "%" }} />
            </div>
            <strong>
              {decision.completed} de {decision.total} práticas realizadas
            </strong>
          </>
        )}
        <div className="adaptive-report-actions">
          <Link className="primary-button" href={"/course/" + course.slug}>
            Voltar ao meu curso <ArrowRight size={16} />
          </Link>
          <button className="secondary-button" onClick={() => void refreshLearningAccess()}>
            <RefreshCw size={15} /> Conferir novamente
          </button>
        </div>
      </div>
    </section>
  );
}
