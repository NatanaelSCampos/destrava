import { unitAccessSchema, examPolicySchema, learningAccessIssues } from "./learning-access";
import { z } from "zod";
import { sceneIllustrationSchema, sceneItemSchema } from "./activity-scene";
import { lessonStagesSchema } from "./lesson-stages";
import { deferredRecoverySchema } from "./teaching";
import { teachingCourseIssues } from "./validate-teaching";
import {
  learningGoalSchema,
  learningSkillSchema,
  skillIdSchema,
  assessmentPurposeSchema,
} from "./contract-vocabulary";
import { unitLearningPolicySchema } from "./learning-policies";
export { skillIdSchema, assessmentPurposeSchema } from "./contract-vocabulary";

import { capabilityRequirementsSchema } from "./capability-contracts";
import { activityPresentationSchema, textPresentationSchema } from "./text-presentation";
import { activityVariantSchema, answerPolicySchema, variantIdsSchema } from "./variant-contracts";
import {
  normalizationRulesSchema,
  activityTypeSchema,
  objectiveActivityTypes,
} from "./activity-data";
export { normalizationRulesSchema, activityTypeSchema } from "./activity-data";
export type { NormalizationRules } from "./activity-data";

const id = z.string().trim().min(1);
const version = z.string().regex(/^\d+\.\d+(?:\.\d+)?$/);
const localizedTextSchema = z.record(z.string().min(2), z.string().min(1));
export const supportedLanguageSchemaVersions = ["1.1"] as const;
export const supportedCourseSchemaVersions = [
  "1.3",
  "1.4",
  "1.5",
  "1.6",
  "1.7",
  "1.8",
  "1.9",
  "1.10", "1.11", "1.12",
] as const;

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
export const languagePackageSchema = z
  .object({
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
    linguisticFeatures: z.object({
      romanization: z.boolean(),
      tones: z.boolean(),
      grammaticalGender: z.boolean(),
    }),
    capabilityRequirements: capabilityRequirementsSchema.optional(),
    speech: z.object({
      support: z.object({
        speechRecognition: z.boolean(),
        textToSpeech: z.boolean(),
        pronunciationAssessment: z.boolean(),
      }),
      defaultVariant: id,
      providers: z.record(z.string(), z.record(z.string(), speechLocaleSchema)),
    }),
    normalization: normalizationRulesSchema,
    modules: z.record(
      z.string(),
      z.object({ enabled: z.boolean(), source: z.string().optional() }),
    ),
  })
  .strict()
  .superRefine((language, ctx) => {
    if (!supportedLanguageSchemaVersions.some((value) => value === language.schemaVersion))
      ctx.addIssue({
        code: "custom",
        path: ["schemaVersion"],
        message:
          "Separated linguistic traits and speech coverage require LanguagePackage schemaVersion 1.1",
      });
    const variants = new Set(language.variants.map((item) => item.id));
    if (variants.size !== language.variants.length)
      ctx.addIssue({ code: "custom", message: "Duplicate language variant" });
    if (!variants.has(language.speech.defaultVariant))
      ctx.addIssue({ code: "custom", message: "Unknown default speech variant" });
    for (const [provider, locales] of Object.entries(language.speech.providers))
      for (const variant of Object.keys(locales))
        if (!variants.has(variant))
          ctx.addIssue({
            code: "custom",
            message: `Unknown ${provider} speech variant: ${variant}`,
          });
  });
export type LanguagePackage = z.infer<typeof languagePackageSchema>;

export const alphabetModuleSchema = z
  .array(
    z.object({
      letter: id,
      name: id,
      word: id,
      translation: id,
      example: id,
      kind: z.enum(["vowel", "consonant"]),
      note: z.string().optional(),
    }),
  )
  .min(1);
