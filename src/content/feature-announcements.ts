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
];
