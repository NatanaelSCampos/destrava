export type WordCard = {
  front: string;
  back: string;
  frontLabel: string;
  backLabel: string;
  spokenText: string;
  example: string;
};

export function wordReviewCard(
  word: { spanish: string; translation: string; example: string },
  reviewCount: number,
): WordCard {
  if (reviewCount > 0 && reviewCount % 3 === 1)
    return {
      front: word.translation,
      back: word.spanish,
      frontLabel: "PORTUGUÊS",
      backLabel: "ESPANHOL",
      spokenText: word.spanish,
      example: word.example,
    };
  if (reviewCount > 0 && reviewCount % 3 === 2)
    return {
      front: "Ouça e tente reconhecer a palavra ou expressão.",
      back: `${word.spanish} · ${word.translation}`,
      frontLabel: "ESCUTA",
      backLabel: "RESPOSTA",
      spokenText: word.spanish,
      example: word.example,
    };
  return {
    front: word.spanish,
    back: word.translation,
    frontLabel: "ESPANHOL",
    backLabel: "PORTUGUÊS",
    spokenText: word.spanish,
    example: word.example,
  };
}
