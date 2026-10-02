export type SpanishRegion = "general" | "spain" | "mexico" | "argentina";

export const spanishRegions: Array<{ id: SpanishRegion; label: string; description: string }> = [
  { id: "general", label: "Geral", description: "Exemplos compreensíveis em diferentes países." },
  { id: "spain", label: "Espanha", description: "Inclui usos comuns na Espanha." },
  { id: "mexico", label: "México", description: "Inclui usos comuns no México." },
  { id: "argentina", label: "Argentina", description: "Inclui usos comuns na Argentina." },
];

export function spanishRegion(value: unknown): SpanishRegion {
  return spanishRegions.some((item) => item.id === value) ? (value as SpanishRegion) : "general";
}

export function spanishSpeechLocale(region: SpanishRegion): string {
  return { general: "es-ES", spain: "es-ES", mexico: "es-MX", argentina: "es-AR" }[region];
}

export type RegionalExample = {
  region: Exclude<SpanishRegion, "general">;
  term: string;
  example: string;
};

export type RegionalTopic = {
  id: string;
  title: string;
  meaning: string;
  note: string;
  variants: RegionalExample[];
  checkPrompt: string;
  checkRegion: Exclude<SpanishRegion, "general">;
  sources: Array<{ label: string; url: string }>;
};

export const regionalTopics: RegionalTopic[] = [
  {
    id: "computer",
    title: "Computador",
    meaning: "computador",
    note: "'Ordenador' é marcado como uso da Espanha no dicionário acadêmico. 'Computadora' é uma opção frequente nos exemplos americanos.",
    variants: [
      { region: "spain", term: "ordenador", example: "Mi ordenador está en casa." },
      { region: "mexico", term: "computadora", example: "Mi computadora está en casa." },
      { region: "argentina", term: "computadora", example: "Mi computadora está en casa." },
    ],
    checkPrompt: "Em qual destes exemplos aparece 'ordenador'?",
    checkRegion: "spain",
    sources: [{ label: "RAE: ordenador", url: "https://dle.rae.es/ordenador" }],
  },
  {
    id: "phone",
    title: "Telefone portátil",
    meaning: "telefone celular",
    note: "As palavras mudam conforme o país; as duas são compreensíveis. No espanhol da Espanha, 'móvil' é muito comum.",
    variants: [
      { region: "spain", term: "móvil", example: "¿Dónde está mi móvil?" },
      { region: "mexico", term: "celular", example: "¿Dónde está mi celular?" },
      { region: "argentina", term: "celular", example: "¿Dónde está mi celular?" },
    ],
    checkPrompt: "Em qual destes exemplos aparece 'móvil'?",
    checkRegion: "spain",
    sources: [
      { label: "RAE: móvil", url: "https://dle.rae.es/m%C3%B3vil" },
      { label: "ASALE: celular", url: "https://www.asale.org/damer/celular" },
    ],
  },
  {
    id: "informal-you",
    title: "Tratamento informal",
    meaning: "você (singular)",
    note: "Na Argentina, 'vos' costuma ser usado informalmente com uma conjugação própria. 'Usted' é uma forma de tratamento diferente.",
    variants: [
      { region: "spain", term: "tú", example: "¿Cómo te llamas tú?" },
      { region: "mexico", term: "tú", example: "¿Cómo te llamas tú?" },
      { region: "argentina", term: "vos", example: "¿Cómo te llamás vos?" },
    ],
    checkPrompt: "Em qual destes exemplos aparece 'vos' com 'llamás'?",
    checkRegion: "argentina",
    sources: [{ label: "RAE/ASALE: vos", url: "https://www.rae.es/dpd/vos" }],
  },
];

export function regionalVocabularyNote(word: string, region: SpanishRegion): string | undefined {
  const normalized = word.toLocaleLowerCase("es").trim();
  const topic = regionalTopics.find((item) =>
    item.variants.some((variant) => variant.term === normalized),
  );
  if (!topic) return undefined;
  const preferred = topic.variants.find((variant) => variant.region === region);
  const variants = topic.variants.map(
    (variant) =>
      `${spanishRegions.find((item) => item.id === variant.region)?.label}: ${variant.term}`,
  );
  return `${preferred ? `Na região escolhida, é comum dizer “${preferred.term}”. ` : ""}Variações: ${variants.join(" · ")}.`;
}
