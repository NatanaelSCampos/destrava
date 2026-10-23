import type { AssessmentDefinition, AssessmentPurpose } from "./contracts";

export const assessmentPurposeLabels: Record<AssessmentPurpose, string> = {
  diagnostic: "Diagnóstica",
  formative: "Formativa",
  summative: "Somativa",
};

export function assessmentActivityIds(assessment: AssessmentDefinition): string[] {
  return assessment.method === "adaptive"
    ? [...new Set(assessment.bank.map((item) => item.activityId))]
    : assessment.activityIds;
}

export function resolveAssessment(
  definitions: readonly AssessmentDefinition[],
  reference: string | undefined,
  purpose?: AssessmentPurpose,
): AssessmentDefinition | undefined {
  if (!reference) return undefined;
  const result = definitions.find((item) => item.id === reference);
  if (!result) throw new Error(`Avaliação referenciada não encontrada: ${reference}`);
  if (purpose && result.purpose !== purpose)
    throw new Error(`Finalidade incompatível para a referência: ${reference}`);
  return result;
}

export function selectAssessment(
  course: { assessments: AssessmentDefinition[]; assessmentRefs: { diagnostic?: string } },
  requestedId?: string | null,
): AssessmentDefinition | undefined {
  return requestedId
    ? resolveAssessment(course.assessments, requestedId)
    : resolveAssessment(course.assessments, course.assessmentRefs.diagnostic, "diagnostic");
}

export function assessmentLink(assessmentId: string): string {
  return `/assessment?assessmentId=${encodeURIComponent(assessmentId)}`;
}
