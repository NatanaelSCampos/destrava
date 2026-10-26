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
  if (unit?.access && !learningAccess?.units[unit.id]?.allowed)
    return (
      <LearningAccessCard
        decision={learningAccess?.units[unit.id]}
        title="Uma unidade de cada vez"
      />
    );
  return <>{children}</>;
}
