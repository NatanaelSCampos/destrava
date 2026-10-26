"use client";
import {
  learningActionAvailability,
  learningActionForPath,
} from "@/domain/study/learning-action-availability";

import { Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LearningAccessGate } from "./learning-access-gate";
import Link from "@/components/navigation-link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { courseStudyProgress } from "@/domain/study/progress";
import { cx } from "@/lib/utils";
import { TutorDrawer } from "@/components/tutor/tutor-drawer";
import { WhatsNewDialog } from "@/components/layout/whats-new-dialog";
import { PageTour } from "@/components/layout/page-tour";
import { pageTourFor } from "@/content/page-tours";
import { featureFlags } from "@/lib/feature-flags";
import { SelectionAudio } from "@/components/audio/selection-audio";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { canAccessWithMfa } from "@/lib/auth/mfa-access";
import { PedagogicalOnboarding } from "@/components/onboarding/pedagogical-onboarding";
import { StudySyncNotice } from "@/components/study-sync-notice";
import type { RuntimeCourseOption } from "@/lib/installed-runtime-types";
import { CourseTransitionNotice } from "./course-transition-notice";
import { ResponsiveSidebar } from "./responsive-sidebar";

const navigation = (courseSlug: string) => [
  { href: "/dashboard", label: "Visão geral", icon: House },
  { href: `/course/${courseSlug}`, label: "Meu curso", icon: BookOpen },
  { href: "/basics", label: "Fundamentos", icon: CaseUpper },
  { href: "/study", label: "Aula de hoje", icon: Play },
  { href: "/live-classes", label: "Aula guiada", icon: Sparkles },
  { href: "/review", label: "Revisar", icon: RotateCcw },
  { href: "/speaking", label: "Praticar fala", icon: Mic2 },
  { href: "/conversation", label: "Conversar", icon: MessageCircle },
  { href: "/describe", label: "Explicar imagem", icon: ImageIcon },
  { href: "/assessment", label: "Avaliações", icon: ChartNoAxesCombined },
  { href: "/vocabulary", label: "Vocabulário", icon: GraduationCap },
  { href: "/mistakes", label: "Meus erros", icon: NotebookPen },
  { href: "/history", label: "Histórico", icon: Clock3 },
  { href: "/progress", label: "Estatísticas", icon: ChartNoAxesCombined },
];

function isNavActive(href: string, pathname: string) {
  if (href === "/basics" && (pathname === "/alphabet" || pathname === "/numbers")) return true;
  return pathname.startsWith(href) && (href !== "/dashboard" || pathname === href);
}

/** The assessment route is a selector unless the URL explicitly identifies an assessment. */
export function AssessmentAvailabilityGate({ children }: { children: ReactNode }) {
  const { course, runtime } = useStudy();
  const searchParams = useSearchParams();
  const action = learningActionForPath("/assessment", searchParams)!;
  const availability = learningActionAvailability(course, action, {
    source: runtime ? "installed" : "compiled",
    permitted: true,
  });
  if (!availability.eligible)
    return (
      <section className="panel" role="status">
        <h1>Esta avaliação está indisponível no curso atual</h1>
        <p>{availability.reasons.join(" ")} Nenhuma nota será registrada.</p>
        <Link className="secondary-button" href="/assessment">
          Escolher outra avaliação
        </Link>
        <Link className="text-link" href={`/course/${course.slug}`}>
          Consultar meu curso
        </Link>
      </section>
    );
  return <>{children}</>;
}

