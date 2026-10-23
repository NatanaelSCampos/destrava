import assert from "node:assert/strict";
import type OpenAI from "openai";
import { loadContent } from "./content-loader";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse } from "../src/content/public";
import { allActivities } from "../src/content/schema";
import { requireLearningVariant, resolveLearningVariant } from "../src/engine/variants/resolution";
import { resolveSpeechOperation, selectBrowserVoice } from "../src/engine/variants/speech";
import { activityVariantSchema } from "../src/content/variant-contracts";
import { gradeActivity, normalizeAnswer } from "../src/domain/activities/grader";
import { OpenAIProvider } from "../src/domain/ai/ai-provider";
import { buildLinguisticAIContext } from "../src/domain/ai/linguistic-context";
import { transcribeWav } from "../src/lib/transcribe-speech";
import { activitySeedPayload } from "../src/repositories/activity-content-projection";
import { userCourseVariant } from "../src/lib/user-course-variant";
import { createSupabaseServerClient } from "../src/lib/supabase/server";
import { capabilityRegistry, capabilityCatalog } from "../src/engine/capabilities/registry";
import { checkCapabilityImplementations } from "./capability-implementation-check";
import { courseWithDeviceAvailability } from "../src/lib/client-capabilities";
import { createAssessmentApi, type StoredAssessmentRow } from "../src/lib/assessment-api";
import { readCourseState, writeCourseState } from "../src/domain/study/course-state-storage";
import {
  StudyProgressSync,
  type StudySyncCacheEntry,
} from "../src/domain/study/study-progress-sync";
import { orderingTokens, orderingAnswer, measureText } from "../src/engine/text/representation";

const inputs = loadContent();
const raw = structuredClone(inputs.find((item) => item.language.id === "en")!);
raw.course.schemaVersion = "1.4";
raw.course.defaultVariant = "en-GB";
raw.course.acceptedVariants = ["en-US", "en-GB"];
const authored = raw.course.units[0].lessons[0].activities[0];
authored.type = "short_answer";
authored.payload = { answer: "colour", accepted: [] };
authored.evaluation = {
  strategy: "exact-normalized",
  answerPolicy: { alternatives: [{ text: "color", variants: ["en-US"] }, { text: "shade" }] },
};
raw.course.assessments = [
  {
    id: "variant-assessment",
    title: "Synthetic variant assessment",
    purpose: "diagnostic",
    method: "fixed",
    objectiveIds: [],
    gradingStrategy: "objective_mean",
    passingPolicy: { overall: 1 },
    activityIds: [authored.id],
  },
];
raw.course.assessmentRefs = { diagnostic: "variant-assessment" };
for (const unit of raw.course.units) {
  unit.assessmentRefs = { formative: [] };
  unit.learningPolicy = { completion: { requirements: [] }, mastery: { requirements: [] } };
}
const bundle = runtimeBundle(raw),
  { language, course } = bundle;
const activity = allActivities(course).find((item) => item.id === authored.id)!;
const context = (preference?: unknown) => ({ language, course, preference });
let checks = 0,
  properties = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("External network prohibited in variant tests");
};
async function check(name: string, run: () => unknown | Promise<unknown>) {
  await run();
  checks++;
  console.log(`OK ${name}`);
}

