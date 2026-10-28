import type { LivingTrail, LivingTrailMoment } from "@/domain/study/living-trail";
export type TrailLocation = {
  version: 1;
  momentId: string;
  activityId?: string;
  updatedAt: string;
};
export type TrailScope = {
  userId: string | null;
  courseId: string;
  contentVersion: string;
  source: "compiled" | "installed";
  installationId?: string;
  artifactHash?: string;
};
export function trailLocationKey(scope: TrailScope) {
  return "destrava:trail-location:v1:" + encodeURIComponent(JSON.stringify(scope));
}
export function parseTrailLocation(raw: string | null): TrailLocation | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const v = JSON.parse(raw);
    return v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.keys(v).every((key) =>
        ["version", "momentId", "activityId", "updatedAt"].includes(key),
      ) &&
      v.version === 1 &&
      typeof v.momentId === "string" &&
      v.momentId.trim().length > 0 &&
      v.momentId.length <= 180 &&
      (v.activityId === undefined ||
        (typeof v.activityId === "string" &&
          v.activityId.trim().length > 0 &&
          v.activityId.length <= 180)) &&
      typeof v.updatedAt === "string" &&
      Number.isFinite(Date.parse(v.updatedAt))
      ? {
          version: 1,
          momentId: v.momentId,
          ...(v.activityId ? { activityId: v.activityId } : {}),
          updatedAt: v.updatedAt,
        }
      : null;
  } catch {
    return null;
  }
}
export function trailMomentHref(moment: LivingTrailMoment, activityId?: string) {
  if (!activityId || !moment.activityIds.includes(activityId) || moment.kind !== "lesson")
    return moment.href;
  const url = new URL(moment.href, "https://trail.invalid");
  url.searchParams.set("activity", activityId);
  return url.pathname + url.search + url.hash;
}
function canContinue(moment: LivingTrailMoment) {
  return (
    ["available", "in_progress"].includes(moment.status) ||
    (moment.status === "completed" &&
      moment.isExam &&
      moment.result?.passed === false &&
      moment.access.allowed)
  );
}
export function trailContinuation(
  trail: LivingTrail,
  location: TrailLocation | null,
  completedIds: readonly string[],
) {
  const moments = trail.chapters.flatMap((chapter) => chapter.moments);
  const saved =
    location &&
    moments.find(
      (moment) =>
        moment.id === location.momentId &&
        canContinue(moment) &&
        (!location.activityId || moment.activityIds.includes(location.activityId)),
    );
  const moment = saved || moments.find((item) => item.id === trail.currentMomentId) || null;
  if (!moment || !canContinue(moment)) return null;
  const pending = moment.availableActivityIds.filter((id) => !completedIds.includes(id));
  const activityId =
    saved && location?.activityId && pending.includes(location.activityId)
      ? location.activityId
      : (moment.entryActivityId ?? pending[0]);
  return {
    moment,
    chapter: trail.chapters.find((chapter) =>
      chapter.moments.some((item) => item.id === moment.id),
    )!,
    href: trailMomentHref(moment, activityId),
  };
}
export function trailReturnHref(courseSlug: string, _chapterNumber: number, momentId?: string) {
  return (
    "/course/" +
    encodeURIComponent(courseSlug) +
    (momentId ? "#moment-" + encodeURIComponent(momentId) : "")
  );
}

/** Resolve only a route already declared by the current scoped trail. Never grants access. */
export function trailRouteMoment(
  trail: LivingTrail,
  pathname: string,
  search: Pick<URLSearchParams, "get">,
) {
  const candidates = trail.chapters
    .flatMap((chapter) => chapter.moments.map((moment) => ({ chapter, moment })))
    .filter(({ moment }) => {
      const target = new URL(moment.href, "https://trail.invalid");
      return (
        target.pathname === pathname &&
        (moment.kind !== "assessment" ||
          target.searchParams.get("assessmentId") === search.get("assessmentId"))
      );
    });
  const activity = search.get("activity");
  return (
    candidates.find(({ moment }) => activity && moment.activityIds.includes(activity)) ??
    candidates.find(({ moment }) => moment.id === search.get("moment")) ??
    candidates[0]
  );
}
