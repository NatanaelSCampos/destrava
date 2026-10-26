import { createClient } from "@supabase/supabase-js";
import { loadContent } from "./content-loader";
import { readFileSync } from "node:fs";
import { selectPublishedCourses } from "../src/content/catalog-selection";
import { runtimeBundle } from "../src/content/runtime-package";
import { assessmentSeedRows } from "../src/repositories/assessment-content-projection";
import { activitySeedPayload } from "../src/repositories/activity-content-projection";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey)
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local before seeding.",
  );
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function upsert(table: string, rows: Record<string, unknown>[], conflict = "id") {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: conflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function syncAssessmentItems(assessmentId: string, activityIds: string[]) {
  const { data: existing, error: readError } = await db
    .from("assessment_items")
    .select("activity_id,position")
    .eq("assessment_id", assessmentId);
  if (readError) throw new Error(`assessment_items: ${readError.message}`);
  const rows = existing ?? [];
  if (
    JSON.stringify(
      [...rows].sort((a, b) => a.position - b.position).map((row) => row.activity_id),
    ) === JSON.stringify(activityIds)
  )
    return;
  const maxPosition = Math.max(activityIds.length, 0, ...rows.map((row) => row.position));
  // The table also has a unique (assessment_id, position) constraint. Move
  // existing rows out of the way before reordering by activity id.
  for (const [index, row] of rows.entries()) {
    const { error } = await db
      .from("assessment_items")
      .update({ position: maxPosition + rows.length + index + 1 })
      .eq("assessment_id", assessmentId)
      .eq("activity_id", row.activity_id);
    if (error) throw new Error(`assessment_items: ${error.message}`);
  }
  await upsert(
    "assessment_items",
    activityIds.map((activityId, index) => ({
      assessment_id: assessmentId,
      activity_id: activityId,
      position: index + 1,
    })),
    "assessment_id,activity_id",
  );
  const wanted = new Set(activityIds);
  for (const row of rows.filter((row) => !wanted.has(row.activity_id))) {
    const { error } = await db
      .from("assessment_items")
      .delete()
      .eq("assessment_id", assessmentId)
      .eq("activity_id", row.activity_id);
    if (error) throw new Error(`assessment_items: ${error.message}`);
  }
}

async function seedCourse(raw: ReturnType<typeof loadContent>[number]) {
  const { course, coursePackage, resources } = runtimeBundle(raw);
  await upsert("courses", [
    {
      id: course.id,
      slug: course.slug,
      title: course.title,
      level: course.level,
      description: course.description,
      active: true,
      content_version: coursePackage.contentVersion,
      assessment_refs: coursePackage.assessmentRefs,
    },
  ]);
  const unitForLesson = new Map<string, string>();
  for (const unit of course.units) {
    await upsert("units", [
      {
        id: unit.id,
        course_id: course.id,
        slug: unit.slug,
        title: unit.title,
        number: unit.number,
        description: unit.description,
        objectives: unit.objectives,
        active: unit.active,
        assessment_refs: unit.assessmentRefs,
        learning_policy: unit.learningPolicy,
      },
    ]);
    for (const lesson of unit.lessons) {
      unitForLesson.set(lesson.id, unit.id);
      await upsert("lessons", [
        {
          id: lesson.id,
          unit_id: unit.id,
          slug: lesson.slug,
          title: lesson.title,
          eyebrow: lesson.eyebrow,
          description: lesson.description,
          position: lesson.order,
          estimated_minutes: lesson.minutes,
          active: lesson.active,
        },
      ]);
      for (const [index, activity] of [
        ...lesson.activities,
        ...(lesson.deferredRecovery?.rules.map((rule) => rule.activity) ?? []),
      ].entries()) {
        const { id, type, title, prompt, skill, minutes, source, explanation } = activity;
        const payload = activitySeedPayload(activity);
        await upsert("activities", [
          {
            id,
            lesson_id: lesson.id,
            type,
            title,
            prompt,
            skill,
            position: index + 1,
            estimated_minutes: minutes,
            payload,
            source_reference: source ?? null,
            schema_version: 1,
            active: true,
          },
        ]);
        if ("options" in activity)
          await upsert(
            "activity_options",
            activity.options.map((label, optionIndex) => ({
              activity_id: id,
              position: optionIndex + 1,
              label,
            })),
            "activity_id,position",
          );
        if ("answer" in activity || activity.answerPolicy)
          await upsert(
            "activity_answers",
            [
              {
                activity_id: id,
                answer: {
                  answer: "answer" in activity ? activity.answer : "",
                  ...(activity.answerPolicy ? { answerPolicy: activity.answerPolicy } : {}),
                  ...(activity.type === "ordering" && activity.answerOrder
                    ? { answerOrder: activity.answerOrder }
                    : {}),
                  accepted: "accepted" in activity ? activity.accepted : [],
                  fullAnswers: "fullAnswers" in activity ? activity.fullAnswers : [],
                  explanation: explanation ?? "",
                },
              },
            ],
            "activity_id",
          );
      }
    }
  }
  for (const [index, word] of resources.vocabulary.entries()) {
    const unitId = unitForLesson.get(word.lessonId);
    if (!unitId) throw new Error(`Vocabulary ${word.id} has unknown lesson ${word.lessonId}`);
    await upsert("vocabulary_items", [
      {
        id: word.id,
        unit_id: unitId,
        lesson_id: word.lessonId,
        term: word.term,
        translation: word.translation,
        example: word.example,
        position: index + 1,
        active: true,
      },
    ]);
  }
  for (const row of assessmentSeedRows(coursePackage)) {
    const { activityIds, ...assessment } = row;
    await upsert("assessments", [assessment]);
    await syncAssessmentItems(assessment.id, activityIds);
  }
  console.log(
    `Seeded ${course.id}: ${course.units.length} unit(s), ${resources.vocabulary.length} vocabulary items.`,
  );
}

async function main() {
  const catalog = selectPublishedCourses(
    loadContent(),
    JSON.parse(readFileSync("content/catalog.json", "utf8")),
  );
  for (const bundle of catalog.bundles) await seedCourse(bundle);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
