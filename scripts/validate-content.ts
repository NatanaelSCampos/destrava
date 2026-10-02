import { frecuenciasA1, vocabularySeed } from "../src/content/frecuencias-a1";

const ids = new Set<string>();
const conceptIds = new Set(frecuenciasA1.learningConcepts.map((concept) => concept.id));
if (conceptIds.size !== frecuenciasA1.learningConcepts.length)
  throw new Error("Duplicate learning concept id.");
let activityCount = 0;
for (const unit of frecuenciasA1.units) {
  for (const lesson of unit.lessons) {
    for (const activity of lesson.activities) {
      if (ids.has(activity.id)) throw new Error(`Duplicate activity id: ${activity.id}`);
      ids.add(activity.id);
      activityCount++;
      for (const conceptId of activity.conceptIds) {
        if (!conceptIds.has(conceptId))
          throw new Error(`Unknown concept ${conceptId} on activity ${activity.id}`);
      }
      if (
        (activity.type === "multiple_choice" || activity.type === "listening") &&
        !activity.options.includes(activity.answer)
      ) {
        throw new Error(`Answer missing from options: ${activity.id}`);
      }
      if (
        activity.type === "ordering" &&
        activity.words.join(" ").length < activity.answer.length - 2
      ) {
        throw new Error(`Ordering words do not form the answer: ${activity.id}`);
      }
    }
  }
}
if (
  vocabularySeed.some(
    (item) =>
      !frecuenciasA1.units.some((unit) =>
        unit.lessons.some((lesson) => lesson.id === item.lessonId),
      ),
  )
) {
  throw new Error("Vocabulary references a missing lesson.");
}
console.log(
  `Validated ${frecuenciasA1.units.length} unit, ${frecuenciasA1.units.reduce((sum, unit) => sum + unit.lessons.length, 0)} lessons, ${activityCount} activities and ${vocabularySeed.length} vocabulary items.`,
);
