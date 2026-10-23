import type { CoursePackage, InteractiveLessonDefinition } from "./contracts";

export type CuratedExample = { conceptId: string; text: string; translation: string };

export function curatedInteractiveExamples(course: CoursePackage, definition: InteractiveLessonDefinition): CuratedExample[] {
  const source = course.sourceLanguage;
  const examples: CuratedExample[] = [];
  for (const conceptId of definition.concepts) {
    const concept = course.concepts.find((item) => item.id === conceptId);
    for (const entry of concept?.examples ?? []) {
      const translation = entry.translations[source];
      if (translation) examples.push({ conceptId, text: entry.target, translation });
    }
  }
  for (const word of course.lexicon.filter((entry) => entry.lessonId === definition.lessonId)) {
    for (const entry of word.examples ?? []) {
      const translation = entry.translations[source];
      if (translation) examples.push({ conceptId: definition.concepts[0] ?? word.id, text: entry.target, translation });
    }
  }
  examples.push(...definition.alternativeExamples);
  return examples.filter((entry, index) => examples.findIndex((item) => item.text === entry.text) === index);
}
