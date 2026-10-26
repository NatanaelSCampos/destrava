import { InteractiveLessonEntry } from "@/components/interactive-lesson/interactive-lesson-entry";
import type { CourseLessonLocation } from "@/lib/course-lesson-navigation";

export default async function CourseGuidedLessonPage({ params }: { params: Promise<CourseLessonLocation> }) {
  return <InteractiveLessonEntry location={await params} />;
}
