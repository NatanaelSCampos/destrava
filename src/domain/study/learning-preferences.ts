import { z } from "zod";

export const learningGoalSchema = z.enum(["general", "travel", "work", "study", "conversation"]);
export const selfReportedLevelSchema = z.enum([
  "zero", "basic", "simple_conversation", "comfortable", "advanced", "unknown",
]);
export const learningSkillSchema = z.enum(["speaking", "listening", "reading", "writing"]);
export const sessionMinutesSchema = z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(45)]);
const skillWeightsSchema = z.object({
  speaking: z.number().min(0).max(1), listening: z.number().min(0).max(1),
  reading: z.number().min(0).max(1), writing: z.number().min(0).max(1),
});
export const learningPreferencesSchema = z.object({
  goal: learningGoalSchema,
  contexts: z.array(z.string().min(1)).max(3),
  skillPriorities: z.array(learningSkillSchema).max(2).refine((items) => new Set(items).size === items.length),
  skillWeights: skillWeightsSchema,
  preferredSessionMinutes: sessionMinutesSchema,
});
export type LearningGoal = z.infer<typeof learningGoalSchema>;
export type LearningSkill = z.infer<typeof learningSkillSchema>;
export type SelfReportedLevel = z.infer<typeof selfReportedLevelSchema>;
export type LearningPreferences = z.infer<typeof learningPreferencesSchema>;
export const learningSkills = learningSkillSchema.options;

export const goalLabels: Record<LearningGoal, string> = {
  general: "No dia a dia", travel: "Em viagens", work: "No trabalho",
  study: "Nos estudos", conversation: "Em conversas",
};
export const skillLabels: Record<LearningSkill, string> = {
  speaking: "Falar", listening: "Entender quem fala", reading: "Ler", writing: "Escrever",
};
export const levelLabels: Record<SelfReportedLevel, string> = {
  zero: "Estou começando do zero", basic: "Sei algumas palavras e frases",
  simple_conversation: "Consigo ter conversas simples",
  comfortable: "Consigo conversar sobre vários assuntos",
  advanced: "Já me comunico bem", unknown: "Não sei dizer",
};

export function deriveSkillWeights(priorities: readonly LearningSkill[]): LearningPreferences["skillWeights"] {
  const unique = [...new Set(priorities)].slice(0, 2);
  const other = unique.length === 0 ? 0.6 : unique.length === 1 ? 0.55 : 0.45;
  const weights = Object.fromEntries(learningSkills.map((skill) => [skill, other])) as LearningPreferences["skillWeights"];
  if (unique[0]) weights[unique[0]] = 1;
  if (unique[1]) weights[unique[1]] = 0.85;
  return weights;
}

export function createLearningPreferences(input: Omit<LearningPreferences, "skillWeights">): LearningPreferences {
  return learningPreferencesSchema.parse({ ...input, skillWeights: deriveSkillWeights(input.skillPriorities) });
}

export const defaultLearningPreferences = createLearningPreferences({
  goal: "general", contexts: [], skillPriorities: [], preferredSessionMinutes: 15,
});

export function readLearningPreferences(raw: unknown): LearningPreferences {
  const parsed = learningPreferencesSchema.safeParse(raw);
  return parsed.success
    ? createLearningPreferences({
        goal: parsed.data.goal, contexts: parsed.data.contexts,
        skillPriorities: parsed.data.skillPriorities,
        preferredSessionMinutes: parsed.data.preferredSessionMinutes,
      })
    : defaultLearningPreferences;
}

export function diagnosticAdvice(level: SelfReportedLevel): "optional" | "recommended" | "strongly_recommended" {
  if (level === "zero") return "optional";
  if (level === "basic") return "recommended";
  return "strongly_recommended";
}

export type ContentAffinity = { goals?: string[]; contexts?: string[] };
export function contentAffinityRank(item: ContentAffinity, preferences: LearningPreferences): number {
  if (preferences.contexts.some((context) => item.contexts?.includes(context))) return 3;
  if (item.goals?.includes(preferences.goal)) return 2;
  if (!item.goals?.length && !item.contexts?.length || item.goals?.includes("general")) return 1;
  return 0;
}

export function orderByLearningAffinity<T extends ContentAffinity>(items: readonly T[], preferences: LearningPreferences): T[] {
  return items.map((item, index) => ({ item, index }))
    .sort((a, b) => contentAffinityRank(b.item, preferences) - contentAffinityRank(a.item, preferences) || a.index - b.index)
    .map(({ item }) => item);
}
