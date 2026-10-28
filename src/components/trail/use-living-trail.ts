"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useStudy } from "@/components/study-provider";
import { buildLivingTrail } from "@/domain/study/living-trail";
import { findJourneyPresentation } from "@/content/journey-registry";
import {
  parseTrailLocation,
  trailContinuation,
  trailLocationKey,
  type TrailScope,
} from "@/lib/trail-location";
import { courseLessonPath } from "@/lib/course-lesson-navigation";
const changed = "destrava:trail-location";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changed, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changed, listener);
  };
}
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function useLivingTrail() {
  const { course, state, runtime, learningAccess, vocabularyItems, authUserId, ready } = useStudy();
  const source = runtime ? ("installed" as const) : ("compiled" as const);
  const trail = useMemo(
    () =>
      buildLivingTrail(course, state, {
        presentation: runtime ? undefined : findJourneyPresentation(course),
        learningAccess,
        actionContext: { source, permitted: true },
        vocabularyItems,
      }),
    [course, state, runtime, learningAccess, source, vocabularyItems],
  );
  const scope: TrailScope = {
    userId: authUserId,
    courseId: course.id,
    contentVersion: course.contentVersion,
    source,
    ...(runtime
      ? {
          installationId: runtime.reference.installationId,
          artifactHash: runtime.reference.artifactHash,
        }
      : {}),
  };
  const storageKey = trailLocationKey(scope);
  const raw = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => null,
  );
  const continuation = trailContinuation(
    trail,
    parseTrailLocation(raw),
    state.completedActivityIds,
  );
  return { trail, continuation, storageKey, ready };
}
/** Navigation only. No answers, grades, completion or access evidence are written here. */
export function TrailLocationTracker() {
  const { course } = useStudy();
  const { trail, storageKey, ready } = useLivingTrail();
  const pathname = usePathname(),
    search = useSearchParams();
  const activityId = search.get("activity"),
    assessmentId = search.get("assessmentId"),
    requestedMoment = search.get("moment");
  const moments = trail.chapters.flatMap((chapter) => chapter.moments);
  const candidates = moments.filter((moment) => {
    if (moment.kind === "assessment")
      return (
        (pathname === "/assessment" && assessmentId === moment.assessmentId) ||
        course.units.some((unit) =>
          unit.lessons.some(
            (lesson) =>
              lesson.id === moment.lessonId &&
              pathname === courseLessonPath(course, unit, lesson) &&
              (!assessmentId || assessmentId === moment.assessmentId),
          ),
        )
      );
    return course.units.some((unit) =>
      unit.lessons.some(
        (lesson) =>
          lesson.id === moment.lessonId &&
          pathname ===
            courseLessonPath(course, unit, lesson) + (moment.kind === "guided" ? "/guided" : ""),
      ),
    );
  });
  const moment =
    candidates.find((item) => activityId && item.activityIds.includes(activityId)) ??
    candidates.find((item) => item.id === requestedMoment) ??
    candidates[0];
  const validActivity =
    moment && activityId && moment.activityIds.includes(activityId) ? activityId : undefined;
  const momentId =
    moment && ["available", "in_progress", "completed"].includes(moment.status)
      ? moment.id
      : undefined;
  useEffect(() => {
    if (!ready || !momentId) return;
    const previous = parseTrailLocation(read(storageKey));
    if (previous?.momentId === momentId && previous.activityId === validActivity) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          momentId,
          ...(validActivity ? { activityId: validActivity } : {}),
          updatedAt: new Date().toISOString(),
        }),
      );
      window.dispatchEvent(new Event(changed));
    } catch {
      /* Storage is optional; official progression stays available. */
    }
  }, [ready, storageKey, momentId, validActivity]);
  return null;
}
