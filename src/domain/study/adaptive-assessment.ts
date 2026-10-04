import type { CoursePackage } from "@/content/contracts";
type AssessmentSkill = CoursePackage["assessments"][number]["skillPlan"][number];
export type AdaptiveBankItem = { activityId: string; skill: AssessmentSkill; difficulty: 1 | 2 | 3; ceiling?: boolean };

export type AdaptiveAnswer = {
  activityId: string;
  skill: AssessmentSkill;
  difficulty: 1 | 2 | 3;
  ceiling?: boolean;
  correct: boolean;
  answer: string;
  correctAnswer?: string;
  explanation?: string;
};

export function nextAdaptiveItem(bank: AdaptiveBankItem[], answers: AdaptiveAnswer[], skillPlan: AssessmentSkill[]) {
  const skill = skillPlan[answers.filter((answer) => !answer.ceiling).length];
  if (!skill) return null;
  const used = new Set(answers.map((answer) => answer.activityId));
  const recent = answers.filter((answer) => answer.skill === skill && !answer.ceiling).slice(-2);
  const difficulty: 1 | 2 | 3 =
    recent.length && !recent.at(-1)?.correct
      ? 1
      : recent.length && recent.every((answer) => answer.correct)
        ? 3
        : 2;
  const available = bank.filter((item) => item.skill === skill && !item.ceiling && !used.has(item.activityId));
  return (
    available.sort(
      (a, b) => Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty),
    )[0] ?? null
  );
}

export function adaptiveAssessmentReport(
  answers: AdaptiveAnswer[], skillPlan: AssessmentSkill[],
  passingPolicy: { overall: number; minimumBySkill?: Partial<Record<AssessmentSkill, number>> },
  skillWeights: Partial<Record<AssessmentSkill, number>>,
) {
  const bySkill = [...new Set(skillPlan)].map((skill) => {
    const items = answers.filter((item) => item.skill === skill && !item.ceiling);
    const correct = items.filter((item) => item.correct).length;
    const score = items.length ? Math.round((100 * correct) / items.length) : null;
    const minimum = (passingPolicy.minimumBySkill?.[skill] ?? passingPolicy.overall) * 100;
    return {
      skill,
      answered: items.length,
      correct,
      score,
      status: items.length === 0 ? "not_assessed" as const
        : items.length < 2 ? "insufficient" as const
          : score! >= minimum ? "approved" as const : "review" as const,
    };
  });
  const weighted = bySkill.filter((item) => item.status !== "not_assessed" && item.status !== "insufficient").map((item) => ({
    score: item.score!, weight: skillWeights[item.skill] ?? 0,
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const score = totalWeight > 0
    ? Math.round(weighted.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight)
    : 0;
  const passed =
    bySkill.reduce((sum, item) => sum + item.answered, 0) === skillPlan.length &&
    score >= passingPolicy.overall * 100 &&
    bySkill.every((item) => item.status === "approved");
  return { score, bySkill, passed, wrong: answers.filter((item) => !item.correct && !item.ceiling), scoredQuestions: bySkill.reduce((sum, item) => sum + item.answered, 0) };
}
