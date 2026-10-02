import type { Skill } from "@/content/schema";

export type AdaptiveBankItem = { activityId: string; skill: Skill; difficulty: 1 | 2 | 3 };

// Questions already curated in the active A1 course. Level 3 asks for application in context,
// but remains inside this unit's learning objectives.
export const adaptiveAssessmentBank: AdaptiveBankItem[] = [
  { activityId: "assessment-1", skill: "vocabulary", difficulty: 1 },
  { activityId: "vocab-2", skill: "vocabulary", difficulty: 1 },
  { activityId: "vocab-3", skill: "vocabulary", difficulty: 2 },
  { activityId: "vocab-4", skill: "vocabulary", difficulty: 2 },
  { activityId: "vocab-5", skill: "vocabulary", difficulty: 3 },
  { activityId: "workbook-5", skill: "vocabulary", difficulty: 3 },
  { activityId: "grammar-2", skill: "grammar", difficulty: 1 },
  { activityId: "guided-2", skill: "grammar", difficulty: 1 },
  { activityId: "assessment-2", skill: "grammar", difficulty: 2 },
  { activityId: "assessment-3", skill: "grammar", difficulty: 2 },
  { activityId: "review-3", skill: "grammar", difficulty: 2 },
  { activityId: "assessment-6", skill: "grammar", difficulty: 3 },
  { activityId: "guided-3", skill: "grammar", difficulty: 3 },
  { activityId: "workbook-4", skill: "grammar", difficulty: 3 },
  { activityId: "listening-1", skill: "listening", difficulty: 1 },
  { activityId: "assessment-4", skill: "writing", difficulty: 2 },
  { activityId: "guided-4", skill: "writing", difficulty: 3 },
  { activityId: "assessment-5", skill: "reading", difficulty: 2 },
];
