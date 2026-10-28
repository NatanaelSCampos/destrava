import type { LivingTrail } from "@/domain/study/living-trail";
/** An off-screen stop is sufficiently far away to offer a return, in either direction. */
export function trailScrollDirection(
  rect: { top: number; bottom: number },
  viewport: { top: number; bottom: number },
  margin = 72,
): "up" | "down" | null {
  if (rect.bottom < viewport.top - margin) return "up";
  if (rect.top > viewport.bottom + margin) return "down";
  return null;
}
/** Old editorial anchors still resolve after a moment is expanded into teaching stages. */
export function resolveTrailAnchor(
  trail: LivingTrail,
  hash: string,
  currentId?: string,
): string | null {
  const moments = trail.chapters.flatMap((chapter) => chapter.moments);
  let requested: string | undefined;
  try {
    if (hash.startsWith("#moment-")) requested = decodeURIComponent(hash.slice(8));
  } catch {
    /* Malformed anchors fall back to the real continuation. */
  }
  const exact = moments.find((moment) => moment.id === requested);
  const legacy = requested ? moments.filter((moment) => moment.originMomentId === requested) : [];
  return (
    exact?.id ??
    legacy.find((moment) => ["available", "in_progress"].includes(moment.status))?.id ??
    legacy[0]?.id ??
    currentId ??
    null
  );
}
