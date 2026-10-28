"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useStudy } from "@/components/study-provider";
import { LivingTrailView } from "@/components/trail/living-trail-view";
function ChapterTrail() {
  const { courseSlug, unitSlug } = useParams<{ courseSlug: string; unitSlug: string }>();
  const { course } = useStudy();
  return courseSlug === course.slug ? (
    <LivingTrailView unitSlug={unitSlug} />
  ) : (
    <div className="empty-state">Capítulo não encontrado.</div>
  );
}
export default function UnitPage() {
  return (
    <Suspense fallback={<div className="page-loading">Abrindo seu capítulo…</div>}>
      <ChapterTrail />
    </Suspense>
  );
}
