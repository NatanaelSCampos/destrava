import type { PublicCourse } from "@/content/public";
import { dueReviewCounts } from "@/domain/review/due-review-counts";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import type { LearningProfile } from "./learning-profile";
import type { StudyState } from "./study-state";

type RecommendationBase = {
  source: "due_review" | "mistake" | "pronunciation" | "fluency" | "curriculum";
  id: string;
  title: string;
  reason: string;
  priority: number;
  minutes: number;
};
export type LearningRecommendation =
  | (RecommendationBase & { kind: "review"; source: "due_review" })
  | (RecommendationBase & {
      kind: "activity";
      source: "mistake" | "pronunciation" | "fluency" | "curriculum";
      unitNumber: number;
      lessonSlug: string;
    });

export class LearningRecommendationEngine {
  static recommend(
    course: PublicCourse,
    state: StudyState,
    profile: LearningProfile,
    vocabularyItems: ReadonlyArray<{ id: string }>,
    options: { now?: Date; includeReviews?: boolean } = {},
  ): LearningRecommendation[] {
    const now = options.now ?? new Date();
    const recommendations = new Map<string, LearningRecommendation>();
    const activities = course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) =>
        lesson.activities.map((activity) => ({ activity, lesson, unit })),
      ),
    );
    const activityById = new Map(activities.map((entry) => [entry.activity.id, entry]));
    const skillScores = new Map(profile.skills.map((item) => [item.id, item.score]));
    const conceptScores = new Map(profile.concepts.map((item) => [item.id, item.score]));

    function add(item: LearningRecommendation) {
      const key = `${item.kind}:${item.id}`;
      const current = recommendations.get(key);
      if (!current || current.priority < item.priority) recommendations.set(key, item);
    }

    if (options.includeReviews !== false) {
      const due = dueReviewCounts(
        {
          vocabulary: state.vocabulary,
          mistakes: Object.fromEntries(
            Object.entries(state.mistakes).filter(([activityId]) => activityById.has(activityId)),
          ),
        },
        vocabularyItems,
        now,
      );
      if (due.total)
        add({
          kind: "review",
          source: "due_review",
          id: "due",
          title: `Revisar ${due.total} ${due.total === 1 ? "item" : "itens"}`,
          reason: "Palavras e erros prontos para revisão espaçada.",
          priority: 100,
          minutes: Math.min(8, Math.max(4, due.total)),
        });
    }

    for (const mistake of Object.values(state.mistakes)) {
      const context = activityById.get(mistake.activityId);
      if (
        !context ||
        (mistake.schedule.masteryScore >= 75 && mistake.timesCorrect >= mistake.timesMissed)
      )
        continue;
      if (options.includeReviews !== false && ReviewScheduler.isDue(mistake.schedule, now))
        continue;
      const daysSinceError = Math.max(
        0,
        (now.getTime() - new Date(mistake.lastMissedAt).getTime()) / 86_400_000,
      );
      if (!Number.isFinite(daysSinceError)) continue;
      const priority = Math.round(
        70 +
          Math.min(19, mistake.timesMissed * 5) -
          Math.min(12, mistake.timesCorrect * 3) +
          Math.max(0, 8 - daysSinceError / 3),
      );
      add({
        kind: "activity",
        source: "mistake",
        id: mistake.activityId,
        title: context.activity.title,
        reason:
          mistake.timesMissed > 1
            ? `Você errou este ponto ${mistake.timesMissed} vezes. Vale tentar novamente.`
            : "Uma tentativa anterior mostrou dificuldade neste ponto.",
        priority,
        minutes: context.activity.minutes,
        unitNumber: context.unit.number,
        lessonSlug: context.lesson.slug,
      });
    }

    const latestSpeaking = new Map<string, StudyState["speaking"][number]>();
    for (const submission of state.speaking) {
      if (!submission.feedback || !activityById.has(submission.activityId)) continue;
      const previous = latestSpeaking.get(submission.activityId);
      if (!previous || submission.createdAt > previous.createdAt)
        latestSpeaking.set(submission.activityId, submission);
    }
    for (const submission of latestSpeaking.values()) {
      if (!submission.feedback) continue;
      const { accuracy, fluency } = submission.feedback;
      const weakest = Math.min(accuracy, fluency);
      if (weakest >= 75) continue;
      const context = activityById.get(submission.activityId)!;
      const isPronunciation = accuracy <= fluency;
      add({
        kind: "activity",
        source: isPronunciation ? "pronunciation" : "fluency",
        id: submission.activityId,
        title: context.activity.title,
        reason: isPronunciation
          ? `Sua última clareza de pronúncia foi ${Math.round(accuracy)}/100.`
          : `Sua última fluência foi ${Math.round(fluency)}/100.`,
        priority: Math.round(75 + (75 - weakest) / 4),
        minutes: context.activity.minutes,
        unitNumber: context.unit.number,
        lessonSlug: context.lesson.slug,
      });
    }

    for (const [index, context] of activities.entries()) {
      if (state.completedActivityIds.includes(context.activity.id)) continue;
      const skillScore = skillScores.get(context.activity.skill);
      const conceptScore = Math.min(
        ...context.activity.conceptIds
          .map((id) => conceptScores.get(id))
          .filter((score): score is number => score !== null && score !== undefined),
        100,
      );
      const priority = Math.round(
        50 -
          Math.min(12, index * 0.35) +
          (skillScore === null || skillScore === undefined
            ? 0
            : Math.max(0, (65 - skillScore) / 7)) +
          Math.max(0, (65 - conceptScore) / 6),
      );
      add({
        kind: "activity",
        source: "curriculum",
        id: context.activity.id,
        title: context.activity.title,
        reason: "Próxima atividade da sua trilha, ajustada ao seu desempenho.",
        priority,
        minutes: context.activity.minutes,
        unitNumber: context.unit.number,
        lessonSlug: context.lesson.slug,
      });
    }

    return [...recommendations.values()].sort(
      (a, b) => b.priority - a.priority || a.title.localeCompare(b.title),
    );
  }
}
