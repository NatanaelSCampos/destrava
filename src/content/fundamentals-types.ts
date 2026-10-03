export type AlphabetLetter = {
  letter: string;
  name: string;
  word: string;
  translation: string;
  example: string;
  kind: "vowel" | "consonant";
  note?: string;
};

export type RegionalTopic = {
  id: string;
  title: string;
  meaning: string;
  note: string;
  variants: Array<{ region: string; term: string; example: string }>;
  checkPrompt: string;
  checkRegion: string;
  sources: Array<{ label: string; url: string }>;
};
