import { spanishRegion } from "@/content/spanish-regions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function userSpanishRegion(userId: string | null) {
  if (!userId) return "general" as const;
  const client = await createSupabaseServerClient();
  if (!client) return "general" as const;
  const { data } = await client
    .from("user_study_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  const state = data?.state as { profile?: { spanishRegion?: unknown } } | null | undefined;
  return spanishRegion(state?.profile?.spanishRegion);
}
