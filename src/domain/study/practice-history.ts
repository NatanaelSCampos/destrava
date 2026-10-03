import type { PublicCourse } from "@/content/public";
import { writingFeedbackSchema } from "@/domain/ai/schemas";
import type { StudySession, StudyState } from "./study-state";

export type PracticePoint = {
  id: string;
  at: string;
  score: number;
  sessionId: string | null;
};

export type PracticeSeries = {
  id: string;
  title: string;
  measure: string;
  href: string;
  points: PracticePoint[];
};

export type SessionComparison = {
  id: string;
  title: string;
  measure: string;
  before: number | null;
  after: number;
};

export function buildPracticeHistory(
  course: PublicCourse,
  state: StudyState,
  vocabularyItems: ReadonlyArray<{ id: string; term: string; lessonId: string }>,
): PracticeSeries[] {
  const activities = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) =>
        lesson.activities.map(
          (activity) =>
            [
              activity.id,
              {
                title: activity.title,
                href: `/course/${course.slug}/unit/${unit.number}/lesson/${lesson.slug}?activity=${encodeURIComponent(activity.id)}`,
              },
            ] as const,
        ),
      ),
    ),
  );
  const lessonIds = new Set(
    course.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)),
  );
  const vocabulary = new Map(
    vocabularyItems.filter((word) => lessonIds.has(word.lessonId)).map((word) => [word.id, word]),
  );
  const series = new Map<string, PracticeSeries>();

  function add(id: string, title: string, measure: string, href: string, point: PracticePoint) {
    if (!Number.isFinite(point.score) || Number.isNaN(Date.parse(point.at))) return;
    const current = series.get(id) ?? { id, title, measure, href, points: [] };
    current.points.push({ ...point, score: Math.round(Math.max(0, Math.min(100, point.score))) });
    series.set(id, current);
  }

  for (const attempt of state.attempts) {
    const activity = activities.get(attempt.activityId);
    if (!activity || attempt.correct === null) continue;
    add(`exercise:${attempt.activityId}`, activity.title, "Acerto", activity.href, {
      id: attempt.id,
      at: attempt.createdAt,
      score: attempt.correct ? 100 : 0,
      sessionId: attempt.sessionId,
    });
  }

  for (const submission of state.writing) {
    const activity = activities.get(submission.activityId);
    if (!activity) continue;
    const feedback = writingFeedbackSchema.safeParse(submission.feedback);
    if (!feedback.success) continue;
    const { grammar, vocabulary: vocabularyScore, clarity } = feedback.data.score;
    add(`writing:${submission.activityId}`, activity.title, "Escrita", activity.href, {
      id: submission.id,
      at: submission.createdAt,
      score: (grammar + vocabularyScore + clarity) / 3,
      sessionId: submission.sessionId ?? null,
    });
  }

  for (const submission of state.speaking) {
    const activity = activities.get(submission.activityId);
    if (!activity || !submission.feedback) continue;
    for (const [measure, score] of [
      ["Pronúncia", submission.feedback.accuracy],
      ["Fluência", submission.feedback.fluency],
    ] as const) {
      add(`${measure}:${submission.activityId}`, activity.title, measure, activity.href, {
        id: `${submission.id}:${measure}`,
        at: submission.createdAt,
        score,
        sessionId: submission.sessionId ?? null,
      });
    }
  }

  const reviewedTarget = new Map<
    string,
    { id: string; title: string; measure: string; href: string }
  >();
  for (const mistake of Object.values(state.mistakes)) {
    const activity = activities.get(mistake.activityId);
    if (activity)
      reviewedTarget.set(mistake.schedule.id, {
        id:
          mistake.category === "writing" || mistake.category === "speaking"
            ? `recall:${mistake.activityId}`
            : `exercise:${mistake.activityId}`,
        title: activity.title,
        measure:
          mistake.category === "writing" || mistake.category === "speaking"
            ? "Recordação da correção"
            : "Acerto",
        href: activity.href,
      });
  }
  for (const [id, progress] of Object.entries(state.vocabulary)) {
    const word = vocabulary.get(id);
    if (word)
      reviewedTarget.set(progress.schedule.id, {
        id: `word:${id}`,
        title: word.term,
        measure: "Recordação",
        href: "/vocabulary",
      });
  }
  for (const review of state.reviews) {
    const target = reviewedTarget.get(review.scheduleId);
    if (!target) continue;
    add(target.id, target.title, target.measure, target.href, {
      id: review.id,
      at: review.reviewedAt,
      score: review.correct ? 100 : 0,
      sessionId: review.sessionId ?? null,
    });
  }

  return [...series.values()]
    .map((item) => ({
      ...item,
      points: item.points.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.points.at(-1)!.at.localeCompare(a.points.at(-1)!.at));
}

export function sessionComparisons(
  session: StudySession,
  history: PracticeSeries[],
): SessionComparison[] {
  return history.flatMap((item) => {
    const during = item.points.filter((point) => point.sessionId === session.id);
    if (!during.length) return [];
    const previous = item.points.filter((point) => point.at < session.startedAt).at(-1);
    const before = previous?.score ?? (during.length > 1 ? during[0].score : null);
    return [
      {
        id: item.id,
        title: item.title,
        measure: item.measure,
        before,
        after: during.at(-1)!.score,
      },
    ];
  });
}
