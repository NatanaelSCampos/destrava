import type { PublicCourse } from "@/content/public";
import type { StudyState } from "./study-state";
import { courseStudySummary } from "./progress";
import { MAX_STUDY_SESSION_SECONDS } from "./session-time";

const practiceEvents = new Set(["lesson_completed", "exercise_answered", "writing_submitted", "speaking_submitted", "review_completed"]);

/** A date proves an action's day, never its duration or language proficiency. */
export function studyOverview(
  course: PublicCourse,
  state: StudyState,
  vocabularyItems: ReadonlyArray<{ id: string; lessonId: string }> = [],
  now = new Date(),
) {
  const coverage = courseStudySummary(course, state);
  const summary = { coverage, recordedSeconds: 0, finishedSessions: 0, activeSeconds: 0, streak: 0, practicedToday: false, hasPracticeDates: false };
  if ((state.courseId && state.courseId !== course.id) || !Number.isFinite(now.getTime())) return summary;
  const activeUnits = course.units.filter(unit => unit.active);
  const activeLessons = activeUnits.flatMap(unit => unit.lessons.filter(lesson => lesson.active));
  const units = new Set(activeUnits.map(unit => unit.id));
  const lessons = new Set(activeLessons.map(lesson => lesson.id));
  const activities = new Set(activeLessons.flatMap(lesson => lesson.activities.map(activity => activity.id)));
  const vocabulary = new Set(vocabularyItems.filter(item => lessons.has(item.lessonId)).map(item => item.id));
  const schedules = new Set([
    ...Object.entries(state.vocabulary).filter(([id]) => vocabulary.has(id)).map(([, item]) => item.schedule.id),
    ...Object.values(state.mistakes).filter(item => activities.has(item.activityId)).map(item => item.schedule.id),
  ]);
  const localDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
  const validTime = (value: string) => { const time = Date.parse(value); return Number.isFinite(time) && time <= now.getTime() ? time : null; };
  const days = new Set<number>();
  function add(value: string) { const time = validTime(value); if (time !== null) days.add(localDay(new Date(time))); }

  for (const attempt of state.attempts) if (activities.has(attempt.activityId)) add(attempt.createdAt);
  for (const item of [...state.writing, ...state.speaking]) if (activities.has(item.activityId)) add(item.createdAt);
  for (const event of state.events) {
    if ((!event.metadata?.courseId || event.metadata.courseId === course.id) && practiceEvents.has(event.type) && (activities.has(event.activityId ?? "") || (event.type === "review_completed" && vocabulary.has(event.itemId ?? "")))) add(event.createdAt);
  }
  for (const review of state.reviews) if (schedules.has(review.scheduleId)) add(review.reviewedAt);
  for (const result of [...state.assessmentAttempts, ...state.adaptiveAssessments]) {
    const definition = course.assessments.find(item => item.id === result.assessmentId);
    if (definition && (!definition.unitId || units.has(definition.unitId)) &&
        (!definition.lessonId || lessons.has(definition.lessonId)) && result.source === "server" && result.courseId === course.id &&
        result.contentVersion === course.contentVersion && result.method === definition.method &&
        result.purpose === definition.purpose && (result.status === "completed" || result.status === "insufficient") &&
        result.answers?.length && result.answers.every(answer => activities.has(answer.activityId))) add(result.finishedAt);
  }

  // Only measured seconds from an identified session count. No wall-time estimates.
  const sessions = new Map<string, { seconds: number; active: boolean; at: string }>();
  for (const session of state.sessions) {
    const start = validTime(session.startedAt), end = session.finishedAt ? validTime(session.finishedAt) : null;
    const active = !session.finishedAt && session.id === state.activeSessionId;
    if (!units.has(session.unitId) || start === null ||
        (session.finishedAt ? end === null || end < start : !active) ||
        !Number.isFinite(session.durationSeconds) || session.durationSeconds < 0 ||
        session.durationSeconds > MAX_STUDY_SESSION_SECONDS) continue;
    const seconds = Math.floor(session.durationSeconds);
    const previous = sessions.get(session.id);
    if (!previous || (previous.active && !active) || (previous.active === active && previous.seconds < seconds)) sessions.set(session.id, { seconds, active, at: session.finishedAt ?? session.startedAt });
  }
  for (const session of sessions.values()) {
    summary.recordedSeconds += session.seconds;
    if (session.active) summary.activeSeconds += session.seconds;
    else summary.finishedSessions++;
    if (session.seconds > 0) add(session.at);
  }
  const today = localDay(now);
  summary.hasPracticeDates = days.size > 0;
  summary.practicedToday = days.has(today);
  let cursor = summary.practicedToday ? today : today - 1;
  while (days.has(cursor)) { summary.streak++; cursor--; }
  return summary;
}
