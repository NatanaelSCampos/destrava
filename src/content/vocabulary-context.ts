import type { PublicCourse } from "./public";
import { regionalVocabularyNote, type SpanishRegion } from "./spanish-regions";

export type VocabularySense = {
  meaning: string;
  example: string;
};

type Context = { className?: string; senses: VocabularySense[]; regionalNote?: string };

const spanishContext: Record<string, Context> = {
  tener: {
    className: "Verbo",
    senses: [
      { meaning: "ter ou possuir", example: "Tengo un libro en casa." },
      { meaning: "indicar idade", example: "Tengo 27 años." },
      { meaning: "expressar necessidade ou sensação", example: "Tengo hambre." },
    ],
  },
  vivir: {
    className: "Verbo",
    senses: [
      { meaning: "morar em algum lugar", example: "Vivo en Lima." },
      { meaning: "viver ou experimentar", example: "Vivimos un momento especial." },
    ],
  },
  hablar: {
    className: "Verbo",
    senses: [
      { meaning: "falar um idioma", example: "Hablo español y portugués." },
      { meaning: "conversar com alguém", example: "Hablo con Ana por teléfono." },
    ],
  },
  llamarse: {
    className: "Verbo pronominal",
    senses: [{ meaning: "chamar-se; dizer seu nome", example: "Me llamo Elena." }],
  },
};

export function vocabularyContext(
  word: { id: string; translation: string; example: string },
  languageCode: string,
  region: SpanishRegion = "general",
): Context {
  const base =
    languageCode === "es" && spanishContext[word.id]
      ? spanishContext[word.id]
      : { senses: [{ meaning: word.translation, example: word.example }] };
  if (languageCode !== "es") return base;
  const regionalNote =
    word.id === "llamarse" && region === "argentina"
      ? "Na Argentina, a pergunta informal costuma ser ‘¿Cómo te llamás vos?’. O curso apresenta ‘¿Cómo te llamas tú?’ como base."
      : regionalVocabularyNote(word.id, region);
  return { ...base, regionalNote };
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function vocabularyOccurrences(
  course: PublicCourse,
  word: { spanish: string; lessonId: string },
): Array<{ title: string; href: string }> {
  const term = normalized(
    word.spanish
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