async function main() {
  await check(
    "server preference reader handles course rows, legacy, missing data and read failures with mocked storage",
    async () => {
      let row: unknown = { profile: { variantId: "en-US" }, courseId: course.id };
      let legacy: unknown = null,
        error: unknown = null;
      const calls: string[] = [];
      const getClient = async () =>
        ({
          from: (table: string) => {
            calls.push(table);
            const query = {
              select: () => query,
              eq: (key: string, value: string) => {
                if (key === "course_id") assert.equal(value, course.id);
                if (key === "user_id") assert.equal(value, "synthetic-user");
                return query;
              },
              maybeSingle: async () => ({
                data:
                  (table === "user_course_state" ? row : legacy) === null
                    ? null
                    : { state: table === "user_course_state" ? row : legacy },
                error,
              }),
            };
            return query;
          },
        }) as unknown as NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
      const read = () =>
        userCourseVariant("synthetic-user", course.id, language, course, undefined, getClient);
      assert.equal(await read(), "en-US");
      assert.deepEqual(calls, ["user_course_state"]);
      row = null;
      legacy = { schemaVersion: 2, courses: { [course.id]: { profile: { variantId: "en-US" } } } };
      assert.equal(await read(), "en-US");
      assert(calls.includes("user_study_state"));
      legacy = null;
      assert.equal(await read(), "en-GB");
      row = { profile: { variantId: "not-supported" }, courseId: course.id };
      assert.equal(await read(), "en-GB");
      error = new Error("synthetic read failure");
      await assert.rejects(read);
      error = null;
      row = { profile: [], courseId: course.id };
      await assert.rejects(read);
    },
  );
  await check("course default survives runtime projection and overrides language fallback", () => {
    assert.equal(course.defaultVariant, "en-GB");
    assert.equal(course.sourceLanguage, raw.course.sourceLanguage);
    assert.equal(requireLearningVariant(language, course).variantId, "en-GB");
  });
  await check("valid preference personalizes course default; absence uses course", () => {
    assert.equal(requireLearningVariant(language, course, "en-US").selectedBy, "preference");
    for (const missing of [undefined, null, ""])
      assert.equal(requireLearningVariant(language, course, missing).variantId, "en-GB");
  });
  await check("invalid and unsupported preferences produce explicit diagnostics", () => {
    assert.equal(
      requireLearningVariant(language, course, "general").diagnostics[0].code,
      "UNSUPPORTED_PREFERENCE",
    );
    for (const value of ["missing", {}, 1])
      assert.equal(
        requireLearningVariant(language, course, value).diagnostics[0].code,
        "INVALID_PREFERENCE",
      );
  });
  await check("mandatory activity wins with explicit conflict, preserving preference", () => {
    const selected = requireLearningVariant(language, course, "en-US", {
      requiredVariant: "en-GB",
    });
    assert.equal(selected.variantId, "en-GB");
    assert.equal(selected.preference, "en-US");
    assert.equal(selected.diagnostics[0].code, "PREFERENCE_CONFLICT");
    assert.equal(selected.speechFallback, "exact");
  });
  await check(
    "invalid authored configuration blocks instead of silently choosing another variant",
    () => {
      assert.equal(
        resolveLearningVariant(language, { defaultVariant: "unknown" }).status,
        "invalid",
      );
      assert.equal(
        resolveLearningVariant(language, course, "en-US", { acceptedVariants: ["en-GB"] }).status,
        "invalid",
      );
      assert.equal(
        resolveLearningVariant(language, course, "en-US", { requiredVariant: "general" }).status,
        "invalid",
      );
      assert(
        !activityVariantSchema.safeParse({
          requiredVariant: "en-GB",
          speechFallback: "same_language",
        }).success,
      );
      assert(!activityVariantSchema.safeParse({ acceptedVariants: ["en-GB", "en-GB"] }).success);
      const invalid = structuredClone(raw);
      invalid.course.schemaVersion = "1.3";
      assert.throws(() => runtimeBundle(invalid));
      invalid.course.schemaVersion = "1.4";
      invalid.course.defaultVariant = "missing";
      assert.throws(() => runtimeBundle(invalid));
    },
  );
  await check(
    "declared alternatives are contextual equivalences; other forms stay distinct",
    () => {
      assert(gradeActivity(activity, "color", language.normalization, context("en-US"))!.correct);
      assert(!gradeActivity(activity, "color", language.normalization, context("en-GB"))!.correct);
      assert(gradeActivity(activity, "shade", language.normalization, context("en-GB"))!.correct);
      assert(!gradeActivity(activity, "hue", language.normalization, context("en-US"))!.correct);
      const restricted = {
        ...activity,
        answerPolicy: { ...activity.answerPolicy, requiredForms: ["colour"] },
      };
      assert(
        !gradeActivity(restricted, "shade", language.normalization, context("en-GB"))!.correct,
      );
      assert(
        gradeActivity(restricted, " COLOUR. ", language.normalization, context("en-GB"))!.correct,
      );
      assert.throws(() => gradeActivity(activity, "color"));
      const blank = {
        ...activity,
        type: "fill_blank" as const,
        answer: "colour",
        accepted: [],
        fullAnswers: ["a colour"],
        answerPolicy: { requiredForms: ["colour"] },
      };
      assert.equal(
        gradeActivity(blank, "colour", language.normalization, context("en-GB"))!.completeAnswer,
        undefined,
      );
      assert(
        !gradeActivity(
          { ...activity, variant: { requiredVariant: "en-GB" } },
          "color",
          language.normalization,
          context("en-US"),
        )!.correct,
      );
    },
  );
  await check(
    "private equivalence classification reaches AI as status, without exported answer strings",
    () => {
      assert.equal(
        buildLinguisticAIContext(course, language, "pt-BR", "en-US", activity.id, "color").activity!
          .declaredResponse,
        "authorized",
      );
      assert.equal(
        buildLinguisticAIContext(course, language, "pt-BR", "en-GB", activity.id, "color").activity!
          .declaredResponse,
        "other_variant",
      );
      const projected = JSON.stringify(
        buildLinguisticAIContext(course, language, "pt-BR", "en-US", activity.id, "hue"),
      );
      assert(
        !projected.includes("colour") &&
          !projected.includes("shade") &&
          !projected.includes('"alternatives"'),
      );
    },
  );
  const modelRequests: Array<Record<string, unknown>> = [];
  let feedback: unknown = {
    correctedText: "hello",
    errors: [],
    naturalness: [],
    optionalSuggestions: [],
    score: { grammar: 90, vocabulary: 90, clarity: 90 },
  };
  const provider = new OpenAIProvider({
    responses: {
      parse: async (request: Record<string, unknown>) => {
        modelRequests.push(request);
        return {
          output_parsed: feedback,
          model: "synthetic-model",
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      },
    },
  } as unknown as Pick<OpenAI, "responses">);
  await check(
    "actual writing adapter propagates variant, source, target, level and restrictions with mock transport",
    async () => {
      const current = structuredClone(course);
      const writing = allActivities(current).find((item) => item.type === "writing")!;
      writing.variant = { requiredVariant: "en-GB" };
      await provider.correctWriting({
        course: current,
        language,
        sourceLanguage: "pt-BR",
        variantId: "en-US",
        activityId: writing.id,
        text: "A synthetic student sentence.",
      });
      const request = modelRequests.at(-1)!;
      const messages = request.input as Array<{ content: string }>;
      const data = JSON.parse(messages[1].content);
      assert.equal(data.linguisticContext.variantId, "en-GB");
      assert.equal(data.linguisticContext.sourceLanguage, "pt-BR");
      assert.equal(data.linguisticContext.targetLanguage, "en");
      assert.equal(data.linguisticContext.level, course.level);
      assert.equal(data.linguisticContext.activity.variant.requiredVariant, "en-GB");
      assert(messages[0].content.includes("Never invent equivalences"));
      assert.equal(request.store, false);
      assert.equal(request.max_output_tokens, 900);
      writing.answerPolicy = {
        alternatives: [{ text: "A synthetic student sentence.", variants: ["en-GB"] }],
      };
      feedback = {
        correctedText: "changed",
        errors: [
          { excerpt: "synthetic", correction: "changed", explanation: "incorrect mock assertion" },
        ],
        naturalness: [],
        optionalSuggestions: [],
        score: { grammar: 90, vocabulary: 90, clarity: 90 },
      };
      await assert.rejects(
        () =>
          provider.correctWriting({
            course: current,
            language,
            sourceLanguage: "pt-BR",
            variantId: "en-US",
            activityId: writing.id,
            text: "A synthetic student sentence.",
          }),
        /contradicts/,
      );
      feedback = {};
      await assert.rejects(() =>
        provider.correctWriting({
          course,
          language,
          sourceLanguage: "pt-BR",
          variantId: "en-GB",
          activityId: writing.id,
          text: "synthetic",
        }),
      );
    },
  );
  await check(
    "conversation, image and interactive oral-support adapters preserve linguistic context with mocks",
    async () => {
      const linguisticContext = buildLinguisticAIContext(course, language, "pt-BR", "en-US");
      feedback = {
        reply: "hello",
        correction: "",
        correctionCategory: "none",
        completedObjectiveIds: [],
        objectiveEvidence: [],
      };
      await provider.conversationTurn({
        topic: "test",
        pace: "beginner",
        correction: "instant",
        history: [],
        message: "hello",
        context: {
          course: "test",
          language: "en",
          sourceLanguage: "pt-BR",
          level: "A1",
          unit: "test",
          goal: "general",
          knownWords: 0,
          difficulty: [],
          region: "en-US",
          referenceVocabulary: [],
          linguisticContext,
        },
      });
      let messages = modelRequests.at(-1)!.input as Array<{ content: string }>;
      assert.deepEqual(
        JSON.parse(messages[1].content).learner.linguisticContext,
        linguisticContext,
      );
      feedback = { observed: "test", strength: "test", correction: "", nextSentence: "test" };
      await provider.evaluateImageDescription({
        language: "en",
        sourceLanguage: "pt-BR",
        level: "A1",
        sceneTitle: "test",
        sceneFacts: [],
        transcript: "test",
        region: "en-US",
        linguisticContext,
      });
      messages = modelRequests.at(-1)!.input as Array<{ content: string }>;
      assert.deepEqual(JSON.parse(messages[1].content).linguisticContext, linguisticContext);
      feedback = {
        message: "Synthetic teacher answer",
        example: "",
        translation: "",
        followUp: "",
        canResume: true,
      };
      await provider.teachInteractiveLesson({
        language,
        sourceLanguage: "pt-BR",
        level: "A1",
        variantId: "en-US",
        lessonTitle: "test",
        segmentTitle: "test",
        explanation: "test",
        transcript: "test",
        concepts: [],
        question: "test",
        goal: "general",
        mistakes: [],
        linguisticContext,
      });
      messages = modelRequests.at(-1)!.input as Array<{ content: string }>;
      assert.deepEqual(JSON.parse(messages[1].content).linguisticContext, linguisticContext);
    },
  );
  await check(
    "pedagogical variant is not provider locale and absent mapping never silently substitutes",
    () => {
      const mapping = resolveSpeechOperation(language, {}, "general", "assessmentLocale");
      assert.equal(mapping.requestedVariant, "general");
      assert.equal(mapping.operationalLocale, "en-US");
      assert.equal(mapping.compatibility, "declared_mapping");
      assert.equal(mapping.fallbackAllowed, false);
      const unsupported = structuredClone(language);
      unsupported.speech.providers.azure["en-GB"].assessmentLocale = null;
      assert.equal(
        resolveSpeechOperation(unsupported, course, "en-GB", "assessmentLocale").status,
        "unavailable",
      );
    },
  );
  const usVoice = { lang: "en-US", voiceURI: "voice-us", name: "test" };
  const gbVoice = { lang: "en-GB", voiceURI: "voice-gb", name: "test" };
  await check(
    "allowed cross-variant browser fallback reports different locale and unavailable exact fidelity",
    () => {
      const selected = selectBrowserVoice([usVoice], "en-GB", true, "", "en-GB");
      assert.equal(selected.compatibility, "different_locale");
      assert.equal(selected.operationalLocale, "en-US");
      assert(selected.fallback);
      assert.equal(selectBrowserVoice([usVoice], "en-GB", false).status, "unavailable");
      assert.equal(selectBrowserVoice([], "en-GB", true).status, "unavailable");
      assert.equal(selectBrowserVoice([usVoice, gbVoice], "en-GB", true).voice, gbVoice);
    },
  );
  await check(
    "missing required voice blocks listening and assessment without grading or penalty",
    async () => {
      const current = structuredClone(course);
      const listened = allActivities(current).find((item) => item.type === "listening")!;
      listened.variant = { requiredVariant: "en-GB" };
      const safe = publicCourse(current, language);
      const device = courseWithDeviceAvailability(safe, 15, language, "en-US", [usVoice]);
      assert(device.availability!.unavailableActivityIds.includes(listened.id));
      const ok = courseWithDeviceAvailability(safe, 15, language, "en-US", [gbVoice]);
      assert(!ok.availability!.unavailableActivityIds.includes(listened.id));
      assert(!("correct" in selectBrowserVoice([usVoice], "en-GB", false)));
    },
  );
  await check(
    "real transcription adapter uses mocked provider locale and activity constraint, zero external requests",
    async () => {
      const current = structuredClone(bundle);
      allActivities(current.course).find((item) => item.id === activity.id)!.variant = {
        requiredVariant: "en-GB",
      };
      const buffer = Buffer.alloc(16044);
      buffer.write("RIFF", 0);
      buffer.write("WAVE", 8);
      buffer.write("fmt ", 12);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(1, 22);
      buffer.writeUInt32LE(16000, 24);
      buffer.writeUInt16LE(16, 34);
      buffer.write("data", 36);
      buffer.writeUInt32LE(16000, 40);
      let requests = 0;
      const dependencies = {
        bundle: () => current,
        variant: async () => "en-US",
        endpoint: () => new URL("http://127.0.0.1:3001/speech-mock"),
        key: () => "synthetic-not-a-key",
        request: async (url: Parameters<typeof fetch>[0]) => {
          requests++;
          assert.equal(new URL(String(url)).searchParams.get("language"), "en-GB");
          return Response.json({ RecognitionStatus: "Success", DisplayText: "hello" });
        },
      };
      const file = new File([buffer], "test.wav");
      assert.equal(await transcribeWav(file, null, course.id, activity.id, dependencies), "hello");
      assert.equal(requests, 1);
      current.language.speech.providers.azure["en-GB"].recognitionLocale = null;
      await assert.rejects(() => transcribeWav(file, null, course.id, activity.id, dependencies));
      assert.equal(requests, 1);
    },
  );
  await check(
    "answer policies never cross public/UI/seed projections and registry is internally consistent",
    () => {
      const safe = publicCourse(course, language);
      const exposed = safe.units[0].lessons[0].activities[0];
      assert(!("answerPolicy" in exposed));
      assert(!("answer" in exposed));
      assert(!("answerOrder" in exposed));
      assert(!("answerPolicy" in activitySeedPayload(activity)));
      assert.equal(capabilityRegistry.get("linguistic.variant")!.support, "implemented");
      assert.equal(capabilityRegistry.get("linguistic.answers")!.support, "implemented");
      assert.deepEqual(checkCapabilityImplementations(), []);
      assert(!JSON.stringify(capabilityCatalog()).includes('"colour"'));
    },
  );
  await check(
    "preference roundtrip and local sync preserve course isolation and dirty writes",
    async () => {
      const state = readCourseState(null, course.id, language.id);
      assert.equal(state.profile.variantId, "");
      state.profile.variantId = "en-US";
      const stored = writeCourseState(null, course.id, state);
      assert.equal(readCourseState(stored, course.id, language.id).profile.variantId, "en-US");
      assert.equal(readCourseState(stored, "other-course", "xx-Test").profile.variantId, "");
      let remote = structuredClone(state),
        failSave = false;
      let cache: StudySyncCacheEntry = { state: null, pending: null, recovery: [] };
      const repository = {
        load: async () => structuredClone(remote),
        save: async (next: typeof state) => {
          if (failSave) throw Error("synthetic save failure");
          remote = structuredClone(next);
        },
      };
      const sync = new StudyProgressSync(() => readCourseState(null, course.id, language.id), {
        read: () => cache,
        write: (_owner, next) => {
          cache = structuredClone(next);
        },
      });
      await sync.load(sync.beginLoading(), "synthetic-user", repository);
      sync.update((old) => ({ ...old, profile: { ...old.profile, variantId: "en-GB" } }));
      failSave = true;
      await assert.rejects(() => sync.flush());
      assert(sync.getSnapshot().dirty);
      failSave = false;
      await sync.flush();
      assert.equal(remote.profile.variantId, "en-GB");
      await sync.load(sync.beginLoading(), "synthetic-user", repository);
      assert.equal(sync.getSnapshot().state.profile.variantId, "en-GB");
    },
  );
  await check(
    "assessment preference is stored once and replay ignores later preference changes",
    async () => {
      let preference = "en-US",
        writes = 0;
      const rows: StoredAssessmentRow[] = [];
      const api = createAssessmentApi({
        resolveCourse: () => bundle,
        authenticatedUser: async () => ({ id: "synthetic-user" }),
        requiresAuth: () => true,
        variantPreference: async () => preference,
        save: async (_user, input, result) => {
          writes++;
          rows.push({
            id: result.id,
            assessment_id: result.assessmentId,
            started_at: result.startedAt,
            finished_at: result.finishedAt,
            objective_score: result.objectiveScore,
            result: {
              courseId: course.id,
              contentVersion: course.contentVersion,
              input,
              variantId: result.variantId,
            },
          });
          return result.finishedAt;
        },
        read: async () => rows,
      });
      const input = {
        courseId: course.id,
        assessmentId: "variant-assessment",
        attemptId: "11111111-1111-4111-8111-111111111111",
        startedAt: "2026-10-10T10:00:00.000Z",
        responses: [{ activityId: activity.id, answer: "color" }],
      };
      const response = await api.POST(
        new Request("http://127.0.0.1:3001", { method: "POST", body: JSON.stringify(input) }),
      );
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.objectiveScore, 100);
      assert.equal(result.variantId, "en-US");
      assert.equal(writes, 1);
      preference = "en-GB";
      const recovered = await (
        await api.GET(new Request(`http://127.0.0.1:3001?courseId=${course.id}`))
      ).json();
      assert.equal(recovered.results[0].objectiveScore, 100);
      assert.equal(recovered.results[0].variantId, "en-US");
      const unavailable = createAssessmentApi({
        resolveCourse: () => bundle,
        authenticatedUser: async () => ({ id: "synthetic-user" }),
        requiresAuth: () => true,
        variantPreference: async () => {
          throw Error("synthetic read failure");
        },
        save: async () => {
          writes++;
          return "";
        },
        read: async () => [],
      });
      assert.equal(
        (
          await unavailable.POST(
            new Request("http://127.0.0.1:3001", { method: "POST", body: JSON.stringify(input) }),
          )
        ).status,
        503,
      );
      assert.equal(writes, 1);
    },
  );
  await check(
    "5A Unicode, explicit reconstruction and text units remain independent of variant",
    () => {
      const tokens = orderingTokens("fixture", ["你", "好", "你"]);
      assert.equal(
        orderingAnswer(
          tokens,
          tokens.map((item) => item.id),
          { strategy: "separator", separator: "" },
        ),
        "你好你",
      );
      assert.equal(measureText("e\u0301", { strategy: "graphemes" }), 1);
      assert.equal(measureText("e\u0301", { strategy: "code_points" }), 2);
      assert.equal(normalizeAnswer(normalizeAnswer(" COLOUR? . ")), normalizeAnswer(" COLOUR? . "));
    },
  );
  await check(
    "generated precedence/isolation/idempotence invariants are deterministic (seed 0x5b17)",
    () => {
      let seed = 0x5b17;
      const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
      for (let i = 0; i < 1000; i++) {
        const ids = Array.from(
          { length: 2 + (random() % 7) },
          (_, index) => `synthetic-${i}-${index}`,
        );
        const defaultVariant = ids[random() % ids.length],
          pref = ids[random() % ids.length],
          required = ids[random() % ids.length];
        const l = {
            id: `synthetic-language-${i}`,
            variants: ids.map((id) => ({ id })),
            speech: { defaultVariant: ids[0] },
          },
          c = { defaultVariant, acceptedVariants: ids };
        const before = JSON.stringify({ l, c });
        assert.equal(requireLearningVariant(l, c).variantId, defaultVariant);
        properties++;
        assert.equal(requireLearningVariant(l, c, pref).variantId, pref);
        properties++;
        const value = requireLearningVariant(l, c, pref, { requiredVariant: required });
        assert.equal(value.variantId, required);
        properties++;
        assert.equal(value.preference, pref);
        properties++;
        assert.deepEqual(
          value,
          requireLearningVariant(l, { ...c, acceptedVariants: [...ids].reverse() }, pref, {
            requiredVariant: required,
          }),
        );
        properties++;
        assert.equal(
          requireLearningVariant(l, c, "absent").diagnostics[0].code,
          "INVALID_PREFERENCE",
        );
        properties++;
        assert.equal(JSON.stringify({ l, c }), before);
        properties++;
      }
    },
  );
  await check("ES/EN/xx-Test defaults and public contracts retain existing compatibility", () => {
    for (const item of inputs) {
      const current = runtimeBundle(item),
        safe = publicCourse(current.course, current.language);
      assert.equal(
        requireLearningVariant(current.language, current.course).variantId,
        item.course.defaultVariant ?? current.language.speech.defaultVariant,
      );
      assert(!JSON.stringify(safe).includes('"answerPolicy"'));
      for (const selected of current.language.variants)
        assert.equal(
          requireLearningVariant(current.language, current.course, selected.id).variantId,
          selected.id,
        );
    }
  });
  console.log(
    JSON.stringify({
      variantGroups: checks,
      generatedAssertions: properties,
      seed: "0x5b17",
      externalCalls: 0,
      paidCalls: 0,
      databaseCalls: 0,
      linguisticQualityCertified: false,
    }),
  );
}
void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
