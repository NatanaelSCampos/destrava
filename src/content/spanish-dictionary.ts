import type { DictionaryEntry } from "./language-resources";

export const spanishDictionary: Record<string, DictionaryEntry> = {
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
