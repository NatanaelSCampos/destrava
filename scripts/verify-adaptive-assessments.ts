import assert from "node:assert/strict";
import { loadContent } from "./content-loader";
import { adaptiveAssessmentReport, nextAdaptiveItem, type AdaptiveAnswer } from "../src/domain/study/adaptive-assessment";

for (const { course } of loadContent()) {
  for (const assessment of course.assessments.filter((item) => item.type === "adaptive_diagnostic")) {
    const count = assessment.skillPlan.length;
    for (let pattern = 0; pattern < 2 ** count; pattern++) {
      const answers: AdaptiveAnswer[] = [];
      for (let index = 0; index < count; index++) {
        const next = nextAdaptiveItem(assessment.bank, answers, assessment.skillPlan);
        assert(next, `${assessment.id}: missing question at ${index} for pattern ${pattern}`);
        assert(!answers.some((answer) => answer.activityId === next.activityId), `${assessment.id}: repeated activity`);
        answers.push({ ...next, correct: Boolean(pattern & (1 << index)), answer: "test" });
      }
      assert.equal(nextAdaptiveItem(assessment.bank, answers, assessment.skillPlan), null);
      const report = adaptiveAssessmentReport(answers, assessment.skillPlan, assessment.passingPolicy, assessment.skillWeights);
      if (count >= 10) {
        assert(report.bySkill.every((item) => item.answered >= 2), `${assessment.id}: insufficient skill sample`);
        assert.equal(report.scoredQuestions, count);
        if (pattern === 2 ** count - 1) {
          assert.equal(report.score, 100);
          assert.equal(report.passed, true);
          const ceiling = { ...answers[0], activityId: `${assessment.id}.ceiling`, ceiling: true, correct: false };
          const withCeiling = adaptiveAssessmentReport([...answers, ceiling], assessment.skillPlan,
            assessment.passingPolicy, assessment.skillWeights);
          assert.equal(withCeiling.score, 100);
          assert.equal(withCeiling.passed, true);
          assert.equal(withCeiling.wrong.length, 0);
        }
      }
    }
    console.log(`${assessment.id}: ${2 ** count} answer paths validated.`);
  }
}
