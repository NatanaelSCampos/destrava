import { z } from "zod";

export const CONVERSATION_ANALYSIS_SCHEMA_VERSION = "1.0.0" as const;
export const CONVERSATION_RUBRIC_VERSION = "1.0.0" as const;
export const conversationDimensionNames = [
  "range",
  "accuracy",
  "interaction",
  "coherence",
  "autonomy",
] as const;
export type ConversationDimensionName = (typeof conversationDimensionNames)[number];
const text = z.string().trim().min(1).max(360);
const identifier = z.string().trim().min(1).max(160);

/** Public transcript rubric. It does not assess pronunciation, acoustic fluency or CEFR level. */
export const conversationRubric = {
  version: CONVERSATION_RUBRIC_VERSION,
  dimensions: {
    range: "Variety of words and constructions actually used for the situation.",
    accuracy: "Linguistic accuracy that can be supported by the transcript; no acoustic claims.",
    interaction: "Relevant responses, initiative, questions and repair of understanding.",
    coherence: "Connection and intelligibility of ideas in the learner's contributions.",
    autonomy:
      "Independent expression without copying a supplied model; support is not independence.",
  },
  scale: [
    "0: quoted evidence demonstrates difficulty performing the communicative function.",
    "1: isolated or strongly supported expression.",
    "2: simple effective expression with some support or repair.",
    "3: mostly independent, connected and varied expression in the observed situation.",
    "4: flexible and sustained expression in the observed situation.",
  ],
  insufficient:
    "Use null when there is insufficient reliable learner evidence. Silence and missing data are not zero.",
  evidence:
    "Quote only the learner's actual registered words. Identify target/support language and assistance honestly. Never infer acoustic pronunciation from a transcript.",
} as const;

export const conversationEvidenceRefSchema = z
  .object({
    turnId: identifier,
    quote: text,
    language: z.enum(["target", "support", "unknown"]),
    support: z.enum(["independent", "assisted", "model_repeat", "uncertain"]),
  })
  .strict();
export type ConversationEvidenceRef = z.infer<typeof conversationEvidenceRefSchema>;
const dimension = z
  .object({
    score: z.number().int().min(0).max(4).nullable(),
    evidence: z.array(conversationEvidenceRefSchema).max(8),
    note: z.string().trim().max(360),
  })
  .strict();
export const conversationObservationSchema = conversationEvidenceRefSchema
  .extend({
    key: identifier,
    kind: z.enum(["word", "phrase", "concept"]),
    label: text,
    outcome: z.enum(["difficulty", "independent_success", "supported_success", "uncertain"]),
    note: z.string().trim().max(360),
  })
  .strict();
export type ConversationObservation = z.infer<typeof conversationObservationSchema>;
export const conversationSessionAnalysisSchema = z
  .object({
    schemaVersion: z.literal(CONVERSATION_ANALYSIS_SCHEMA_VERSION),
    rubricVersion: z.literal(CONVERSATION_RUBRIC_VERSION),
    sessionId: identifier,
    languageCode: z.string().trim().min(2).max(80),
    dimensions: z
      .object({
        range: dimension,
        accuracy: dimension,
        interaction: dimension,
        coherence: dimension,
        autonomy: dimension,
      })
      .strict(),
    observations: z.array(conversationObservationSchema).max(40),
    summary: z.string().trim().max(1000),
    strengths: z.array(text).max(5),
    nextPractice: z.array(text).max(5),
  })
  .strict();
export type ConversationSessionAnalysis = z.infer<typeof conversationSessionAnalysisSchema>;