export const numbersModuleSchema = z.object({
  prompts: z
    .array(
      z.object({
        id,
        category: id,
        display: id,
        spoken: id,
        example: id,
        exampleTranslation: id,
        accepted: z.array(id).optional(),
      }),
    )
    .min(1),
  categoryLabels: z.record(z.string(), id),
});
export const regionalVariantsModuleSchema = z.array(
  z
    .object({
      id,
      title: id,
      meaning: id,
      note: id,
      category: id.optional(),
      variants: z.array(z.object({ region: id, term: id, example: id })).min(1),
      checkPrompt: id,
      checkRegion: id.optional(),
      checkOptions: z.array(id).min(2).optional(),
      checkAnswer: id.optional(),
      sources: z.array(z.object({ label: id, url: z.url() })),
    })
    .refine(
      (topic) =>
        topic.checkRegion || (topic.checkOptions?.includes(topic.checkAnswer ?? "") ?? false),
      "Regional check needs a region or a valid answer",
    ),
);

export const provenanceSchema = z.object({
  origin: z.enum(["human", "ai_generated", "adapted", "imported"]),
  generator: z.object({ name: id, version: z.string().optional() }).optional(),
  sources: z.array(z.object({ type: id, reference: id, page: z.number().optional() })).optional(),
  review: z
    .object({
      status: z.enum([
        "draft",
        "generated",
        "review_pending",
        "approved",
        "published",
        "deprecated",
      ]),
      reviewedBy: z.string().optional(),
    })
    .optional(),
});
export const mediaSchema = z.object({
  id,
  type: z.enum(["image", "audio", "video"]),
  src: id,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
// Authoring contract for a guided lesson. It contains presentation data only;
// activity answers remain in the server-side CoursePackage activities.
const boardTextRuns = z.array(z.object({
  text: z.string().min(1).max(650), language: z.string().trim().min(1).max(80).optional(),
}).strict()).min(1).max(12).optional();
const boardVisualFields = {
  illustration: sceneIllustrationSchema.optional(),
  icon: sceneItemSchema.shape.icon.optional(),
};
export const boardElementSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    ...boardVisualFields,
    label: z.string().trim().min(1).max(80).optional(),
    id,
    text: id,
    runs: boardTextRuns,
    translation: z.string().optional(),
    textPresentation: textPresentationSchema.optional(),
  }),
  z.object({
    kind: z.literal("example"),
    ...boardVisualFields,
    label: z.string().trim().min(1).max(80).optional(),
    id,
    text: id,
    runs: boardTextRuns,
    translation: id,
    textPresentation: textPresentationSchema.optional(),
  }),
  z.object({
    kind: z.literal("comparison"),
    ...boardVisualFields,
    id,
    left: id,
    right: id,
    label: z.string().optional(),
    leftPresentation: textPresentationSchema.optional(),
    rightPresentation: textPresentationSchema.optional(),
  }),
]).superRefine((element, ctx) => {
  if (element.kind !== "comparison" && element.runs && element.text.length > 650)
    ctx.addIssue({ code: "custom", path: ["runs"], message: "Board runs are limited to 650 total characters." });
  if (element.kind !== "comparison" && element.runs && element.runs.map(run => run.text).join("") !== element.text)
    ctx.addIssue({ code: "custom", path: ["runs"], message: "Board runs must reproduce the complete text exactly." });
});
export const lessonActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("board.show"), element: boardElementSchema }),
  z.object({ type: z.literal("board.highlight"), targetId: id }),
  z.object({ type: z.literal("board.clear") }),
  z.object({ type: z.literal("translation.show"), visible: z.boolean() }),
  z.object({
    type: z.literal("caption.show"),
    text: z.string().max(300),
    textPresentation: textPresentationSchema.optional(),
  }),
  z.object({
    type: z.literal("teacher.state"),
    state: z.enum(["speaking", "paused", "listening"]),
  }),
  z.object({ type: z.literal("audio.play"), mediaId: id }),
  z.object({ type: z.literal("activity.open"), activityRef: id }),
  z.object({ type: z.literal("speech.request"), activityRef: id }),
]);
export type LessonAction = z.infer<typeof lessonActionSchema>;
export type BoardElement = z.infer<typeof boardElementSchema>;
export const interactiveLessonSchema = z.object({
  id,
  autoAdvancePresentations: z.boolean().optional(),
  courseId: id,
  unitId: id,
  lessonId: id,
  title: id,
  objectives: z.array(id).min(1),
  concepts: z.array(id),
  skills: z.array(z.string().min(1)).min(1),
  estimatedMinutes: z.number().positive(),
  alternativeExamples: z.array(z.object({ conceptId: id, text: id, translation: id })).default([]),
  segments: z
    .array(
      z.object({
        id,
        title: id,
        type: z.enum([
          "presentation",
          "explanation",
          "example",
          "activity",
          "checkpoint",
          "speaking",
          "summary",
        ]),
        objectives: z.array(id).default([]),
        concepts: z.array(id).default([]),
        presentation: z
          .object({
            mode: z.enum(["video", "audio", "slides"]),
            mediaId: id.optional(),
            durationMs: z.number().int().positive(),
            transcript: z
              .array(
                z.object({
                  startMs: z.number().int().nonnegative(),
                  endMs: z.number().int().positive(),
                  text: id,
                  textPresentation: textPresentationSchema.optional(),
                }),
              )
              .default([]),
          })
          .optional(),
        cues: z
          .array(z.object({ id, atMs: z.number().int().nonnegative(), action: lessonActionSchema }))
          .default([]),
        activityRef: id.optional(),
        required: z.boolean().default(false),
        allowInterruption: z.boolean().default(true),
        resumeAnchorsMs: z.array(z.number().int().nonnegative()).default([0]),
        explanation: z.string().optional(),
      }),
    )
    .min(2),
  provenance: provenanceSchema.optional(),
});
export type InteractiveLessonDefinition = z.infer<typeof interactiveLessonSchema>;
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
  meanings: z
    .array(z.object({ id, translations: z.record(z.string(), z.array(id).min(1)) }))
    .min(1),
  examples: z.array(z.object({ target: id, translations: localizedTextSchema })).optional(),
  level: z.string().optional(),
  lessonId: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  surface: z.string().optional(),
  className: z.string().optional(),
  regionalNote: z.union([z.string(), z.record(z.string(), z.string().optional())]).optional(),
  visualCue: z
    .object({ icon: z.enum(["home", "work", "talk", "doctor", "teacher", "location"]), alt: id })
    .optional(),
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
  goals: z.array(learningGoalSchema).optional(),
  contexts: z.array(id).optional(),
});
export const roleplaySchema = z.object({
  id,
  scenario: id,
  level: id,
  character: z.object({ role: id }),
  objectives: z.array(id).min(1),
  constraints: z
    .object({ maxVocabularyLevel: z.string().optional(), allowHints: z.boolean().optional() })
    .optional(),
  goals: z.array(learningGoalSchema).optional(),
  contexts: z.array(id).optional(),
});

