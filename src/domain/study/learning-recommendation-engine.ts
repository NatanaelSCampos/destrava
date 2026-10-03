import type { PublicCourse } from "@/content/public";
import { dueReviewCounts } from "@/domain/review/due-review-counts";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import type { LanguageResources } from "@/content/language-resources";
import type { LearningProfile } from "./learning-profile";
import type { StudyState } from "./study-state";
import { featureFlags } from "@/lib/feature-flags";

type RecommendationBase = {
  source:
    | "due_review"
    | "mistake"
    | "pronunciation"
    | "fluency"
    | "curriculum"
    | "number"
    | "conversation"
    | "image"
    | "behavior";
  id: string;
  title: string;
  reason: string;
  priority: number;
  minutes: number;
};
export type LearningRecommendation =
  | (RecommendationBase & { kind: "review"; source: "due_review" })
  | (RecommendationBase & { kind: "number"; source: "number" })
  | (RecommendationBase & { kind: "conversation"; source: "conversation"; sessionId?: string })
  | (RecommendationBase & { kind: "image"; source: "image" })
  | (RecommendationBase & {
      kind: "activity";
      source: "mistake" | "pronunciation" | "fluency" | "curriculum" | "behavior";
      unitNumber: number;
      lessonSlug: string;
    });

export class LearningRecommendationEngine {
  static recommend(
    course: PublicCourse,
    state: StudyState,
    profile: LearningProfile,
    vocabularyItems: ReadonlyArray<{ id: string }>,
    resources: Pick<LanguageResources, "numbers" | "numberCategoryLabels" | "structures" | "conversationScenarios" | "imageScenes">,
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
          structureReviews: state.structureReviews,
        },
        vocabularyItems,
        now,
        undefined,
        resources.structures,
      );
      if (due.total)
        add({
          kind: "review",
          source: "due_review",
          id: "due",
          title: `Revisar ${due.total} ${due.total === 1 ? "item" : "itens"}`,
          reason: "Palavras, estruturas e erros prontos para revisão espaçada.",
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

    const explanationCounts = new Map<string, number>();
    for (const event of state.events ?? [])
      if (
        event.type === "explanation_opened" &&
        event.metadata?.courseId === course.id &&
        event.itemId &&
        now.getTime() - Date.parse(event.createdAt) < 30 * 86_400_000
      )
        explanationCounts.set(event.itemId, (explanationCounts.get(event.itemId) ?? 0) + 1);
    for (const [activityId, count] of explanationCounts) {
      const context = activityById.get(activityId);
      if (!context || count < 3) continue;
      add({
        kind: "activity",
        source: "behavior",
        id: activityId,
        title: context.activity.title,
        reason: "Você abriu a explicação várias vezes. Vale praticar este ponto de novo.",
        priority: 79 + Math.min(7, count),
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

    if (resources.numbers.length) {
      const numberGroups = new Map<string, NonNullable<StudyState["numberAttempts"]>>();
      for (const attempt of state.numberAttempts ?? []) {
        if (!resources.numbers.some((entry) => entry.id === attempt.promptId)) continue;
        const group = numberGroups.get(attempt.promptId) ?? [];
        group.push(attempt);
        numberGroups.set(attempt.promptId, group);
      }
      for (const [promptId, group] of numberGroups) {
        const prompt = resources.numbers.find((entry) => entry.id === promptId)!;
        const recent = group.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
        if (recent[0].correct && recent.every((item) => item.correct)) continue;
        const misses = recent.filter((item) => !item.correct).length;
        if (!misses) continue;
        add({
          kind: "number",
          source: "number",
          id: promptId,
          title: `${resources.numberCategoryLabels[prompt.category] ?? prompt.category}: ${prompt.display}`,
          reason: `Você teve dificuldade em ${misses} das últimas ${recent.length} tentativas deste número.`,
          priority: 72 + misses * 6,
          minutes: 3,
        });
      }
    }

    if (featureFlags.AI_TUTOR) {
      const recentSessions = (state.conversations ?? [])
        .filter(
          (session) =>
            session.courseId === course.id &&
            now.getTime() - Date.parse(session.startedAt) < 30 * 86_400_000,
        )
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 12);
      const categoryCounts = new Map<string, number>();
      for (const session of recentSessions)
        for (const turn of session.turns) {
          if (turn.role !== "partner" || !turn.correction?.trim()) continue;
          const category = turn.correctionCategory ?? "other";
          categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
        }
      const repeated = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      const latest = recentSessions[0];
      if (latest && repeated && repeated[1] >= 2) {
        const scenario = resources.conversationScenarios.find((entry) => entry.id === latest.scenarioId);
        add({
          kind: "conversation",
          source: "conversation",
          id: scenario?.id ?? "free",
          title: scenario ? `Praticar: ${scenario.title}` : "Praticar conversa livre",
          reason: `As conversas recentes tiveram ${repeated[1]} ajustes de ${
            {
              grammar: "gramática",
              vocabulary: "vocabulário",
              clarity: "clareza",
              other: "linguagem",
            }[repeated[0]] ?? "linguagem"
          }. Pratique de novo sem nota oficial.`,
          priority: 78 + Math.min(8, repeated[1]),
          minutes: 6,
        });
      }
      const unfinished = recentSessions.find(
        (session) =>
          session.mode === "mission" &&
          !session.finishedAt &&
          session.turns.some((turn) => turn.role === "student"),
      );
      if (unfinished) {
        const scenario = resources.conversationScenarios.find((entry) => entry.id === unfinished.scenarioId);
        if (scenario)
          add({
            kind: "conversation",
            source: "conversation",
            id: unfinished.id,
            sessionId: unfinished.id,
            title: `Continuar: ${scenario.title}`,
            reason: "Você iniciou esta missão e ainda pode concluir os objetivos.",
            priority: 76,
            minutes: 5,
          });
      }
      const replayCounts = new Map<string, number>();
      for (const event of state.events ?? [])
        if (
          event.type === "conversation_partner_audio" &&
          event.metadata?.courseId === course.id &&
          event.itemId &&
          now.getTime() - Date.parse(event.createdAt) < 30 * 86_400_000
        )
          replayCounts.set(event.itemId, (replayCounts.get(event.itemId) ?? 0) + 1);
      const repeatedAudio = [...replayCounts.entries()].find(([, count]) => count >= 3);
      if (repeatedAudio) {
        const session = recentSessions.find((item) =>
          item.turns.some((turn) => turn.id === repeatedAudio[0]),
        );
        if (session)
          add({
            kind: "conversation",
            source: "conversation",
            id: session.id,
            sessionId: session.id,
            title: "Revisitar uma conversa",
            reason: "Você ouviu a mesma fala várias vezes. Releia e escute novamente no contexto.",
            priority: 73,
            minutes: 4,
          });
      }
      const imageAttempts = (state.imageDescriptions ?? [])
        .filter(
          (attempt) =>
            attempt.courseId === course.id &&
            now.getTime() - Date.parse(attempt.createdAt) < 30 * 86_400_000,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12);
      const imageCorrections = new Map<string, number>();
      for (const attempt of imageAttempts)
        if (attempt.feedback.correction?.trim())
          imageCorrections.set(attempt.sceneId, (imageCorrections.get(attempt.sceneId) ?? 0) + 1);
      for (const [sceneId, count] of imageCorrections) {
        const scene = resources.imageScenes.find((entry) => entry.id === sceneId);
        if (!scene || count < 2) continue;
        add({
          kind: "image",
          source: "image",
          id: sceneId,
          title: `Descrever: ${scene.title}`,
          reason: `Você recebeu dicas nesta cena ${count} vezes. Tente uma nova descrição.`,
          priority: 75 + Math.min(8, count),
          minutes: 5,
        });
      }
    }

    for (const [index, context] of activities.entries()) {
      if (state.completedActivityIds.includes(context.activity.id)) continue;
      const skillScore = Math.min(
        ...(context.activity.skills.length ? context.activity.skills : [context.activity.skill])
          .map((skill) => skillScores.get(skill))
          .filter((score): score is number => score !== null && score !== undefined),
        100,
      );
      const conceptScore = Math.min(
        ...context.activity.conceptIds
          .map((id) => conceptScores.get(id))
          .filter((score): score is number => score !== null && score !== undefined),
        100,
      );
      const priority = Math.round(
        50 -
          Math.min(12, index * 0.35) +
          Math.max(0, (65 - skillScore) / 7) +
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
