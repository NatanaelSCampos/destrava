import { InteractiveLessonEntry } from "@/components/interactive-lesson/interactive-lesson-entry";

export default async function LiveClassesPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  return <InteractiveLessonEntry requested={(await searchParams).lesson} />;
}
