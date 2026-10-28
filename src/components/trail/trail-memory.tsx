"use client";
import { ArrowRight, Brain, Leaf } from "lucide-react";
import Link from "@/components/navigation-link";
import { useStudy } from "@/components/study-provider";
import { dueReviewCounts } from "@/domain/review/due-review-counts";
import { learningActionAvailability } from "@/domain/study/learning-action-availability";
import { featureFlags } from "@/lib/feature-flags";
export function TrailMemory() {
  const { course, state, runtime, vocabularyItems, resources } = useStudy();
  const ids = new Set(
    course.units.flatMap((u) => u.lessons.flatMap((l) => l.activities.map((a) => a.id))),
  );
  const due = dueReviewCounts(state, vocabularyItems, new Date(), ids, resources.structures);
  const action = learningActionAvailability(
    course,
    { kind: "review" },
    { source: runtime ? "installed" : "compiled", permitted: true },
  );
  const available = action.eligible && featureFlags.SPACED_REPETITION;
  return (
    <section className="tv-memory" aria-labelledby="tv-memory-title">
      <span className="tv-kicker">
        <Brain size={15} /> MEMÓRIA VIVA
      </span>
      <h2 id="tv-memory-title">
        {available && due.total
          ? "Um novo encontro com o que aprendeu"
          : "Lembrar também faz parte do caminho"}
      </h2>
      <p>
        {available && due.total
          ? "Tente lembrar antes de conferir. Sua fila de revisão já tem o que retomar."
          : "As retomadas nas aulas convidam você a usar o que já aprendeu em outra situação."}
      </p>
      {available && due.total > 0 ? (
        <>
          <div className="tv-memory-count">
            <strong>{due.total}</strong>
            <span>
              {due.total === 1 ? "revisão disponível agora" : "revisões disponíveis agora"}
            </span>
          </div>
          <Link className="secondary-button" href="/review">
            Retomar da memória <ArrowRight size={16} />
          </Link>
        </>
      ) : (
        <span className="tv-memory-note">
          <Leaf size={16} /> Continue no seu ritmo.
        </span>
      )}
    </section>
  );
}
