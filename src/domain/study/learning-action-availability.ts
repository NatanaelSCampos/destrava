import type { PublicCourse } from "@/content/public";
import { capabilityRegistry } from "@/engine/capabilities/registry";
import { installedCapabilitySupport } from "@/domain/installed-study/compatibility";
import { featureFlags } from "@/lib/feature-flags";
import { evaluateUnitPolicies } from "./learning-policy-engine";
import type { StudyState } from "./study-state";

export type LearningAction =
  | { kind: "activity"; activityId: string }
  | { kind: "review" | "numbers" | "conversation" | "image" | "micro_lesson" | "interactive" | "speaking" | "tutor" | "assessment"; id?: string };
export type LearningActionContext = { source: "compiled" | "installed"; permitted?: boolean };
export type LearningActionAvailability = {
  eligible: boolean;
  implementation: "implemented" | "partial" | "unsupported";
  compatibility: boolean;
  operation: "available" | "unavailable" | "unknown";
  permission: "allowed" | "denied" | "unknown";
  reasons: string[];
};
const defaultContext: LearningActionContext = { source: "compiled", permitted: true };
const capabilities = {
  review: "review.spaced", numbers: "numbers.dictation", conversation: "ai.conversation",
  image: "ai.image_description", micro_lesson: "ai.micro_lesson", interactive: "lesson.interactive",
  speaking: "activity.speaking", tutor: "ai.tutor", assessment: "assessment.fixed",
};
/** Presentation decision only; never an authorization token or replacement for server guards. */
export function learningActionAvailability(course: PublicCourse, action: LearningAction,
  context: LearningActionContext = defaultContext): LearningActionAvailability {
  const permission = context.permitted === true ? "allowed" : context.permitted === false ? "denied" : "unknown";
  const reasons: string[] = [];
  let compatibility = true;
  let activity;
  if (action.kind === "activity") {
    const owner = course.units.flatMap(unit => unit.lessons.map(lesson => ({ unit, lesson })))
      .find(({ lesson }) => lesson.activities.some(item => item.id === action.activityId));
    activity = owner?.lesson.activities.find(item => item.id === action.activityId);
    if (!owner || !activity || !owner.unit.active || !owner.lesson.active ||
      course.availability?.unavailableUnitIds?.includes(owner.unit.id) ||
      course.availability?.unavailableActivityIds.includes(action.activityId)) {
      compatibility = false;
      reasons.push(...(course.availability?.reasons?.[action.activityId] ?? ["Esta atividade está indisponível no curso atual."]));
    }
  }
  const assessmentId = action.kind === "assessment" ? action.id : undefined;
  const definition = action.kind === "assessment" ? course.assessments.find(item => item.id === assessmentId) : undefined;
  const capability = action.kind === "activity" ? `activity.${activity?.type ?? "unknown"}`
    : action.kind === "assessment" && definition ? `assessment.${definition.method}` : capabilities[action.kind];
  const registered = capabilityRegistry.get(capability);
  const implementation = registered?.executor && registered.support === "implemented" ? "implemented"
    : registered?.executor && registered.support === "partial" && action.kind === "numbers" ? "partial" : "unsupported";
  if (implementation === "unsupported") reasons.push("Este recurso não tem uma implementação disponível.");
  if (context.source === "installed" && !installedCapabilitySupport.find(item => item.id === capability)?.integrated) {
    compatibility = false;
    reasons.push("Este recurso ainda não está integrado a cursos instalados.");
  }
  if (action.kind === "assessment" && action.id !== undefined && (!definition || course.availability?.unavailableAssessmentIds?.includes(definition.id))) {
    compatibility = false; reasons.push("Esta avaliação está indisponível no curso atual.");
  }
  if (action.kind === "interactive" && !course.units.some(unit => unit.active && !course.availability?.unavailableUnitIds?.includes(unit.id) &&
    unit.lessons.some(lesson => lesson.active && lesson.interactiveLessonRef && !course.availability?.unavailableInteractiveLessonIds?.includes(lesson.interactiveLessonRef)))) {
    compatibility = false; reasons.push("Nenhuma aula particular está disponível neste curso.");
  }
  if (action.kind === "speaking" && !course.units.some(unit => unit.active && unit.lessons.some(lesson => lesson.active && lesson.activities.some(item =>
    item.type === "speaking" && !course.availability?.unavailableActivityIds.includes(item.id))))) {
    compatibility = false; reasons.push("Nenhuma atividade de fala está disponível neste curso.");
  }
  const projected = course.availability?.actionStates?.[capability];
  // Deterministic activities also support the existing in-memory course fixtures.
  let operation = projected?.state ?? (action.kind === "activity" && registered && !registered.operational?.length ? "available" : "unavailable");
  reasons.push(...(projected?.reasons ?? (operation === "unavailable" ? ["A disponibilidade deste recurso não foi confirmada."] : [])));
  if ((action.kind === "review" && (!featureFlags.SPACED_REPETITION || course.availability?.spacedRepetition === false)) ||
    ((action.kind === "speaking" || activity?.type === "speaking") && !featureFlags.SPEAKING) ||
    (activity?.type === "listening" && !featureFlags.LISTENING) ||
    (["conversation", "image", "micro_lesson", "tutor"].includes(action.kind) && !featureFlags.AI_TUTOR)) {
    operation = "unavailable"; reasons.push("Este recurso está temporariamente indisponível.");
  }
  if (operation === "unknown") reasons.push("Tentativa condicional: serviço e permissões serão verificados ao executar.");
  if (permission !== "allowed") reasons.push(permission === "denied" ? "Você não tem permissão para esta ação." : "Sua permissão ainda precisa ser verificada.");
  return { eligible: implementation !== "unsupported" && compatibility && operation !== "unavailable" && permission === "allowed",
    implementation, compatibility, operation, permission, reasons: [...new Set(reasons)] };
}
export function learningActionForPath(pathname: string, searchParams?: Pick<URLSearchParams, "get"> | null): LearningAction | undefined {
  const [rawPath, query] = pathname.split("?");
  const path = rawPath.replace(/\/$/, "");
  const routes: Record<string, LearningAction["kind"]> = { "/review": "review", "/numbers": "numbers", "/conversation": "conversation",
    "/describe": "image", "/micro-lesson": "micro_lesson", "/live-classes": "interactive", "/speaking": "speaking", "/assessment": "assessment" };
  const kind = routes[path];
  if (kind === "assessment") {
    const id = searchParams?.get("assessmentId") ?? new URLSearchParams(query).get("assessmentId");
    return id ? { kind, id } : { kind };
  }
  return kind && kind !== "activity" ? { kind } : undefined;
}
/** Show named obligations even when they cannot enter an executable study plan. */
export function unavailableLearningRequirements(course: PublicCourse, state: StudyState, context?: LearningActionContext) {
  return course.units.flatMap(unit => {
    const result = evaluateUnitPolicies(unit, state, course);
    return (["completion", "mastery"] as const).flatMap(group => (unit.learningPolicy?.[group].requirements ?? []).flatMap(rule => {
      const evaluated = result[group].requirements.find(item => item.id === rule.id);
      const ids = "activityIds" in rule ? rule.activityIds : [];
      const blocked = ids.map(activityId => learningActionAvailability(course, { kind: "activity", activityId }, context)).filter(item => !item.eligible);
      const extra = rule.kind === "review_score" ? learningActionAvailability(course, { kind: "review" }, context)
        : rule.kind === "assessment" ? learningActionAvailability(course, { kind: "assessment", id: rule.assessmentId }, context) : undefined;
      const required = "minimumCount" in rule ? rule.minimumCount ?? ids.length : "minimumSamples" in rule ? rule.minimumSamples : ids.length;
      const insufficientCapacity = blocked.length > 0 && ids.length - blocked.length < required;
      return evaluated?.status === "unavailable" || (evaluated?.status !== "satisfied" && insufficientCapacity) || (extra && !extra.eligible)
        ? [{ id: `${unit.id}:${group}:${rule.id}`, unitId: unit.id, label: rule.label,
          reasons: [...new Set([...blocked.flatMap(item => item.reasons), ...(extra?.reasons ?? []), "Este requisito continua pendente; a indisponibilidade não o conclui."])] }] : [];
    }));
  });
}
