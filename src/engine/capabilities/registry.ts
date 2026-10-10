import { z } from "zod";
import {
  activityPayloadSchemas,
  activityTypeSchema,
  normalizationRulesSchema,
  objectiveActivityTypes,
  legacyOrderingPayloadSchema,
  legacyWritingPayloadSchema,
} from "@/content/activity-data";
import {
  assessmentSchema,
  interactiveLessonSchema,
  lexiconEntrySchema,
  alphabetModuleSchema,
  numbersModuleSchema,
  regionalVariantsModuleSchema,
  missionSchema,
} from "@/content/contracts";
import { unitLearningPolicySchema } from "@/content/learning-policies";
import { capabilityRequirementsSchema } from "@/content/capability-contracts";
import { reconstructionSchema, textMeasureSchema } from "@/content/text-strategies";
import {
  reconstructText,
  writingRequirement,
  textMeasureAvailability,
  orderingTokens,
} from "@/engine/text/representation";
import { activityVariantSchema, answerPolicySchema } from "@/content/variant-contracts";
import { activityPresentationSchema, textDirectionSchema } from "@/content/text-presentation";

export type ImplementationReference = { file: string; symbol: string; method?: string };
// Internal references checked by AST, never loaded from content or exported to producers.
export const executionBindings = {
  textDirection: { file: "src/engine/presentation/text.ts", symbol: "resolveTextPresentation" },
  bidiText: { file: "src/components/learning/text-presentation.tsx", symbol: "LearningText" },
  textInput: { file: "src/components/learning/text-presentation.tsx", symbol: "LearningInput" },
  variant: { file: "src/engine/variants/resolution.ts", symbol: "resolveLearningVariant" },
  answerPolicy: { file: "src/engine/variants/answers.ts", symbol: "declaredAnswers" },
  reconstruction: { file: "src/engine/text/representation.ts", symbol: "reconstructText" },
  measurement: { file: "src/engine/text/representation.ts", symbol: "measureText" },
  activity: { file: "src/components/activities/activity-renderer.tsx", symbol: "ActivityRenderer" },
  objective: { file: "src/domain/activities/grader.ts", symbol: "gradeActivity" },
  normalization: { file: "src/domain/activities/grader.ts", symbol: "normalizeAnswer" },
  assessment: { file: "src/domain/assessments/assessment-engine.ts", symbol: "evaluateAssessment" },
  policy: { file: "src/domain/study/learning-policy-engine.ts", symbol: "evaluateUnitPolicies" },
  spacedReview: {
    file: "src/domain/review/review-scheduler.ts",
    symbol: "ReviewScheduler",
    method: "afterAnswer",
  },
  interactive: { file: "src/domain/interactive-lesson/runtime.ts", symbol: "reduceRuntime" },
  recording: {
    file: "src/components/activities/speaking-recorder.tsx",
    symbol: "SpeakingRecorder",
  },
  tts: { file: "src/lib/speak-text.ts", symbol: "speakText" },
  audio: { file: "src/components/activities/audio-player.tsx", symbol: "AudioPlayer" },
  media: {
    file: "src/domain/interactive-lesson/presentation-controller.ts",
    symbol: "HtmlMediaPresentationController",
    method: "play",
  },
  recognition: { file: "src/lib/transcribe-speech.ts", symbol: "transcribeWav" },
  pronunciation: { file: "src/app/api/pronunciation/route.ts", symbol: "POST" },
  writingAI: {
    file: "src/domain/ai/ai-provider.ts",
    symbol: "OpenAIProvider",
    method: "correctWriting",
  },
  conversationAI: {
    file: "src/domain/ai/ai-provider.ts",
    symbol: "OpenAIProvider",
    method: "conversationTurn",
  },
  microLessonAI: {
    file: "src/domain/ai/ai-provider.ts",
    symbol: "OpenAIProvider",
    method: "generateMicroLesson",
  },
  tutorAI: { file: "src/domain/ai/ai-provider.ts", symbol: "OpenAIProvider", method: "tutor" },
  dictionary: { file: "src/domain/vocabulary/dictionary-search.ts", symbol: "searchDictionary" },
  alphabet: { file: "src/components/basics/alphabet-guide.tsx", symbol: "AlphabetGuide" },
  numbers: { file: "src/components/numbers/number-practice.tsx", symbol: "NumberPractice" },
  numbersDisplay: { file: "src/components/basics/number-guide.tsx", symbol: "NumberGuide" },
  imageAI: {
    file: "src/domain/ai/ai-provider.ts",
    symbol: "OpenAIProvider",
    method: "evaluateImageDescription",
  },
  interactiveAI: {
    file: "src/domain/ai/ai-provider.ts",
    symbol: "OpenAIProvider",
    method: "teachInteractiveLesson",
  },
  regions: { file: "src/components/basics/regional-guide.tsx", symbol: "RegionalGuide" },
} satisfies Record<string, ImplementationReference>;
export type OperationalDependency =
  | "client.recording"
  | "client.audio_output"
  | "client.media_playback"
  | "speech.recognition_service"
  | "speech.pronunciation_service"
  | "ai.text_service"
  | "learning.session_store";
