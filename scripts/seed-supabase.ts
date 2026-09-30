import { createClient } from "@supabase/supabase-js";
import { frecuenciasA1, vocabularySeed } from "../src/content/frecuencias-a1";

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

async function main() {
  await upsert("courses", [
    {
      id: frecuenciasA1.id,
      slug: frecuenciasA1.slug,
      title: frecuenciasA1.title,
      level: frecuenciasA1.level,
      description: frecuenciasA1.description,
      active: true,
    },
  ]);
  for (const unit of frecuenciasA1.units) {
    await upsert("units", [
      {
        id: unit.id,
        course_id: frecuenciasA1.id,
        slug: unit.slug,
        title: unit.title,
        number: unit.number,
        description: unit.description,
        objectives: unit.objectives,
        active: unit.active,
      },
    ]);
    for (const lesson of unit.lessons) {
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
      for (const [index, activity] of lesson.activities.entries()) {
        const { id, type, title, prompt, skill, minutes, source, explanation, ...specific } =
          activity;
        const payload = { ...specific } as Record<string, unknown>;
        delete payload.answer;
        delete payload.accepted;
        delete payload.options;
        delete payload.pairs;
        delete payload.explanation;
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
        if ("answer" in activity)
          await upsert(
            "activity_answers",
            [
              {
                activity_id: id,
                answer: {
                  answer: activity.answer,
                  accepted: "accepted" in activity ? activity.accepted : [],
                  explanation: explanation ?? "",
                },
              },
            ],
            "activity_id",
          );
      }
    }
  }

  const firstUnit = frecuenciasA1.units[0];
  for (const [index, item] of vocabularySeed.entries()) {
    await upsert("vocabulary_items", [
      {
        id: item.id,
        unit_id: firstUnit.id,
        lesson_id: item.lessonId,
        spanish: item.spanish,
        translation: item.translation,
        example: item.example,
        position: index + 1,
        active: true,
      },
    ]);
  }
  for (const unit of frecuenciasA1.units) {
    const assessmentLesson = unit.lessons.find((lesson) =>
      lesson.activities.some((activity) => activity.type === "quiz"),
    );
    if (!assessmentLesson) continue;
    const assessmentId = `${unit.id}-final`;
    await upsert("assessments", [
      {
        id: assessmentId,
        unit_id: unit.id,
        title: `Avaliação final · ${unit.title}`,
        passing_score: 75,
        active: true,
      },
    ]);
    await upsert(
      "assessment_items",
      assessmentLesson.activities
        .filter((activity) => activity.type !== "quiz")
        .map((activity, index) => ({
          assessment_id: assessmentId,
          activity_id: activity.id,
          position: index + 1,
        })),
      "assessment_id,activity_id",
    );
  }

  console.log(
    `Imported ${frecuenciasA1.units.length} unit(s), ${firstUnit.lessons.length} lessons and ${vocabularySeed.length} vocabulary items.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
