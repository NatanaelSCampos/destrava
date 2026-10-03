import type { PublicCourse } from "@/content/public";
import type { StudyState } from "./study-state";
import type { LearningRecommendation } from "./learning-recommendation-engine";
import type { LanguageResources } from "@/content/language-resources";
import { ReviewScheduler } from "@/domain/review/review-scheduler";

export type RecommendationGuidance = {
  explanation: string;
  example?: string;
};

export function recommendationGuidance(
  course: PublicCourse,
  state: StudyState,
  item: LearningRecommendation,
  resources: LanguageResources,
): RecommendationGuidance {
  if (item.kind === "review") {
    const activityIds = new Set(course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id)),
    ));
    const mistake = Object.values(state.mistakes).find(
      (entry) => activityIds.has(entry.activityId) && ReviewScheduler.isDue(entry.schedule),
    );
    return mistake
      ? { explanation: mistake.explanation || "Compare a resposta anterior com a forma esperada.", example: mistake.correctAnswer }
      : { explanation: "Retome os cartões vencidos. Cada resposta ajusta a data da próxima revisão." };
  }
  if (item.kind === "number") {
    const prompt = resources.numbers.find((entry) => entry.id === item.id);
    return prompt
      ? { explanation: `Para dizer ${prompt.display}, use “${prompt.spoken}”. Escute e depois tente ditado e fala.`, example: prompt.example }
      : { explanation: "Pratique o número com escuta, escrita e fala." };
  }
  if (item.kind === "conversation") {
    const session = (state.conversations ?? [])
      .filter((entry) => entry.courseId === course.id &&
        (entry.id === item.sessionId || entry.scenarioId === item.id || item.id === "free"))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    const correction = session?.turns.filter((turn) => turn.role === "partner" && turn.correction?.trim()).at(-1)?.correction;
    const scenario = resources.conversationScenarios.find((entry) => entry.id === (session?.scenarioId ?? item.id));
    return {
      explanation: correction
        ? `Na conversa anterior, o professor sugeriu: ${correction}`
        : scenario
          ? `Nesta missão, tente: ${scenario.objectives.slice(0, 2).map((objective) => objective.label.toLowerCase()).join(" e ")}.`
          : "Escolha um assunto familiar, responda em frases curtas e use as correções para tentar de novo.",
      example: scenario?.objectives[0]?.hint,
    };
  }
  if (item.kind === "image") {
    const scene = resources.imageScenes.find((entry) => entry.id === item.id);
    const last = (state.imageDescriptions ?? [])
      .filter((entry) => entry.courseId === course.id && entry.sceneId === item.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      explanation: last?.feedback.correction?.trim()
        ? `Na última descrição, a dica foi: ${last.feedback.correction}`
        : "Observe pessoas, objetos e ações. Descreva apenas o que aparece na cena.",
      example: scene?.facts.slice(0, 3).join(" · "),
    };
  }
  const mistake = state.mistakes[item.id];
  return {
    explanation: mistake?.explanation?.trim() ||
      (item.source === "pronunciation" || item.source === "fluency"
        ? "Ouça o modelo e grave outra tentativa na atividade. Compare clareza e fluência com a anterior."
        : "Releia a explicação da atividade e tente uma nova resposta."),
    example: mistake?.correctAnswer,
  };
}
