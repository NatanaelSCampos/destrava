import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { renderToString } from "react-dom/server";
import { loadContent } from "./content-loader";
import { activityPayloadSchemas } from "../src/content/activity-data";
import {
  capabilityRequirementSchema,
  type CapabilityRequirement,
} from "../src/content/capability-contracts";
import { coursePackageSchema, type CoursePackage } from "../src/content/contracts";
import { runtimeBundle } from "../src/content/runtime-package";
import { publicCourse, publicRequirements } from "../src/content/public";
import {
  capabilityRegistry,
  capabilityDefinitions,
  createCapabilityRegistry,
  capabilityCatalog,
} from "../src/engine/capabilities/registry";
import {
  negotiateCapabilities,
  CapabilityCompatibilityError,
  type CapabilityEnvironment,
} from "../src/engine/capabilities/compatibility";
import { validatePackageCapabilities } from "../src/engine/capabilities/package-compatibility";
import {
  checkCapabilityImplementations,
  inspectImplementationReference,
} from "./capability-implementation-check";
import { gradeActivity } from "../src/domain/activities/grader";
import { readCourseState } from "../src/domain/study/course-state-storage";
import { unitProgress } from "../src/domain/study/progress";
import { createAssessmentApi } from "../src/lib/assessment-api";
import { StudyProvider } from "../src/components/study-provider";
import { ActivityRenderer } from "../src/components/activities/activity-renderer";
import { courseWithDeviceAvailability } from "../src/lib/client-capabilities";
import { readFileSync } from "node:fs";
import { serverCapabilityEnvironment } from "../src/lib/capability-environment";
import { activitySeedPayload } from "../src/repositories/activity-content-projection";
import { assessmentSeedRows } from "../src/repositories/assessment-content-projection";

const bundles = loadContent();
const fixture = bundles.find((item) => item.language.id === "xx-Test")!;
const request = (
  id: string,
  data?: Record<string, unknown>,
  extra: Partial<CapabilityRequirement> = {},
): CapabilityRequirement => ({
  id,
  version: "1.0.0",
  required: true,
  ...(data ? { data } : {}),
  ...extra,
});
const check = (
  requirement: CapabilityRequirement,
  environment?: CapabilityEnvironment,
  registry = capabilityRegistry,
) =>
  negotiateCapabilities(
    [{ requirement, location: "synthetic.requirements[0]" }],
    environment,
    registry,
  );
const has = (report: ReturnType<typeof check>, code: string) =>
  report.diagnostics.some((item) => item.code === code);
const core = request("activity.multiple_choice", { options: ["A", "B"], answer: "A" });
let checks = 0;
async function test(name: string, execute: () => void | Promise<void>) {
  await execute();
  checks++;
  console.log(`OK ${name}`);
}
const mutate = (change: (course: CoursePackage) => void) => {
  const copy = structuredClone(fixture);
  change(copy.course);
  return copy;
};

