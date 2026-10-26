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
const teachingMessageParts = z.array(z.object({
  text: z.string().min(1).max(650), role: z.enum(["source", "target", "unknown"]),
}).strict()).min(1).max(12);
const interactiveTeachingBaseSchema = z.object({
  message: z.string().trim().min(10).max(650),
  example: z.string().max(180),
  translation: z.string().max(180),
  followUp: z.string().max(180),
  canResume: z.boolean(),
  followUpRole: z.enum(["source", "target", "unknown"]).optional(),
  messageParts: teachingMessageParts.optional(),
});
export const interactiveTeachingSchema = interactiveTeachingBaseSchema.superRefine((reply, ctx) => {
  if (reply.messageParts && reply.messageParts.map(part => part.text).join("") !== reply.message)
    ctx.addIssue({ code: "custom", path: ["messageParts"], message: "Parts must reproduce the complete message." });
});
export const interactiveTeachingModelSchema = interactiveTeachingBaseSchema.omit({ message: true, messageParts: true })
  .required({ followUpRole: true }).extend({ messageParts: teachingMessageParts });
export type InteractiveTeachingFeedback = z.infer<typeof interactiveTeachingSchema>;

export const conversationReplySchema = z.object({
  reply: z.string(),
  correction: z.string(),
  correctionCategory: z.enum(["none", "grammar", "vocabulary", "clarity", "other"]),
  completedObjectiveIds: z.array(z.string()),
  objectiveEvidence: z.array(z.object({ id: z.string(), quote: z.string() })),
});

export const imageDescriptionFeedbackSchema = z.object({
  observed: z.string(),
  strength: z.string(),
  correction: z.string(),
  nextSentence: z.string(),
});

export const microLessonQuestionSchema = z.object({
  question: z.string().min(8),
  options: z.array(z.string().min(1)).length(3),
  correctIndex: z.number().int().min(0).max(2),
  answerExplanation: z.string().min(8),
});

export const microLessonSchema = z.object({
  title: z.string().min(3),
  explanation: z.string().min(20),
  examples: z.array(z.object({ text: z.string().min(3), translation: z.string().min(3) })).length(2),
  exercises: z.array(microLessonQuestionSchema).length(3),
  speaking: z.object({ prompt: z.string().min(8), modelAnswer: z.string().min(3) }),
  finalCheck: microLessonQuestionSchema,
});

export type WritingFeedback = z.infer<typeof writingFeedbackSchema>;
export type TutorFeedback = z.infer<typeof tutorFeedbackSchema>;
export type ConversationReply = z.infer<typeof conversationReplySchema>;
export type ImageDescriptionFeedback = z.infer<typeof imageDescriptionFeedbackSchema>;
export type MicroLesson = z.infer<typeof microLessonSchema>;