export const activitySchema = z.object({
  id,
  variant: activityVariantSchema.optional(),
  presentation: activityPresentationSchema.optional(),
  capabilityRequirements: capabilityRequirementsSchema.optional(),
  type: activityTypeSchema,
  skills: z.array(skillIdSchema).min(1),
  concepts: z.array(id).default([]),
  difficulty: z.number().min(0).max(1).optional(),
  instructions: localizedTextSchema.optional(),
  title: id,
  prompt: z.string().default(""),
  minutes: z.number().positive(),
  payload: z.record(z.string(), z.unknown()),
  evaluation: z
    .object({
      strategy: id,
      normalization: normalizationRulesSchema.optional(),
      answerPolicy: answerPolicySchema.optional(),
    })
    .optional(),
  media: z.array(id).optional(),
  provenance: provenanceSchema.optional(),
  goals: z.array(learningGoalSchema).optional(),
  contexts: z.array(id).optional(),
});
export const lessonSchema = z.object({
  id,
  capabilityRequirements: capabilityRequirementsSchema.optional(),
  slug: id,
  title: id,
  order: z.number().int().positive(),
  objectives: z.array(id),
  activities: z.array(activitySchema).min(1),
  stages: lessonStagesSchema.optional(),
  deferredRecovery: deferredRecoverySchema(activitySchema).optional(),
  objectiveLabels: z.record(z.string().min(1), z.string().trim().min(1).max(180)).optional(),
  eyebrow: z.string().default(""),
  description: z.string().default(""),
  minutes: z.number().positive(),
  active: z.boolean().default(true),
  interactiveLessonRef: id.optional(),
});
export const assessmentRefsSchema = z
  .object({
    diagnostic: id.optional(),
    final: id.optional(),
    formative: z
      .array(id)
      .default([])
      .refine((items) => new Set(items).size === items.length, "Duplicate formative reference"),
  })
  .strict();
