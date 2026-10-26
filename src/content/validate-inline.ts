import { annotatedParts, type ActivityPresentation, type PresentationField } from "./text-presentation";
type AnnotatedActivity = {
  title: string; prompt: string; presentation?: ActivityPresentation; payload: Record<string, unknown>;
};
export function inlinePresentationIssues(activity: AnnotatedActivity): string[] {
  const errors: string[] = [];
  const data = activity.payload;
  const teaching = data.teaching as { support?: string } | undefined;
  const feedback = data.feedback as { summaryCorrect: string; summaryIncorrect: string; alternatives: {detail: string}[] } | undefined;
  const values: Partial<Record<PresentationField, string | string[]>> = {
    title: activity.title, prompt: activity.prompt,
    body: typeof data.body === "string" ? data.body.split("\n\n") : undefined,
    support: teaching?.support?.split("\n\n"),
    feedbackSummary: feedback ? [feedback.summaryCorrect, feedback.summaryIncorrect] : undefined,
    feedbackAlternative: feedback?.alternatives.map(item => item.detail),
  };
  for (const key of ["guidance", "example", "options", "answer", "transcript", "referenceText", "front", "back", "highlights", "explanation"] as const)
    values[key] = data[key] as string | string[] | undefined;
  values.tokens = data.words as string[] | undefined;
  for (const [key, annotations] of Object.entries(activity.presentation?.annotations ?? {})) {
    const value = values[key as PresentationField];
    const items = typeof value === "string" ? [value] : value;
    if (!items || annotations.some(a => a.item >= items.length)) {
      errors.push("Inline annotation field/item is missing: " + key); continue;
    }
    try { items.forEach((text, index) => annotatedParts(text, annotations, index)); }
    catch (error) { errors.push(error instanceof Error ? error.message : "Invalid inline annotation"); }
  }
  return errors;
}