async function main() {
  await test("known compatible capability with real objective execution", () => {
    const report = check(core);
    assert.equal(report.compatible, true);
    assert.equal(report.readiness, "ready");
    const bundle = runtimeBundle(fixture);
    const activity = bundle.course.units[0].lessons[0].activities.find(
      (item) => item.type === "multiple_choice",
    )!;
    assert.equal(gradeActivity(activity, "olá", fixture.language.normalization)?.correct, true);
  });
  await test("unknown mandatory capability rejected before runtime activation", () => {
    const input = mutate((course) => {
      course.capabilityRequirements = [request("learning.telepathy")];
    });
    assert.throws(
      () => runtimeBundle(input),
      (error) =>
        error instanceof CapabilityCompatibilityError && has(error.report, "CAPABILITY_UNKNOWN"),
    );
  });
  await test("newer minor, major and patch versions are not implicitly accepted", () => {
    for (const version of ["1.1.0", "2.0.0", "1.0.1", "0.9.0"]) {
      const result = check({ ...core, version });
      assert.equal(result.compatible, false);
      assert(has(result, "CAPABILITY_VERSION_INCOMPATIBLE"));
    }
  });
  await test("unknown optional capability has a usable declared alternative", () => {
    const result = check(
      request("external.optional-exercise", undefined, {
        required: false,
        fallback: { id: core.id, version: core.version, data: core.data },
      }),
    );
    assert.equal(result.compatible, true);
    assert.equal(result.readiness, "ready");
    assert.equal(result.selections[0].selectedId, core.id);
    assert.equal(result.selections[0].usedFallback, true);
    assert.equal(result.diagnostics[0].severity, "warning");
  });
  await test("optional absence, malformed alternative and unsupported alternative rejected", () => {
    for (const fallback of [
      undefined,
      { id: core.id, version: core.version, data: { options: ["A"] } },
      { id: "unknown.fallback", version: "1.0.0" },
    ]) {
      const result = check(request("unknown.optional", undefined, { required: false, fallback }));
      assert.equal(result.compatible, false);
      assert(has(result, "CAPABILITY_FALLBACK_INVALID"));
    }
    assert(has(check({ ...core, required: false }), "CAPABILITY_FALLBACK_INVALID"));
  });
  await test("implemented claim without executor is refused", () => {
    assert.throws(
      () =>
        createCapabilityRegistry([{ ...capabilityRegistry.get(core.id)!, executor: undefined }]),
      /no verified executor/,
    );
  });
  await test("missing source, missing method and throwing AI placeholder are rejected by AST", () => {
    assert(
      inspectImplementationReference({ file: "src/not-an-implementation.ts", symbol: "Run" })
        .length,
    );
    assert(
      inspectImplementationReference({
        file: "src/domain/ai/ai-provider.ts",
        symbol: "OpenAIProvider",
        method: "evaluateSpeaking",
      }).length,
    );
    assert(
      inspectImplementationReference({
        file: "src/domain/ai/ai-provider.ts",
        symbol: "OpenAIProvider",
        method: "nonexistent",
      }).length,
    );
    assert(
      inspectImplementationReference(
        { file: "src/domain/activities/grader.ts", symbol: "gradeActivity" },
        () => "export function gradeActivity() { throw new Error('stub'); }",
      ).length,
    );
  });
  await test("partial or declared functionality cannot satisfy mandatory requirements", () => {
    const definition = capabilityRegistry.get(core.id)!;
    for (const support of ["partial", "declared", "not_implemented"] as const) {
      const registry = createCapabilityRegistry([{ ...definition, support }]);
      assert(has(check(core, undefined, registry), "CAPABILITY_NOT_IMPLEMENTED"));
    }
    assert.equal(capabilityRegistry.get("numbers.dictation")!.support, "partial");
    assert(!capabilityRegistry.has("speech.tonal_assessment"));
  });
  await test("operational unavailability differs from structural incompatibility", () => {
    const result = check(request("speech.recognition"), {
      dependencies: {
        "speech.recognition_service": { state: "unavailable", reason: "Synthetic provider outage" },
      },
    });
    assert.equal(result.compatible, true);
    assert.equal(result.readiness, "unavailable");
    assert(has(result, "CAPABILITY_UNAVAILABLE"));
    const pending = check(request("speech.recognition"));
    assert.equal(pending.readiness, "unknown");
    assert(has(pending, "CAPABILITY_AVAILABILITY_UNKNOWN"));
  });
  await test("optional operational fallback is chosen without grading the learner", () => {
    const result = check(
      request("ai.tutor", undefined, {
        required: false,
        fallback: {
          id: "activity.lesson_content",
          version: "1.0.0",
          data: { body: "Authored explanation" },
        },
      }),
      { dependencies: { "ai.text_service": { state: "unavailable" } } },
    );
    assert.equal(result.compatible, true);
    assert.equal(result.readiness, "ready");
    assert(result.selections[0].usedFallback);
    assert(!result.diagnostics.some((item) => item.severity === "error"));
  });
  await test("missing and cyclic engine dependencies produce explicit diagnostics", () => {
    const missing = createCapabilityRegistry([
      { ...capabilityRegistry.get(core.id)!, dependencies: ["missing.engine"] },
    ]);
    assert(has(check(core, undefined, missing), "CAPABILITY_DEPENDENCY_MISSING"));
    const cyclic = createCapabilityRegistry([
      { ...capabilityRegistry.get(core.id)!, dependencies: [core.id] },
    ]);
    assert(has(check(core, undefined, cyclic), "CAPABILITY_DEPENDENCY_MISSING"));
    assert(
      checkCapabilityImplementations(missing).some((issue) =>
        issue.includes("unsupported dependency"),
      ),
    );
  });
  await test("schema and semantics are independently checked", () => {
    assert(has(check({ ...core, data: { options: "not an array" } }), "CAPABILITY_DATA_INVALID"));
    assert(
      has(
        check({ ...core, data: { options: ["A", "B"], answer: "outside" } }),
        "CAPABILITY_DATA_INVALID",
      ),
    );
    assert(
      has(
        check(request("activity.ordering", { words: ["one", "two"], answer: "one three" })),
        "CAPABILITY_DATA_INVALID",
      ),
    );
    assert.equal(
      check(request("activity.ordering", { words: ["one", "one"], answer: "one one" })).compatible,
      true,
    );
    assert(
      has(
        check(
          request("activity.lesson_content", {
            body: "Valid schema",
            media: { kind: "audio", url: "/audio.wav" },
          }),
        ),
        "CAPABILITY_DATA_INVALID",
      ),
    );
  });
  await test("external code, credentials and misleading fields are not capability data", () => {
    assert.equal(
      capabilityRequirementSchema.safeParse({ ...core, executor: "external-script.js" }).success,
      false,
    );
    for (const extra of [
      { run: "fetch('paid')" },
      { apiKey: "synthetic-key" },
      { provider: "external" },
    ])
      assert.equal(check({ ...core, data: { ...core.data, ...extra } }).compatible, false);
    assert.equal(
      capabilityRequirementSchema.safeParse({
        ...core,
        fallback: { id: core.id, version: core.version },
      }).success,
      false,
    );
  });
  await test("unknown evaluation strategy cannot be silently discarded", () => {
    const input = mutate((course) => {
      course.units[0].lessons[0].activities[1].evaluation = { strategy: "imaginary-rubric" };
    });
    assert.throws(() => runtimeBundle(input), CapabilityCompatibilityError);
  });
  await test("declarations at every native scope survive compilation and projection", () => {
    const input = mutate((course) => {
      course.capabilityRequirements = [core];
      course.units[0].capabilityRequirements = [core];
      course.units[0].lessons[0].capabilityRequirements = [core];
      course.units[0].lessons[0].activities[0].capabilityRequirements = [core];
      course.assessments[0].capabilityRequirements = [core];
    });
    input.language.capabilityRequirements = [core];
    const bundle = runtimeBundle(input),
      exposed = publicCourse(bundle.course, bundle.language);
    assert.equal(bundle.course.capabilityRequirements?.[0].id, core.id);
    assert.equal(bundle.course.languageRequirements?.[0].id, core.id);
    assert.equal(exposed.units[0].lessons[0].activities[0].capabilityRequirements?.[0].id, core.id);
    for (const prefix of [
      "course.capabilityRequirements",
      "language.capabilityRequirements",
      "course.units[0].capabilityRequirements",
      "course.units[0].lessons[0].capabilityRequirements",
      "course.units[0].lessons[0].activities[0].capabilityRequirements",
      "course.assessments[0].capabilityRequirements",
    ])
      assert(
        bundle.course.capabilityReport!.selections.some((selection) =>
          selection.location.startsWith(prefix),
        ),
      );
  });
  await test("mandatory incompatible declaration fails at unit, lesson, activity and assessment scopes", () => {
    for (const set of [
      (course: CoursePackage) => {
        course.units[0].capabilityRequirements = [request("unknown")];
      },
      (course: CoursePackage) => {
        course.units[0].lessons[0].capabilityRequirements = [request("unknown")];
      },
      (course: CoursePackage) => {
        course.units[0].lessons[0].activities[0].capabilityRequirements = [request("unknown")];
      },
      (course: CoursePackage) => {
        course.assessments[0].capabilityRequirements = [request("unknown")];
      },
    ])
      assert.throws(() => runtimeBundle(mutate(set)), CapabilityCompatibilityError);
  });
  await test("unknown required language module and missing module payload fail early", () => {
    const copy = structuredClone(fixture);
    copy.language.modules.future = { enabled: true, source: "not-loaded.json" };
    assert.throws(() => runtimeBundle(copy), CapabilityCompatibilityError);
    assert.throws(
      () => runtimeBundle({ ...fixture, moduleData: {} }),
      CapabilityCompatibilityError,
    );
  });
  await test("policy unavailability is neither completion nor student failure", () => {
    const input = mutate((course) => {
      course.units[0].lessons[0].activities[0].capabilityRequirements = [
        request("speech.recognition"),
      ];
    });
    const bundle = runtimeBundle(input);
    const exposed = publicCourse(bundle.course, bundle.language, {
      dependencies: { "speech.recognition_service": { state: "unavailable" } },
    });
    const state = readCourseState(null, exposed.id, bundle.language.id);
    state.completedActivityIds = [
      "xx.act.intro",
      "xx.act.choice",
      "xx.act.rule",
      "xx.act.fill",
      "xx.act.short",
    ];
    const result = unitProgress(exposed.units[0], state, [], exposed);
    assert.equal(result.completion.status, "unavailable");
    assert.equal(result.isCompleted, false);
    assert(exposed.units[0].lessons[0].activities.some((item) => item.id === "xx.act.intro"));
    const html = renderToString(
      <StudyProvider course={exposed} resources={bundle.resources} language={bundle.language}>
        <ActivityRenderer activity={exposed.units[0].lessons[0].activities[0]} />
      </StudyProvider>,
    );
    assert(html.includes("ATIVIDADE INDISPONÍVEL"));
    assert(!html.includes("Marcar como estudado"));
  });
  await test("unavailable assessment produces no save or official grade", async () => {
    const input = mutate((course) => {
      course.assessments[0].capabilityRequirements = [request("speech.recognition")];
    });
    const bundle = runtimeBundle(input);
    let writes = 0;
    const api = createAssessmentApi({
      resolveCourse: () => bundle,
      authenticatedUser: async () => ({ id: "synthetic" }),
      requiresAuth: () => true,
      read: async () => [],
      save: async () => {
        writes++;
        return new Date().toISOString();
      },
      environment: { dependencies: { "speech.recognition_service": { state: "unavailable" } } },
    });
    const response = await api.POST(
      new Request("http://local.test/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: bundle.course.id,
          assessmentId: bundle.course.assessments[0].id,
          attemptId: randomUUID(),
          startedAt: new Date().toISOString(),
          responses: [{ activityId: "xx.act.choice", answer: "olá" }],
        }),
      }),
    );
    assert.equal(response.status, 503);
    assert.equal(writes, 0);
    assert(!(await response.text()).includes("objectiveScore"));
  });
  await test("private payloads and fallback answer keys never cross public boundaries", () => {
    const secret = "PRIVATE_SYNTHETIC_ANSWER_837";
    const privateRequest = request("external.optional", undefined, {
      required: false,
      fallback: {
        id: core.id,
        version: core.version,
        data: { options: [secret, "other"], answer: secret },
      },
    });
    const input = mutate((course) => {
      course.capabilityRequirements = [privateRequest];
      course.units[0].capabilityRequirements = [privateRequest];
      course.units[0].lessons[0].capabilityRequirements = [privateRequest];
      course.units[0].lessons[0].activities[0].capabilityRequirements = [privateRequest];
      course.assessments[0].capabilityRequirements = [privateRequest];
    });
    input.language.capabilityRequirements = [privateRequest];
    const bundle = runtimeBundle(input),
      exposed = publicCourse(bundle.course, bundle.language);
    const published = JSON.stringify({
      course: exposed,
      language: {
        ...bundle.language,
        capabilityRequirements: publicRequirements(bundle.language.capabilityRequirements),
      },
      catalog: capabilityCatalog(),
    });
    assert(!published.includes(secret));
    assert(!published.includes('"capabilityRequests"'));
    assert(!published.includes('"executor"'));
    assert(!JSON.stringify(exposed).includes('"answer":'));
    const publicDatabaseRows = JSON.stringify({ assessments: assessmentSeedRows(bundle.coursePackage),
      activities: bundle.course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities.map(activitySeedPayload))) });
    assert(!publicDatabaseRows.includes(secret)); assert(!publicDatabaseRows.includes('"answer":'));
  });
  await test("changing language characteristics does not fabricate engine support", () => {
    const input = structuredClone(fixture);
    input.language.id = "synthetic-other";
    input.language.identity.nativeName = "Other";
    input.course.targetLanguage = input.language.id;
    input.course.concepts.forEach((item) => { item.language = input.language.id; });
    input.course.lexicon.forEach((item) => { item.language = input.language.id; });
    input.language.writingSystem.direction = "rtl";
    input.language.linguisticFeatures.tones = true;
    const bundle = runtimeBundle(input);
    assert(bundle.course.capabilityReport?.compatible);
    assert(!capabilityRegistry.has("speech.tonal_assessment"));
    assert(!capabilityRegistry.has("ui.rtl"));
    input.course.capabilityRequirements = [request("speech.tonal_assessment")];
    assert.throws(() => runtimeBundle(input), CapabilityCompatibilityError);
  });
  await test("existing ES/EN/synthetic capabilities and learning policies remain compatible", () => {
    for (const input of bundles) {
      const validated = validatePackageCapabilities(input.course, input.language, input.moduleData);
      assert(validated.report.compatible);
      assert.deepEqual(
        runtimeBundle(input).course.units[0].learningPolicy,
        input.course.units[0].learningPolicy,
      );
      assert.equal(coursePackageSchema.safeParse(input.course).success, true);
    }
    assert.strictEqual(
      capabilityRegistry.get(core.id)!.schema,
      activityPayloadSchemas.multiple_choice,
    );
    assert.deepEqual(checkCapabilityImplementations(), []);
    assert.equal(capabilityDefinitions.filter((item) => item.support === "partial").length, 1);
  });
  await test("device probing preserves unavailable activities and avoids invented evidence", () => {
    const input = mutate((course) => {
      course.units[0].lessons[0].activities[0].capabilityRequirements = [
        request("speech.recording"),
      ];
    });
    const bundle = runtimeBundle(input),
      exposed = publicCourse(bundle.course, bundle.language);
    assert.strictEqual(courseWithDeviceAvailability(exposed, -1), exposed);
    const device = courseWithDeviceAvailability(exposed, 0);
    assert(device.availability?.unavailableActivityIds.includes("xx.act.intro"));
    assert(device.units[0].lessons[0].activities.some((item) => item.id === "xx.act.intro"));
    assert.equal(
      unitProgress(
        device.units[0],
        readCourseState(null, device.id, bundle.language.id),
        [],
        device,
      ).completion.status,
      "unavailable",
    );
    assert(
      !courseWithDeviceAvailability(exposed, 7).availability?.unavailableActivityIds.includes(
        "xx.act.intro",
      ),
    );
  });
  await test("non-core primary skills cannot silently bypass runtime/persistence limits", () => {
    const input = mutate((course) => {
      course.units[0].lessons[0].activities[0].skills = ["fluency"];
    });
    assert.throws(
      () => runtimeBundle(input),
      (error) =>
        error instanceof CapabilityCompatibilityError &&
        has(error.report, "CAPABILITY_DATA_INVALID"),
    );
  });
  await test("client scope resolution survives filtering an earlier inactive unit", () => {
    const input = mutate((course) => {
      course.units[0].lessons[0].activities[0].capabilityRequirements = [
        request("speech.recording"),
      ];
      const unused = structuredClone(course.units[0]);
      unused.id = "inactive.unit";
      unused.slug = "inactive";
      unused.active = false;
      unused.assessmentRefs = { formative: [] };
      unused.learningPolicy = { completion: { requirements: [] }, mastery: { requirements: [] } };
      unused.lessons = [
        {
          ...unused.lessons[0],
          id: "inactive.lesson",
          activities: [
            {
              ...unused.lessons[0].activities[0],
              id: "inactive.activity",
              capabilityRequirements: undefined,
            },
          ],
        },
      ];
      course.units.unshift(unused);
    });
    const bundle = runtimeBundle(input),
      exposed = publicCourse(bundle.course, bundle.language);
    assert.equal(exposed.units.length, 1);
    const device = courseWithDeviceAvailability(exposed, 0);
    assert(device.availability?.unavailableActivityIds.includes("xx.act.intro"));
  });
  await test("portable catalog is generated from verified definitions without private sources", () => {
    const artifact = JSON.parse(readFileSync("contracts/engine-capabilities-v1.json", "utf8"));
    assert.deepEqual(artifact, capabilityCatalog());
    assert(!JSON.stringify(artifact).includes('"file":'));
    assert(!JSON.stringify(artifact).includes("OPENAI_API_KEY"));
  });
  await test("authored audio references are preserved and unusable media is reported", () => {
    const input = mutate((course) => {
      course.media.push({ id: "synthetic.audio", type: "audio", src: "/synthetic-audio.wav" });
      const activity = course.units[0].lessons[0].activities[0];
      activity.type = "listening"; activity.media = ["synthetic.audio"];
      activity.payload = { transcript: "Example", options: ["A", "B"], answer: "A" };
    });
    const bundle = runtimeBundle(input), activity = bundle.course.units[0].lessons[0].activities[0];
    assert.equal(activity.media?.kind, "audio");
    assert(activity.media?.kind === "audio" && activity.media.url === "/synthetic-audio.wav");
    const exposed = publicCourse(bundle.course, bundle.language, { dependencies: { "client.media_playback": { state: "available" } }, resources: { "/synthetic-audio.wav": { state: "unavailable", reason: "Synthetic missing asset" } } });
    assert(exposed.availability?.unavailableActivityIds.includes(activity.id));
    assert(has(exposed.capabilityReport!, "CAPABILITY_UNAVAILABLE"));
    const wrong = structuredClone(input); wrong.course.units[0].lessons[0].activities[0].type = "lesson_content";
    wrong.course.units[0].lessons[0].activities[0].payload = { body: "Does not play media" };
    assert.throws(() => runtimeBundle(wrong), CapabilityCompatibilityError);
  });
  await test("a configured credential is not advertised as verified provider health", () => {
    const before = process.env.OPENAI_API_KEY;
    try {
      process.env.OPENAI_API_KEY = "synthetic-placeholder-with-no-network";
      assert.equal(serverCapabilityEnvironment(fixture.language).dependencies?.["ai.text_service"]?.state, "unknown");
      delete process.env.OPENAI_API_KEY;
      assert.equal(serverCapabilityEnvironment(fixture.language).dependencies?.["ai.text_service"]?.state, "unavailable");
    } finally { if (before === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = before; }
  });
  await test("manual speaking remains executable without recognition coverage", () => {
    const input = mutate((course) => {
      const activity = course.units[0].lessons[0].activities[0]; activity.type = "speaking";
      activity.payload = { guidance: ["Record and write the transcript"] };
    });
    const bundle = runtimeBundle(input), exposed = publicCourse(bundle.course, bundle.language);
    assert.equal(bundle.language.speech.support.speechRecognition, false);
    const html = renderToString(<StudyProvider course={exposed} language={bundle.language} resources={bundle.resources}>
      <ActivityRenderer activity={exposed.units[0].lessons[0].activities[0]} />
    </StudyProvider>);
    assert(html.includes("Gravar resposta")); assert(!html.includes("prática oral está temporariamente indisponível"));
  });
  await test("temporarily unavailable alternatives do not become structural incompatibility", () => {
    const environment: CapabilityEnvironment = { dependencies: { "ai.text_service": { state: "unavailable" } } };
    const fallback = { id: "ai.tutor", version: "1.0.0" };
    const pending = check(request("unknown.optional", undefined, { required: false, fallback }), environment);
    assert.equal(pending.compatible, true); assert.equal(pending.readiness, "unavailable");
    assert(!has(pending, "CAPABILITY_FALLBACK_INVALID"));
    const working = check({ ...core, required: false, fallback }, environment);
    assert.equal(working.compatible, true); assert.equal(working.readiness, "ready");
    assert.equal(working.selections[0].usedFallback, false);
  });
  await test("malformed declarations fail with diagnostics rather than throwing", () => {
    for (const value of [null, undefined, {}, { id: 42, version: false }]) {
      const report = check(value as unknown as CapabilityRequirement);
      assert.equal(report.compatible, false); assert(has(report, "CAPABILITY_DATA_INVALID"));
    }
  });
  console.log(
    JSON.stringify({
      capabilities: "passed",
      checks,
      registered: capabilityRegistry.size,
      paidCalls: 0,
      remoteOperations: 0,
    }),
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
