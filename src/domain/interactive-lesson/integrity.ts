import type { InteractiveLessonDefinition } from "@/content/contracts";
import { canonicalJson, sameEvidenceScope, type LessonEvidenceScope } from "./evidence";
import { legacyRuntime, projectSegmentEvidence, type LessonRuntimeState } from "./runtime";

export class LessonIntegrityError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
export function recoverLegacyRuntime(definition: InteractiveLessonDefinition, scope: LessonEvidenceScope) {
  return legacyRuntime(definition, scope);
}
export function validateRuntimeProgress(definition: InteractiveLessonDefinition, runtime: LessonRuntimeState,
  trusted: LessonRuntimeState, scope: LessonEvidenceScope) {
  if (!runtime.evidenceScope || !sameEvidenceScope(runtime.evidenceScope, scope) ||
    canonicalJson(runtime.segmentEvidence) !== canonicalJson(trusted.segmentEvidence) ||
    canonicalJson(runtime.segmentFailures) !== canonicalJson(trusted.segmentFailures) ||
    canonicalJson(runtime.segmentAttemptSequences) !== canonicalJson(trusted.segmentAttemptSequences))
    throw new LessonIntegrityError("EVIDENCE_MISMATCH", 422);
  const projected = projectSegmentEvidence(definition, runtime);
  if (runtime.checkpointPassed !== projected.checkpointPassed || runtime.speakingSaved !== projected.speakingSaved ||
    runtime.checkpointFailures !== projected.checkpointFailures) throw new LessonIntegrityError("EVIDENCE_MISMATCH", 422);
  const segment = definition.segments[runtime.segmentIndex];
  const ids = definition.segments.map((item) => item.id);
  const count = runtime.phase === "completed" ? ids.length : runtime.segmentIndex;
  if (!segment || runtime.positionMs > (segment.presentation?.durationMs ?? 0) ||
    canonicalJson(runtime.completedSegmentIds) !== canonicalJson(ids.slice(0, count)) ||
    (runtime.phase === "completed" && runtime.segmentIndex !== ids.length - 1) ||
    canonicalJson(runtime.runtimePath.filter((node) => node.kind === "canonical").map((node) => node.segmentId)) !== canonicalJson(ids) ||
    runtime.runtimePath.filter((node) => node.kind === "reinforcement").length > 1 ||
    runtime.runtimePath.some((node) => !ids.includes(node.segmentId)) ||
    (runtime.resumePoint && (runtime.phase !== "intervening" || runtime.resumePoint.segmentId !== segment.id ||
      runtime.resumePoint.anchorMs > (segment.presentation?.durationMs ?? 0))) ||
    (runtime.phase === "checkpoint" && segment.type !== "checkpoint") ||
    (runtime.phase === "speaking" && segment.type !== "speaking")) throw new LessonIntegrityError("INVALID_SEGMENT", 400);
  for (const completed of definition.segments.slice(0, count)) {
    if (!completed.required || !["checkpoint", "speaking"].includes(completed.type)) continue;
    const proof = trusted.segmentEvidence[completed.id];
    if (!proof?.accepted || !sameEvidenceScope(proof, scope) || proof.segmentId !== completed.id ||
      proof.activityId !== completed.activityRef ||
      (completed.type === "speaking") !== (proof.kind === "speaking_submitted"))
      throw new LessonIntegrityError("REQUIRED_EVIDENCE_MISSING", 422);
  }
}
