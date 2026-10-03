import { loadContent } from "./content-loader";

const bundles = loadContent();
for (const bundle of bundles) {
  const units = bundle.course.units.length;
  const lessons = bundle.course.units.flatMap((unit) => unit.lessons).length;
  const activities = bundle.course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities)).length;
  console.log(`Validated ${bundle.course.id}: ${units} unit(s), ${lessons} lessons, ${activities} activities, ${bundle.course.lexicon.length} lexicon entries.`);
}
