import Link from "next/link";
import { cookies } from "next/headers";
import { defaultCourseId, findCourseBundle } from "@/content/course-registry";
import { InteractiveClassroom } from "@/components/interactive-lesson/interactive-classroom";
import { curatedInteractiveExamples } from "@/content/interactive-examples";
import "./live-classes.css";

export default async function LiveClassesPage({ searchParams }: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const activeId = (await cookies()).get("destrava-active-course")?.value ?? defaultCourseId;
  const bundle = findCourseBundle(activeId) ?? findCourseBundle(defaultCourseId)!;
  const requested = (await searchParams).lesson;
  const definitions = bundle.coursePackage.interactiveLessons.filter((definition) =>
    bundle.course.units.some((unit) => unit.active && unit.lessons.some((lesson) =>
      lesson.active && lesson.id === definition.lessonId && lesson.interactiveLessonRef === definition.id,
    )),
  );
  const definition = definitions.find((entry) => entry.lessonId === requested || entry.id === requested) ?? definitions[0];
  if (!definition) return <div className="live-empty panel">
    <span className="eyebrow">AULA PARTICULAR</span>
    <h1>Em preparação para este curso</h1>
    <p>As aulas particulares aparecem aqui quando o curso tiver um roteiro interativo publicado.</p>
    <Link className="primary-button" href={`/course/${bundle.course.slug}`}>Voltar ao curso</Link>
  </div>;
  const media = Object.fromEntries(bundle.coursePackage.media.map(({ id, src, type }) => [id, { src, type }]));
  return <InteractiveClassroom key={`${bundle.course.id}:${definition.id}`}
    definition={definition} courseId={bundle.course.id}
    contentVersion={bundle.coursePackage.contentVersion} media={media}
    curatedExamples={curatedInteractiveExamples(bundle.coursePackage, definition)} />;
}
