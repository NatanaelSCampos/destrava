import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./pages.css";
import "./activities.css";
import { frecuenciasA1, vocabularySeed } from "@/content/frecuencias-a1";
import { publicCourse } from "@/content/public";
import { StudyProvider } from "@/components/study-provider";
import { AppShell } from "@/components/layout/app-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Destrava - Aprenda. Pratique. Destrave.",
  description: "Aprenda espanhol no seu ritmo, pratique com confiança e destrave sua conversa.",
};

const course = publicCourse(frecuenciasA1);
const vocabularyItems = vocabularySeed.map((item) => ({ ...item }));

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <StudyProvider course={course} vocabularyItems={vocabularyItems}>
          <AppShell>{children}</AppShell>
        </StudyProvider>
      </body>
    </html>
  );
}
