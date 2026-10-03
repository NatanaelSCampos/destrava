import { z } from "zod";

const id = z.string().trim().min(1);
const version = z.string().regex(/^\d+\.\d+(?:\.\d+)?$/);
const localizedTextSchema = z.record(z.string().min(2), z.string().min(1));

export const normalizationRulesSchema = z.object({
  trimWhitespace: z.boolean(),
  collapseWhitespace: z.boolean(),
  caseInsensitive: z.boolean(),
  ignoreTerminalPunctuation: z.boolean(),
  ignoreDiacritics: z.boolean(),
});
export type NormalizationRules = z.infer<typeof normalizationRulesSchema>;

export const languageVariantSchema = z.object({
  id,
  name: id,
  default: z.boolean().optional(),
});
export const speechLocaleSchema = z.object({
  recognitionLocale: z.string().nullable(),
  assessmentLocale: z.string().nullable(),
  ttsLocale: z.string().nullable(),
});
export const languagePackageSchema = z.object({
  schemaVersion: version,
  contentVersion: version,
  id,
  identity: z.object({
    name: id,
    nativeName: id,
    iso639_1: z.string().optional(),
    iso639_3: z.string().optional(),
  }),
  writingSystem: z.object({
    direction: z.enum(["ltr", "rtl"]),
    scripts: z.array(id).min(1),
    caseSensitive: z.boolean(),
  }),
  variants: z.array(languageVariantSchema).min(1),
  capabilities: z.object({
    speechRecognition: z.boolean(),
    textToSpeech: z.boolean(),
    pronunciationAssessment: z.boolean(),
    regionalVariants: z.boolean(),
    romanization: z.boolean(),
    tones: z.boolean(),
    grammaticalGender: z.boolean(),
  }),
  speech: z.object({
    defaultVariant: id,
    providers: z.record(z.string(), z.record(z.string(), speechLocaleSchema)),
  }),
  normalization: normalizationRulesSchema,
  modules: z.record(z.string(), z.object({ enabled: z.boolean(), source: z.string().optional() })),
  strategies: z.object({
    textTokenizer: id.optional(),
    answerNormalizer: id.optional(),
    numberParser: id.optional(),
  }).optional(),
}).superRefine((language, ctx) => {
  const variants = new Set(language.variants.map((item) => item.id));
  if (variants.size !== language.variants.length)
    ctx.addIssue({ code: "custom", message: "Duplicate language variant" });
  if (!variants.has(language.speech.defaultVariant))
    ctx.addIssue({ code: "custom", message: "Unknown default speech variant" });
  for (const [provider, locales] of Object.entries(language.speech.providers))
    for (const variant of Object.keys(locales))
      if (!variants.has(variant))
        ctx.addIssue({ code: "custom", message: `Unknown ${provider} speech variant: ${variant}` });
});
export type LanguagePackage = z.infer<typeof languagePackageSchema>;

