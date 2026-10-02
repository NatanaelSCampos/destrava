"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { pageTourFor, type PageTourStep } from "@/content/page-tours";

type Highlight = {
  top: number;
  left: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

export function PageTour({
  pathname,
  replayToken,
  onOpenChange,
}: {
  pathname: string;
  replayToken: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { authUserId, ready, state, recordStudyEvent } = useStudy();
  const tour = pageTourFor(pathname, Boolean(state.activeSessionId));
  const seen = Boolean(
    tour &&
    state.events.some((event) => event.type === "page_tour_seen" && event.itemId === tour.id),
  );
  const [steps, setSteps] = useState<PageTourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [cardHeight, setCardHeight] = useState(260);
  const nextButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const replayedToken = useRef(replayToken);

  useEffect(() => onOpenChange(open), [onOpenChange, open]);

  useEffect(() => {
    if (!ready || !tour) return;
    const forceReplay = replayToken !== replayedToken.current;
    replayedToken.current = replayToken;
    const storageKey = `destrava:page-tour:v1:${authUserId ?? "demo"}:${tour.id}`;
    let seenLocally = false;
    try {
      seenLocally = window.localStorage.getItem(storageKey) === "1";
    } catch {
      // The persisted study event still prevents a repeat when storage is unavailable.
    }
    if (!forceReplay && (seen || seenLocally)) {
      setOpen(false);
      return;
    }

    onOpenChange(true);

    const main = document.querySelector(".main-content");
    if (!main) return;
    let observer: MutationObserver | null = null;
    const expiry = window.setTimeout(() => {
      observer?.disconnect();
      onOpenChange(false);
    }, 5000);
    const showWhenReady = () => {
      if (main.querySelector(".page-loading")) return;
      const visible = tour.steps.filter((step) => {
        const element = document.querySelector(step.target);
        if (!element || !element.getClientRects().length) return false;
        const bounds = element.getBoundingClientRect();
        return bounds.right > 0 && bounds.left < window.innerWidth;
      });
      if (!visible.length || visible[0].target !== tour.steps[0].target) return;
      observer?.disconnect();
      window.clearTimeout(expiry);
      setHighlight(null);
      setSteps(visible);
      setIndex(0);
      setOpen(true);
    };
    const timer = window.setTimeout(showWhenReady, 160);
    observer = new MutationObserver(showWhenReady);
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(expiry);
      observer?.disconnect();
      setOpen(false);
    };
  }, [authUserId, onOpenChange, ready, replayToken, seen, tour]);

  const step = steps[index];
  useEffect(() => {
    if (!open || !step) return;
    const element = document.querySelector(step.target);
    if (!element) return;
    element.scrollIntoView({
      behavior: "auto",
      block: window.innerWidth <= 520 ? "start" : "center",
      inline: "nearest",
    });
    if (window.innerWidth <= 520) window.scrollBy({ top: -24, behavior: "auto" });
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - 8, bounds.left - 7));
      const top = Math.max(8, Math.min(window.innerHeight - 8, bounds.top - 7));
      setHighlight({
        top,
        left,
        width: Math.max(0, Math.min(window.innerWidth - 8, bounds.right + 7) - left),
        height: Math.max(0, Math.min(window.innerHeight - 8, bounds.bottom + 7) - top),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    };
    update();
    const settled = window.setTimeout(update, 350);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(settled);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() =>
      setCardHeight(dialog.current?.offsetHeight ?? 260),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focus = window.requestAnimationFrame(() => nextButton.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const buttons = Array.from(
        dialog.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focus);
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
    // The dialog keeps focus while its steps change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function finish() {
    if (tour && !seen) {
      recordStudyEvent("page_tour_seen", tour.id);
      try {
        window.localStorage.setItem(
          `destrava:page-tour:v1:${authUserId ?? "demo"}:${tour.id}`,
          "1",
        );
      } catch {
        // Remote persistence still records this tour.
      }
    }
    setOpen(false);
  }

  if (!open || !tour || !step) return null;
  const cardWidth = Math.min(370, highlight ? highlight.viewportWidth - 32 : 370);
  const cardLeft = highlight
    ? Math.max(16, Math.min(highlight.viewportWidth - cardWidth - 16, highlight.left))
    : undefined;
  const below = highlight ? highlight.viewportHeight - (highlight.top + highlight.height) : 0;
  const cardTop = highlight
    ? below >= cardHeight + 22 || below >= highlight.top
      ? Math.min(highlight.viewportHeight - cardHeight - 16, highlight.top + highlight.height + 14)
      : Math.max(16, highlight.top - cardHeight - 14)
    : undefined;

  return (
    <div className="page-tour-layer">
      <div className={`page-tour-blocker ${highlight ? "" : "page-tour-dim"}`} />
      {highlight && (
        <div
          className="page-tour-highlight"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}
      <section
        ref={dialog}
        className={`page-tour-dialog ${highlight ? "" : "page-tour-centered"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-tour-title"
        aria-describedby="page-tour-description"
        style={highlight ? { top: cardTop, left: cardLeft, width: cardWidth } : undefined}
      >
        <button type="button" className="page-tour-close" aria-label="Pular guia" onClick={finish}>
          <X size={17} />
        </button>
        <span className="page-tour-kicker">GUIA · {tour.name}</span>
        <span className="page-tour-progress">
          Passo {index + 1} de {steps.length}
        </span>
        <h2 id="page-tour-title">{step.title}</h2>
        <p id="page-tour-description">{step.description}</p>
        <div className="page-tour-dots" aria-hidden="true">
          {steps.map((entry, position) => (
            <span key={entry.title} className={position === index ? "active" : ""} />
          ))}
        </div>
        <div className="page-tour-actions">
          <button type="button" className="page-tour-skip" onClick={finish}>
            Pular guia
          </button>
          <span>
            {index > 0 && (
              <button type="button" className="page-tour-back" onClick={() => setIndex(index - 1)}>
                <ArrowLeft size={15} /> Voltar
              </button>
            )}
            <button
              ref={nextButton}
              type="button"
              className="page-tour-next"
              onClick={() => (index === steps.length - 1 ? finish() : setIndex(index + 1))}
            >
              {index === steps.length - 1 ? "Concluir" : "Próximo"} <ArrowRight size={15} />
            </button>
          </span>
        </div>
      </section>
    </div>
  );
}
