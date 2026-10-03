import type { CoursePackage } from "@/content/contracts";
type AssessmentSkill = CoursePackage["assessments"][number]["skillPlan"][number];
export type AdaptiveBankItem = { activityId: string; skill: AssessmentSkill; difficulty: 1 | 2 | 3 };

export type AdaptiveAnswer = {
  activityId: string;
  skill: AssessmentSkill;
  difficulty: 1 | 2 | 3;
  correct: boolean;
  answer: string;
  correctAnswer?: string;
  explanation?: string;
};

export function nextAdaptiveItem(bank: AdaptiveBankItem[], answers: AdaptiveAnswer[], skillPlan: AssessmentSkill[]) {
  const skill = skillPlan[answers.length];
  if (!skill) return null;
  const used = new Set(answers.map((answer) => answer.activityId));
  const recent = answers.slice(-2);
  const difficulty: 1 | 2 | 3 =
    recent.length && !recent.at(-1)?.correct
      ? 1
      : recent.length === 2 && recent.every((answer) => answer.correct)
        ? 3
        : 2;
  const available = bank.filter((item) => item.skill === skill && !used.has(item.activityId));
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
    const items = answers.filter((item) => item.skill === skill);
    return {
      skill,
      answered: items.length,
      correct: items.filter((item) => item.correct).length,
      score: items.length
        ? Math.round((100 * items.filter((item) => item.correct).length) / items.length)
        : null,
    };
  });
  const weighted = bySkill.filter((item) => item.score !== null).map((item) => ({
    score: item.score!, weight: skillWeights[item.skill] ?? 0,
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const score = totalWeight > 0
    ? Math.round(weighted.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight)
    : 0;
  const passed =
    answers.length === skillPlan.length &&
    score >= passingPolicy.overall * 100 &&
    bySkill.every((item) => item.answered === 0 || (item.score ?? 0) >= (passingPolicy.minimumBySkill?.[item.skill] ?? 0) * 100);
  return { score, bySkill, passed, wrong: answers.filter((item) => !item.correct) };
}
