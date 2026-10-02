"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  CaseUpper,
  ChartNoAxesCombined,
  ChevronDown,
  Clock3,
  GraduationCap,
  House,
  CircleHelp,
  Image as ImageIcon,
  Menu,
  MessageCircle,
  Mic2,
  NotebookPen,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { dueReviewCounts } from "@/domain/review/due-review-counts";
import { courseProgress } from "@/domain/study/progress";
import { cx } from "@/lib/utils";
import { TutorDrawer } from "@/components/tutor/tutor-drawer";
import { WhatsNewDialog } from "@/components/layout/whats-new-dialog";
import { PageTour } from "@/components/layout/page-tour";
import { pageTourFor } from "@/content/page-tours";
import { featureFlags } from "@/lib/feature-flags";
import { SelectionAudio } from "@/components/audio/selection-audio";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { canAccessWithMfa } from "@/lib/auth/mfa-access";

const navigation = (courseSlug: string) => [
  { href: "/dashboard", label: "Visão geral", icon: House },
  { href: `/course/${courseSlug}`, label: "Meu curso", icon: BookOpen },
  { href: "/basics", label: "Fundamentos", icon: CaseUpper },
  { href: "/study", label: "Aula de hoje", icon: Play },
  { href: "/review", label: "Revisar", icon: RotateCcw },
  { href: "/speaking", label: "Praticar fala", icon: Mic2 },
  { href: "/conversation", label: "Conversar", icon: MessageCircle },
  { href: "/describe", label: "Explicar imagem", icon: ImageIcon },
  { href: "/assessment", label: "Diagnóstico", icon: ChartNoAxesCombined },
  { href: "/vocabulary", label: "Vocabulário", icon: GraduationCap },
  { href: "/mistakes", label: "Meus erros", icon: NotebookPen },
  { href: "/history", label: "Histórico", icon: Clock3 },
  { href: "/progress", label: "Estatísticas", icon: ChartNoAxesCombined },
];

