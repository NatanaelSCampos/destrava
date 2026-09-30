import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  tutorFeedbackSchema,
  writingFeedbackSchema,
  type TutorFeedback,
  type WritingFeedback,
} from "./schemas";
import type { RelevantMistake } from "./tutor-context-builder";
import { TutorContextBuilder } from "./tutor-context-builder";

export type AIUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
};
export type AIResult<T> = { feedback: T; usage: AIUsage };

export interface AIProvider {
  correctWriting(input: { activityId: string; text: string }): Promise<AIResult<WritingFeedback>>;
  tutor(input: {
    question: string;
    activityId?: string;
    mistakes: RelevantMistake[];
  }): Promise<AIResult<TutorFeedback>>;
  explainMistake(input: { activityId: string; answer: string }): Promise<AIResult<TutorFeedback>>;
  evaluateSpeaking(input: { activityId: string; audioUrl: string }): Promise<never>;
}

const writingInstructions =
  "Você é um professor de espanhol A1 para falantes de português. Corrija apenas erros reais de gramática, ortografia ou vocabulário. Frases corretas não são erros apenas porque existe alternativa mais natural. Separe rigorosamente erros, melhorias de naturalidade e sugestões opcionais. Responda em português claro. Preserve a intenção e a voz do aluno. Não inclua conteúdo do livro. Em cada erro, confira que o trecho original realmente aparece no texto e explique exatamente a mudança; para acentos, nomeie a letra correta sem inventar regras. As notas de grammar, vocabulary e clarity são inteiros de 0 a 100, não uma escala de 0 a 5. Comece de 100 e desconte somente pelos problemas reais da categoria: dois erros leves de acento em cinco frases claras não justificam nota abaixo de 80. Não penalize a mesma falha em todas as categorias.";
const tutorInstructions =
  "Você é um professor particular de espanhol A1 para falantes de português. Responda de forma breve, correta e encorajadora. Explique a regra com um exemplo novo. Não invente dados sobre o aluno. Use só o contexto relevante enviado. Não reproduza páginas de livros.";

function usageFrom(response: {
  model: string;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
}): AIUsage {
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const inputRate = Number(process.env.OPENAI_INPUT_USD_PER_MILLION);
  const outputRate = Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION);
  const estimatedCostUsd =
    Number.isFinite(inputRate) && inputRate > 0 && Number.isFinite(outputRate) && outputRate > 0
      ? (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
      : null;
  return { model: response.model, inputTokens, outputTokens, estimatedCostUsd };
}

export class OpenAIProvider implements AIProvider {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  async correctWriting({
    activityId,
    text,
  }: {
    activityId: string;
    text: string;
  }): Promise<AIResult<WritingFeedback>> {
    const context = TutorContextBuilder.build(activityId, []);
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      max_output_tokens: 900,
      input: [
        { role: "system", content: writingInstructions },
        {
          role: "user",
          content: JSON.stringify({
            task: "Corrigir esta produção escrita A1",
            context: {
              course: context.course,
              unit: context.unit,
              lesson: context.lesson,
              activity: context.activity?.prompt,
            },
            studentText: text,
          }),
        },
      ],
      text: { format: zodTextFormat(writingFeedbackSchema, "writing_feedback") },
    });
    const feedback = writingFeedbackSchema.parse(response.output_parsed);
    return { feedback, usage: usageFrom(response) };
  }

  async tutor({
    question,
    activityId,
    mistakes,
  }: {
    question: string;
    activityId?: string;
    mistakes: RelevantMistake[];
  }): Promise<AIResult<TutorFeedback>> {
    const context = TutorContextBuilder.build(activityId, mistakes);
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      max_output_tokens: 500,
      input: [
        { role: "system", content: tutorInstructions },
        { role: "user", content: JSON.stringify({ context, question }) },
      ],
      text: { format: zodTextFormat(tutorFeedbackSchema, "tutor_feedback") },
    });
    const feedback = tutorFeedbackSchema.parse(response.output_parsed);
    return { feedback, usage: usageFrom(response) };
  }

  async explainMistake({ activityId, answer }: { activityId: string; answer: string }) {
    return this.tutor({
      activityId,
      mistakes: [],
      question: `Por que minha resposta "${answer.slice(0, 150)}" está incorreta?`,
    });
  }

  async evaluateSpeaking(): Promise<never> {
    throw new Error("A avaliação de pronúncia ainda não está disponível.");
  }
}

export function getAIProvider(): AIProvider {
  if (!process.env.OPENAI_API_KEY) throw new Error("A correção por IA ainda não está configurada.");
  return new OpenAIProvider();
}
