"use client";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "@/components/navigation-link";
import { useLivingTrail } from "./use-living-trail";
import { useStudy } from "@/components/study-provider";
import { trailReturnHref } from "@/lib/trail-location";
export function TrailReturn({
  lessonId,
  assessmentId,
  unitId,
}: {
  lessonId?: string;
  assessmentId?: string;
  unitId?: string;
}) {
  const { trail } = useLivingTrail();
  const { course } = useStudy();
  const search = useSearchParams();
  const candidates = trail.chapters
    .flatMap((chapter) => chapter.moments.map((moment) => ({ chapter, moment })))
    .filter(
      ({ chapter, moment }) =>
        (!unitId || chapter.unitId === unitId) &&
        (lessonId
          ? moment.lessonId === lessonId
          : assessmentId
            ? moment.assessmentId === assessmentId
            : true),
    );
  const current =
    candidates.find(
      ({ moment }) =>
        search.get("activity") && moment.activityIds.includes(search.get("activity")!),
    ) ??
    candidates.find(({ moment }) => moment.id === search.get("moment")) ??
    candidates.find(({ moment }) => moment.id === trail.currentMomentId) ??
    candidates[0];
  return (
    <Link
      className="back-link tv-return"
      href={
        current
          ? trailReturnHref(course.slug, current.chapter.number, current.moment.id)
          : "/course/" + course.slug
      }
    >
      <ArrowLeft size={16} aria-hidden="true" /> Voltar à minha trilha
    </Link>
  );
}
