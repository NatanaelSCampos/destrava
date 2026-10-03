import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readCourseState } from "@/domain/study/course-state-storage";
import { resolveVariant } from "@/content/language-variant";
import type { LanguagePackage } from "@/content/contracts";

export async function userCourseVariant(
  userId: string | null,
  courseId: string,
  language: LanguagePackage,
) {
  if (!userId) return language.speech.defaultVariant;
  const client = await createSupabaseServerClient();
  if (!client) return language.speech.defaultVariant;
  const { data } = await client.from("user_course_state").select("state")
    .eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  const state = data?.state ? readCourseState(data.state, courseId, language.id) : null;
  return resolveVariant(language, state?.profile.variantId);
}
