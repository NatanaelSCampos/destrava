"use client";
import { LessonSupport } from "@/components/activities/lesson-support";
import type { PublicLesson } from "@/content/public";
import type { PublicActivity } from "@/content/public";
import type { LessonRuntimeState } from "@/domain/interactive-lesson/runtime";
import { ActivityRenderer } from "@/components/activities/activity-renderer";

export function guidedStudyActivity(activity: PublicActivity | undefined, phase: LessonRuntimeState["phase"]) {
  if (!activity || !["presenting", "paused"].includes(phase) || !["lesson_content", "review"].includes(activity.type)) return undefined;
  return activity;
}
export function GuidedStudyActivity({ activity, phase, lesson, unavailableActivityIds }: { activity: PublicActivity | undefined; phase: LessonRuntimeState["phase"]; lesson?: PublicLesson; unavailableActivityIds?: readonly string[] }) {
  const current = guidedStudyActivity(activity, phase);
  if (!current) return null;
  return <section className="live-support panel" aria-label="Leitura e revisão da etapa">
    <p>Leia e pratique no seu ritmo. Marcar esta parte como estudada registra sua participação, sem nota.</p>
    <ActivityRenderer key={current.id} activity={current} />
    {lesson?.activities.some(item => item.id === current.id) && <LessonSupport lesson={lesson} activity={current} unavailableActivityIds={unavailableActivityIds} />}
  </section>;
}
