"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X, Route } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { journeyText } from "@/lib/journey-text";
import { trailRouteMoment, trailReturnHref } from "@/lib/trail-location";
import { useLivingTrail } from "./use-living-trail";
import { LivingTrailView } from "./living-trail-view";
/** Consume one nested native cancel without dismissing the learning surface. */
export function closeNestedTrailDialog(event: Event, owner: HTMLDialogElement) {
  if (event.target === owner || !(event.target instanceof HTMLDialogElement)) return;
  event.preventDefault();
  event.stopPropagation();
  event.target.close();
}
/** The real routed lesson remains the only execution surface and retains its existing guards. */
export function TrailExperienceFrame({ children }: { children: ReactNode }) {
  const { course } = useStudy(),
    { trail } = useLivingTrail();
  const pathname = usePathname(),
    search = useSearchParams(),
    router = useRouter();
  const location = trailRouteMoment(trail, pathname, search);
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = Boolean(location);
  useEffect(() => {
    if (!visible || !dialog.current) return;
    const element = dialog.current,
      previousOverflow = document.body.style.overflow;
    const nestedCancel = (event: Event) => closeNestedTrailDialog(event, element);
    element.addEventListener("cancel", nestedCancel, true);
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.removeEventListener("cancel", nestedCancel, true);
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);
  if (!location) return <>{children}</>;
  const close = () =>
    router.push(trailReturnHref(course.slug, location.chapter.number, location.moment.id), {
      scroll: false,
    });
  return (
    <>
      <div aria-hidden="true">
        <LivingTrailView background />
      </div>
      <dialog
        ref={dialog}
        className="tv-lesson-dialog"
        aria-labelledby="tv-lesson-title"
        onCancel={(event) => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) {
            const r = dialog.current.getBoundingClientRect();
            if (
              event.clientX < r.left ||
              event.clientX > r.right ||
              event.clientY < r.top ||
              event.clientY > r.bottom
            )
              close();
          }
        }}
      >
        <header className="tv-lesson-dialog-head">
          <div>
            <span className="tv-kicker">
              <Route size={14} /> NA SUA TRILHA
            </span>
            <h2 id="tv-lesson-title">{journeyText(location.moment.title)}</h2>
          </div>
          <button
            type="button"
            className="tv-dialog-close"
            aria-label="Fechar aula e voltar à trilha"
            onClick={close}
          >
            <X size={22} />
          </button>
        </header>
        <div className="tv-lesson-dialog-body">{children}</div>
      </dialog>
    </>
  );
}
