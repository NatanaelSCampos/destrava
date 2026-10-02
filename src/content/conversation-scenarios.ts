export type MissionObjective = { id: string; label: string; hint: string };
export type ConversationScenario = {
  id: string;
  title: string;
  setting: string;
  character: string;
  opening: string;
  objectives: MissionObjective[];
};

export const conversationScenarios: ConversationScenario[] = [
  {
    id: "new-colleague",
    title: "Conheça um colega",
    setting: "Você chegou ao primeiro dia de trabalho e encontra uma pessoa da equipe.",
    character: "Alex, um colega simpático que está se apresentando.",
    opening: "¡Hola! Soy Alex. ¿Cómo te llamas?",
    objectives: [
      { id: "say-name", label: "Dizer seu nome", hint: "Me llamo..." },
      { id: "say-city", label: "Dizer onde mora", hint: "Vivo en..." },
      { id: "say-profession", label: "Dizer sua profissão", hint: "Soy... / Trabajo como..." },
      { id: "ask-name", label: "Perguntar o nome", hint: "¿Cómo te llamas?" },
    ],
  },
  {
    id: "cafe",
    title: "Peça em um café",
    setting: "Você entrou em um café e quer fazer um pedido simples.",
    character: "Uma pessoa que atende no balcão.",
    opening: "¡Buenos días! ¿Qué te gustaría pedir?",
    objectives: [
      { id: "greet", label: "Cumprimentar", hint: "Buenos días / Hola" },
      { id: "order", label: "Pedir bebida ou comida", hint: "Quiero un café, por favor." },
      { id: "ask-price", label: "Perguntar o preço", hint: "¿Cuánto cuesta?" },
      { id: "thank", label: "Agradecer", hint: "Gracias" },
    ],
  },
];

export function findConversationScenario(id: string | null | undefined) {
  return conversationScenarios.find((item) => item.id === id);
}