export function AppShell({
  children,
  courseOptions,
  selectionRevision = 0,
}: {
  children: ReactNode;
  courseOptions: RuntimeCourseOption[];
  selectionRevision?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    course,
    resources,
    language,
    state,
    vocabularyItems,
    ready,
    authUserId,
    flushStudyState,
    runtime,
    progressLoadStatus,
  } = useStudy();
  const [switchingCourse, setSwitchingCourse] = useState(false);
  const [pendingCourseId, setPendingCourseId] = useState("");
  const [finishingOnboarding, setFinishingOnboarding] = useState(false);
  const [courseError, setCourseError] = useState("");
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
  if (progressLoadStatus === "failed")
    return (
      <main className="page-loading">
        <h1>Não foi possível carregar seu progresso</h1>
        <p>Tente novamente para continuar de onde parou.</p>
        <StudySyncNotice />
      </main>
    );
  if (!state.profile.onboarded || finishingOnboarding)
    return (
      <>
        <StudySyncNotice />
        <PedagogicalOnboarding
          courseOptions={courseOptions}
          selectionRevision={selectionRevision}
          onSavingChange={setFinishingOnboarding}
        />
      </>
    );
  const progress = courseStudyProgress(course, state);
  const activityIds = new Set(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id)),
    ),
  );
  const pendingReviews = dueReviewCounts(
    state,
    vocabularyItems,
    new Date(),
    activityIds,
    resources.structures,
  ).total;
  const actionContext = {
    source: runtime ? ("installed" as const) : ("compiled" as const),
    permitted: true,
  };
  const reviewAction = learningActionAvailability(course, { kind: "review" }, actionContext);
  const conversationAction = learningActionAvailability(
    course,
    { kind: "conversation" },
    actionContext,
  );
  const tutorAction = learningActionAvailability(course, { kind: "tutor" }, actionContext);
  const navItems = navigation(course.slug).filter((item) => {
    const action = learningActionForPath(item.href);
    return (
      (!action || learningActionAvailability(course, action, actionContext).eligible) &&
      (item.href !== "/describe" || resources.imageScenes.length > 0) &&
      (item.href !== "/basics" || Object.values(language.modules).some((module) => module.enabled))
    );
  });
  const studyNavCount = navItems.findIndex((item) => item.href === "/vocabulary");
  const activeNav = navItems.find((item) => isNavActive(item.href, pathname));
  const hasPageTour = Boolean(pageTourFor(pathname, Boolean(state.activeSessionId)));
  const pathAction = pathname === "/assessment" ? undefined : learningActionForPath(pathname);
  const pathAvailability = pathAction
    ? learningActionAvailability(course, pathAction, actionContext)
    : undefined;
  const installedBlockedPath =
    (runtime &&
      ["/review", "/speaking", "/conversation", "/describe", "/micro-lesson", "/numbers"].some(
        (path) => pathname === path,
      )) ||
    Boolean(pathAvailability && !pathAvailability.eligible);

  return (
    <div className="app-frame" aria-busy={switchingCourse}>
      {switchingCourse && (
        <CourseTransitionNotice
          title={
            courseOptions.find((option) => option.id === pendingCourseId)?.title ?? course.title
          }
        />
      )}
      {menuOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <ResponsiveSidebar open={menuOpen} setOpen={setMenuOpen}>
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
          {runtime && (
            <div className="course-switcher">
              <small>Versão {runtime.reference.contentVersion}</small>
              <button
                type="button"
                className="text-link"
                data-use-current-version
                disabled={switchingCourse}
                onClick={async () => {
                  setSwitchingCourse(true);
                  setPendingCourseId(course.id);
                  setCourseError("");
                  try {
                    await flushStudyState();
                    const response = await fetch("/api/course/active", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        courseId: course.id,
                        source: "installed",
                        expectedRevision: runtime.selectionRevision,
                        operationId: crypto.randomUUID(),
                      }),
                    });
                    if (!response.ok)
                      throw new Error(
                        "Não foi possível iniciar a versão atual. Recarregue e tente novamente.",
                      );
                    window.location.assign(new URL("/dashboard", window.location.origin).href);
                  } catch (error) {
                    setCourseError(error instanceof Error ? error.message : "Versão indisponível.");
                    setSwitchingCourse(false);
                  }
                }}
              >
                Estudar versão atual
              </button>
              <small>Recarregar mantém esta versão. Use o botão para iniciar a versão ativa.</small>
              {courseError && <small role="alert">{courseError}</small>}
            </div>
          )}
          {courseOptions.length > 1 && (
            <label className="course-switcher">
              Trocar curso
              <select
                data-course-selector
                value={switchingCourse && pendingCourseId ? pendingCourseId : course.id}
                disabled={switchingCourse}
                onChange={async (event) => {
                  const courseId = event.target.value;
                  if (courseId === course.id || switchingCourse) return;
                  setSwitchingCourse(true);
                  setPendingCourseId(courseId);
                  setCourseError("");
                  try {
                    await flushStudyState();
                    const response = await fetch("/api/course/active", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        courseId,
                        source: courseOptions.find((option) => option.id === courseId)?.source,
                        expectedRevision: selectionRevision,
                        operationId: crypto.randomUUID(),
                      }),
                    });
                    if (!response.ok) throw new Error("Não foi possível trocar de curso.");
                    // Reload so the server layout resolves the new course cookie.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.assign("/dashboard");
                  } catch (error) {
                    setCourseError(
                      error instanceof Error ? error.message : "Falha ao trocar de curso.",
                    );
                    setSwitchingCourse(false);
                  }
                }}
              >
                {courseOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title} · {option.language}
                  </option>
                ))}
              </select>
              {courseError && <small role="alert">{courseError}</small>}
            </label>
          )}
          <div className="sidebar-course-progress">
            <span>Conteúdo estudado</span>
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
          {tutorAction.eligible && (
            <button className="sidebar-tutor" onClick={() => {
                setMenuOpen(false);
                setTutorOpen(true);
                window.requestAnimationFrame(() => document.getElementById("tutor-question")?.focus());
              }}>
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
      </ResponsiveSidebar>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-toggle"
              aria-label="Abrir menu"
          aria-expanded={menuOpen}
          aria-controls="study-navigation"
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
            <span className="level-pill">NÍVEL {course.level}</span>
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
            {tutorAction.eligible && (
              <button className="topbar-tutor" onClick={() => {
                setMenuOpen(false);
                setTutorOpen(true);
                window.requestAnimationFrame(() => document.getElementById("tutor-question")?.focus());
              }}>
                <Sparkles size={16} />{" "}
                {tutorAction.operation === "unknown"
                  ? "Perguntar ao professor"
                  : "Perguntar ao professor"}
              </button>
            )}
            <Link href="/settings" className="avatar" aria-label="Configurações">
              N
            </Link>
          </div>
        </header>
        <main className="main-content">
          <LearningAccessGate>
            <StudySyncNotice />
            {installedBlockedPath ? (
              <section className="panel" role="status">
                <span className="eyebrow">RECURSO EM PREPARAÇÃO</span>
                <h1>Este recurso ainda não está disponível neste curso</h1>
                <p>
                  {pathAvailability?.reasons.join(" ") ??
                    "Este caminho não está integrado ao curso atual."}{" "}
                  Nenhuma nota ou progresso será alterado por isso.
                </p>
                <Link className="secondary-button" href={`/course/${course.slug}`}>
                  Continuar meu curso
                </Link>
              </section>
            ) : pathname === "/assessment" ? (
              <Suspense fallback={<div className="page-loading">Verificando avaliação…</div>}>
                <AssessmentAvailabilityGate>{children}</AssessmentAvailabilityGate>
              </Suspense>
            ) : (
              children
            )}
          </LearningAccessGate>
        </main>
      </div>
      <nav className="mobile-primary-nav" aria-label="Atalhos de estudo">
        <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}>
          <House size={20} /> <span>Hoje</span>
        </Link>
        <Link href="/study" aria-current={pathname === "/study" ? "page" : undefined}>
          <Play size={20} /> <span>Aula</span>
        </Link>
        <Link
          href={reviewAction.eligible ? "/review" : "/history"}
          aria-current={
            pathname === (reviewAction.eligible ? "/review" : "/history") ? "page" : undefined
          }
        >
          <RotateCcw size={20} /> <span>{reviewAction.eligible ? "Revisar" : "Histórico"}</span>
        </Link>
        {conversationAction.eligible ? (
          <Link
            href="/conversation"
            aria-current={pathname === "/conversation" ? "page" : undefined}
          >
            <MessageCircle size={20} />{" "}
            <span>
              {conversationAction.operation === "unknown" ? "Conversar" : "Conversar"}
            </span>
          </Link>
        ) : (
          <Link
            href={`/course/${course.slug}`}
            aria-current={pathname.startsWith("/course") ? "page" : undefined}
          >
            <BookOpen size={20} /> <span>Curso</span>
          </Link>
        )}
        <button
          type="button"
          aria-label="Abrir todos os recursos"
          aria-expanded={menuOpen}
          aria-controls="study-navigation"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} /> <span>Mais</span>
        </button>
      </nav>
      {tutorAction.eligible && <TutorDrawer open={tutorOpen} onClose={() => setTutorOpen(false)} />}
      <SelectionAudio />
      <PageTour pathname={pathname} replayToken={tourReplayToken} onOpenChange={setTourOpen} />
      <WhatsNewDialog userId={authUserId} enabled={!tourOpen} />
    </div>
  );
}
