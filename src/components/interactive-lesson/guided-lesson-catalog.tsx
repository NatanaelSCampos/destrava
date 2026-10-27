"use client";
import Link from "@/components/navigation-link";
import { useStudy } from "@/components/study-provider";
import { ArrowRight, BookOpen, Clock3, LockKeyhole, Play, Sparkles } from "lucide-react";
import { guidedLessonCatalog, type GuidedCatalogDefinition } from "@/domain/interactive-lesson/catalog";

export function GuidedLessonCatalog({ definitions }: { definitions: GuidedCatalogDefinition[] }) {
  const { course, learningAccess } = useStudy();
  const entries = guidedLessonCatalog(course, definitions, learningAccess);
  return <section className="guided-catalog lesson-experience">
    <header className="guided-catalog-heading"><span className="eyebrow"><Sparkles size={14} /> AULAS GUIADAS</span>
      <h1>Ouça, acompanhe e pratique.</h1>
      <p>Escolha uma aula de {course.title}. A explicação tem voz, um quadro visual e espaço para pausar.</p>
      <Link className="back-link" href={"/course/" + encodeURIComponent(course.slug)}><BookOpen size={16} /> Ver meu curso</Link>
    </header>
    {entries.length ? <div className="guided-catalog-grid">{entries.map(entry => <article key={entry.id}
      className={"guided-catalog-card" + (entry.available ? "" : " is-unavailable")}>
      <div className="guided-catalog-art" aria-hidden="true"><span><BookOpen size={30} /></span>
        <svg viewBox="0 0 180 88" focusable="false"><path d="M24 44h38m12 0h34m12 0h36" />
          <rect x="8" y="24" width="44" height="40" rx="10" /><rect x="68" y="14" width="44" height="60" rx="10" /><rect x="128" y="24" width="44" height="40" rx="10" />
          <path d="m24 43 5 5 9-11m44 4h16m-16 8h12m54-5h12" /></svg></div>
      <div className="guided-catalog-card-body"><span className="eyebrow">UNIDADE {entry.unitNumber} · {entry.unitTitle}</span>
        <h2>{entry.title}</h2><p>{entry.description}</p>
        <div className="guided-catalog-meta"><span><Clock3 size={14} /> Cerca de {entry.estimatedMinutes} min</span><span>Áudio e quadro</span></div>
        {entry.available ? <Link className="guided-catalog-open" href={entry.href}><Play size={15} /> Abrir aula <ArrowRight size={16} /></Link>
          : <div className="guided-catalog-locked" role="status"><LockKeyhole size={16} /><span>{entry.message}</span></div>}
      </div>
    </article>)}</div> : <div className="live-empty panel" role="status"><h2>Aulas em preparação</h2><p>As aulas publicadas neste curso aparecerão aqui.</p></div>}
  </section>;
}
