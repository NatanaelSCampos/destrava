import { z } from "zod";

export const writingFeedbackSchema = z.object({
  correctedText: z.string(),
  errors: z.array(
    z.object({ excerpt: z.string(), correction: z.string(), explanation: z.string() }),
  ),
  naturalness: z.array(z.string()),
  optionalSuggestions: z.array(z.string()),
  score: z.object({
    grammar: z.number().int().min(0).max(100),
    vocabulary: z.number().int().min(0).max(100),
    clarity: z.number().int().min(0).max(100),
  }),
});

export const tutorFeedbackSchema = z.object({
  answer: z.string(),
  example: z.string(),
  quickCheck: z.string(),
});

export const microLessonSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  example: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number().int().min(0).max(2),
  answerExplanation: z.string(),
});

export type WritingFeedback = z.infer<typeof writingFeedbackSchema>;
export type TutorFeedback = z.infer<typeof tutorFeedbackSchema>;
export type MicroLesson = z.infer<typeof microLessonSchema>;
