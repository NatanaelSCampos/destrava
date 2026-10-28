"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useStudy } from "@/components/study-provider";
import { LivingTrailView } from "@/components/trail/living-trail-view";
function CourseTrail() {
  const { courseSlug } = useParams<{ courseSlug: string }>();
  const { course } = useStudy();
  return courseSlug === course.slug ? (
    <LivingTrailView />
  ) : (
    <div className="empty-state">Curso não encontrado.</div>
  );
}
export default function CoursePage() {
  return (
    <Suspense fallback={<div className="page-loading">Abrindo sua trilha…</div>}>
      <CourseTrail />
    </Suspense>
  );
}
