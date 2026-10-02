export type WordCard = {
  front: string;
  back: string;
  frontLabel: string;
  backLabel: string;
  spokenText: string;
  example: string;
  presentation: "standard" | "reverse" | "audio" | "cloze";
};

function cloze(word: string, example: string) {
  const forms = word
    .split("/")
    .map((form) => form.trim().replace(/^[¿¡]/, "").replace(/[?!]$/, ""));
  for (const form of forms) {
    if (!form) continue;
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "iu").exec(example);
    if (match)
      return example.slice(0, match.index) + "_____" + example.slice(match.index + match[0].length);
  }
  return null;
}

export function wordReviewCard(
  word: { spanish: string; translation: string; example: string },
  reviewCount: number,
): WordCard {
  if (reviewCount > 0 && reviewCount % 4 === 3) {
    const sentence = cloze(word.spanish, word.example);
    if (sentence)
      return {
        front: sentence,
        back: `${word.spanish} · ${word.translation}`,
        frontLabel: "COMPLETE A FRASE",
        backLabel: "PALAVRA ESPERADA",
        spokenText: word.spanish,
        example: word.example,
        presentation: "cloze",
      };
  }
  if (reviewCount > 0 && reviewCount % 4 === 1)
    return {
      front: word.translation,
      back: word.spanish,
      frontLabel: "PORTUGUÊS",
      backLabel: "ESPANHOL",
      spokenText: word.spanish,
      example: word.example,
      presentation: "reverse",
    };
  if (reviewCount > 0 && reviewCount % 4 === 2)
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
