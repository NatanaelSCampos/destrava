import type { LanguageResources, VocabularyItem } from "@/content/language-resources";

export function normalizeDictionaryQuery(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, "").trim().toLowerCase();
}

export type DictionaryResult = VocabularyItem & { catalogOnly: boolean };

export function searchDictionary(resources: LanguageResources, query: string): DictionaryResult[] {
  const needle = normalizeDictionaryQuery(query);
  const seen = new Set<string>();
  const results: DictionaryResult[] = [];
  for (const item of resources.vocabulary) {
    const entry = resources.dictionary[item.id];
    const haystack = [item.term, item.translation, item.example, entry?.className,
      ...(entry?.aliases ?? []), ...(entry?.senses.flatMap((sense) => [sense.meaning, sense.example]) ?? [])]
      .filter(Boolean).join(" ");
    if (!needle || normalizeDictionaryQuery(haystack).includes(needle)) {
      results.push({ ...item, catalogOnly: false });
      seen.add(item.id);
    }
  }
  if (needle) for (const [term, entry] of Object.entries(resources.dictionary)) {
    if (seen.has(term) || resources.vocabulary.some((item) => item.id === term)) continue;
    const haystack = [term, entry.className, ...(entry.aliases ?? []),
      ...entry.senses.flatMap((sense) => [sense.meaning, sense.example])].filter(Boolean).join(" ");
    if (normalizeDictionaryQuery(haystack).includes(needle)) {
      results.push({ id: term, term, translation: entry.senses[0]?.meaning ?? "",
        example: entry.senses[0]?.example ?? "", lessonId: "", catalogOnly: true });
    }
  }
  return results;
}
