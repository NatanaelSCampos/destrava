import "server-only";
import { createClient } from "@supabase/supabase-js";
import { findCourseBundle } from "@/content/course-registry";
import { InstalledStudyService } from "@/domain/installed-study/service";
import { SupabaseInstalledStudyCatalog } from "@/repositories/supabase-installed-study";
import { courseInstallationRuntime } from "@/lib/course-installation-runtime";
import { assertInstalledRuntimeScope } from "@/lib/installed-runtime-scope";

/** Learner read/write service, never an approval/activation issuer. */
export function installedStudyPorts() {
  assertInstalledRuntimeScope();
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const catalog = new SupabaseInstalledStudyCatalog(db);
  const installations = courseInstallationRuntime();
  const study = new InstalledStudyService({
    catalog,
    installations,
    compiledCourseExists: (id) => Boolean(findCourseBundle(id)),
  });
  return { study, catalog, installations };
}
export function installedStudyRuntime() {
  return installedStudyPorts().study;
}
