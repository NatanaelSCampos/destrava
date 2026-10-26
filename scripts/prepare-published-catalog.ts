import fs from "node:fs";
import path from "node:path";
import { loadContent } from "./content-loader";
import { selectPublishedCourses } from "../src/content/catalog-selection";
import { runtimeBundle } from "../src/content/runtime-package";
import { activitySeedPayload } from "../src/repositories/activity-content-projection";
import { assessmentSeedRows } from "../src/repositories/assessment-content-projection";

const literal = (v: unknown): string =>
  v === undefined || v === null
    ? "NULL"
    : typeof v === "boolean"
      ? String(v)
      : typeof v === "number"
        ? String(v)
        : "'" + (typeof v === "string" ? v : JSON.stringify(v)).replaceAll("'", "''") + "'";
const list = (ids: string[]) => ids.map(literal).join(",");

/** Generates a reviewable, transactional plan. Does not connect to a database. */
export function publishedCatalogPlan(retire: string[], archive: string[] = []) {
  const selection = selectPublishedCourses(
    loadContent(),
    JSON.parse(fs.readFileSync("content/catalog.json", "utf8")),
  );
  const ids = selection.bundles.map((b) => b.course.id);
  if (
    !retire.length ||
    new Set([...ids, ...retire, ...archive]).size !== ids.length + retire.length + archive.length
  )
    throw new Error("Published, retired and archived identities must be distinct");
  const sql: string[] = [
    "BEGIN;",
    "SET LOCAL lock_timeout='5s';",
    "SET LOCAL statement_timeout='120s';",
    "SELECT pg_advisory_xact_lock(26002026);",
    `CREATE TEMP TABLE retired_courses ON COMMIT DROP AS SELECT id FROM public.courses WHERE id IN (${list(retire)});`,
    "CREATE TEMP TABLE retired_units ON COMMIT DROP AS SELECT id FROM public.units WHERE course_id IN (SELECT id FROM retired_courses);",
    "CREATE TEMP TABLE retired_lessons ON COMMIT DROP AS SELECT id FROM public.lessons WHERE unit_id IN (SELECT id FROM retired_units);",
    "CREATE TEMP TABLE retired_activities ON COMMIT DROP AS SELECT id FROM public.activities WHERE lesson_id IN (SELECT id FROM retired_lessons);",
    "CREATE TEMP TABLE retired_assessments ON COMMIT DROP AS SELECT id FROM public.assessments WHERE course_id IN (SELECT id FROM retired_courses);",
    "CREATE TEMP TABLE retired_sessions ON COMMIT DROP AS SELECT id FROM public.study_sessions WHERE unit_id IN (SELECT id FROM retired_units);",
    "CREATE TEMP TABLE retired_attempts ON COMMIT DROP AS SELECT id FROM public.assessment_attempts WHERE assessment_id IN (SELECT id FROM retired_assessments);",
    "DELETE FROM public.exercise_attempts WHERE activity_id IN (SELECT id FROM retired_activities) OR session_id IN (SELECT id FROM retired_sessions) OR assessment_attempt_id IN (SELECT id FROM retired_attempts);",
    "DELETE FROM public.writing_submissions WHERE activity_id IN (SELECT id FROM retired_activities) OR assessment_attempt_id IN (SELECT id FROM retired_attempts);",
    "DELETE FROM public.speaking_submissions WHERE activity_id IN (SELECT id FROM retired_activities);",
    "DELETE FROM public.study_session_activities WHERE activity_id IN (SELECT id FROM retired_activities) OR session_id IN (SELECT id FROM retired_sessions);",
    "DELETE FROM public.study_events WHERE course_id IN (SELECT id FROM retired_courses) OR activity_id IN (SELECT id FROM retired_activities);",
    "DELETE FROM public.interactive_lesson_sessions WHERE course_id IN (SELECT id FROM retired_courses) OR lesson_id IN (SELECT id FROM retired_lessons);",
    "DELETE FROM public.user_activity_progress WHERE activity_id IN (SELECT id FROM retired_activities);",
    "DELETE FROM public.lesson_progress WHERE lesson_id IN (SELECT id FROM retired_lessons);",
    "DELETE FROM public.unit_progress WHERE unit_id IN (SELECT id FROM retired_units);",
    "DELETE FROM public.skill_progress WHERE course_id IN (SELECT id FROM retired_courses);",
    "DELETE FROM public.mistakes WHERE course_id IN (SELECT id FROM retired_courses) OR unit_id IN (SELECT id FROM retired_units) OR activity_id IN (SELECT id FROM retired_activities);",
    "DELETE FROM public.user_vocabulary WHERE vocabulary_item_id IN (SELECT id FROM public.vocabulary_items WHERE unit_id IN (SELECT id FROM retired_units));",
    "DELETE FROM public.assessment_attempts WHERE id IN (SELECT id FROM retired_attempts);",
    "DELETE FROM public.study_sessions WHERE id IN (SELECT id FROM retired_sessions);",
    "DELETE FROM public.user_course_state WHERE course_id IN (SELECT id FROM retired_courses);",
    "DELETE FROM public.user_course_profiles WHERE course_id IN (SELECT id FROM retired_courses);",
    "DELETE FROM public.user_review_targets WHERE course_id IN (SELECT id FROM retired_courses);",
    ...retire.map(
      (id) =>
        `UPDATE public.user_study_state SET state=state #- ARRAY['courses',${literal(id)}] WHERE jsonb_typeof(state->'courses')='object' AND state->'courses' ? ${literal(id)};`,
    ),
    "DELETE FROM public.courses WHERE id IN (SELECT id FROM retired_courses);",
  ];
  if (archive.length) {
    sql.push(
      `UPDATE public.courses SET active=false WHERE id IN (${list(archive)});`,
      `UPDATE public.units SET active=false WHERE course_id IN (${list(archive)});`,
      `UPDATE public.lessons SET active=false WHERE unit_id IN (SELECT id FROM public.units WHERE course_id IN (${list(archive)}));`,
      `UPDATE public.activities SET active=false WHERE lesson_id IN (SELECT l.id FROM public.lessons l JOIN public.units u ON u.id=l.unit_id WHERE u.course_id IN (${list(archive)}));`,
      `UPDATE public.assessments SET active=false WHERE course_id IN (${list(archive)});`,
      `UPDATE public.vocabulary_items SET active=false WHERE unit_id IN (SELECT id FROM public.units WHERE course_id IN (${list(archive)}));`,
    );
  }
  const counts: Record<string, unknown>[] = [];
  function upsert(table: string, row: Record<string, unknown>, parent?: string) {
    const keys = Object.keys(row),
      updates = keys.filter((k) => k !== "id");
    if (parent)
      sql.push(
        `DO $ownership$ BEGIN IF EXISTS(SELECT 1 FROM public.${table} WHERE id=${literal(row.id)} AND ${parent} IS DISTINCT FROM ${literal(row[parent])}) THEN RAISE EXCEPTION 'CATALOG_ID_OWNERSHIP_CONFLICT'; END IF; END $ownership$;`,
      );
    const values = keys.map((k) => literal(row[k]));
    sql.push(
      `INSERT INTO public.${table} (${keys.join(",")}) VALUES (${values.join(",")}) ON CONFLICT(id) DO UPDATE SET ${updates.map((k) => `${k}=EXCLUDED.${k}`).join(",")};`,
    );
  }
  for (const raw of selection.bundles) {
    const { course, coursePackage, resources } = runtimeBundle(raw);
    upsert("courses", {
      id: course.id,
      slug: course.slug,
      title: course.title,
      level: course.level,
      description: course.description,
      active: true,
      content_version: coursePackage.contentVersion,
      assessment_refs: coursePackage.assessmentRefs,
    });
    const normalUnits = course.units.map((u) => u.id),
      normalLessons = course.units.flatMap((u) => u.lessons.map((l) => l.id)),
      normalActivities = course.units.flatMap((u) =>
        u.lessons.flatMap((l) =>
          [...l.activities, ...(l.deferredRecovery?.rules.map((r) => r.activity) ?? [])].map(
            (a) => a.id,
          ),
        ),
      );
    sql.push(
      `UPDATE public.units SET active=false WHERE course_id=${literal(course.id)} AND id NOT IN (${list(normalUnits)});`,
      `UPDATE public.lessons SET active=false WHERE unit_id IN (SELECT id FROM public.units WHERE course_id=${literal(course.id)}) AND id NOT IN (${list(normalLessons)});`,
      `UPDATE public.activities SET active=false WHERE lesson_id IN (SELECT l.id FROM public.lessons l JOIN public.units u ON u.id=l.unit_id WHERE u.course_id=${literal(course.id)}) AND id NOT IN (${list(normalActivities)});`,
    );
    if (coursePackage.assessments.length)
      sql.push(
        `UPDATE public.assessments SET active=false WHERE course_id=${literal(course.id)} AND id NOT IN (${list(coursePackage.assessments.map((a) => a.id))});`,
      );
    else
      sql.push(`UPDATE public.assessments SET active=false WHERE course_id=${literal(course.id)};`);
    sql.push(
      `UPDATE public.units SET number=number+(SELECT coalesce(max(number),0)+1 FROM public.units WHERE course_id=${literal(course.id)}) WHERE course_id=${literal(course.id)};`,
    );
    let activityCount = 0,
      lessonCount = 0;
    const lessonUnits = new Map<string, string>();
    for (const unit of course.units) {
      upsert(
        "units",
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
        "course_id",
      );
      sql.push(
        `UPDATE public.lessons SET position=position+(SELECT coalesce(max(position),0)+1 FROM public.lessons WHERE unit_id=${literal(unit.id)}) WHERE unit_id=${literal(unit.id)};`,
      );
      for (const lesson of unit.lessons) {
        lessonCount++;
        lessonUnits.set(lesson.id, unit.id);
        upsert(
          "lessons",
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
          "unit_id",
        );
        let lessonPosition = 0;
        sql.push(
          `UPDATE public.activities SET position=position+(SELECT coalesce(max(position),0)+1 FROM public.activities WHERE lesson_id=${literal(lesson.id)}) WHERE lesson_id=${literal(lesson.id)};`,
        );
        for (const a of [
          ...lesson.activities,
          ...(lesson.deferredRecovery?.rules.map((r) => r.activity) ?? []),
        ]) {
          activityCount++;
          upsert(
            "activities",
            {
              id: a.id,
              lesson_id: lesson.id,
              type: a.type,
              title: a.title,
              prompt: a.prompt,
              skill: a.skill,
              position: ++lessonPosition,
              estimated_minutes: a.minutes,
              payload: activitySeedPayload(a),
              source_reference: a.source ?? null,
              schema_version: 1,
              active: true,
            },
            "lesson_id",
          );
          // Options are public; answer records remain private and compiled grading uses the package.
          sql.push(`DELETE FROM public.activity_options WHERE activity_id=${literal(a.id)};`);
          if ("options" in a)
            a.options.forEach((label, i) =>
              sql.push(
                `INSERT INTO public.activity_options(activity_id,position,label) VALUES(${literal(a.id)},${i + 1},${literal(label)});`,
              ),
            );
        }
      }
    }
    for (const [i, w] of resources.vocabulary.entries())
      upsert(
        "vocabulary_items",
        {
          id: w.id,
          unit_id: lessonUnits.get(w.lessonId),
          lesson_id: w.lessonId,
          term: w.term,
          translation: w.translation,
          example: w.example,
          position: i + 1,
          active: true,
        },
        "unit_id",
      );
    for (const a of assessmentSeedRows(coursePackage)) {
      const { activityIds, ...row } = a;
      upsert("assessments", row, "course_id");
      sql.push(`DELETE FROM public.assessment_items WHERE assessment_id=${literal(a.id)};`);
      activityIds.forEach((id, i) =>
        sql.push(
          `INSERT INTO public.assessment_items(assessment_id,activity_id,position) VALUES(${literal(a.id)},${literal(id)},${i + 1});`,
        ),
      );
    }
    counts.push({
      courseId: course.id,
      version: course.contentVersion,
      units: course.units.length,
      lessons: lessonCount,
      activities: activityCount,
    });
  }
  sql.push(
    `DO $catalog$ BEGIN IF (SELECT array_agg(id ORDER BY id) FROM public.courses WHERE active) IS DISTINCT FROM ARRAY[${list([...ids].sort())}]::text[] THEN RAISE EXCEPTION 'CATALOG_ACTIVE_SET_MISMATCH'; END IF; END $catalog$;`,
    "NOTIFY pgrst, 'reload schema';",
    "COMMIT;",
  );
  return { sql: sql.join("\n") + "\n", counts, published: ids, retire, archive };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve("scripts/prepare-published-catalog.ts")
) {
  const [output, retired, archived = ""] = process.argv.slice(2);
  if (!output || !retired)
    throw new Error("Usage: prepare-published-catalog.ts output.sql retiredIdsCsv archivedIdsCsv");
  const plan = publishedCatalogPlan(retired.split(","), archived ? archived.split(",") : []);
  fs.writeFileSync(output, plan.sql);
  fs.writeFileSync(output + ".json", JSON.stringify({ ...plan, sql: undefined }, null, 2));
  console.log(JSON.stringify({ ...plan, sql: undefined }));
}
