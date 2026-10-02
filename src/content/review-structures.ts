export type ReviewStructure = {
  id: string;
  lessonId: string;
  conceptId: string;
  title: string;
  prompt: string;
  answer: string;
  explanation: string;
};

export const reviewStructures: ReviewStructure[] = [
  {
    id: "introduce-name",
    lessonId: "l-grammar",
    conceptId: "personal-questions",
    title: "Dizer seu nome",
    prompt: "Crie uma frase para dizer seu nome usando me llamo.",
    answer: "Me llamo Elena.",
    explanation: "Me llamo + nome apresenta a própria pessoa. Troque Elena pelo seu nome.",
  },
  {
    id: "say-age",
    lessonId: "l-grammar",
    conceptId: "age-tener",
    title: "Dizer a idade",
    prompt: "Como você diria que tem 27 anos usando tener?",
    answer: "Tengo 27 años.",
    explanation: "Em espanhol, a idade usa tener: tengo + número + años.",
  },
  {
    id: "ask-origin",
    lessonId: "l-grammar",
    conceptId: "origin",
    title: "Perguntar a origem",
    prompt: "Pergunte de onde a outra pessoa é.",
    answer: "¿De dónde eres?",
    explanation: "De dónde pergunta a origem; eres é a forma de ser para tú.",
  },
  {
    id: "say-residence",
    lessonId: "l-grammar",
    conceptId: "residence",
    title: "Dizer onde mora",
    prompt: "Diga que mora em Lima usando vivir.",
    answer: "Vivo en Lima.",
    explanation: "Vivo en + lugar indica onde você mora.",
  },
];

export function findReviewStructure(id: string) {
  return reviewStructures.find((item) => item.id === id);
}
