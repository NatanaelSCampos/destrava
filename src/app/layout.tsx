import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import "./pages.css";
import "./activities.css";
import "./page-tour.css";
import "./learning-text.css";
import "./report.css";
import { ReportButton } from "@/components/support/report-button";
import { interfacePresentation } from "@/engine/presentation/text";
import { StudyProvider } from "@/components/study-provider";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { resolveApplicationRuntime } from "@/lib/application-course-runtime";
import { RuntimeUnavailablePanel } from "@/components/layout/runtime-unavailable";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Destrava - Aprenda. Pratique. Destrave.",
  description: "Aprenda idiomas no seu ritmo, pratique com confiança e destrave sua conversa.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getAuthenticatedUser();
  const selected = await resolveApplicationRuntime(
    user?.id ?? null,
    (await cookies()).get("destrava-active-course")?.value,
  );
  const { view, context } = selected;
  return (
    <html
      lang={interfacePresentation.language}
      dir={interfacePresentation.direction}
      className={inter.variable}
    >
      <body
        data-runtime-source={selected.source}
        data-course-id={view?.course.id}
        data-content-version={context?.reference.contentVersion ?? view?.course.contentVersion}
        data-version-session={context?.versionSessionId}
        data-installation-id={context?.reference.installationId}
      >
        {view ? (
          <StudyProvider
            key={`${selected.userId ?? "anonymous"}:${selected.source}:${view.course.id}:${context?.reference.artifactHash ?? "compiled"}:${context?.versionSessionId ?? "bootstrap"}`}
            course={view.course}
            resources={view.resources}
            language={view.language}
            runtime={context}
            mountedUserId={selected.userId}
          >
            <AppShell
              courseOptions={selected.courseOptions}
              selectionRevision={selected.selectionRevision}
            >
              {children}
            </AppShell>
          </StudyProvider>
        ) : (
          <RuntimeUnavailablePanel
            courses={selected.courseOptions}
            revision={selected.selectionRevision}
            unavailable={selected.unavailable!}
          />
        )}
        <ReportButton />
      </body>
    </html>
  );
}
