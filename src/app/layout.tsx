import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import "./pages.css";
import "./activities.css";
import "./page-tour.css";
import "./learning-text.css";
import { interfacePresentation } from "@/engine/presentation/text";
import { allCourseBundles, defaultCourseId, findCourseBundle } from "@/content/course-registry";
import { publicCourse, publicRequirements } from "@/content/public";
import { StudyProvider } from "@/components/study-provider";
import { AppShell } from "@/components/layout/app-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Destrava - Aprenda. Pratique. Destrave.",
  description: "Aprenda idiomas no seu ritmo, pratique com confiança e destrave sua conversa.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const activeId = (await cookies()).get("destrava-active-course")?.value ?? defaultCourseId;
  const bundle = findCourseBundle(activeId) ?? findCourseBundle(defaultCourseId)!;
  const course = publicCourse(bundle.course, bundle.language);
  const courseOptions = allCourseBundles().map(({ course, language }) => ({
    id: course.id,
    title: course.title,
    language: language.identity.nativeName,
  }));
  return (
    <html
      lang={interfacePresentation.language}
      dir={interfacePresentation.direction}
      className={inter.variable}
    >
      <body>
        <StudyProvider
          key={course.id}
          course={course}
          resources={bundle.resources}
          language={{
            ...bundle.language,
            capabilityRequirements: publicRequirements(bundle.language.capabilityRequirements),
          }}
        >
          <AppShell courseOptions={courseOptions}>{children}</AppShell>
        </StudyProvider>
      </body>
    </html>
  );
}
