import type { VisualCue } from "@/content/visual-vocabulary";

export type WordCard = {
  front: string;
  back: string;
  frontLabel: string;
  backLabel: string;
  spokenText: string;
  example: string;
  presentation: "standard" | "reverse" | "audio" | "cloze" | "image";
  visual?: VisualCue;
};

function cloze(word: string, example: string, additionalForms: string[] = []) {
  const forms = [
    ...word.split("/").map((form) => form.trim().replace(/^[¿¡]/, "").replace(/[?!]$/, "")),
    ...additionalForms,
  ];
  for (const form of forms) {
    if (!form) continue;
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "iu").exec(example);
    if (match)
      return {
        sentence:
          example.slice(0, match.index) + "_____" + example.slice(match.index + match[0].length),
        answer: match[0],
      };
  }
  return null;
}

export function wordReviewCard(
  word: { spanish: string; translation: string; example: string },
  reviewCount: number,
  options: { visual?: VisualCue; clozeForms?: string[] } = {},
): WordCard {
  const position = reviewCount % (options.visual ? 5 : 4);
  if (options.visual && (reviewCount === 0 || position === 4))
    return {
      front: "Que palavra ou expressão esta figura representa?",
      back: `${word.spanish} · ${word.translation}`,
      frontLabel: "FIGURA → TERMO",
      backLabel: "ESPANHOL",
      spokenText: word.spanish,
      example: word.example,
      presentation: "image",
      visual: options.visual,
    };
  if (reviewCount > 0 && position === 3) {
    const found = cloze(word.spanish, word.example, options.clozeForms);
    if (found)
      return {
        front: found.sentence,
        back: `${found.answer} · ${word.translation}`,
        frontLabel: "COMPLETE A FRASE",
        backLabel: "PALAVRA ESPERADA",
        spokenText: found.answer,
        example: word.example,
        presentation: "cloze",
      };
  }
  if (reviewCount > 0 && position === 1)
    return {
      front: word.translation,
      back: word.spanish,
      frontLabel: "PORTUGUÊS",
      backLabel: "ESPANHOL",
      spokenText: word.spanish,
      example: word.example,
      presentation: "reverse",
    };
  if (reviewCount > 0 && position === 2)
    return {
      front: "Ouça e tente reconhecer a palavra ou expressão.",
      back: `${word.spanish} · ${word.translation}`,
      frontLabel: "ESCUTA",
      backLabel: "RESPOSTA",
      spokenText: word.spanish,
      example: word.example,
      presentation: "audio",
    };
  return {
    front: word.spanish,
    back: word.translation,
    frontLabel: "ESPANHOL",
    backLabel: "PORTUGUÊS",
    spokenText: word.spanish,
    example: word.example,
    presentation: "standard",
  };
}
