import Link from "@/components/navigation-link";
import { cookies } from "next/headers";
import { resolveApplicationRuntime } from "@/lib/application-course-runtime";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { InteractiveClassroom } from "@/components/interactive-lesson/interactive-classroom";
import { curatedInteractiveExamples } from "@/content/interactive-examples";
import "@/app/live-classes/live-classes.css";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { courseInteractiveLesson, courseLessonPath, type CourseLessonLocation } from "@/lib/course-lesson-navigation";
import { learningActionAvailability } from "@/domain/study/learning-action-availability";
import { publicCourse } from "@/content/public";

export async function InteractiveLessonEntry({ requested, location }: { requested?: string; location?: CourseLessonLocation }) {
  const selected = await resolveApplicationRuntime(
    (await getAuthenticatedUser())?.id ?? null,
    (await cookies()).get("destrava-active-course")?.value,
  );
  if (selected.source !== "compiled" || !selected.bundle)
    return (
      <div className="live-empty panel" role="status">
        <h1>Aula particular indisponível neste curso</h1>
        <p>
          O roteiro interativo ainda não está integrado ao conteúdo instalado. Seu progresso foi
          preservado.
        </p>
        <Link href="/dashboard" className="secondary-button">
          Voltar ao estudo
        </Link>
      </div>
    );
  const bundle = selected.bundle;
  const projected = publicCourse(bundle.course, bundle.language);
  const target = location ? courseInteractiveLesson(projected, bundle.coursePackage.interactiveLessons, location) : undefined;
  if (location && !target) return <section className="live-empty panel" role="status">
    <h1>Prática não encontrada nesta lição</h1>
    <p>Confira a unidade no curso atual para continuar.</p>
    <Link className="secondary-button" href={"/course/" + encodeURIComponent(bundle.course.slug)}>Voltar ao curso</Link>
  </section>;
  const definitions = bundle.coursePackage.interactiveLessons.filter((definition) =>
    bundle.course.units.some(
      (unit) =>
        unit.active && !projected.availability?.unavailableUnitIds?.includes(unit.id) &&
        unit.lessons.some(
          (lesson) =>
            lesson.active &&
            lesson.id === definition.lessonId &&
            lesson.interactiveLessonRef === definition.id,
        ),
    ),
  );
  const definition = target?.definition ?? (requested
    ? definitions.find(entry => entry.lessonId === requested || entry.id === requested)
    : definitions[0]);
  if (!definition)
    return (
      <div className="live-empty panel">
        <span className="eyebrow">AULA PARTICULAR</span>
        <h1>Em preparação para este curso</h1>
        <p>
          As aulas particulares aparecem aqui quando o curso tiver um roteiro interativo publicado.
        </p>
        <Link className="primary-button" href={`/course/${bundle.course.slug}`}>
          Voltar ao curso
        </Link>
      </div>
    );
  const media = Object.fromEntries(
    bundle.coursePackage.media.map(({ id, src, type, metadata }) => [id, { src, type, synthetic: metadata?.synthetic === true }]),
  );
  if (!learningActionAvailability(projected, { kind: "interactive", id: definition.id }, { source: "compiled", permitted: true }).eligible ||
    projected.availability?.unavailableInteractiveLessonIds?.includes(definition.id))
    return (
      <div className="live-empty panel" role="status">
        <h1>Aula temporariamente indisponível</h1>
        <p>
          Uma capacidade obrigatória desta aula não está disponível. Seu progresso continua
          preservado.
        </p>
        <Link className="secondary-button" href={`/course/${bundle.course.slug}`}>
          Voltar ao curso
        </Link>
      </div>
    );
  const unitHref = target ? "/course/" + encodeURIComponent(bundle.course.slug) + "/unit/" + target.unit.number : undefined;
  const classroom = <InteractiveClassroom
    key={`${bundle.course.id}:${definition.id}`}
    definition={definition}
    courseId={bundle.course.id}
    contentVersion={bundle.coursePackage.contentVersion}
    media={media}
    curatedExamples={curatedInteractiveExamples(bundle.coursePackage, definition)}
    unitHref={unitHref}
  />;
  if (!target) return classroom;
  const index = target.unit.lessons.findIndex(item => item.id === target.lesson.id);
  const previous = target.unit.lessons[index - 1], next = target.unit.lessons[index + 1];
  return <section className="course-guided-lesson">
    <Link href={unitHref!} className="back-link"><ArrowLeft size={16} /> Voltar à unidade</Link>
    {classroom}
    <nav className="lesson-neighbors" aria-label="Continuar unidade">
      {previous && <Link href={courseLessonPath(bundle.course, target.unit, previous)}><ChevronLeft size={15} /> Lição anterior</Link>}
      {next && <Link href={courseLessonPath(bundle.course, target.unit, next)}>Próxima lição <ChevronRight size={15} /></Link>}
    </nav>
  </section>;
}
