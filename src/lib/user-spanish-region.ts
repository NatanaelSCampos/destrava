import { spanishRegion } from "@/content/spanish-regions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readCourseState, LEGACY_COURSE_ID } from "@/domain/study/course-state-storage";

export async function userSpanishRegion(userId: string | null) {
  if (!userId) return "general" as const;
  const client = await createSupabaseServerClient();
  if (!client) return "general" as const;
  const { data } = await client
    .from("user_course_state")
    .select("state")
    .eq("user_id", userId)
    .eq("course_id", LEGACY_COURSE_ID)
    .maybeSingle();
  const state = data?.state ? readCourseState(data.state, LEGACY_COURSE_ID) : null;
  return spanishRegion(state?.profile.spanishRegion);
}
