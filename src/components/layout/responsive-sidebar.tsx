"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

/** One navigation tree for desktop and a modal, keyboard-accessible drawer on mobile. */
export function ResponsiveSidebar({ open, setOpen, children }: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  children: ReactNode;
}) {
  const sidebar = useRef<HTMLElement>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1024px)");
    const update = () => {
      setMobile(query.matches);
      if (!query.matches) setOpen(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [setOpen]);
  useEffect(() => {
    const element = sidebar.current;
    if (!element || !mobile || !open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = Array.from(element.parentElement?.querySelectorAll<HTMLElement>(".app-main, .mobile-primary-nav") ?? []);
    const previousInert = background.map(item => item.inert);
    const previousOverflow = document.documentElement.style.overflow;
    background.forEach(item => { item.inert = true; });
    document.documentElement.style.overflow = "hidden";
    const focusable = () => Array.from(element.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), select:not([disabled]), [tabindex='0']"))
      .filter(item => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden");
    element.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    element.addEventListener("keydown", keydown);
    return () => {
      element.removeEventListener("keydown", keydown);
      background.forEach((item, index) => { item.inert = previousInert[index]; });
      document.documentElement.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && getComputedStyle(previousFocus).display !== "none") previousFocus.focus({ preventScroll: true });
    };
  }, [mobile, open, setOpen]);
  return <aside ref={sidebar} id="study-navigation" className={`sidebar${open ? " sidebar-open" : ""}`}
    inert={mobile && !open} role={mobile && open ? "dialog" : undefined}
    aria-modal={mobile && open ? true : undefined} aria-label="Menu de estudo">
    {children}
  </aside>;
}