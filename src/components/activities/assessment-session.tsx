"use client";

import { LearningAccessCard } from "./learning-access-card";
import { useStudy } from "@/components/study-provider";
import { learningActionAvailability } from "@/domain/study/learning-action-availability";
import { AdaptiveAssessmentRunner } from "./adaptive-assessment-runner";
import { FixedAssessmentRunner } from "./fixed-assessment-runner";

/** The same availability and executors are used inside the course and in the assessment area. */
export function AssessmentSession({ assessmentId }: { assessmentId: string }) {
  const { course, runtime, learningAccess } = useStudy();
  const assessment = course.assessments.find((item) => item.id === assessmentId);
  const availability = learningActionAvailability(
    course,
    { kind: "assessment", id: assessmentId },
    {
      source: runtime ? "installed" : "compiled",
      permitted: true,
    },
  );
  if (!assessment || !availability.eligible)
    return (
      <section className="panel" role="status">
        <h2>Avaliação temporariamente indisponível</h2>
        <p>{availability.reasons.join(" ")} Nenhuma nota será registrada.</p>
      </section>
    );
  const owner = course.units.find((u) => u.id === assessment.unitId);
  if (owner?.access && !learningAccess?.units[owner.id]?.allowed)
    return <LearningAccessCard decision={learningAccess?.units[owner.id]} />;
  return assessment.method === "adaptive" ? (
    <AdaptiveAssessmentRunner key={assessment.id} assessment={assessment} />
  ) : (
    <FixedAssessmentRunner key={assessment.id} assessment={assessment} />
  );
}
