"use client";
import { useEffect, useRef, useState } from "react";
import { useStudy } from "@/components/study-provider";
import { deferredRecoveryStatus } from "@/domain/study/deferred-recovery";
import { ExerciseCard } from "./exercise-card";
import { LessonSupport } from "./lesson-support";

export function DeferredRecovery({ activityId }: { activityId: string }) {
  const { course, state } = useStudy();
  const lesson = course.units.flatMap(unit => unit.lessons).find(item =>
    item.activities.some(activity => activity.id === activityId));
  const candidates = lesson ? deferredRecoveryStatus(lesson, state).filter(item =>
    !course.availability?.unavailableActivityIds.includes(item.activity.id)) : [];
  const [selected, setSelected] = useState<(typeof candidates)[number] | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (selected) heading.current?.focus(); }, [selected]);
  if (!lesson || (!selected && !candidates.length)) return null;
  return <section className="deferred-recovery" aria-label="Retomar uma ideia em outra situação">
    <h3 ref={heading} tabIndex={-1}>Vamos reencontrar esta ideia?</h3>
    <p>Depois de outras atividades, tente uma nova situação. A primeira tentativa e esta prática ficam registradas separadamente.</p>
    {!selected ? <button type="button" className="secondary-button" onClick={() => setSelected(candidates[0])}>Tentar uma nova situação</button> : <>
      <h4>{selected.activity.title}</h4>
      {!selected.activity.scene && <p>{selected.activity.prompt}</p>}
      <LessonSupport lesson={lesson} activity={selected.activity} unavailableActivityIds={course.availability?.unavailableActivityIds} />
      <ExerciseCard key={selected.activity.id} activity={selected.activity as Parameters<typeof ExerciseCard>[0]["activity"]} />
      <p className="muted">Se consultar o apoio, use-o para compreender. Esta retomada não transforma o erro inicial em acerto nem declara domínio.</p>
      <button type="button" className="ghost-button" onClick={() => {
        setSelected(null);
        window.setTimeout(() => document.getElementById("activity-" + activityId)?.focus(), 0);
      }}>Voltar ao percurso</button>
    </>}
  </section>;
}