export const provenanceSchema = z.object({
  origin: z.enum(["human", "ai_generated", "adapted", "imported"]),
  generator: z.object({ name: id, version: z.string().optional() }).optional(),
  sources: z.array(z.object({ type: id, reference: id, page: z.number().optional() })).optional(),
  review: z.object({
    status: z.enum(["draft", "generated", "review_pending", "approved", "published", "deprecated"]),
    reviewedBy: z.string().optional(),
  }).optional(),
});
export const mediaSchema = z.object({
  id,
  type: z.enum(["image", "audio", "video"]),
  src: id,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export const conceptSchema = z.object({
  id,
  language: id,
  type: id,
  name: id,
  description: localizedTextSchema.optional(),
  prerequisites: z.array(id).optional(),
  examples: z.array(z.object({ target: id, translations: localizedTextSchema })).optional(),
});
export const lexiconEntrySchema = z.object({
  id,
  language: id,
  lemma: id,
  partOfSpeech: z.string().optional(),
  meanings: z.array(z.object({ id, translations: z.record(z.string(), z.array(id).min(1)) })).min(1),
  examples: z.array(z.object({ target: id, translations: localizedTextSchema })).optional(),
  level: z.string().optional(),
  lessonId: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  surface: z.string().optional(),
  className: z.string().optional(),
  regionalNote: z.union([z.string(), z.record(z.string(), z.string().optional())]).optional(),
  visualCue: z.object({ icon: z.enum(["home", "work", "talk", "doctor", "teacher", "location"]), alt: id }).optional(),
  clozeForms: z.array(z.string()).optional(),
});
export const missionSchema = z.object({
  id,
  level: id,
  scenario: id,
  objectives: z.array(id).min(1),
  recommendedConcepts: z.array(id).optional(),
  title: z.string().optional(),
  setting: z.string().optional(),
  character: z.string().optional(),
  opening: z.string().optional(),
  objectiveDetails: z.array(z.object({ id, label: id, hint: z.string() })).optional(),
});
export const roleplaySchema = z.object({
  id,
  scenario: id,
  level: id,
  character: z.object({ role: id }),
  objectives: z.array(id).min(1),
  constraints: z.object({ maxVocabularyLevel: z.string().optional(), allowHints: z.boolean().optional() }).optional(),
});

export const skillIdSchema = z.enum([
  "reading", "writing", "listening", "speaking", "vocabulary", "grammar",
  "pronunciation", "fluency", "comprehension",
]);
export const activityTypeSchema = z.enum([
  "lesson_content", "multiple_choice", "true_false", "fill_blank", "ordering",
  "short_answer", "writing", "listening", "speaking", "flashcard", "review", "quiz",
]);
export const activitySchema = z.object({
  id,
  type: activityTypeSchema,
  skills: z.array(skillIdSchema).min(1),
  concepts: z.array(id).default([]),
  difficulty: z.number().min(0).max(1).optional(),
  instructions: localizedTextSchema.optional(),
  title: id,
  prompt: z.string().default(""),
  minutes: z.number().positive(),
  payload: z.record(z.string(), z.unknown()),
  evaluation: z.object({ strategy: id, normalization: normalizationRulesSchema.optional() }).optional(),
  media: z.array(id).optional(),
  provenance: provenanceSchema.optional(),
});
export const lessonSchema = z.object({
  id, slug: id, title: id, order: z.number().int().positive(),
  objectives: z.array(id), activities: z.array(activitySchema).min(1),
  eyebrow: z.string().default(""), description: z.string().default(""),
  minutes: z.number().positive(), active: z.boolean().default(true),
});
export const unitSchema = z.object({
  id, slug: id, order: z.number().int().positive(), title: id,
  objectives: z.array(id), skills: z.array(skillIdSchema).min(1),
  introduces: z.object({ concepts: z.array(id).optional(), vocabulary: z.array(id).optional() }).optional(),
  lessons: z.array(lessonSchema).min(1), assessmentId: z.string().optional(),
  description: z.string().default(""), active: z.boolean().default(true),
});
export const assessmentSchema = z.object({
  id, type: id, unitId: z.string().optional(),
  skillWeights: z.partialRecord(skillIdSchema, z.number().min(0).max(1)),
  passingPolicy: z.object({
    overall: z.number().min(0).max(1),
    minimumBySkill: z.partialRecord(skillIdSchema, z.number().min(0).max(1)).optional(),
  }),
  skillPlan: z.array(skillIdSchema).min(1),
  bank: z.array(z.object({ activityId: id, skill: skillIdSchema, difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]) })).min(1),
  activities: z.array(activitySchema).default([]),
});
export const coursePackageSchema = z.object({
  schemaVersion: version, contentVersion: version, id, slug: id,
  sourceLanguage: id, targetLanguage: id, defaultVariant: z.string().optional(),
  framework: z.object({ name: id, entryLevel: z.string().optional(), exitLevel: id }),
  track: id, title: id, description: z.string().default(""),
  learningGoals: z.array(id).min(1), units: z.array(unitSchema).min(1),
  concepts: z.array(conceptSchema), lexicon: z.array(lexiconEntrySchema),
  missions: z.array(missionSchema).default([]), roleplays: z.array(roleplaySchema).default([]),
  assessments: z.array(assessmentSchema).default([]), media: z.array(mediaSchema).default([]),
  practice: z.object({ reviewStructures: z.array(z.object({
    id, lessonId: id, conceptId: id, title: id, prompt: id, answer: id, explanation: id,
  })).default([]) }).optional(),
  provenance: provenanceSchema.optional(),
});
export type CoursePackage = z.infer<typeof coursePackageSchema>;
export type ActivityContract = z.infer<typeof activitySchema>;