function isNavActive(href: string, pathname: string) {
  if (href === "/basics" && (pathname === "/alphabet" || pathname === "/numbers")) return true;
  return pathname.startsWith(href) && (href !== "/dashboard" || pathname === href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { course, state, vocabularyItems, ready, authUserId } = useStudy();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourReplayToken, setTourReplayToken] = useState(0);
  const [sessionCheck, setSessionCheck] = useState<"checking" | "ready" | "challenge" | "error">(
    "checking",
  );
  const requiresAuth = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  useEffect(() => {
    if (
      ready &&
      requiresAuth &&
      !authUserId &&
      pathname !== "/login" &&
      pathname !== "/auth/finish"
    )
      router.replace("/login");
  }, [ready, requiresAuth, authUserId, pathname, router]);
  useEffect(() => {
    if (!ready || !authUserId || !requiresAuth || pathname === "/auth/finish") return;
    let cancelled = false;
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const checkAccess = () => {
      void canAccessWithMfa(client).then(({ allowed, error }) => {
        if (cancelled) return;
        if (error) {
          setSessionCheck("error");
          return;
        }
        const needsChallenge = !allowed;
        setSessionCheck(needsChallenge ? "challenge" : "ready");
        if (needsChallenge && pathname !== "/mfa" && pathname !== "/login") {
          // A full reload clears study data already loaded before trust expired.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/mfa");
        }
      });
    };
    checkAccess();
    const timer = window.setInterval(checkAccess, 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ready, authUserId, requiresAuth, pathname, router]);
  if (pathname === "/login" || pathname === "/mfa" || pathname === "/auth/finish")
    return <>{children}</>;
  if (
    !ready ||
    (requiresAuth && (!authUserId || sessionCheck === "checking" || sessionCheck === "challenge"))
  )
    return <div className="page-loading">Preparando seu espaço de estudo…</div>;
  if (sessionCheck === "error")
    return (
      <div className="page-loading">
        Não foi possível verificar sua sessão. Recarregue a página.
      </div>
    );
  const progress = courseProgress(course, state);
  const activityIds = new Set(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id)),
    ),
  );
  const pendingReviews = dueReviewCounts(state, vocabularyItems, new Date(), activityIds).total;
  const navItems = navigation(course.slug).filter(
    (item) =>
      (item.href !== "/speaking" || featureFlags.SPEAKING) &&
      (item.href !== "/conversation" || featureFlags.AI_TUTOR) &&
      (item.href !== "/describe" || featureFlags.AI_TUTOR),
  );
  const studyNavCount = 6 + Number(featureFlags.SPEAKING) + 2 * Number(featureFlags.AI_TUTOR);
  const activeNav = navItems.find((item) => isNavActive(item.href, pathname));
  const hasPageTour = Boolean(pageTourFor(pathname, Boolean(state.activeSessionId)));

  return (
    <div className="app-frame">
      {menuOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={cx("sidebar", menuOpen && "sidebar-open")}>
        <div className="sidebar-top">
          <Link href="/dashboard" className="brand" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark">
              D<span>.</span>
            </span>
            <span>
              <strong>Destrava</strong>
              <small>Aprenda. Pratique. Destrave.</small>
            </span>
          </Link>
          <button
            className="icon-button mobile-close"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-course">
          <div className="sidebar-course-head">
            <span className="sidebar-course-icon">
              <BookOpen size={18} />
            </span>
            <span>
              <small>CURSO ATUAL</small>
              <strong>{course.title}</strong>
            </span>
            <ChevronDown size={15} />
          </div>
          <div className="sidebar-course-progress">
            <span>Seu progresso</span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          <div className="nav-caption">ESTUDAR</div>
          {navItems.slice(0, studyNavCount).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx("nav-link", isNavActive(href, pathname) && "active")}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {href === "/review" && featureFlags.SPACED_REPETITION && pendingReviews > 0 && (
                <span className="nav-count">{pendingReviews}</span>
              )}
            </Link>
          ))}
          <div className="nav-caption nav-caption-second">ACOMPANHAR</div>
          {navItems.slice(studyNavCount).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx("nav-link", pathname.startsWith(href) && "active")}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {featureFlags.AI_TUTOR && (
            <button className="sidebar-tutor" onClick={() => setTutorOpen(true)}>
              <span className="sidebar-tutor-icon">
                <Sparkles size={18} />
              </span>
              <span>
                <strong>Professor IA</strong>
                <small>Tire uma dúvida agora</small>
              </span>
            </button>
          )}
          <Link
            href="/settings"
            className="nav-link settings-link"
            onClick={() => setMenuOpen(false)}
          >
            <Settings2 size={18} strokeWidth={1.8} />
            <span>Configurações</span>
          </Link>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-toggle"
              aria-label="Abrir menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-parent">Meu espaço</span>
            <span className="breadcrumb-sep">/</span>
            <strong>
              {pathname === "/micro-lesson"
                ? "Microlição"
                : pathname === "/numbers"
                  ? "Praticar números"
                  : pathname === "/alphabet"
                    ? "Alfabeto"
                    : (activeNav?.label ?? "Meu curso")}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="level-pill">NÍVEL A1</span>
            {hasPageTour && (
              <button
                type="button"
                className="topbar-tour"
                aria-label="Rever guia desta tela"
                onClick={() => setTourReplayToken((value) => value + 1)}
              >
                <CircleHelp size={16} /> <span>Ver guia</span>
              </button>
            )}
            {featureFlags.AI_TUTOR && (
              <button className="topbar-tutor" onClick={() => setTutorOpen(true)}>
                <Sparkles size={16} /> Perguntar ao professor
              </button>
            )}
            <Link href="/settings" className="avatar" aria-label="Configurações">
              N
            </Link>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
      {featureFlags.AI_TUTOR && (
        <TutorDrawer open={tutorOpen} onClose={() => setTutorOpen(false)} />
      )}
      <SelectionAudio />
      <PageTour pathname={pathname} replayToken={tourReplayToken} onOpenChange={setTourOpen} />
      {featureFlags.AI_TUTOR && <WhatsNewDialog userId={authUserId} enabled={!tourOpen} />}
    </div>
  );
}
