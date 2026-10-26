import Link from "@/components/navigation-link";
import { Check, Circle } from "lucide-react";
import type { PolicyResult, PolicyStatus } from "@/domain/study/learning-policy-engine";
import { assessmentLink } from "@/content/assessment-references";

export const policyStatusLabels: Record<PolicyStatus, string> = {
  not_required: "Não exigido",
  pending: "Pendente",
  satisfied: "Cumprido",
  not_met: "Critério não atingido",
  not_assessed: "Sem evidência suficiente",
  unavailable: "Recurso indisponível",
};
export function PolicyChecklist({ title, result }: { title: string; result: PolicyResult }) {
  return (
    <div>
      <h4>
        {title} · {policyStatusLabels[result.status]}
      </h4>
      {!result.requirements.length && (
        <p className="helper-note">
          {result.status === "not_required"
            ? "Este curso não exige critérios adicionais."
            : "A política curricular não está disponível."}
        </p>
      )}
      <div className="mastery-checks">
        {result.requirements.map((item) => (
          <div key={item.id}>
            {item.status === "satisfied" ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Circle size={15} aria-hidden="true" />
            )}
            <span>
              {item.label}
              <br />
              <small>
                {policyStatusLabels[item.status]}
                {item.score !== null ? ` · ${Math.round(item.score)}%` : ""}
                {item.minimumScore !== undefined ? ` · mínimo ${item.minimumScore}%` : ""}
                {item.kind !== "unit_completed" && !item.assessmentId
                  ? ` · ${item.observed}/${item.required} evidências`
                  : ""}
              </small>
              {item.assessmentId && item.status !== "satisfied" && (
                <>
                  <br />
                  <Link href={assessmentLink(item.assessmentId)}>Abrir avaliação</Link>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
