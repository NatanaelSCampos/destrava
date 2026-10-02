import { MicroLessonPractice } from "@/components/micro-lesson/micro-lesson-practice";

export default async function MicroLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string | string[] }>;
}) {
  const { activity } = await searchParams;
  return <MicroLessonPractice activityId={typeof activity === "string" ? activity : ""} />;
}
