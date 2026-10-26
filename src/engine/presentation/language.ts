/** Resolve the declared language for presentation without changing package identity. */
export function presentationLanguage(language: {
  id: string;
  identity?: { iso639_1?: string; iso639_3?: string };
}): string {
  return (
    language.identity?.iso639_1?.trim() ||
    language.identity?.iso639_3?.trim() ||
    language.id
  );
}
