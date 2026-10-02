export type FeatureAnnouncement = {
  id: string;
  title: string;
  summary: string;
  highlights: string[];
  href: string;
  linkLabel: string;
};

// Add one entry with a new id for each released feature or meaningful improvement.
// The claim RPC ensures every entry appears at most once per learner, on any device.
export const featureAnnouncements: FeatureAnnouncement[] = [
  {
    id: "2026-10-conversa-adaptativa",
    title: "Converse por voz e receba práticas mais pessoais",
    summary: "As conversas agora ajudam a escolher o que praticar depois.",
    highlights: [
      "Fale nas missões e na conversa livre; confira a transcrição antes de enviar.",
      "Explore novas situações de viagem, compras e restaurante.",
      "O professor considera seus ajustes recentes e sugere práticas específicas.",
    ],
    href: "/conversation",
    linkLabel: "Experimentar conversa",
  },
  {
    id: "2026-10-revisao-apresentacao",
    title: "A revisão da apresentação ficou mais clara",
    summary: "O antigo mapa mental virou um roteiro para praticar em voz alta.",
    highlights: [
      "Siga três passos curtos para revisar e testar o que lembra.",
      "Veja cada assunto em um cartão, ouça o exemplo e crie sua frase.",
      "Ao final, diga três frases e faça uma pergunta sem olhar os modelos.",
    ],
    href: "/course/frecuencias-a1/unit/1/lesson/revision?activity=review-1",
    linkLabel: "Abrir revisão",
  },
];