export type CapabilityDefinition = {
  id: string;
  versions: readonly string[];
  description: string;
  support: "implemented" | "partial" | "declared" | "not_implemented";
  schema: z.ZodType;
  versionSchemas?: Readonly<Record<string, z.ZodType>>;
  executor?: keyof typeof executionBindings;
  presentation?: ImplementationReference;
  evidence: readonly string[];
  dependencies?: readonly string[];
  operational?: readonly OperationalDependency[];
  restrictions?: readonly string[];
  semantic?: (data: unknown) => string[];
};
export type CapabilityRegistry = ReadonlyMap<string, CapabilityDefinition>;
const empty = z.object({}).strict();
const referenceText = z.object({ referenceText: z.string().trim().min(1) }).strict();
const one = (
  id: string,
  schema: z.ZodType,
  executor: CapabilityDefinition["executor"],
  description: string,
  extra: Partial<CapabilityDefinition> = {},
): CapabilityDefinition => ({
  id,
  versions: ["1.0.0"],
  description,
  support: "implemented",
  schema,
  executor,
  evidence: [],
  ...extra,
});
const objectiveTypes = new Set<string>(objectiveActivityTypes);
const semantics = (type: string, raw: unknown) => {
  const data = raw as {
    options?: string[];
    answer?: string;
    words?: string[];
    media?: unknown;
    reconstruction?: { strategy: "separator"; separator: string };
    answerOrder?: number[];
    minWords?: number;
    textRequirement?: unknown;
  };
  const errors: string[] = [];
  if (objectiveTypes.has(type) && !data.answer?.trim())
    errors.push(
      "The canonical answer must be usable by the interaction; empty answers cannot be submitted.",
    );
  if (data.options?.some((option) => !option.trim())) errors.push("Options cannot be empty.");
  if (type !== "listening" && data.media)
    errors.push(
      "This interaction does not play payload media; use a listening or interactive presentation capability.",
    );
  if (
    data.options &&
    (!data.options.includes(data.answer!) || new Set(data.options).size !== data.options.length)
  )
    errors.push("Options must be distinct and contain the canonical answer.");
  if (type === "ordering") {
    try {
      orderingTokens("validation", data.words!);
    } catch {
      errors.push("Tokens require well-formed Unicode strings.");
      return errors;
    }
    if (data.reconstruction || data.answerOrder) {
      const order = data.answerOrder;
      if (
        !order ||
        order.length !== data.words!.length ||
        new Set(order).size !== order.length ||
        order.some((i) => i < 0 || i >= data.words!.length)
      )
        errors.push(
          "Explicit reconstruction requires a canonical permutation of all source positions.",
        );
      else if (
        reconstructText(
          order.map((i) => data.words![i]),
          data.reconstruction,
        ).normalize("NFC") !== data.answer!.normalize("NFC")
      )
        errors.push(
          "Canonical answer does not match its declared source permutation and reconstruction.",
        );
      return errors;
    }
    const tokens = (s: string) =>
      s
        .normalize("NFC")
        .toLowerCase()
        .replace(/[?!.,;:]/gu, "")
        .trim()
        .split(/\s+/u)
        .sort();
    if (JSON.stringify(tokens(data.words!.join(" "))) !== JSON.stringify(tokens(data.answer!)))
      errors.push(
        "The answer must be obtainable by ordering the supplied tokens (including repetitions).",
      );
  }
  if (type === "writing") {
    try {
      writingRequirement(data);
    } catch {
      errors.push("Writing must declare exactly one valid textRequirement or legacy minWords.");
    }
  }
  return errors;
};
export const capabilityDefinitions: readonly CapabilityDefinition[] = [
  one(
    "presentation.direction",
    z.object({ direction: textDirectionSchema }).strict(),
    "textDirection",
    "Resolve explicit horizontal text direction from language and content metadata; interface controls remain separate.",
    {
      restrictions: [
        "LTR, RTL and auto only; no vertical typography or language-specific writing algorithm.",
      ],
    },
  ),
  one(
    "presentation.bidi",
    activityPresentationSchema,
    "bidiText",
    "Isolate plain educational text using HTML dir/bdi and logical CSS; retain logical Unicode data.",
    {
      restrictions: [
        "Plain text and independent fragments only; no arbitrary rich markup or guarantee of editorial correctness. Directional controls are preserved and flagged, not made harmless by isolation.",
      ],
    },
  ),
  one(
    "text.input",
    activityPresentationSchema,
    "textInput",
    "Native text inputs with auto direction, original values, selection and composition-aware keyboard handling.",
    {
      restrictions: [
        "Native browser input; tested in Chromium with synthetic composition. Real device IMEs and screen readers require manual qualification.",
      ],
    },
  ),
  one(
    "linguistic.variant",
    activityVariantSchema,
    "variant",
    "Resolve declared activity variant restrictions; operational availability never changes the pedagogical variant.",
  ),
  one(
    "linguistic.answers",
    answerPolicySchema,
    "answerPolicy",
    "Filter author-declared answer alternatives by effective variant and explicit required whole forms; never infer equivalences.",
  ),
  one(
    "text.reconstruction",
    reconstructionSchema,
    "reconstruction",
    "Join supplied elements using an explicit literal separator, including no separator.",
  ),
  one(
    "text.measurement",
    textMeasureSchema,
    "measurement",
    "Count whitespace units, Unicode code points, graphemes or locale-dependent word-like segments.",
    {
      restrictions: [
        "Intl strategies require native Intl.Segmenter; intl_words also requires an explicitly supported BCP 47 locale. Results depend on runtime Unicode/ICU data; not universal linguistic correctness.",
      ],
      semantic: (data) => {
        try {
          textMeasureAvailability(data as Parameters<typeof textMeasureAvailability>[0]);
          return [];
        } catch {
          return ["Invalid text measure or locale."];
        }
      },
    },
  ),
  ...activityTypeSchema.options.map((type) =>
    one(
      `activity.${type}`,
      activityPayloadSchemas[type],
      "activity",
      `Execute ${type} using the existing activity interaction.`,
      {
        ...(type === "ordering"
          ? {
              versions: ["1.0.0", "1.1.0"],
              versionSchemas: {
                "1.0.0": legacyOrderingPayloadSchema,
                "1.1.0": activityPayloadSchemas.ordering,
              },
            }
          : {}),
        ...(type === "writing"
          ? {
              versions: ["1.0.0", "1.1.0"],
              versionSchemas: {
                "1.0.0": legacyWritingPayloadSchema,
                "1.1.0": activityPayloadSchemas.writing,
              },
            }
          : {}),
        evidence: objectiveTypes.has(type)
          ? ["participation", "objective_answer"]
          : type === "writing"
            ? ["writing_submission"]
            : type === "speaking"
              ? ["speaking_submission"]
              : ["participation"],
        dependencies: objectiveTypes.has(type)
          ? ["grading.exact-normalized"]
          : type === "speaking"
            ? ["speech.recording"]
            : [],
        semantic: (data) => semantics(type, data),
        restrictions:
          type === "quiz"
            ? ["Presentation/participation marker only; not an assessment."]
            : type === "ordering"
              ? [
                  "The canonical answer uses exactly the supplied tokens, including repetitions.",
                  "Version 1.0.0 preserves space joining; 1.1.0 supports a literal separator and a private canonical source permutation. Occurrences have separate identities.",
                ]
              : ["multiple_choice", "listening"].includes(type)
                ? ["Options are distinct and contain the canonical answer."]
                : [],
      },
    ),
  ),
  one(
    "grading.exact-normalized",
    empty,
    "objective",
    "Compare against canonical answers with declared normalization.",
    { evidence: ["objective_answer"] },
  ),
  one(
    "text.normalization",
    normalizationRulesSchema,
    "normalization",
    "NFC, whitespace, case and configured punctuation/diacritics.",
    {
      restrictions: [
        "Combining marks U+0300–U+036F only when diacritics are ignored; not a morphological analyzer.",
      ],
    },
  ),
  one(
    "assessment.fixed",
    assessmentSchema,
    "assessment",
    "Execute an explicitly referenced fixed assessment.",
    {
      dependencies: ["grading.exact-normalized"],
      evidence: ["server_assessment_result"],
      semantic: (data) =>
        (data as { method: string }).method === "fixed"
          ? []
          : ["This capability requires method=fixed."],
      presentation: {
        file: "src/components/activities/fixed-assessment-runner.tsx",
        symbol: "FixedAssessmentRunner",
      },
    },
  ),
  one(
    "assessment.adaptive",
    assessmentSchema,
    "assessment",
    "Execute a declared adaptive skill plan and bank.",
    {
      dependencies: ["grading.exact-normalized"],
      evidence: ["server_assessment_result"],
      semantic: (data) =>
        (data as { method: string }).method === "adaptive"
          ? []
          : ["This capability requires method=adaptive."],
      presentation: {
        file: "src/components/activities/adaptive-assessment-runner.tsx",
        symbol: "AdaptiveAssessmentRunner",
      },
    },
  ),
  one(
    "policy.unit",
    unitLearningPolicySchema,
    "policy",
    "Interpret AND completion and estimated mastery policies.",
    { evidence: ["derived_policy_state"] },
  ),
  one("review.spaced", empty, "spacedReview", "Schedule vocabulary and mistake recall.", {
    evidence: ["review_result", "review_schedule"],
  }),
  one(
    "lesson.interactive",
    interactiveLessonSchema,
    "interactive",
    "Run a finite authored timeline, board and checkpoints.",
    {
      evidence: ["interactive_session_state"],
      operational: ["learning.session_store"],
      presentation: {
        file: "src/components/interactive-lesson/interactive-classroom.tsx",
        symbol: "InteractiveClassroom",
      },
      restrictions: [
        "Only actions accepted by lessonActionSchema; learning evidence comes from referenced activities.",
        "Automatic curriculum generation/adaptation is not part of this capability.",
      ],
    },
  ),
  one(
    "speech.recording",
    empty,
    "recording",
    "Record up to 20 seconds and save a learner-provided transcript.",
    { operational: ["client.recording"], evidence: ["speaking_submission"] },
  ),
  one("speech.tts", empty, "tts", "Read supplied text using a configured browser locale.", {
    operational: ["client.audio_output"],
    restrictions: ["Voices vary by device; availability is probed on the client."],
  }),
  one(
    "media.audio",
    z.object({ src: z.string().min(1) }).strict(),
    "audio",
    "Play an authored audio source.",
    {
      operational: ["client.media_playback"],
    },
  ),
  one(
    "media.presentation",
    z.object({ src: z.string().min(1), type: z.enum(["audio", "video"]) }).strict(),
    "media",
    "Control authored audio/video playback.",
    {
      operational: ["client.media_playback"],
    },
  ),
  one(
    "speech.recognition",
    empty,
    "recognition",
    "Transcribe 16 kHz mono PCM WAV audio, up to 20 seconds.",
    { operational: ["speech.recognition_service"], evidence: ["transcription"] },
  ),
  one(
    "speech.pronunciation",
    referenceText,
    "pronunciation",
    "Compare a recording to a canonical reference phrase.",
    {
      operational: ["speech.pronunciation_service"],
      evidence: ["pronunciation_feedback"],
      restrictions: ["Requires a supported locale; probabilistic feedback, not certified mastery."],
    },
  ),
  one(
    "ai.writing_feedback",
    empty,
    "writingAI",
    "Give writing feedback without an official objective grade.",
    { operational: ["ai.text_service"], evidence: ["writing_feedback"] },
  ),
  one("ai.conversation", empty, "conversationAI", "Converse freely with contextual corrections.", {
    operational: ["ai.text_service"],
    evidence: ["conversation_turn"],
  }),
  one(
    "ai.conversation_mission",
    missionSchema,
    "conversationAI",
    "Converse with authored objectives and quoted evidence.",
    { operational: ["ai.text_service"], evidence: ["conversation_turn", "objective_quote"] },
  ),
  one(
    "ai.micro_lesson",
    empty,
    "microLessonAI",
    "Generate a micro lesson from an existing mistake.",
    {
      operational: ["ai.text_service"],
      evidence: ["micro_lesson_response"],
      restrictions: [
        "Requires an existing learner mistake and generated questions are validated before use.",
      ],
    },
  ),
  one("ai.tutor", empty, "tutorAI", "Explain the current learning context.", {
    operational: ["ai.text_service"],
  }),
  one(
    "ai.image_description",
    z.object({ facts: z.array(z.string().min(1)).min(1) }).strict(),
    "imageAI",
    "Compare a learner description to authored image facts, without reinterpreting the image on each request.",
    {
      operational: ["ai.text_service"],
      evidence: ["image_description_feedback"],
      restrictions: [
        "Needs an authored image scene and canonical facts; not an image generation/import capability.",
      ],
    },
  ),
  one(
    "ai.interactive_support",
    empty,
    "interactiveAI",
    "Explain or give an alternative example during a paused interactive lesson.",
    {
      operational: ["ai.text_service"],
      evidence: ["tutor_intervention"],
      restrictions: [
        "Does not generate a replacement curriculum or automatically establish mastery.",
      ],
    },
  ),
  one(
    "lexicon.dictionary",
    z.object({ entries: z.array(lexiconEntrySchema) }).strict(),
    "dictionary",
    "Search supplied lexical entries and meanings.",
  ),
  one(
    "fundamentals.alphabet",
    z.object({ entries: alphabetModuleSchema }).strict(),
    "alphabet",
    "Display letters, names and examples.",
  ),
  one(
    "fundamentals.regional_variants",
    z.object({ entries: regionalVariantsModuleSchema }).strict(),
    "regions",
    "Compare authored regional terms and examples.",
  ),
  one(
    "fundamentals.numbers",
    numbersModuleSchema,
    undefined,
    "Display authored numbers and examples.",
    {
      executor: "numbersDisplay",
    },
  ),
  one(
    "numbers.dictation",
    numbersModuleSchema,
    "numbers",
    "Practice authored numbers in the existing limited notation.",
    {
      support: "partial",
      restrictions: [
        "ASCII digits, limited currency and ordinal notation; not a universal number parser.",
      ],
    },
  ),
];
export function createCapabilityRegistry(
  definitions: readonly CapabilityDefinition[],
): CapabilityRegistry {
  const result = new Map<string, CapabilityDefinition>();
  for (const definition of definitions) {
    if (result.has(definition.id)) throw new Error(`Duplicate capability: ${definition.id}`);
    if (
      definition.support === "implemented" &&
      (!definition.executor || !executionBindings[definition.executor])
    )
      throw new Error(`Implemented capability has no verified executor: ${definition.id}`);
    result.set(definition.id, definition);
  }
  return result;
}
export const capabilityRegistry = createCapabilityRegistry(capabilityDefinitions);
/** Portable schemas/constraints only; no payload instances, answers, secrets or private source paths. */
export function capabilityCatalog(registry: CapabilityRegistry = capabilityRegistry) {
  return {
    catalogVersion: "1.3.0",
    versionRule: "explicit-exact-allowlist",
    packageSchemas: {
      language: "1.1",
      course: "1.5",
      acceptedCourseVersions: ["1.3", "1.4", "1.5"],
    },
    requirementsSchema: z.toJSONSchema(capabilityRequirementsSchema, { io: "input" }),
    rules: [
      "Native content implies mandatory capabilities; optional additions never waive native requirements or evidence policies.",
      "Optional requirements always need a validated alternative. Selection does not fabricate evidence or execute external code.",
      "Provider/browser availability is a separate environment check; configuration does not prove a live provider is healthy.",
      "Package references, activity ownership and declarative policies must also pass package semantic validation.",
    ],
    capabilities: [...registry.values()].map((entry) => ({
      id: entry.id,
      supportedVersions: [...entry.versions],
      support: entry.support,
      description: entry.description,
      dataSchema: z.toJSONSchema(entry.schema, { io: "input" }),
      ...(entry.versionSchemas
        ? {
            dataSchemasByVersion: Object.fromEntries(
              Object.entries(entry.versionSchemas).map(([version, schema]) => [
                version,
                z.toJSONSchema(schema, { io: "input" }),
              ]),
            ),
          }
        : {}),
      evidence: [...entry.evidence],
      dependencies: [...(entry.dependencies ?? [])],
      operationalDependencies: [...(entry.operational ?? [])],
      restrictions: [...(entry.restrictions ?? [])],
      semanticValidation: Boolean(entry.semantic),
    })),
  };
}
