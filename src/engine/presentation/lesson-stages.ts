import { lessonStageIssues, type LessonStage } from "@/content/lesson-stages";

type LessonParts = { stages?: readonly LessonStage[]; activities: readonly { id: string; title: string }[] };
export type ResolvedLessonStage = LessonStage & { startIndex: number; endIndex: number };

/** Presentation only: activity identities, grading and completion remain unchanged. */
export function resolveLessonStages(lesson: LessonParts): ResolvedLessonStage[] {
  const issues = lessonStageIssues(lesson);
  if (issues.length) throw new Error(issues.join(" "));
  const groups = lesson.stages ?? lesson.activities.map(activity => ({
    id: activity.id, title: activity.title, activityIds: [activity.id],
  }));
  let offset = 0;
  return groups.map(stage => {
    const startIndex = offset;
    offset += stage.activityIds.length;
    return { ...stage, startIndex, endIndex: offset - 1 };
  });
}

export function lessonStagePosition(stages: readonly ResolvedLessonStage[], activityIndex: number) {
  const stageIndex = stages.findIndex(stage => activityIndex >= stage.startIndex && activityIndex <= stage.endIndex);
  if (stageIndex < 0) throw new Error("Unknown lesson activity index.");
  return { stageIndex, partIndex: activityIndex - stages[stageIndex].startIndex };
}

export function lessonStageComplete(stage: LessonStage, completed: ReadonlySet<string>): boolean {
  return stage.activityIds.every(id => completed.has(id));
}