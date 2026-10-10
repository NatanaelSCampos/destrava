import { z } from "zod";

// Shared data vocabulary. Learner preference rules and UI labels stay in the domain.
export const learningGoalSchema = z.enum(["general", "travel", "work", "study", "conversation"]);
export const learningSkillSchema = z.enum(["speaking", "listening", "reading", "writing"]);
export const coreSkillSchema = z.enum(["vocabulary", "grammar", "listening", "writing", "speaking", "reading"]);
export const skillIdSchema = z.enum([
  "reading", "writing", "listening", "speaking", "vocabulary", "grammar",
  "pronunciation", "fluency", "comprehension",
]);
export const assessmentPurposeSchema = z.enum(["diagnostic", "formative", "summative"]);

export type LearningGoal = z.infer<typeof learningGoalSchema>;
export type LearningSkill = z.infer<typeof learningSkillSchema>;
