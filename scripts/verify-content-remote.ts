import { createClient } from "@supabase/supabase-js";
import { loadContent } from "./content-loader";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Remote Supabase connection is not configured.");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
for (const { course } of loadContent()) {
  const { data: row, error: courseError } = await db.from("courses")
    .select("id,slug,level").eq("id", course.id).single();
  if (courseError || row?.slug !== course.slug || row.level !== course.framework.exitLevel)
    throw new Error(`Remote course mismatch: ${course.id}`);
  const { count: units, error: unitError } = await db.from("units")
    .select("id", { count: "exact", head: true }).eq("course_id", course.id);
  if (unitError || units !== course.units.length)
    throw new Error(`Remote unit count mismatch: ${course.id}`);
  const unitIds = course.units.map((unit) => unit.id);
  const lessonIds = course.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id));
  const { count: lessons, error: lessonError } = await db.from("lessons")
    .select("id", { count: "exact", head: true }).in("unit_id", unitIds);
  const expectedLessons = lessonIds.length;
  if (lessonError || lessons !== expectedLessons)
    throw new Error(`Remote lesson count mismatch: ${course.id}`);
  const { count: activities, error: activityError } = await db.from("activities")
    .select("id", { count: "exact", head: true }).in("lesson_id", lessonIds);
  const expectedActivities = course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities)).length;
  if (activityError || activities !== expectedActivities)
    throw new Error(`Remote activity count mismatch: ${course.id}`);
  const { count: words, error: wordError } = await db.from("vocabulary_items")
    .select("term", { count: "exact", head: true }).in("unit_id", unitIds);
  const expectedWords = course.lexicon.filter((entry) => entry.lessonId).length;
  if (wordError || words !== expectedWords)
    throw new Error(`Remote vocabulary count mismatch: ${course.id}`);
  console.log(`Remote course verified: ${course.id} (${units} unit, ${lessons} lessons, ${activities} activities, ${words} vocabulary items).`);
}
const { error: profileError } = await db.from("user_course_profiles").select("course_id").limit(0);
if (profileError) throw new Error(`Course profile migration unavailable: ${profileError.message}`);
const { error: eventsError } = await db.from("study_events").select("course_id").limit(0);
if (eventsError) throw new Error(`Course-scoped study events unavailable: ${eventsError.message}`);
console.log("Remote course profile projection is available.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
