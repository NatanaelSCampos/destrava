export type LessonEvidenceScope = {
  userId: string;
  courseId: string;
  lessonId: string;
  sessionId: string;
  contentVersion: string;
  definitionHash: string;
};
export type SegmentEvidence = LessonEvidenceScope & {
  segmentId: string;
  activityId: string;
  attemptId: string;
  sequence: number;
  kind: "objective_correct" | "writing_submitted" | "speaking_submitted";
  accepted: boolean;
};
export function sameEvidenceScope(a: LessonEvidenceScope, b: LessonEvidenceScope) {
  return a.userId === b.userId && a.courseId === b.courseId && a.lessonId === b.lessonId &&
    a.sessionId === b.sessionId && a.contentVersion === b.contentVersion &&
    a.definitionHash === b.definitionHash;
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item)).join(",") + "}";
  return JSON.stringify(value);
}
