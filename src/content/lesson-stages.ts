import { z } from "zod";

/** A stage groups ordinary activities; it contains no answers or executable content. */
export const lessonStageSchema = z.object({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  activityIds: z.array(z.string().trim().min(1)).min(1).max(12),
}).strict();
export const lessonStagesSchema = z.array(lessonStageSchema).min(1).max(100);
export type LessonStage = z.infer<typeof lessonStageSchema>;

export function lessonStageIssues(lesson: {
  stages?: readonly LessonStage[]; activities: readonly { id: string }[];
}): string[] {
  if (!lesson.stages) return [];
  const errors: string[] = [];
  const ids = lesson.stages.map(stage => stage.id);
  if (new Set(ids).size !== ids.length) errors.push("Stage IDs must be unique within the lesson.");
  const parts = lesson.stages.flatMap(stage => stage.activityIds);
  const expected = lesson.activities.map(activity => activity.id);
  if (parts.length !== expected.length || parts.some((id, index) => id !== expected[index]))
    errors.push("Stages must partition all ordinary lesson activities exactly once, in their declared order.");
  return errors;
}