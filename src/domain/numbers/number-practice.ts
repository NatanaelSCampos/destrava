import type { PronunciationFeedback } from "@/domain/activities/pronunciation";

export type NumberMode = "dictation" | "speaking" | "repetition";
export type NumberCategory = "basic" | "money" | "date" | "time" | "phone" | "large" | "ordinal";

export type NumberPrompt = {
  id: string;
  category: NumberCategory;
  display: string;
  spoken: string;
  accepted?: string[];
};

export const numberCategoryLabels: Record<NumberCategory, string> = {
  basic: "Números",
  money: "Dinheiro",
  date: "Datas",
  time: "Horários",
  phone: "Telefone",
  large: "Números grandes",
  ordinal: "Ordinais",
};

export const numberPrompts: NumberPrompt[] = [
  { id: "17", category: "basic", display: "17", spoken: "diecisiete" },
  { id: "47", category: "basic", display: "47", spoken: "cuarenta y siete" },
  { id: "70", category: "basic", display: "70", spoken: "setenta" },
  {
    id: "money-12-50",
    category: "money",
    display: "12,50 €",
    spoken: "doce euros con cincuenta céntimos",
  },
  { id: "money-35", category: "money", display: "35 €", spoken: "treinta y cinco euros" },
  { id: "date-12-05", category: "date", display: "12/05", spoken: "el doce de mayo" },
  { id: "date-21-09", category: "date", display: "21/09", spoken: "el veintiuno de septiembre" },
  {
    id: "time-08-15",
    category: "time",
    display: "08:15",
    spoken: "son las ocho y cuarto",
    accepted: ["8:15"],
  },
  {
    id: "time-02-30",
    category: "time",
    display: "02:30",
    spoken: "son las dos y media",
    accepted: ["2:30"],
  },
  {
    id: "phone-612",
    category: "phone",
    display: "612 34 56 78",
    spoken: "seis uno dos, tres cuatro, cinco seis, siete ocho",
  },
  { id: "large-1250", category: "large", display: "1.250", spoken: "mil doscientos cincuenta" },
  { id: "ordinal-1", category: "ordinal", display: "1.º", spoken: "primero" },
  { id: "ordinal-3", category: "ordinal", display: "3.º", spoken: "tercero" },
];

export function findNumberPrompt(id: string) {
  return numberPrompts.find((prompt) => prompt.id === id);
}

function digits(value: string) {
  if (!/^[\d\s.,:/ºª€$-]+$/u.test(value.trim())) return "";
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function gradeNumberDictation(prompt: NumberPrompt, answer: string) {
  const actual = digits(answer);
  return (
    Boolean(actual) &&
    [prompt.display, ...(prompt.accepted ?? [])].some((value) => digits(value) === actual)
  );
}

export function numberSpeechScore(feedback: PronunciationFeedback) {
  const score = Math.round((feedback.accuracy + feedback.completeness) / 2);
  return { score, correct: feedback.accuracy >= 75 && feedback.completeness >= 75 };
}

export function numberPracticeLink(promptId?: string) {
  return promptId ? `/numbers?prompt=${encodeURIComponent(promptId)}` : "/numbers";
}
