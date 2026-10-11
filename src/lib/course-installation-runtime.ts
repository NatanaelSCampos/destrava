import "server-only";
import { createClient } from "@supabase/supabase-js";
import { findCourseBundle } from "@/content/course-registry";
import { publicCourse } from "@/content/public";
import { CourseInstallationService } from "@/domain/course-installations/service";
import { InstallationError, type ResolvedSession } from "@/domain/course-installations/contracts";
import {
  SupabaseCourseArtifactStore,
  SupabaseCourseInstallationCatalog,
} from "@/repositories/supabase-course-installations";

/** Server-only integration. No mutation authorizer or test issuer is installed in HTTP runtime. */
export function courseInstallationRuntime() {
  // Until a trusted production approval provider exists, installed runtime is local homologation only.
  if (process.env.NODE_ENV === "production")
    throw new InstallationError("NOT_AUTHORIZED", "resolution");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new InstallationError("CATALOG_FAILED", "resolution");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return new CourseInstallationService({
    catalog: new SupabaseCourseInstallationCatalog(db),
    store: new SupabaseCourseArtifactStore(db),
  });
}

export async function resolveRuntimeCourse(
  courseId: string,
  userId?: string | null,
  versionSessionId?: string,
) {
  if (versionSessionId === undefined) return findCourseBundle(courseId);
  if (!userId) throw new InstallationError("NOT_AUTHORIZED", "session");
  const resolved = await courseInstallationRuntime().resolveSession(userId, versionSessionId);
  if (resolved.session.reference.courseId !== courseId)
    throw new InstallationError("SESSION_CONFLICT", "session");
  return { ...resolved.content.prepared.bundle, versionSession: resolved.session };
}

export function publicVersionSession(resolved: ResolvedSession) {
  const { prepared } = resolved.content;
  const exposed = structuredClone(publicCourse(prepared.bundle.course, prepared.bundle.language));
  for (const unit of exposed.units)
    for (const lesson of unit.lessons)
      for (const activity of lesson.activities) {
        if (activity.type === "listening" && activity.media?.kind === "audio")
          activity.media.url = `/api/course-installations/media?sessionId=${encodeURIComponent(resolved.session.id)}&path=${encodeURIComponent(activity.media.url)}`;
      }
  return { session: resolved.session, course: exposed };
}
