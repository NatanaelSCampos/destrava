import type { Skill } from "@/content/schema";
import type { AdaptiveBankItem } from "@/content/adaptive-assessment-bank";

export type AdaptiveAnswer = {
  activityId: string;
  skill: Skill;
  difficulty: 1 | 2 | 3;
  correct: boolean;
  answer: string;
};

export const adaptiveSkillPlan: Skill[] = [
  "vocabulary",
  "grammar",
  "listening",
  "writing",
  "grammar",
  "reading",
];
export const adaptiveAssessmentPolicy = { targetScore: 75, criticalSkillMinimum: 60 };

export function nextAdaptiveItem(bank: AdaptiveBankItem[], answers: AdaptiveAnswer[]) {
  const skill = adaptiveSkillPlan[answers.length];
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

export function adaptiveAssessmentReport(answers: AdaptiveAnswer[]) {
  const bySkill = [...new Set(adaptiveSkillPlan)].map((skill) => {
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
  const score = answers.length
    ? Math.round((100 * answers.filter((answer) => answer.correct).length) / answers.length)
    : 0;
  const critical = bySkill.filter((item) => item.answered >= 2);
  const passed =
    answers.length === adaptiveSkillPlan.length &&
    score >= adaptiveAssessmentPolicy.targetScore &&
    critical.every((item) => (item.score ?? 0) >= adaptiveAssessmentPolicy.criticalSkillMinimum);
  return { score, bySkill, passed, wrong: answers.filter((item) => !item.correct) };
}
