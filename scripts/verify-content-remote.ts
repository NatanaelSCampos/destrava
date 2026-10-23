import { createClient } from "@supabase/supabase-js";
import { loadContent } from "./content-loader";
import { assessmentActivityIds } from "../src/content/assessment-references";
import { unitLearningPolicySchema } from "../src/content/learning-policies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Remote Supabase connection is not configured.");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
for (const { course } of loadContent()) {
  const { data: row, error: courseError } = await db.from("courses")
    .select("id,slug,level,content_version").eq("id", course.id).single();
  if (courseError || row?.slug !== course.slug || row.level !== course.framework.exitLevel || row.content_version !== course.contentVersion)
    throw new Error(`Remote course mismatch: ${course.id}`);
  const { count: units, error: unitError } = await db.from("units")
    .select("id", { count: "exact", head: true }).eq("course_id", course.id);
  if (unitError || units !== course.units.length)
    throw new Error(`Remote unit count mismatch: ${course.id}`);
  for (const unit of course.units) {
    const { data, error } = await db.from("units").select("learning_policy").eq("id", unit.id).single();
    const parsed = unitLearningPolicySchema.safeParse(data?.learning_policy);
    if (error || !parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(unit.learningPolicy))
      throw new Error(`Remote learning policy mismatch: ${unit.id}`);
  }
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
  for (const assessment of course.assessments) {
    const { data: items, error: itemError } = await db.from("assessment_items")
      .select("activity_id,position").eq("assessment_id", assessment.id).order("position");
    if (itemError || JSON.stringify((items ?? []).map((item) => item.activity_id)) !==
      JSON.stringify(assessmentActivityIds(assessment)))
      throw new Error(`Remote assessment items mismatch: ${assessment.id}`);
    const { data: definition, error: definitionError } = await db.from("assessments")
      .select("purpose,method,passing_score,course_id").eq("id", assessment.id).single();
    if (definitionError || definition?.purpose !== assessment.purpose || definition.method !== assessment.method ||
      definition.course_id !== course.id || definition.passing_score !== Math.round(assessment.passingPolicy.overall * 100))
      throw new Error(`Remote assessment semantics mismatch: ${assessment.id}`);
  }
  console.log(`Remote course verified: ${course.id} (${units} unit, ${lessons} lessons, ${activities} activities, ${words} vocabulary items).`);
}
const { error: profileError } = await db.from("user_course_profiles")
  .select("course_id,learning_preferences,self_reported_level,onboarding_step").limit(0);
if (profileError) throw new Error(`Course profile migration unavailable: ${profileError.message}`);
const { error: eventsError } = await db.from("study_events").select("course_id").limit(0);
if (eventsError) throw new Error(`Course-scoped study events unavailable: ${eventsError.message}`);
const { error: interactiveError } = await db.from("interactive_lesson_sessions")
  .select("id,revision,content_version,runtime_state").limit(0);
if (interactiveError) throw new Error(`Interactive lesson sessions unavailable: ${interactiveError.message}`);
const { data: speakingActivity, error: speakingError } = await db.from("activities")
  .select("id,type").eq("id", "grammar-age-speaking").maybeSingle();
if (speakingError || speakingActivity?.type !== "speaking")
  throw new Error("Interactive lesson speaking activity is not seeded.");
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (publicKey && url) {
  const anonymous = createClient(url, publicKey, { auth: { persistSession: false } });
  const { data: exposed } = await anonymous.from("user_course_profiles").select("user_id").limit(1);
  if (exposed?.length) throw new Error("Anonymous access exposed a course profile.");
  const { data: exposedSessions, error: accessError } = await anonymous.from("interactive_lesson_sessions")
    .select("id").limit(1);
  if (accessError || exposedSessions?.length) throw new Error("Anonymous access to interactive lesson sessions is unsafe.");
}
console.log("Remote course profile, interactive sessions, seeded speaking and anonymous RLS verified.");
const { error: policiesError } = await db.from("unit_progress").select("content_version,participation_percent,policy_state").limit(0);
if (policiesError) throw new Error(`Learning policy projection migration unavailable: ${policiesError.message}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
