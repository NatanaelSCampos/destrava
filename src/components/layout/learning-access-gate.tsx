"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useStudy } from "@/components/study-provider";
import { LearningAccessCard } from "@/components/activities/learning-access-card";
export function LearningAccessGate({ children }: { children: ReactNode }) {
  const { course, learningAccess } = useStudy();
  const pathname = usePathname();
  const prefix = "/course/" + course.slug + "/unit/";
  const slug = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length).split("/")[0]
    : undefined;
  const unit = course.units.find((u) => u.slug === slug || String(u.number) === slug);
  // A chapter overview explains its lock; actual lesson routes remain guarded.
  const isLearningRoute =
    pathname.startsWith(prefix) &&
    pathname.slice(prefix.length).split("/").filter(Boolean).length > 1;
  if (isLearningRoute && unit?.access && !learningAccess?.units[unit.id]?.allowed)
    return (
      <LearningAccessCard decision={learningAccess?.units[unit.id]} title="Um passo de cada vez" />
    );
  return <>{children}</>;
}
