import type { PublicCourse } from "./public";
import type { DictionaryEntry } from "./language-resources";

export type VocabularySense = {
  meaning: string;
  example: string;
};

type Context = { className?: string; senses: VocabularySense[]; regionalNote?: string };



export function vocabularyContext(
  word: { id: string; translation: string; example: string },
  dictionary: Record<string, DictionaryEntry>,
  region = "general",
): Context {
  const entry = dictionary[word.id];
  if (!entry) return { senses: [{ meaning: word.translation, example: word.example }] };
  return {
    className: entry.className,
    senses: entry.senses,
    regionalNote: typeof entry.regionalNote === "string"
      ? entry.regionalNote
      : entry.regionalNote?.[region] ?? entry.regionalNote?.general,
  };
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function vocabularyOccurrences(
  course: PublicCourse,
  word: { term: string; lessonId: string },
): Array<{ title: string; href: string }> {
  const term = normalized(
    word.term
      .split("/")[0]
      .replace(/[¿?¡!]/g, "")
      .trim(),
  );
  const results: Array<{ title: string; href: string }> = [];
  for (const unit of course.units) {
    for (const lesson of unit.lessons) {
      if (lesson.id === word.lessonId)
        results.push({
          title: `Unidade ${unit.number} · ${lesson.title}`,
          href: `/course/${course.slug}/unit/${unit.number}/lesson/${lesson.slug}`,
        });
      for (const activity of lesson.activities) {
        const text = [
          activity.prompt,
          "body" in activity ? activity.body : "",
          "referenceText" in activity ? activity.referenceText : "",
          "transcript" in activity ? activity.transcript : "",
        ].join(" ");
        if (term && normalized(text).includes(term))
          results.push({
            title: activity.title,
            href: `/course/${course.slug}/unit/${unit.number}/lesson/${lesson.slug}?activity=${encodeURIComponent(activity.id)}`,
          });
      }
    }
  }
  return results;
}
