import { createClient } from "@supabase/supabase-js";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey)
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local before seeding.");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function upsert(table: string, rows: Record<string, unknown>[], conflict = "id") {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: conflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function seedCourse(raw: ReturnType<typeof loadContent>[number]) {
  const { course, coursePackage, resources } = runtimeBundle(raw);
  await upsert("courses", [{
    id: course.id, slug: course.slug, title: course.title, level: course.level,
    description: course.description, active: true,
  }]);
  const unitForLesson = new Map<string, string>();
  for (const unit of course.units) {
    await upsert("units", [{
      id: unit.id, course_id: course.id, slug: unit.slug, title: unit.title,
      number: unit.number, description: unit.description, objectives: unit.objectives,
      active: unit.active,
    }]);
    for (const lesson of unit.lessons) {
      unitForLesson.set(lesson.id, unit.id);
      await upsert("lessons", [{
        id: lesson.id, unit_id: unit.id, slug: lesson.slug, title: lesson.title,
        eyebrow: lesson.eyebrow, description: lesson.description, position: lesson.order,
        estimated_minutes: lesson.minutes, active: lesson.active,
      }]);
      for (const [index, activity] of lesson.activities.entries()) {
        const { id, type, title, prompt, skill, minutes, source, explanation, ...specific } = activity;
        const payload = { ...specific } as Record<string, unknown>;
        for (const key of ["answer", "accepted", "fullAnswers", "options", "pairs", "explanation"])
          delete payload[key];
        await upsert("activities", [{
          id, lesson_id: lesson.id, type, title, prompt, skill,
          position: index + 1, estimated_minutes: minutes, payload,
          source_reference: source ?? null, schema_version: 1, active: true,
        }]);
        if ("options" in activity)
          await upsert("activity_options", activity.options.map((label, optionIndex) => ({
            activity_id: id, position: optionIndex + 1, label,
          })), "activity_id,position");
        if ("answer" in activity)
          await upsert("activity_answers", [{
            activity_id: id,
            answer: {
              answer: activity.answer,
              accepted: "accepted" in activity ? activity.accepted : [],
              fullAnswers: "fullAnswers" in activity ? activity.fullAnswers : [],
              explanation: explanation ?? "",
            },
          }], "activity_id");
      }
    }
  }
  for (const [index, word] of resources.vocabulary.entries()) {
    const unitId = unitForLesson.get(word.lessonId);
    if (!unitId) throw new Error(`Vocabulary ${word.id} has unknown lesson ${word.lessonId}`);
    await upsert("vocabulary_items", [{
      id: word.id, unit_id: unitId, lesson_id: word.lessonId,
      term: word.term, translation: word.translation, example: word.example,
      position: index + 1, active: true,
    }]);
  }
  for (const assessment of coursePackage.assessments) {
    if (!assessment.unitId) continue;
    await upsert("assessments", [{
      id: assessment.id, unit_id: assessment.unitId,
      title: `Diagnóstico · ${course.units.find((unit) => unit.id === assessment.unitId)?.title ?? course.title}`,
      passing_score: Math.round(assessment.passingPolicy.overall * 100), active: true,
    }]);
    await upsert("assessment_items", assessment.bank.map((item, index) => ({
      assessment_id: assessment.id, activity_id: item.activityId, position: index + 1,
    })), "assessment_id,activity_id");
  }
  for (const unit of course.units) {
    const finalLesson = unit.lessons.find((lesson) => lesson.activities.some((activity) => activity.type === "quiz"));
    if (!finalLesson) continue;
    const id = `${unit.id}-final`;
    await upsert("assessments", [{
      id, unit_id: unit.id, title: `Avaliação final · ${unit.title}`,
      passing_score: 75, active: true,
    }]);
    await upsert("assessment_items", finalLesson.activities
      .filter((activity) => activity.type !== "quiz")
      .map((activity, index) => ({ assessment_id: id, activity_id: activity.id, position: index + 1 })),
    "assessment_id,activity_id");
  }
  console.log(`Seeded ${course.id}: ${course.units.length} unit(s), ${resources.vocabulary.length} vocabulary items.`);
}

async function main() {
  for (const bundle of loadContent()) await seedCourse(bundle);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
