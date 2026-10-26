import { annotatedParts, type ActivityPresentation, type InlineAnnotation, type PresentationField } from "./text-presentation";

// Only the authoritative result crosses this boundary; selected text can differ by variant.
export function gradePresentation(presentation: ActivityPresentation | undefined, correct: boolean, detailIndex: number, selected: {answer?: string; transcript?: string} = {}): ActivityPresentation | undefined {
  if (!presentation) return undefined;
  const annotations: ActivityPresentation["annotations"] = {};
  const fields: ActivityPresentation["fields"] = {};
  const copy = (from: PresentationField, to: PresentationField, item?: number) => {
    const spans = presentation.annotations?.[from]?.filter(a => item === undefined || a.item === item)
      .map((a): InlineAnnotation => ({...a, ...(item === undefined ? {} : {item: 0})}));
    if (spans?.length) annotations[to] = spans;
    if (presentation.fields?.[from]) fields[to] = presentation.fields[from];
  };
  copy("answer", "answer");
  copy("transcript", "transcript");
  copy("feedback", "feedback");
  copy("feedback", "explanation"); // Preserve the earlier feedback field on legacy packages.
  copy("explanation", "explanation");
  copy("feedbackSummary", "feedbackSummary", correct ? 0 : 1);
  if (detailIndex >= 0) copy("feedbackAlternative", "feedback", detailIndex);
  copy("feedbackAlternative", "feedbackAlternative");
  for (const key of ["answer", "transcript"] as const) {
    if (selected[key] === undefined) { delete annotations[key]; delete fields[key]; continue; }
    try { annotatedParts(selected[key], annotations[key]); }
    catch { delete annotations[key]; } // An alternate form keeps its text and direction without guessing spans.
  }
  return presentation.content || Object.keys(annotations).length || Object.keys(fields).length ? { ...(presentation.content ? {content: presentation.content} : {}), fields, annotations } : undefined;
}
