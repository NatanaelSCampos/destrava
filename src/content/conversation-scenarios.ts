export type MissionObjective = { id: string; label: string; hint: string };
export type ConversationScenario = {
  id: string;
  goals?: string[];
  contexts?: string[];
  focusConceptIds?: string[];
  title: string;
  setting: string;
  character: string;
  opening: string;
  objectives: MissionObjective[];
  roleplay?: {
    characterRole: string;
    maxVocabularyLevel?: string;
    allowHints?: boolean;
  };
};

export const conversationScenarios: ConversationScenario[] = [
  {
    id: "new-colleague",
    focusConceptIds: ["greetings", "residence", "profession", "personal-questions"],
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
  {
    id: "directions",
    title: "Peça informações na rua",
    setting: "Você está em uma cidade nova e procura a estação de metrô.",
    character: "Lucía, uma moradora disposta a ajudar.",
    opening: "¡Hola! ¿Necesitas ayuda para encontrar algún lugar?",
    objectives: [
      {
        id: "ask-station",
        label: "Perguntar onde fica a estação",
        hint: "¿Dónde está la estación?",
      },
      { id: "ask-distance", label: "Perguntar se fica longe", hint: "¿Está lejos?" },
      { id: "thank-directions", label: "Agradecer a ajuda", hint: "Muchas gracias." },
    ],
  },
  {
    id: "market",
    title: "Compre no mercado",
    setting: "Você quer comprar frutas em um pequeno mercado.",
    character: "Diego, vendedor de frutas.",
    opening: "¡Buenos días! Tenemos frutas frescas. ¿Qué buscas?",
    objectives: [
      { id: "request-fruit", label: "Pedir uma fruta", hint: "Quiero dos manzanas, por favor." },
      { id: "ask-market-price", label: "Perguntar o preço", hint: "¿Cuánto cuestan?" },
      { id: "finish-purchase", label: "Encerrar a compra", hint: "Eso es todo, gracias." },
    ],
  },
  {
    id: "hotel",
    title: "Faça check-in no hotel",
    setting: "Você chega ao hotel e informa sua reserva na recepção.",
    character: "Sofía, recepcionista do hotel.",
    opening: "¡Buenas tardes! Bienvenido al hotel. ¿Tiene una reserva?",
    objectives: [
      {
        id: "confirm-reservation",
        label: "Confirmar que tem reserva",
        hint: "Sí, tengo una reserva.",
      },
      {
        id: "say-reservation-name",
        label: "Informar o nome da reserva",
        hint: "Está a nombre de...",
      },
      { id: "ask-room", label: "Perguntar pelo quarto", hint: "¿Cuál es mi habitación?" },
    ],
  },
  {
    id: "restaurant",
    title: "Jante em um restaurante",
    setting: "Você entra em um restaurante e conversa com o atendente.",
    character: "Mateo, atendente do restaurante.",
    opening: "¡Buenas noches! ¿Tiene una mesa reservada?",
    objectives: [
      { id: "request-table", label: "Pedir uma mesa", hint: "Una mesa para dos, por favor." },
      { id: "ask-menu", label: "Pedir o cardápio", hint: "¿Me trae el menú?" },
      { id: "order-dinner", label: "Pedir uma refeição", hint: "Quisiera..., por favor." },
    ],
  },
];

export function findConversationScenario(id: string | null | undefined) {
  return conversationScenarios.find((item) => item.id === id);
}