export const unitSchema = z
  .object({
    id,
    capabilityRequirements: capabilityRequirementsSchema.optional(),
    slug: id,
    order: z.number().int().positive(),
    title: id,
    objectives: z.array(id),
    skills: z.array(skillIdSchema).min(1),
    introduces: z
      .object({ concepts: z.array(id).optional(), vocabulary: z.array(id).optional() })
      .optional(),
    lessons: z.array(lessonSchema).min(1),
    assessmentRefs: assessmentRefsSchema.default({ formative: [] }),
    access: unitAccessSchema.optional(),
    learningPolicy: unitLearningPolicySchema,
    description: z.string().default(""),
    active: z.boolean().default(true),
  })
  .strict();
const assessmentBaseSchema = z.object({
  id,
  capabilityRequirements: capabilityRequirementsSchema.optional(),
  title: id,
  purpose: assessmentPurposeSchema,
  unitId: id.optional(),
  lessonId: id.optional(),
  objectiveIds: z.array(id).default([]),
  passingPolicy: z.object({
    overall: z.number().min(0).max(1),
    minimumBySkill: z.partialRecord(skillIdSchema, z.number().min(0).max(1)).optional(),
  }),
});
export const adaptiveAssessmentSchema = assessmentBaseSchema
  .extend({
    method: z.literal("adaptive"),
    skillWeights: z.partialRecord(skillIdSchema, z.number().min(0).max(1)),
    skillPlan: z.array(skillIdSchema).min(1).max(100),
    bank: z
      .array(
        z.object({
          activityId: id,
          skill: skillIdSchema,
          difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          ceiling: z.boolean().optional(),
        }),
      )
      .min(1),
  })
  .strict();
export const fixedAssessmentSchema = assessmentBaseSchema
  .extend({
    method: z.literal("fixed"),
    gradingStrategy: z.literal("objective_mean"),
    exam: examPolicySchema.optional(),
    activityIds: z
      .array(id)
      .min(1)
      .max(100)
      .refine((items) => new Set(items).size === items.length, "Duplicate assessment activity"),
  })
  .strict();
