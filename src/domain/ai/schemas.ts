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

export const conversationReplySchema = z.object({
  reply: z.string(),
  correction: z.string(),
  completedObjectiveIds: z.array(z.string()),
});

export const imageDescriptionFeedbackSchema = z.object({
  observed: z.string(),
  strength: z.string(),
  correction: z.string(),
  nextSentence: z.string(),
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
export type ConversationReply = z.infer<typeof conversationReplySchema>;
export type ImageDescriptionFeedback = z.infer<typeof imageDescriptionFeedbackSchema>;
export type MicroLesson = z.infer<typeof microLessonSchema>;
