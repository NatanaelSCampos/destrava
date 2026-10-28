"use client";

import { journeyText } from "@/lib/journey-text";
import { TrailReturn } from "@/components/trail/trail-return";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Compass, Lightbulb } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { selectAssessment, assessmentLink } from "@/content/assessment-references";
import { AssessmentSession } from "@/components/activities/assessment-session";
import {
  AssessmentChoiceIntro,
  AssessmentHistory,
  assessmentMoments,
  assessmentSize,
} from "@/components/activities/assessment-experience";

function AssessmentSelection() {
  const { course, state } = useStudy();
  const params = useSearchParams();
  const router = useRouter();
  let assessment: ReturnType<typeof selectAssessment>;
  let error = "";
  try {
    assessment = selectAssessment(course, params.get("assessmentId"));
  } catch {
    error = "A avaliação solicitada não pertence ao curso atual.";
  }
  const assessmentUnits = new Map(
    course.assessments.map((item) => [
      item.id,
      course.units.find(
        (unit) =>
          unit.id === item.unitId ||
          unit.assessmentRefs.final === item.id ||
          unit.assessmentRefs.diagnostic === item.id ||
          unit.assessmentRefs.formative.includes(item.id),
      ),
    ]),
  );
  const historical = [...state.assessmentAttempts, ...state.adaptiveAssessments].filter(
    (item) => item.source !== "server" || item.contentVersion !== course.contentVersion,
  );
  if (assessment && params.get("moment"))
    return <AssessmentSession key={assessment.id} assessmentId={assessment.id} />;
  return (
    <div className="assessment-center">
      <TrailReturn assessmentId={assessment?.id} />
      <div className="assessment-center-heading">
        <span className="eyebrow">
          <Compass size={15} aria-hidden="true" /> SEU APRENDIZADO
        </span>
        <p className="page-title">Cada resposta, um próximo passo.</p>
        <p>Descubra o que já ficou com você e o que merece mais uma conversa.</p>
      </div>
      <div className="assessment-workspace">
        <aside className="assessment-picker" aria-label="Escolha uma avaliação">
          <h2 className="assessment-picker-heading">Escolha seu momento</h2>
          {course.assessments.map((item) => {
            const moment = assessmentMoments[item.purpose];
            const selected = item.id === assessment?.id;
            const unit = assessmentUnits.get(item.id);
            return (
              <button
                type="button"
                className="assessment-choice"
                key={item.id}
                aria-pressed={selected}
                onClick={() => router.replace(assessmentLink(item.id))}
              >
                <span className="assessment-choice-icon">
                  <moment.Icon size={21} aria-hidden="true" />
                </span>
                <span className="assessment-choice-copy">
                  <small>{moment.label}</small>
                  <strong>{journeyText(item.title)}</strong>
                  {unit && (
                    <span className="assessment-choice-scope">{journeyText(unit.title)}</span>
                  )}
                  <span className="assessment-choice-state">
                    {selected ? (
                      <>
                        <Check size={13} aria-hidden="true" /> Selecionada
                      </>
                    ) : (
                      assessmentSize(item) +
                      (assessmentSize(item) === 1 ? " atividade" : " atividades")
                    )}
                  </span>
                </span>
              </button>
            );
          })}
          <div className="assessment-picker-note">
            <Lightbulb size={24} aria-hidden="true" />
            <h3>Aprender também é retomar</h3>
            <p>
              Um erro mostra um ponto para explorar. Use as explicações do resultado para continuar.
            </p>
          </div>
        </aside>
        <div className="assessment-selection-content">
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {!assessment ? (
            course.assessments.length ? (
              <AssessmentChoiceIntro invalidReference={!!error} />
            ) : (
              <section className="empty-state" role="status">
                <h1>Por aqui, ainda não há avaliações</h1>
                <p>Continue pelas lições disponíveis no seu curso.</p>
              </section>
            )
          ) : (
            <AssessmentSession key={assessment.id} assessmentId={assessment.id} />
          )}
          <AssessmentHistory
            results={historical.map((item) => ({
              ...item,
              label:
                (course.assessments.find((assessment) => assessment.id === item.assessmentId)
                  ?.title ?? "Outra avaliação") +
                (item.assessmentId && assessmentUnits.get(item.assessmentId)
                  ? " · " + journeyText(assessmentUnits.get(item.assessmentId)!.title)
                  : ""),
              edition: item.contentVersion,
            }))}
            title="Histórico de outras tentativas e edições"
          />
        </div>
      </div>
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<div className="page-loading">Carregando avaliações…</div>}>
      <AssessmentSelection />
    </Suspense>
  );
}
