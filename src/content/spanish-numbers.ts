import numbers from "../../content/languages/es/fundamentals/numbers.json";
import type { NumberPrompt } from "@/domain/numbers/number-practice";

export const spanishNumberPrompts = numbers.prompts as NumberPrompt[];
export const spanishNumberCategoryLabels: Record<string, string> = numbers.categoryLabels;
