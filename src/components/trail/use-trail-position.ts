"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LivingTrail } from "@/domain/study/living-trail";
import { resolveTrailAnchor, trailScrollDirection } from "@/lib/trail-scroll";

export function useTrailPosition(
  trail: LivingTrail,
  currentId: string | undefined,
  enabled: boolean,
  scopeKey: string,
) {
  const entry = useRef<{ scope: string; positionedId?: string; userMoved: boolean }>({
    scope: "",
    userMoved: false,
  });
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const returnToCurrent = useCallback(() => {
    if (!currentId || !enabled) return;
    const target = document.getElementById("moment-" + currentId);
    target?.querySelector<HTMLElement>(".tv-path-stop")?.focus({ preventScroll: true });
    target?.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [currentId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (entry.current.scope !== scopeKey) entry.current = { scope: scopeKey, userMoved: false };
    const explore = () => {
      entry.current.userMoved = true;
    };
    const key = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key))
        explore();
    };
    window.addEventListener("wheel", explore, { passive: true });
    window.addEventListener("touchstart", explore, { passive: true });
    window.addEventListener("pointerdown", explore, { passive: true });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", explore);
      window.removeEventListener("touchstart", explore);
      window.removeEventListener("pointerdown", explore);
      window.removeEventListener("keydown", key);
    };
  }, [enabled, scopeKey]);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const locate = (explicit = false) => {
      // Explicit return anchors also work when the entire course has been completed.
      const id = resolveTrailAnchor(trail, window.location.hash, currentId);
      if (!id || (!explicit && entry.current.userMoved)) return;
      const target = document.getElementById("moment-" + id);
      if (!target) return;
      target.scrollIntoView({ block: "center", behavior: "instant" });
      entry.current.positionedId = id;
      if (window.location.hash)
        target.querySelector<HTMLElement>(".tv-path-stop")?.focus({ preventScroll: true });
    };
    const id = resolveTrailAnchor(trail, window.location.hash, currentId);
    // Hydration may refine the continuation. Follow it until the learner starts exploring.
    if (id && entry.current.positionedId !== id && !entry.current.userMoved) {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => locate());
      });
    }
    const hashChanged = () => locate(true);
    window.addEventListener("hashchange", hashChanged);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", hashChanged);
    };
  }, [enabled, currentId, trail, scopeKey]);

  useEffect(() => {
    if (!enabled || !currentId) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const node = document.getElementById("moment-" + currentId)?.querySelector(".tv-path-stop");
      if (!node) return;
      const topbar = document.querySelector(".topbar")?.getBoundingClientRect();
      const top = topbar && topbar.top <= 0 ? Math.max(0, topbar.bottom) : 0;
      setDirection(
        trailScrollDirection(node.getBoundingClientRect(), { top, bottom: innerHeight }),
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    const path = document.querySelector(".tv-page .tv-winding-path");
    if (path) observer.observe(path);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled, currentId]);
  return { direction: enabled && currentId ? direction : null, returnToCurrent };
}
