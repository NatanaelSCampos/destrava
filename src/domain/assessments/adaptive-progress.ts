import { z } from "zod";
import type { Course } from "@/content/schema";
import type { LanguagePackage } from "@/content/contracts";
import type { AdaptiveAnswer } from "@/domain/study/adaptive-assessment";
import { evaluateAssessment } from "./assessment-engine";

export type AdaptiveProgress = {
  attemptId: string; assessmentId: string; startedAt: string;
  responses: { activityId: string; answer: string }[];
  /** Reconstructed by the server from the private definition. */
  answers?: AdaptiveAnswer[];
};
const prefixSchema = z.object({
  attemptId: z.uuid(), assessmentId: z.string().min(1).max(1024),
  startedAt: z.iso.datetime({ offset: true }),
  responses: z.array(z.object({ activityId: z.string().min(1).max(1024), answer: z.string().max(100000) }).strict()).min(1).max(1000),
  answers: z.unknown().optional(),
}).strict();

/** A prefix confirms submissions but cannot grant a result or completion credit. */
export function canonicalAdaptiveProgress(raw: unknown, course: Course, language: LanguagePackage, preference: string): AdaptiveProgress[] {
  const values = z.array(prefixSchema).max(1000).parse(raw ?? []);
  if (new Set(values.map(x => x.attemptId)).size !== values.length) throw new Error("Tentativa duplicada.");
  return values.map(value => {
    const definition = course.assessments.find(x => x.id === value.assessmentId);
    if (!definition || definition.method !== "adaptive") throw new Error("Avaliação adaptativa ausente.");
    const result = evaluateAssessment(course, definition.id, value.responses, language.normalization,
      { language, course, preference }, { allowPartialAdaptive: true });
    return { attemptId: value.attemptId, assessmentId: value.assessmentId, startedAt: value.startedAt,
      responses: value.responses, answers: result.answers as AdaptiveAnswer[] };
  });
}