export const assessmentSchema = z.discriminatedUnion("method", [
  adaptiveAssessmentSchema,
  fixedAssessmentSchema,
]);
export type AssessmentPurpose = z.infer<typeof assessmentPurposeSchema>;
export type AssessmentDefinition = z.infer<typeof assessmentSchema>;
export type AdaptiveAssessmentDefinition = z.infer<typeof adaptiveAssessmentSchema>;
export type FixedAssessmentDefinition = z.infer<typeof fixedAssessmentSchema>;
export type AssessmentRefs = z.infer<typeof assessmentRefsSchema>;
export const coursePackageSchema = z
  .object({
    capabilityRequirements: capabilityRequirementsSchema.optional(),
    schemaVersion: version,
    contentVersion: version,
    id,
    slug: id,
    isDefault: z.boolean().default(false),
    sourceLanguage: id,
    targetLanguage: id,
    defaultVariant: z.string().optional(),
    acceptedVariants: variantIdsSchema.optional(),
    framework: z.object({ name: id, entryLevel: z.string().optional(), exitLevel: id }),
    track: id,
    title: id,
    description: z.string().default(""),
    learningGoals: z.array(id).min(1),
    units: z.array(unitSchema).min(1),
    supportedGoals: z.array(learningGoalSchema).min(1).optional(),
    contexts: z.array(z.object({ id, label: id, goal: learningGoalSchema })).optional(),
    skillFloors: z.partialRecord(learningSkillSchema, z.number().min(0).max(1)).optional(),
    concepts: z.array(conceptSchema),
    lexicon: z.array(lexiconEntrySchema),
    missions: z.array(missionSchema).default([]),
    roleplays: z.array(roleplaySchema).default([]),
    assessments: z.array(assessmentSchema).default([]),
    media: z.array(mediaSchema).default([]),
    assessmentRefs: z.object({ diagnostic: id.optional() }).strict().default({}),
    interactiveLessons: z.array(interactiveLessonSchema).default([]),
    practice: z
      .object({
        reviewStructures: z
          .array(
            z.object({
              id,
              lessonId: id,
              conceptId: id,
              title: id,
              prompt: id,
              answer: id,
              explanation: id,
            }),
          )
          .default([]),
      })
      .optional(),
    provenance: provenanceSchema.optional(),
  })
  .superRefine((course, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (!supportedCourseSchemaVersions.some((value) => value === course.schemaVersion))
      issue(
        ["schemaVersion"],
        "Declarative learning policies require CoursePackage schemaVersion 1.3",
      );
    if (
      !["1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11", "1.12"].includes(course.schemaVersion) &&
      (course.acceptedVariants ||
        course.units.some((unit) =>
          unit.lessons.some((lesson) =>
            lesson.activities.some(
              (activity) => activity.variant || activity.evaluation?.answerPolicy,
            ),
          ),
        ))
    )
      issue(
        ["schemaVersion"],
        "Variant constraints and answer policies require CoursePackage schemaVersion 1.4",
      );
    const hasTextMetadata =
      course.units.some((unit) =>
        unit.lessons.some((lesson) => lesson.activities.some((activity) => activity.presentation)),
      ) ||
      course.interactiveLessons.some((lesson) =>
        lesson.segments.some(
          (segment) =>
            segment.presentation?.transcript.some((line) => line.textPresentation) ||
            segment.cues.some(({ action }) =>
              action.type === "caption.show"
                ? Boolean(action.textPresentation)
                : action.type === "board.show" &&
                  (action.element.kind === "comparison"
                    ? Boolean(action.element.leftPresentation || action.element.rightPresentation)
                    : Boolean(action.element.textPresentation)),
            ),
        ),
      );
    if (
      hasTextMetadata &&
      !["1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11", "1.12"].includes(course.schemaVersion)
    )
      issue(
        ["schemaVersion"],
        "Text presentation metadata requires CoursePackage schemaVersion 1.5",
      );
    if (course.schemaVersion !== "1.12" && course.interactiveLessons.some(lesson =>
      lesson.autoAdvancePresentations !== undefined || lesson.segments.some(segment =>
        segment.cues.some(({ action }) => action.type === "board.show" &&
          (action.element.illustration !== undefined || action.element.icon !== undefined ||
            (action.element.kind !== "comparison" && (action.element.label !== undefined || action.element.runs !== undefined)))))))
      issue(["interactiveLessons"], "Illustrated boards and automatic presentation sequences require CoursePackage 1.12");
    for (const message of learningAccessIssues(course)) issue(["units"], message);
    for (const message of teachingCourseIssues(course)) issue(["units"], message);
    const definitions = new Map(course.assessments.map((item) => [item.id, item]));
    const activityOwners = new Map(
      course.units.flatMap((unit) =>
        unit.lessons.flatMap((lesson) =>
          lesson.activities.map((activity) => [activity.id, { unit, lesson, activity }] as const),
        ),
      ),
    );
    const lessonOwners = new Map(
      course.units.flatMap((unit) => unit.lessons.map((lesson) => [lesson.id, unit.id] as const)),
    );
    const units = new Set(course.units.map((unit) => unit.id));
    const objectiveTypes = new Set<string>(objectiveActivityTypes);
    if (definitions.size !== course.assessments.length)
      issue(["assessments"], "Duplicate assessment ID");
    for (const [index, definition] of course.assessments.entries()) {
      const path = ["assessments", index];
      if (definition.unitId && !units.has(definition.unitId))
        issue([...path, "unitId"], "Unknown assessment unit");
      if (definition.lessonId && !lessonOwners.has(definition.lessonId))
        issue([...path, "lessonId"], "Unknown assessment lesson");
      if (
        definition.lessonId &&
        definition.unitId &&
        lessonOwners.get(definition.lessonId) !== definition.unitId
      )
        issue([...path, "lessonId"], "Assessment lesson belongs to another unit");
      for (const objective of definition.objectiveIds)
        if (!course.learningGoals.includes(objective))
          issue([...path, "objectiveIds"], `Unknown assessment objective: ${objective}`);
      const ids =
        definition.method === "adaptive"
          ? definition.bank.map((item) => item.activityId)
          : definition.activityIds;
      let objectiveCount = 0;
      for (const activityId of ids) {
        const owner = activityOwners.get(activityId);
        if (!owner) {
          issue(path, `Unknown assessment activity: ${activityId}`);
          continue;
        }
        if (definition.unitId && owner.unit.id !== definition.unitId)
          issue(path, `Activity outside assessment unit: ${activityId}`);
        if (definition.lessonId && owner.lesson.id !== definition.lessonId)
          issue(path, `Activity outside assessment lesson: ${activityId}`);
        if (objectiveTypes.has(owner.activity.type)) objectiveCount++;
        else if (definition.method === "adaptive" || owner.activity.type !== "writing")
          issue(path, `Unsupported assessment activity: ${activityId}`);
      }
      if (!objectiveCount) issue(path, "This assessment method requires objective questions");
      if (definition.method === "adaptive") {
        const sum = Object.values(definition.skillWeights).reduce(
          (total, weight) => total + weight,
          0,
        );
        if (Math.abs(sum - 1) > 0.02)
          issue([...path, "skillWeights"], "Assessment weights must sum to 1");
        for (const item of definition.bank) {
          if (!activityOwners.get(item.activityId)?.activity.skills.includes(item.skill))
            issue([...path, "bank"], `Assessment skill mismatch: ${item.activityId}/${item.skill}`);
        }
        for (const skill of new Set(definition.skillPlan)) {
          const required = definition.skillPlan.filter((item) => item === skill).length;
          const available = new Set(
            definition.bank
              .filter((item) => item.skill === skill && !item.ceiling)
              .map((item) => item.activityId),
          ).size;
          if (available < required)
            issue([...path, "bank"], `Not enough distinct ${skill} questions`);
        }
      }
      for (const skill of Object.keys(definition.passingPolicy.minimumBySkill ?? {}))
        if (
          definition.method === "adaptive"
            ? !definition.skillPlan.includes(skill as z.infer<typeof skillIdSchema>)
            : !ids.some((activityId) => {
                const activity = activityOwners.get(activityId)?.activity;
                return (
                  activity &&
                  objectiveTypes.has(activity.type) &&
                  activity.skills.includes(skill as z.infer<typeof skillIdSchema>)
                );
              })
        )
          issue([...path, "passingPolicy"], `Minimum requires unassessed skill: ${skill}`);
    }
    const validateRef = (
      reference: string | undefined,
      purpose: AssessmentPurpose,
      path: (string | number)[],
      unitId?: string,
    ) => {
      if (!reference) return;
      const definition = definitions.get(reference);
      if (!definition) {
        issue(path, `Unknown assessment reference: ${reference}`);
        return;
      }
      if (definition.purpose !== purpose)
        issue(path, `Assessment reference requires purpose ${purpose}`);
      if (
        unitId &&
        (definition.unitId ??
          (definition.lessonId ? lessonOwners.get(definition.lessonId) : undefined)) !== unitId
      )
        issue(path, "Assessment reference belongs to another scope");
    };
    validateRef(course.assessmentRefs.diagnostic, "diagnostic", ["assessmentRefs", "diagnostic"]);
    for (const [index, unit] of course.units.entries()) {
      validateRef(
        unit.assessmentRefs.diagnostic,
        "diagnostic",
        ["units", index, "assessmentRefs", "diagnostic"],
        unit.id,
      );
      validateRef(
        unit.assessmentRefs.final,
        "summative",
        ["units", index, "assessmentRefs", "final"],
        unit.id,
      );
      for (const reference of unit.assessmentRefs.formative)
        validateRef(
          reference,
          "formative",
          ["units", index, "assessmentRefs", "formative"],
          unit.id,
        );
      for (const group of ["completion", "mastery"] as const) {
        const requirements = unit.learningPolicy[group].requirements;
        const names = new Set<string>();
        for (const [ruleIndex, rule] of requirements.entries()) {
          const path = ["units", index, "learningPolicy", group, "requirements", ruleIndex];
          if (names.has(rule.id)) issue(path, "Duplicate policy requirement ID");
          names.add(rule.id);
          if (rule.kind === "unit_completed" && group === "completion")
            issue(path, "Completion cannot depend on itself");
          if ("activityIds" in rule) {
            for (const activityId of rule.activityIds) {
              const owner = activityOwners.get(activityId);
              if (!owner || owner.unit.id !== unit.id || !owner.lesson.active)
                issue(path, `Policy activity outside active unit: ${activityId}`);
              if (owner && rule.kind === "submission" && owner.activity.type !== rule.practice)
                issue(path, `Submission practice mismatch: ${activityId}`);
              if (
                owner &&
                rule.kind === "objective_score" &&
                (!objectiveTypes.has(owner.activity.type) ||
                  (rule.skill && !owner.activity.skills.includes(rule.skill)))
              )
                issue(path, `Incompatible objective evidence: ${activityId}`);
            }
            const required =
              rule.kind === "participation"
                ? (rule.minimumCount ?? rule.activityIds.length)
                : rule.kind === "submission"
                  ? rule.minimumCount
                  : rule.kind === "objective_score"
                    ? rule.minimumSamples
                    : undefined;
            if (required && required > rule.activityIds.length)
              issue(path, "Required evidence count exceeds declared activities");
          }
          if (rule.kind === "review_score") {
            for (const wordId of rule.vocabularyIds) {
              const word = course.lexicon.find((item) => item.id === wordId);
              if (!word?.lessonId || lessonOwners.get(word.lessonId) !== unit.id)
                issue(path, `Policy vocabulary outside unit: ${wordId}`);
            }
            if (rule.minimumSamples > rule.vocabularyIds.length + rule.activityIds.length)
              issue(path, "Required review evidence exceeds declared targets");
          }
          if (rule.kind === "assessment") {
            validateRef(rule.assessmentId, rule.purpose, path);
            const definition = definitions.get(rule.assessmentId);
            const owner =
              definition?.unitId ??
              (definition?.lessonId ? lessonOwners.get(definition.lessonId) : undefined);
            if (owner && owner !== unit.id)
              issue(path, "Policy assessment belongs to another unit");
          }
        }
      }
    }
    const goals = new Set(course.supportedGoals ?? ["general"]);
    const contexts = new Set<string>();
    for (const entry of course.contexts ?? []) {
      if (!goals.has(entry.goal))
        ctx.addIssue({ code: "custom", message: `Unsupported goal for context ${entry.id}` });
      if (contexts.has(entry.id))
        ctx.addIssue({ code: "custom", message: `Duplicate context ${entry.id}` });
      contexts.add(entry.id);
    }
    for (const item of [
      ...course.missions,
      ...course.roleplays,
      ...course.units.flatMap((unit) =>
        unit.lessons.flatMap((lesson) => [
          ...lesson.activities,
          ...(lesson.deferredRecovery?.rules.map((rule) => rule.activity) ?? []),
        ]),
      ),
    ]) {
      for (const goal of item.goals ?? [])
        if (!goals.has(goal))
          ctx.addIssue({ code: "custom", message: `Unsupported content goal ${goal}` });
      for (const context of item.contexts ?? [])
        if (!contexts.has(context))
          ctx.addIssue({ code: "custom", message: `Unknown content context ${context}` });
    }
  });
export type CoursePackage = z.infer<typeof coursePackageSchema>;
// Definitions contain references and policy only. Answers live in private activities.
export type PublicAssessment = AssessmentDefinition;
export type ActivityContract = z.infer<typeof activitySchema>;
