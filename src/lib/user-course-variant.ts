import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readPersistedCourseState } from "@/domain/study/course-state-storage";
import { resolveVariant } from "@/content/language-variant";
import type { LanguagePackage } from "@/content/contracts";
import type { VariantCourse } from "@/engine/variants/resolution";
import type { ActivityVariant } from "@/content/variant-contracts";
import { findCourseBundle } from "@/content/course-registry";

export async function userCourseVariant(
  userId: string | null,
  courseId: string,
  language: LanguagePackage,
  course: VariantCourse = findCourseBundle(courseId)?.course ?? {},
  activity?: ActivityVariant,
  getClient: typeof createSupabaseServerClient = createSupabaseServerClient,
) {
  if (!userId) return resolveVariant(language, undefined, course, activity);
  const client = await getClient();
  if (!client) throw new Error("Variant preference store unavailable");
  const { data, error } = await client
    .from("user_course_state")
    .select("state")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw new Error("Could not read variant preference");
  let state;
  if (data !== null) state = readPersistedCourseState(data.state, courseId, language.id);
  else {
    const { data: legacy, error: legacyError } = await client
      .from("user_study_state")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();
    if (legacyError) throw new Error("Could not read legacy variant preference");
    state =
      legacy !== null ? readPersistedCourseState(legacy.state, courseId, language.id, true) : null;
  }
  return resolveVariant(language, state?.profile.variantId, course, activity);
}
