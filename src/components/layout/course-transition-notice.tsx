export function CourseTransitionNotice({ title }: { title: string }) {
  return (
    <div className="course-transition-notice" role="status" aria-live="polite">
      <strong>Abrindo {title}…</strong>
      <span>Salvando seu progresso e preparando o curso. Aguarde um instante.</span>
    </div>
  );
}
