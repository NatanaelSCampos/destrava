import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import type { StudyState } from "../src/domain/study/study-state";
import type {
  StudySyncCache,
  StudySyncCacheEntry,
  StudySyncRepository,
} from "../src/domain/study/study-progress-sync";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import type {
  InstalledStudyDependencies,
  InstalledProgressEnvelope,
  InstalledProgressWrite,
  RuntimeSelectionCommand,
  RuntimeSelectionEnvelope,
  InstalledCompatibilityReport,
  InstalledStudyErrorCode,
} from "../src/domain/installed-study/contracts";
import type {
  Installation,
  ResolvedSession,
  VersionEvidence,
  InstalledContentReference,
} from "../src/domain/course-installations/contracts";
import type { Course } from "../src/content/schema";
import type { CapabilityEnvironment } from "../src/engine/capabilities/compatibility";
import {
  candidateHashes,
  candidateRoot,
  cloneFiles,
  copy,
  digest,
  independentLearningFixtures,
  inventory,
  jsonFile,
  importCandidate,
  MemoryInstalledStudyCatalog,
  studentA,
  studentB,
} from "./installed-runtime-test-fixtures";

type StudyService = {
  getSelection(userId: string): Promise<RuntimeSelectionEnvelope>;
  select(userId: string, command: RuntimeSelectionCommand): Promise<RuntimeSelectionEnvelope>;
  resolveContext(userId: string, sessionId: string): Promise<ResolvedSession>;
  load(userId: string, sessionId: string): Promise<InstalledProgressEnvelope>;
  save(userId: string, command: InstalledProgressWrite): Promise<InstalledProgressEnvelope>;
  listVersionEvidence(userId: string, sessionId: string): Promise<VersionEvidence[]>;
};
type Domain = typeof import("../src/domain/installed-study/contracts");
const records: Array<{ scenario: string; result: "passed" }> = [];
async function check(scenario: string, run: () => unknown | Promise<unknown>) {
  await run();
  records.push({ scenario, result: "passed" });
  console.log("OK " + scenario);
}
async function main() {
  const originalFetch = globalThis.fetch;
  let forbiddenNetworkCalls = 0;
  globalThis.fetch = async () => {
    forbiddenNetworkCalls++;
    throw Error("Network forbidden in independent I8 pure tests");
  };
  const fixture = independentLearningFixtures();
  const producerOnly = process.argv.includes("--producer-only");
  const paths = [
    "contracts/package-v1/README.md",
    "contracts/package-v1/capabilities.json",
    "src/engine/import/validate-package.ts",
  ];
  if (!producerOnly)
    paths.push(
      "src/domain/installed-study/contracts.ts",
      "src/domain/installed-study/service.ts",
      "src/domain/installed-study/compatibility.ts",
      "src/repositories/installed-study-http-repository.ts",
      "src/lib/study-sync-cache.ts",
      "src/lib/installed-runtime-types.ts",
      "src/domain/study/study-progress-sync.ts",
      "src/domain/installed-study/evidence-projection.ts",
      "src/domain/study/study-planner.ts",
      "src/lib/feature-flags.ts",
      "src/domain/ai/ai-request-guard.ts",
      "src/lib/versioned-operation-guard.ts",
      "src/lib/application-course-runtime.ts",
      "src/domain/course-installations/contracts.ts",
    );
  const before = candidateHashes(paths);
  try {
    const { validateExternalPackageFiles } = await importCandidate<
      typeof import("../src/engine/import/validate-package")
    >("src/engine/import/validate-package.ts");
    const { publicCourse } =
      await importCandidate<typeof import("../src/content/public")>("src/content/public.ts");
    const { gradeActivity } = await importCandidate<
      typeof import("../src/domain/activities/grader")
    >("src/domain/activities/grader.ts");
    const { evaluateAssessment } = await importCandidate<
      typeof import("../src/domain/assessments/assessment-engine")
    >("src/domain/assessments/assessment-engine.ts");
    const { readCourseState } = await importCandidate<
      typeof import("../src/domain/study/course-state-storage")
    >("src/domain/study/course-state-storage.ts");
    await check(
      "P01/P06 AST proves built-ins only and no dynamic, database, network or execution imports",
      () => {
        const ast = ts.createSourceFile(
          "producer.mjs",
          fixture.producerSource,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.JS,
        );
        const allowed = new Set([
          "node:assert/strict",
          "node:fs",
          "node:path",
          "node:crypto",
          "node:util",
        ]);
        let imports = 0;
        const visit = (node: ts.Node) => {
          if (ts.isImportDeclaration(node)) {
            assert(ts.isStringLiteral(node.moduleSpecifier));
            assert(allowed.has(node.moduleSpecifier.text));
            imports++;
          }
          assert(
            !ts.isExportDeclaration(node) || !node.moduleSpecifier,
            "Producer cannot reexport a private module",
          );
          if (ts.isCallExpression(node)) {
            assert.notEqual(
              node.expression.kind,
              ts.SyntaxKind.ImportKeyword,
              "Dynamic import forbidden",
            );
            if (ts.isIdentifier(node.expression))
              assert(!["require", "fetch", "eval", "Function"].includes(node.expression.text));
          }
          if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "process"
          )
            assert.notEqual(
              node.name.text,
              "env",
              "Producer cannot depend on inherited credentials",
            );
          ts.forEachChild(node, visit);
        };
        visit(ast);
        assert.equal(imports, 5);
        assert(
          !/src[\\/]|supabase|compile-content|seed-supabase|runtimeBundle/.test(
            fixture.producerSource,
          ),
        );
      },
    );
    await check(
      "P02 minimal external distribution executes with no node_modules or private imports",
      () => {
        assert(!fixture.root.startsWith(candidateRoot()));
        const files = inventory(fixture.root);
        assert(
          [...files.keys()].every(
            (path) =>
              !path.includes("node_modules") && !path.startsWith("src/") && !path.includes(".env"),
          ),
        );
        assert.equal(jsonFile(fixture.v1, "manifest.json").provenance.material, "test");
      },
    );
    await check(
      "P03/P04 complete producer V1/V2 are valid through public contract consumer",
      () => {
        for (const files of [fixture.v1, fixture.v2]) {
          const result = validateExternalPackageFiles(files);
          assert.equal(
            result.report.technicallyValid,
            true,
            JSON.stringify(result.report.diagnostics),
          );
          assert.equal(result.report.compatible, true);
          assert.equal(result.report.preparation, "prepared");
          assert(result.prepared);
          assert.equal(result.report.editorial.published, false);
          assert.equal(result.report.editorial.eligibleForPublication, false);
          assert.equal(result.report.activation, "not_performed");
        }
      },
    );
    await check(
      "P03 V1/V2 preserve all curricular IDs and expose different private answer/policy",
      () => {
        const first = jsonFile(fixture.v1, "curriculum/unit-0.json"),
          second = jsonFile(fixture.v2, "curriculum/unit-0.json");
        assert.equal(first.id, second.id);
        assert.equal(first.lessons[0].id, second.lessons[0].id);
        assert.deepEqual(
          first.lessons[0].activities.map((activity: { id: string }) => activity.id),
          second.lessons[0].activities.map((activity: { id: string }) => activity.id),
        );
        const ordering = (unit: typeof first) =>
          unit.lessons[0].activities.find(
            (activity: { id: string }) => activity.id === fixture.activityId,
          );
        assert.deepEqual(ordering(first).payload.words, ordering(second).payload.words);
        assert.notEqual(ordering(first).payload.answer, ordering(second).payload.answer);
        assert.notDeepEqual(
          ordering(first).payload.answerOrder,
          ordering(second).payload.answerOrder,
        );
        assert.notEqual(
          first.learningPolicy.mastery.requirements[0].minimumScore,
          second.learningPolicy.mastery.requirements[0].minimumScore,
        );
        assert.equal(
          jsonFile(fixture.v1, "sections/assessments.json")[0].id,
          jsonFile(fixture.v2, "sections/assessments.json")[0].id,
        );
      },
    );
    await check("P08 producer deterministic exact bytes for identical public arguments", () => {
      const repeat = fixture.produce("v1-repeat", "1.0.0");
      assert.deepEqual(
        [...repeat.files].map(([path, bytes]) => [path, digest(bytes)]),
        [...fixture.v1].map(([path, bytes]) => [path, digest(bytes)]),
      );
    });
    await check("P07 producer refuses overwrite without changing existing package bytes", () => {
      const beforeOutput = [...fixture.v1].map(([path, bytes]) => [path, digest(bytes)]);
      assert.throws(() =>
        execFileSync(
          process.execPath,
          [fixture.producer, fixture.contracts, fixture.directories[0]],
          {
            cwd: fixture.root,
            env: { NODE_ENV: "test", SystemRoot: process.env.SystemRoot },
            stdio: "pipe",
            windowsHide: true,
          },
        ),
      );
      assert.deepEqual(
        [...inventory(fixture.directories[0])].map(([path, bytes]) => [path, digest(bytes)]),
        beforeOutput,
      );
    });
    await check(
      "R20 hash corruption rejects public import without prepared/runtime publication",
      () => {
        const files = cloneFiles(fixture.v1);
        files.get("curriculum/unit-0.json")![20] ^= 1;
        const result = validateExternalPackageFiles(files);
        assert.equal(result.report.preparation, "rejected");
        assert.equal(result.prepared, undefined);
        assert(
          result.report.diagnostics.some((diagnostic) => diagnostic.code === "INTEGRITY_MISMATCH"),
        );
        assert.equal(result.report.editorial.published, false);
      },
    );
    await check("C03 incompatible public capability version cannot prepare", () => {
      const unsupported = fixture.produce("unsupported", "1.0.0", ["--unsupported"]);
      const result = validateExternalPackageFiles(unsupported.files);
      assert.equal(result.report.preparation, "rejected");
      assert.equal(result.prepared, undefined);
      assert(
        result.report.diagnostics.some(
          (diagnostic) => diagnostic.code === "CAPABILITY_VERSION_INCOMPATIBLE",
        ),
      );
    });
    const versions = [fixture.v1, fixture.v2].map((files) => {
      const result = validateExternalPackageFiles(files);
      assert(result.prepared);
      return result;
    });
    await check(
      "R04/R05 independent gabaritos genuinely distinguish correction and fixed assessments",
      () => {
        for (const [index, version] of versions.entries()) {
          const bundle = version.prepared!.bundle,
            course = bundle.course;
          const activity = course.units[0].lessons[0].activities.find(
            (entry) => entry.id === fixture.activityId,
          )!;
          const context = { language: bundle.language, course, preference: "variant-b" };
          assert.equal(
            gradeActivity(activity, fixture.answers[index], bundle.language.normalization, context)
              ?.correct,
            true,
          );
          assert.equal(
            gradeActivity(
              activity,
              fixture.answers[1 - index],
              bundle.language.normalization,
              context,
            )?.correct,
            false,
          );
          const good = evaluateAssessment(
            course,
            fixture.assessmentId,
            [{ activityId: fixture.activityId, answer: fixture.answers[index] }],
            bundle.language.normalization,
            context,
          );
          const bad = evaluateAssessment(
            course,
            fixture.assessmentId,
            [{ activityId: fixture.activityId, answer: fixture.answers[1 - index] }],
            bundle.language.normalization,
            context,
          );
          assert.equal(good.objectiveScore, 100);
          assert.equal(good.passed, true);
          assert.equal(bad.objectiveScore, 0);
          assert.equal(bad.passed, false);
        }
      },
    );
    await check(
      "R21 public projections hide private answers/orders/criteria in both versions",
      () => {
        for (const version of versions)
          fixture.assertNoPrivate(
            publicCourse(version.prepared!.bundle.course, version.prepared!.bundle.language),
          );
      },
    );
    if (producerOnly) {
      assert.equal(forbiddenNetworkCalls, 0);
      assert.deepEqual(candidateHashes(paths), before);
      console.log(
        JSON.stringify({
          taskId: "I8-QA-PRODUCER",
          scope: "producer-only",
          checks: records.length,
          networkCalls: forbiddenNetworkCalls,
          records,
          candidate: before,
        }),
      );
      return;
    }
    // The assertions above and below were authored against the approved contract before implementation reads.
    const DomainError = (await importCandidate<Domain>("src/domain/installed-study/contracts.ts"))
      .InstalledStudyError;
    const { InstalledStudyService } = await importCandidate<{
      InstalledStudyService: new (dependencies: InstalledStudyDependencies) => StudyService;
    }>("src/domain/installed-study/service.ts");
    const compatibility = await importCandidate<{
      installedCourseCompatibility(course: Course): InstalledCompatibilityReport;
      installedCapabilityEnvironment(base?: CapabilityEnvironment): CapabilityEnvironment;
      installedCapabilitySupport: Array<{ id: string; integrated: boolean; reason: string }>;
    }>("src/domain/installed-study/compatibility.ts");
    const build = () => {
      const catalog = new MemoryInstalledStudyCatalog();
      catalog.error = (code) => new DomainError(code);
      const rows = versions.map((version, index): Installation => {
        const prepared = version.prepared!,
          reference: InstalledContentReference = {
            installationId: randomUUID(),
            courseId: fixture.courseId,
            contentVersion: index ? "2.0.0" : "1.0.0",
            contractVersion: prepared.manifest.contracts.course,
            languageContractVersion: prepared.manifest.contracts.language,
            envelopeVersion: prepared.manifest.envelopeVersion,
            artifactHash: digest(Buffer.from(index ? "i8-v2" : "i8-v1")),
          };
        const row: Installation = {
          reference,
          inventory: [],
          provenance: {
            producer: prepared.manifest.producer,
            material: prepared.manifest.provenance,
          },
          capabilityRequirements: prepared.bundle.course.capabilityRequirements ?? [],
          validation: version.report,
          state: "installed",
          preparation: "prepared",
          approval: "local_test_approved",
          createdAt: "2026-10-10T00:00:00.000Z",
          installedAt: "2026-10-10T00:00:00.000Z",
          preparedAt: "2026-10-10T00:00:00.000Z",
          approvedAt: "2026-10-10T00:00:00.000Z",
        };
        catalog.versions.set(reference.installationId, { installation: row, prepared });
        return row;
      });
      catalog.active.set(fixture.courseId, {
        courseId: fixture.courseId,
        installationId: rows[0].reference.installationId,
        revision: 1,
      });
      const service = new InstalledStudyService({
        catalog,
        installations: catalog,
        compiledCourseExists: (id) => id === "compiled.fixture",
      });
      const command = (revision = 0): RuntimeSelectionCommand => ({
        source: "installed",
        courseId: fixture.courseId,
        expectedRevision: revision,
        operationId: randomUUID(),
      });
      const select = async (user = studentA, revision = 0) => {
        const result = await service.select(user, command(revision));
        assert.equal(result.selection?.source, "installed");
        assert(result.selection && "versionSessionId" in result.selection);
        return { result, sessionId: result.selection.versionSessionId };
      };
      const state = (index = 0) =>
        readCourseState(
          null,
          fixture.courseId,
          versions[index].prepared!.bundle.course.languageCode,
        );
      return { catalog, service, rows, command, select, state };
    };
    const reject = async (run: () => Promise<unknown>, code: InstalledStudyErrorCode) => {
      await assert.rejects(run, (error: unknown) => {
        assert(error instanceof DomainError);
        assert.equal(error.code, code);
        assert(!error.message.includes("PRIVATE_QA"));
        return true;
      });
    };
    await check(
      "R01 installed selection creates exactly one pinned session and idempotent receipt",
      async () => {
        const h = build(),
          command = h.command();
        const selected = await h.service.select(studentA, command);
        assert.equal(selected.userId, studentA);
        assert.equal(selected.revision, 1);
        assert.equal(h.catalog.sessions.size, 1);
        assert.deepEqual(await h.service.select(studentA, command), selected);
        assert.equal(h.catalog.sessions.size, 1);
        const session = [...h.catalog.sessions.values()][0];
        assert.deepEqual(session.reference, h.rows[0].reference);
        assert.deepEqual(await h.service.getSelection(studentA), selected);
      },
    );
    await check(
      "R13 stale selection CAS and conflicting operation leave state/session count unchanged",
      async () => {
        const h = build(),
          command = h.command();
        await h.service.select(studentA, command);
        const beforeSelection = copy(h.catalog.selections);
        await reject(() => h.service.select(studentA, h.command(0)), "SELECTION_CONFLICT");
        await reject(
          () =>
            h.service.select(studentA, {
              ...command,
              courseId: "compiled.fixture",
              source: "compiled",
            }),
          "OPERATION_CONFLICT",
        );
        assert.deepEqual(h.catalog.selections, beforeSelection);
        assert.equal(h.catalog.sessions.size, 1);
      },
    );
    await check("R13 concurrent selection CAS admits one complete binding", async () => {
      const h = build();
      const results = await Promise.allSettled([
        h.service.select(studentA, h.command()),
        h.service.select(studentA, h.command()),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 1);
      assert.equal(h.catalog.sessions.size, 1);
      assert.equal((await h.service.getSelection(studentA)).revision, 1);
    });
    await check("R07/R08 existing V1 context survives V2 while new selection pins V2", async () => {
      const h = build(),
        first = await h.select();
      const original = await h.service.resolveContext(studentA, first.sessionId);
      h.catalog.active.set(fixture.courseId, {
        courseId: fixture.courseId,
        installationId: h.rows[1].reference.installationId,
        revision: 2,
      });
      const second = await h.select(studentA, 1);
      assert.equal(
        (await h.service.resolveContext(studentA, second.sessionId)).session.reference
          .contentVersion,
        "2.0.0",
      );
      assert.deepEqual(
        (await h.service.resolveContext(studentA, first.sessionId)).session,
        original.session,
      );
      assert.equal((await h.service.getSelection(studentA)).selection?.source, "installed");
      fixture.assertNoPrivate(await h.service.getSelection(studentA));
      fixture.assertNoPrivate(original.content.prepared.publicCourse);
    });
    await check(
      "R06/R09 per-user installation snapshot is shared, V2 fresh and rollback V1 recovers",
      async () => {
        const h = build(),
          first = await h.select(),
          state = h.state();
        state.profile.onboarded = true;
        state.completedActivityIds = [fixture.contentActivityId];
        const saved = await h.service.save(studentA, {
          versionSessionId: first.sessionId,
          expectedRevision: 0,
          operationId: randomUUID(),
          state,
        });
        assert.equal(saved.revision, 1);
        assert.deepEqual(saved.reference, h.rows[0].reference);
        const another = await h.select(studentA, 1);
        assert.equal((await h.service.load(studentA, another.sessionId)).revision, 1);
        assert.deepEqual(
          (await h.service.load(studentA, another.sessionId)).state?.completedActivityIds,
          [fixture.contentActivityId],
        );
        h.catalog.active.set(fixture.courseId, {
          courseId: fixture.courseId,
          installationId: h.rows[1].reference.installationId,
          revision: 2,
        });
        const v2 = await h.select(studentA, 2);
        const fresh = await h.service.load(studentA, v2.sessionId);
        assert.equal(fresh.revision, 0);
        assert(!fresh.state?.completedActivityIds.length);
        h.catalog.active.set(fixture.courseId, {
          courseId: fixture.courseId,
          installationId: h.rows[0].reference.installationId,
          revision: 3,
        });
        const rolledBack = await h.select(studentA, 3);
        assert.equal((await h.service.load(studentA, rolledBack.sessionId)).revision, 1);
        assert.deepEqual(
          (await h.service.load(studentA, first.sessionId)).state?.completedActivityIds,
          [fixture.contentActivityId],
        );
        assert.equal(
          (await h.service.resolveContext(studentA, v2.sessionId)).session.reference.contentVersion,
          "2.0.0",
        );
      },
    );
    await check(
      "R16 user B cannot resolve/load/save/evidence user A or inherit its snapshot",
      async () => {
        const h = build(),
          first = await h.select();
        await h.service.save(studentA, {
          versionSessionId: first.sessionId,
          expectedRevision: 0,
          operationId: randomUUID(),
          state: h.state(),
        });
        for (const run of [
          () => h.service.resolveContext(studentB, first.sessionId),
          () => h.service.load(studentB, first.sessionId),
          () => h.service.listVersionEvidence(studentB, first.sessionId),
          () =>
            h.service.save(studentB, {
              versionSessionId: first.sessionId,
              expectedRevision: 1,
              operationId: randomUUID(),
              state: h.state(),
            }),
        ])
          await reject(run, "NOT_AUTHORIZED");
        const b = await h.select(studentB);
        assert.equal((await h.service.load(studentB, b.sessionId)).revision, 0);
        assert.equal(h.catalog.progress.size, 1);
      },
    );
    await check("R15 stale progress cannot overwrite canonical installation snapshot", async () => {
      const h = build(),
        first = await h.select();
      await h.service.save(studentA, {
        versionSessionId: first.sessionId,
        expectedRevision: 0,
        operationId: randomUUID(),
        state: h.state(),
      });
      const previous = copy(h.catalog.progress);
      await reject(
        () =>
          h.service.save(studentA, {
            versionSessionId: first.sessionId,
            expectedRevision: 0,
            operationId: randomUUID(),
            state: h.state(),
          }),
        "PROGRESS_CONFLICT",
      );
      assert.deepEqual(h.catalog.progress, previous);
    });
    for (const failure of [
      "getSelection",
      "listActive",
      "resolveInstallation",
      "readProgress",
      "listVersionEvidence",
    ])
      await check("R14 sanitized read failure: " + failure, async () => {
        const h = build(),
          first = await h.select();
        h.catalog.fail.add(failure);
        const run =
          failure === "getSelection"
            ? () => h.service.getSelection(studentA)
            : failure === "listActive" || failure === "resolveInstallation"
              ? () => h.service.select(studentA, h.command(1))
              : () => h.service.load(studentA, first.sessionId);
        await reject(run, "READ_FAILED");
        assert.equal(h.catalog.progress.size, 0);
        assert.equal(h.catalog.sessions.size, 1);
      });
    await check(
      "R15 write failure returns sanitized error and no partial progress/selection",
      async () => {
        const h = build();
        h.catalog.fail.add("select");
        await reject(() => h.service.select(studentA, h.command()), "WRITE_FAILED");
        assert.equal(h.catalog.sessions.size, 0);
        assert.equal(h.catalog.selections.size, 0);
        const first = await h.select();
        h.catalog.fail.add("writeProgress");
        await reject(
          () =>
            h.service.save(studentA, {
              versionSessionId: first.sessionId,
              expectedRevision: 0,
              operationId: randomUUID(),
              state: h.state(),
            }),
          "WRITE_FAILED",
        );
        assert.equal(h.catalog.progress.size, 0);
      },
    );
    await check(
      "R19 no active version denies selection without compiled substitution",
      async () => {
        const h = build();
        h.catalog.active.clear();
        await reject(() => h.service.select(studentA, h.command()), "NO_ACTIVE_VERSION");
        assert.equal(h.catalog.sessions.size, 0);
        assert.equal(h.catalog.selections.size, 0);
      },
    );
    for (const [field, value] of [
      ["state", "preparing"],
      ["preparation", "not_prepared"],
      ["approval", "not_reviewed"],
    ] as const)
      await check(
        "R02/R19 ineligible " + field + " cannot select/partially open session",
        async () => {
          const h = build();
          Object.assign(h.rows[0], { [field]: value });
          await assert.rejects(() => h.service.select(studentA, h.command()));
          assert.equal(h.catalog.sessions.size, 0);
          assert.equal(h.catalog.selections.size, 0);
        },
      );
    await check(
      "R18 client forged grade/assessment data cannot become canonical notes",
      async () => {
        const h = build(),
          first = await h.select(),
          state = h.state();
        state.attempts = [
          {
            id: randomUUID(),
            activityId: fixture.activityId,
            answer: fixture.answers[1],
            correct: true,
            skill: "vocabulary",
            createdAt: new Date().toISOString(),
            sessionId: null,
          },
        ];
        state.assessmentAttempts = [
          {
            id: randomUUID(),
            assessmentId: fixture.assessmentId,
            unitId: fixture.unitId,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            objectiveScore: 100,
            passed: true,
            source: "server",
          },
        ];
        const saved = await h.service.save(studentA, {
          versionSessionId: first.sessionId,
          expectedRevision: 0,
          operationId: randomUUID(),
          state,
        });
        assert.equal(saved.state?.attempts.length ?? 0, 0);
        assert.equal(saved.state?.assessmentAttempts.length ?? 0, 0);
        assert.equal(h.catalog.evidence.length, 0);
      },
    );
    await check(
      "C01 known implemented mandatory AI is integration-blocked even global provider available",
      async () => {
        const blocked = fixture.produce("mandatory-ai", "1.0.0", [
          "--mandatory=ai.writing_feedback",
        ]);
        const globalEnvironment: CapabilityEnvironment = {
          dependencies: { "ai.text_service": { state: "available" } },
        };
        const valid = validateExternalPackageFiles(blocked.files, {
          environment: globalEnvironment,
        });
        assert(valid.prepared);
        const report = compatibility.installedCourseCompatibility(valid.prepared.bundle.course);
        assert.equal(report.compatible, false);
        assert(
          report.diagnostics.some(
            (diagnostic) =>
              diagnostic.capabilityId === "ai.writing_feedback" &&
              diagnostic.condition === "installed.integration" &&
              diagnostic.severity === "error",
          ),
        );
        assert(
          compatibility.installedCapabilitySupport.some(
            (entry) =>
              entry.id === "ai.writing_feedback" && !entry.integrated && entry.reason.length > 0,
          ),
        );
        const installedEnvironment =
          compatibility.installedCapabilityEnvironment(globalEnvironment);
        assert.notDeepEqual(
          installedEnvironment,
          globalEnvironment,
          "Installed integration profile must not inherit a global available claim blindly",
        );
        const h = build();
        h.catalog.versions.get(h.rows[0].reference.installationId)!.prepared = valid.prepared;
        await reject(() => h.service.select(studentA, h.command()), "INTEGRATION_UNAVAILABLE");
        assert.equal(h.catalog.sessions.size, 0);
        assert.equal(h.catalog.progress.size, 0);
        assert.equal(h.catalog.evidence.length, 0);
      },
    );
    await check(
      "C06 supported deterministic path compatibility remains ready without paid provider",
      () => {
        for (const version of versions)
          assert.equal(
            compatibility.installedCourseCompatibility(version.prepared!.bundle.course).compatible,
            true,
          );
      },
    );
    const bridgeFailures: Array<{ scenario: string; message: string }> = [];
    const bridgeCheck = async (scenario: string, run: () => unknown | Promise<unknown>) => {
      try {
        await check(scenario, run);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Independent bridge/cache assertion failed";
        bridgeFailures.push({ scenario, message });
        console.log("FAIL " + scenario + ": " + message);
      }
    };
    type RuntimeContext = {
      userId: string;
      versionSessionId: string;
      reference: InstalledContentReference;
      selectionRevision: number;
    };
    const { InstalledStudyHttpRepository } = await importCandidate<{
      InstalledStudyHttpRepository: new (
        context: RuntimeContext,
        course: ReturnType<typeof publicCourse>,
        request?: typeof fetch,
      ) => StudySyncRepository;
    }>("src/repositories/installed-study-http-repository.ts");
    const { StudyProgressSync } = await importCandidate<
      typeof import("../src/domain/study/study-progress-sync")
    >("src/domain/study/study-progress-sync.ts");
    const { browserStudySyncCache } = await importCandidate<{
      browserStudySyncCache(
        courseId: string,
        languageCode: string,
        runtime?: RuntimeContext,
      ): StudySyncCache;
    }>("src/lib/study-sync-cache.ts");
    const { projectInstalledEvidence } = await importCandidate<{
      projectInstalledEvidence(
        draft: StudyState,
        resolved: ResolvedSession,
        evidence: VersionEvidence[],
      ): StudyState;
    }>("src/domain/installed-study/evidence-projection.ts");
    const response = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    const deferredResponse = () => {
      let resolve!: (response: Response) => void;
      const promise = new Promise<Response>((yes) => {
        resolve = yes;
      });
      return { promise, resolve };
    };
    const tick = async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    };
    class LocalStorageFixture implements Storage {
      values = new Map<string, string>();
      get length() {
        return this.values.size;
      }
      clear() {
        this.values.clear();
      }
      getItem(key: string) {
        return this.values.get(key) ?? null;
      }
      key(index: number) {
        return [...this.values.keys()][index] ?? null;
      }
      removeItem(key: string) {
        this.values.delete(key);
      }
      setItem(key: string, value: string) {
        this.values.set(key, value);
      }
    }
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const localStorage = new LocalStorageFixture();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
    const bridgeFixture = async () => {
      const h = build(),
        selected = await h.select();
      const runtime: RuntimeContext = {
        userId: studentA,
        versionSessionId: selected.sessionId,
        reference: copy(h.rows[0].reference),
        selectionRevision: selected.result.revision,
      };
      const course = versions[0].prepared!.publicCourse;
      const cache = browserStudySyncCache(course.id, course.languageCode, runtime);
      const fresh = () => h.state();
      const envelope = (
        state: StudyState | null = fresh(),
        revision = 0,
      ): InstalledProgressEnvelope => ({
        schemaVersion: 1,
        versionSessionId: runtime.versionSessionId,
        reference: copy(runtime.reference),
        revision,
        state,
        updatedAt: "2026-10-10T12:00:00.123456Z",
      });
      return { h, runtime, course, cache, fresh, envelope };
    };
    const genericCache = () => {
      const entries = new Map<string | null, StudySyncCacheEntry>();
      const cache: StudySyncCache = {
        read: (owner) => copy(entries.get(owner) ?? { state: null, pending: null, recovery: [] }),
        write: (owner, entry) => {
          entries.set(owner, copy(entry));
        },
      };
      return { entries, cache };
    };
    try {
      await bridgeCheck(
        "B00 default browser fetch preserves receiver through actual HTTP load and save",
        async () => {
          const f = await bridgeFixture(),
            requests: Array<{ input: string; init?: RequestInit }> = [],
            previousFetch = globalThis.fetch;
          const draft = f.fresh();
          draft.profile.goal = "Default browser fetch synthetic draft";
          globalThis.fetch = async function (this: unknown, input, init) {
            if (this !== undefined && this !== globalThis)
              throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
            requests.push({ input: String(input), init });
            return response(
              init?.method === "POST"
                ? f.envelope(draft, 1)
                : { ...f.envelope(null, 0), updatedAt: null },
            );
          };
          try {
            // Omit the request argument to exercise the same default used in the browser.
            const repository = new InstalledStudyHttpRepository(f.runtime, f.course);
            assert.equal(await repository.load(), null);
            await repository.save(draft);
            assert.equal(requests.length, 2);
            assert.equal(
              requests[0].input,
              "/api/course-installations/progress?versionSessionId=" +
                encodeURIComponent(f.runtime.versionSessionId),
            );
            assert.equal(requests[0].init?.cache, "no-store");
            assert.equal(requests[1].input, "/api/course-installations/progress");
            assert.equal(requests[1].init?.method, "POST");
            const posted = JSON.parse(String(requests[1].init?.body)) as InstalledProgressWrite;
            assert.equal(posted.versionSessionId, f.runtime.versionSessionId);
            assert.equal(posted.expectedRevision, 0);
            assert.deepEqual(posted.state, draft);
          } finally {
            globalThis.fetch = previousFetch;
          }
        },
      );
      await bridgeCheck(
        "B01 installed HTTP load failure preserves pending and sends zero POST",
        async () => {
          const f = await bridgeFixture(),
            posts: InstalledProgressWrite[] = [];
          const request: typeof fetch = async (_input, init) => {
            if (init?.method === "POST") {
              posts.push(JSON.parse(String(init.body)));
              return response(f.envelope(f.fresh(), 1));
            }
            return response({ code: "READ_FAILED" }, 503);
          };
          const repository = new InstalledStudyHttpRepository(f.runtime, f.course, request);
          const sync = new StudyProgressSync(f.fresh, f.cache);
          await sync.load(sync.beginLoading(), studentA, repository);
          assert.equal(sync.getSnapshot().loadStatus, "failed");
          assert.equal(sync.canSaveRemote(), false);
          const edited = f.fresh();
          edited.profile.goal = "Offline installed draft";
          sync.update(edited);
          await assert.rejects(() => sync.flush());
          await assert.rejects(() => repository.save(edited));
          assert.equal(posts.length, 0);
          assert.equal(sync.getSnapshot().dirty, true);
          assert.equal(f.cache.read(studentA).pending?.profile.goal, edited.profile.goal);
        },
      );
      await bridgeCheck(
        "B02 lost HTTP response retries identical operationId/body and preserves pending until ack",
        async () => {
          const f = await bridgeFixture(),
            posts: InstalledProgressWrite[] = [];
          const request: typeof fetch = async (_input, init) => {
            if (init?.method !== "POST") return response(f.envelope());
            const command = JSON.parse(String(init.body)) as InstalledProgressWrite;
            posts.push(copy(command));
            if (posts.length === 1) throw Error("QA response lost after server committed");
            assert.deepEqual(command, posts[0], "Retry changed its original immutable command");
            return response(f.envelope(copy(command.state), 1));
          };
          const repository = new InstalledStudyHttpRepository(f.runtime, f.course, request),
            sync = new StudyProgressSync(f.fresh, f.cache);
          await sync.load(sync.beginLoading(), studentA, repository);
          const edited = f.fresh();
          edited.profile.goal = "Draft awaiting original receipt";
          sync.update(edited);
          await assert.rejects(() => sync.flush(), /response lost/);
          assert.equal(sync.getSnapshot().dirty, true);
          assert.equal(f.cache.read(studentA).pending?.profile.goal, edited.profile.goal);
          await sync.flush();
          assert.equal(posts.length, 2);
          assert.deepEqual(posts[1], posts[0]);
          assert.equal(sync.getSnapshot().dirty, false);
          assert.equal(f.cache.read(studentA).pending, null);
        },
      );
      await bridgeCheck(
        "B03 later draft after lost response settles original receipt before a new operation",
        async () => {
          const f = await bridgeFixture(),
            posts: InstalledProgressWrite[] = [];
          let savedGoal = "";
          const request: typeof fetch = async (_input, init) => {
            if (init?.method !== "POST") return response(f.envelope());
            const command = JSON.parse(String(init.body)) as InstalledProgressWrite;
            posts.push(copy(command));
            if (posts.length === 1) throw Error("QA response lost after server committed");
            if (posts.length === 2) {
              assert.deepEqual(
                command,
                posts[0],
                "Later editing replaced the pending lost-response command",
              );
              savedGoal = command.state.profile.goal;
              return response(f.envelope(copy(command.state), 1));
            }
            assert.notEqual(command.operationId, posts[0].operationId);
            assert.equal(command.expectedRevision, 1);
            savedGoal = command.state.profile.goal;
            return response(f.envelope(copy(command.state), 2));
          };
          const repository = new InstalledStudyHttpRepository(f.runtime, f.course, request),
            sync = new StudyProgressSync(f.fresh, f.cache);
          await sync.load(sync.beginLoading(), studentA, repository);
          const first = f.fresh();
          first.profile.goal = "Original committed draft";
          sync.update(first);
          await assert.rejects(() => sync.flush(), /response lost/);
          const later = f.fresh();
          later.profile.goal = "Later pending draft";
          sync.update(later);
          await sync.flush();
          assert.equal(posts.length, 3, "Both original receipt and latest draft must be confirmed");
          assert.equal(savedGoal, later.profile.goal);
          assert.equal(sync.getSnapshot().dirty, false);
          assert.equal(f.cache.read(studentA).pending, null);
        },
      );
      await bridgeCheck(
        "B04 CAS409 retains dirty/cache draft and reread preserves explicit recovery",
        async () => {
          const f = await bridgeFixture(),
            posts: InstalledProgressWrite[] = [];
          let advanced = false;
          const request: typeof fetch = async (_input, init) => {
            if (init?.method === "POST") {
              posts.push(JSON.parse(String(init.body)));
              return response({ code: "PROGRESS_CONFLICT" }, 409);
            }
            const state = f.fresh();
            state.profile.goal = advanced ? "Remote revision advanced" : "Original remote";
            return response(f.envelope(state, advanced ? 2 : 1));
          };
          const repository = new InstalledStudyHttpRepository(f.runtime, f.course, request),
            sync = new StudyProgressSync(f.fresh, f.cache);
          await sync.load(sync.beginLoading(), studentA, repository);
          const edited = f.fresh();
          edited.profile.goal = "Local CAS-conflicting draft";
          sync.update(edited);
          await assert.rejects(() => sync.flush(), /PROGRESS_CONFLICT/);
          assert.equal(sync.getSnapshot().dirty, true);
          assert.equal(sync.getSnapshot().state.profile.goal, edited.profile.goal);
          assert.equal(f.cache.read(studentA).pending?.profile.goal, edited.profile.goal);
          advanced = true;
          await sync.load(sync.beginLoading(), studentA, repository);
          assert.equal(sync.getSnapshot().state.profile.goal, "Remote revision advanced");
          assert(
            sync.getSnapshot().recovery.some((draft) => draft.profile.goal === edited.profile.goal),
          );
          assert(
            f.cache
              .read(studentA)
              .recovery.some((draft) => draft.profile.goal === edited.profile.goal),
          );
          assert.equal(
            posts.length,
            1,
            "Recovery must not post the abandoned CAS snapshot automatically",
          );
        },
      );
      await bridgeCheck(
        "B05 actual cache namespaces isolate A/B, V1/V2 and compiled source",
        async () => {
          const f = await bridgeFixture(),
            v2Runtime: RuntimeContext = {
              ...f.runtime,
              versionSessionId: randomUUID(),
              reference: copy(f.h.rows[1].reference),
            };
          const bRuntime: RuntimeContext = {
            ...f.runtime,
            userId: studentB,
            versionSessionId: randomUUID(),
          };
          const cacheB = browserStudySyncCache(f.course.id, f.course.languageCode, bRuntime);
          const cacheV2 = browserStudySyncCache(f.course.id, f.course.languageCode, v2Runtime);
          const compiled = browserStudySyncCache(f.course.id, f.course.languageCode);
          const draft = f.fresh();
          draft.profile.goal = "A V1 namespace canary";
          f.cache.write(studentA, { state: draft, pending: draft, recovery: [draft] });
          assert.deepEqual(cacheB.read(studentB), { state: null, pending: null, recovery: [] });
          assert.deepEqual(cacheV2.read(studentA), { state: null, pending: null, recovery: [] });
          assert.deepEqual(compiled.read(studentA), { state: null, pending: null, recovery: [] });
          assert.deepEqual(f.cache.read(studentB), { state: null, pending: null, recovery: [] });
          assert.throws(() =>
            f.cache.write(studentB, { state: draft, pending: draft, recovery: [] }),
          );
          assert.equal(f.cache.read(studentA).pending?.profile.goal, draft.profile.goal);
        },
      );
      await bridgeCheck(
        "B06 original HTTP session/reference and server timestamp survive an active V2 reply",
        async () => {
          const f = await bridgeFixture(),
            posts: InstalledProgressWrite[] = [],
            canonical = f.fresh();
          const evidenceId = randomUUID(),
            originalTime = "2026-10-10T12:00:00.123456Z";
          canonical.attempts = [
            {
              id: evidenceId,
              activityId: fixture.activityId,
              answer: fixture.answers[0],
              correct: true,
              skill: "vocabulary",
              createdAt: originalTime,
              sessionId: null,
            },
          ];
          const request: typeof fetch = async (_input, init) => {
            if (init?.method !== "POST") return response(f.envelope(canonical, 0));
            const command = JSON.parse(String(init.body)) as InstalledProgressWrite;
            posts.push(copy(command));
            assert.equal(command.versionSessionId, f.runtime.versionSessionId);
            const envelope = f.envelope(copy(command.state), 1);
            if (posts.length === 1) envelope.reference = copy(f.h.rows[1].reference);
            return response(envelope);
          };
          const repository = new InstalledStudyHttpRepository(f.runtime, f.course, request),
            sync = new StudyProgressSync(f.fresh, f.cache);
          await sync.load(sync.beginLoading(), studentA, repository);
          assert.equal(sync.getSnapshot().state.attempts[0].id, evidenceId);
          assert.equal(sync.getSnapshot().state.attempts[0].createdAt, originalTime);
          const edited = copy(sync.getSnapshot().state);
          edited.profile.goal = "Edit while active became V2";
          sync.update(edited);
          await assert.rejects(() => sync.flush());
          assert.equal(sync.getSnapshot().dirty, true);
          assert(f.cache.read(studentA).pending);
          await sync.flush();
          assert.deepEqual(posts[1], posts[0]);
          assert.equal(sync.getSnapshot().state.attempts[0].createdAt, originalTime);
        },
      );
      await bridgeCheck(
        "B07 obsolete HTTP read cannot apply A state after generation/account B",
        async () => {
          const f = await bridgeFixture(),
            cache = genericCache(),
            old = deferredResponse();
          const repositoryA = new InstalledStudyHttpRepository(
            f.runtime,
            f.course,
            async () => old.promise,
          );
          const contextB = { ...f.runtime, userId: studentB, versionSessionId: randomUUID() };
          const remoteB = f.fresh();
          remoteB.profile.goal = "Authoritative B generation";
          const envelopeB = {
            ...f.envelope(remoteB, 1),
            versionSessionId: contextB.versionSessionId,
          };
          const repositoryB = new InstalledStudyHttpRepository(contextB, f.course, async () =>
            response(envelopeB),
          );
          const sync = new StudyProgressSync(f.fresh, cache.cache);
          const previous = sync.load(sync.beginLoading(), studentA, repositoryA);
          await tick();
          await sync.load(sync.beginLoading(), studentB, repositoryB);
          const staleA = f.fresh();
          staleA.profile.goal = "Obsolete A response";
          old.resolve(response(f.envelope(staleA, 1)));
          await previous;
          assert.equal(sync.getSnapshot().userId, studentB);
          assert.equal(sync.getSnapshot().state.profile.goal, remoteB.profile.goal);
          assert.equal(sync.getSnapshot().dirty, false);
          assert.equal(cache.entries.get(studentB)?.state?.profile.goal, remoteB.profile.goal);
        },
      );
      await bridgeCheck(
        "B08 obsolete HTTP save acknowledgement cannot clear a later account generation",
        async () => {
          const f = await bridgeFixture(),
            cache = genericCache(),
            old = deferredResponse(),
            posts: InstalledProgressWrite[] = [];
          const repositoryA = new InstalledStudyHttpRepository(
            f.runtime,
            f.course,
            async (_input, init) => {
              if (init?.method !== "POST") return response(f.envelope());
              posts.push(JSON.parse(String(init.body)));
              return old.promise;
            },
          );
          const contextB = { ...f.runtime, userId: studentB, versionSessionId: randomUUID() },
            remoteB = f.fresh();
          remoteB.profile.goal = "B after in-flight A write";
          const repositoryB = new InstalledStudyHttpRepository(contextB, f.course, async () =>
            response({ ...f.envelope(remoteB, 1), versionSessionId: contextB.versionSessionId }),
          );
          const sync = new StudyProgressSync(f.fresh, cache.cache);
          await sync.load(sync.beginLoading(), studentA, repositoryA);
          const pendingA = f.fresh();
          pendingA.profile.goal = "A in-flight draft";
          sync.update(pendingA);
          const write = sync.flush();
          void write.catch(() => undefined);
          await tick();
          assert.equal(posts.length, 1);
          const laterLoad = sync.load(sync.beginLoading(), studentB, repositoryB);
          old.resolve(response(f.envelope(pendingA, 1)));
          await assert.rejects(() => write, /sessão mudou/i);
          await laterLoad;
          assert.equal(sync.getSnapshot().userId, studentB);
          assert.equal(sync.getSnapshot().state.profile.goal, remoteB.profile.goal);
          assert.equal(cache.entries.get(studentA)?.pending?.profile.goal, pendingA.profile.goal);
          assert.equal(cache.entries.get(studentB)?.pending, null);
        },
      );
      await bridgeCheck(
        "B09 microsecond evidence order preserves original attempt IDs and canonical mistake outcome",
        async () => {
          const h = build(),
            selected = await h.select(),
            resolved = await h.service.resolveContext(studentA, selected.sessionId);
          const activity =
            resolved.content.prepared.bundle.course.units[0].lessons[0].activities.find(
              (entry) => entry.id === fixture.activityId,
            )!;
          const bundle = resolved.content.prepared.bundle,
            context = { language: bundle.language, course: bundle.course, preference: "variant-b" };
          const early: VersionEvidence = {
            id: "ffffffff-ffff-4fff-8fff-fffffffffff1",
            userId: studentA,
            sessionId: selected.sessionId,
            reference: copy(h.rows[0].reference),
            kind: "activity",
            definitionId: fixture.activityId,
            input: { answer: fixture.answers[1] },
            result: JSON.parse(
              JSON.stringify(
                gradeActivity(activity, fixture.answers[1], bundle.language.normalization, context),
              ),
            ),
            createdAt: "2026-10-10T12:00:00.123401Z",
          };
          const late: VersionEvidence = {
            ...copy(early),
            id: "00000000-0000-4000-8000-000000000002",
            input: { answer: fixture.answers[0] },
            result: JSON.parse(
              JSON.stringify(
                gradeActivity(activity, fixture.answers[0], bundle.language.normalization, context),
              ),
            ),
            createdAt: "2026-10-10T12:00:00.123402Z",
          };
          assert.equal(
            Date.parse(early.createdAt),
            Date.parse(late.createdAt),
            "Fixture must really collide at millisecond precision",
          );
          const reverse = [late, early],
            original = copy(reverse);
          const actual = projectInstalledEvidence(h.state(), resolved, reverse),
            reordered = projectInstalledEvidence(h.state(), resolved, [early, late]);
          assert.deepEqual(actual, reordered);
          assert.deepEqual(
            actual.attempts.map((attempt) => attempt.id),
            [late.id, early.id],
          );
          assert.equal(actual.mistakes[fixture.activityId].timesMissed, 1);
          assert.equal(actual.mistakes[fixture.activityId].timesCorrect, 1);
          assert.equal(actual.attempts[0].correct, true);
          assert.deepEqual(
            reverse,
            original,
            "Trusted original timestamps/reference must not be mutated",
          );
        },
      );
      await bridgeCheck(
        "B10 planner excludes unsupported review despite due mistakes and global feature enabled",
        async () => {
          const f = await bridgeFixture(),
            resolved = await f.h.service.resolveContext(studentA, f.runtime.versionSessionId);
          const { buildStudyPlan } = await importCandidate<
            typeof import("../src/domain/study/study-planner")
          >("src/domain/study/study-planner.ts");
          const { ReviewScheduler } = await importCandidate<
            typeof import("../src/domain/review/review-scheduler")
          >("src/domain/review/review-scheduler.ts");
          const flags = await importCandidate<{ featureFlags: { SPACED_REPETITION: boolean } }>(
            "src/lib/feature-flags.ts",
          );
          const previous = flags.featureFlags.SPACED_REPETITION;
          flags.featureFlags.SPACED_REPETITION = true;
          try {
            const now = new Date("2026-10-11T12:00:00.000Z"),
              state = f.fresh();
            state.mistakes[fixture.activityId] = {
              id: randomUUID(),
              activityId: fixture.activityId,
              courseId: fixture.courseId,
              languageCode: f.course.languageCode,
              category: "vocabulary",
              originalAnswer: fixture.answers[1],
              correctAnswer: fixture.answers[0],
              explanation: "Synthetic due mistake",
              timesMissed: 1,
              timesCorrect: 0,
              lastMissedAt: "2026-10-10T12:00:00.000Z",
              lastReviewedAt: null,
              schedule: ReviewScheduler.initial(new Date("2026-10-09T12:00:00.000Z")),
            };
            const availability = (
              f.course as typeof f.course & { availability?: Record<string, unknown> }
            ).availability;
            const enabled = {
              ...f.course,
              availability: { ...availability, spacedRepetition: true },
            } as typeof f.course;
            const disabled = {
              ...f.course,
              availability: { ...availability, spacedRepetition: false },
            } as typeof f.course;
            const resources = resolved.content.prepared.bundle.resources;
            assert(
              buildStudyPlan(enabled, state, 15, resources.vocabulary, resources, now).some(
                (item) => item.kind === "review",
              ),
              "Control course did not create its due review",
            );
            assert(
              !buildStudyPlan(disabled, state, 15, resources.vocabulary, resources, now).some(
                (item) => item.kind === "review",
              ),
              "Installed unsupported review was still planned",
            );
          } finally {
            flags.featureFlags.SPACED_REPETITION = previous;
          }
        },
      );
      const guardSource = readFileSync(
        join(candidateRoot(), "src/domain/ai/ai-request-guard.ts"),
        "utf8",
      );
      const versionGuardSource = readFileSync(
        join(candidateRoot(), "src/lib/versioned-operation-guard.ts"),
        "utf8",
      );
      const compileVm = (source: string) =>
        ts.transpileModule(source, {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
      const vmGlobals = {
        Request,
        Response,
        FormData,
        URL,
        Headers,
        TextEncoder,
        Buffer,
        structuredClone,
      };
      for (const mode of ["installed", "lookup-fails", "compiled"] as const)
        await bridgeCheck(
          "B12 real AI guard without marker before quota/provider: " + mode,
          async () => {
            const versionExports: Record<string, unknown> = {},
              guardExports: Record<string, unknown> = {};
            const effects = { reservations: 0, clients: 0, selectedChecks: 0, mockProvider: 0 };
            runInNewContext(compileVm(versionGuardSource), {
              ...vmGlobals,
              exports: versionExports,
              require(id: string) {
                if (id === "server-only") return {};
                throw Error("Unexpected version guard dependency " + id);
              },
            });
            const reservationId = randomUUID();
            runInNewContext(compileVm(guardSource), {
              ...vmGlobals,
              exports: guardExports,
              process: { env: { DESTRAVA_LOCAL_ONLY: "1", NODE_ENV: "development" } },
              require(id: string) {
                if (id === "next/server")
                  return {
                    NextResponse: {
                      json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
                    },
                  };
                if (id === "@/lib/versioned-operation-guard") return versionExports;
                if (id === "@/lib/supabase/server")
                  return {
                    isSupabaseConfigured: () => true,
                    getAuthenticatedUser: async () => ({ id: studentA }),
                    createSupabaseServerClient: async () => {
                      effects.clients++;
                      return {
                        rpc: async (name: string) => {
                          assert.equal(name, "reserve_ai_request");
                          effects.reservations++;
                          return { data: reservationId, error: null };
                        },
                      };
                    },
                  };
                if (id === "@/lib/application-course-runtime")
                  return {
                    isSelectedInstalled: async (userId: string) => {
                      assert.equal(userId, studentA);
                      effects.selectedChecks++;
                      if (mode === "lookup-fails") throw Error("QA selection read unavailable");
                      return mode === "installed";
                    },
                  };
                throw Error("Unexpected real AI guard dependency " + id);
              },
            });
            const guard = guardExports.guardAIRequest as (
              request: Request,
              feature: string,
              parser: "json",
            ) => Promise<{ error?: Response; reservationId?: string }>;
            const body = { courseId: fixture.courseId, question: "Pergunta sintética sem marker" };
            const request = new Request("http://127.0.0.1:3000/api/ai/tutor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const result = await guard(request, "tutor", "json");
            if (!result.error) effects.mockProvider++;
            assert.equal(effects.selectedChecks, 1);
            assert.equal(request.bodyUsed, false);
            assert.deepEqual(await request.json(), body);
            if (mode === "compiled") {
              assert.equal(result.error, undefined);
              assert.equal(result.reservationId, reservationId);
              assert.equal(effects.clients, 1);
              assert.equal(effects.reservations, 1);
              assert.equal(effects.mockProvider, 1);
            } else {
              assert(result.error);
              assert.equal(result.error.status, mode === "installed" ? 422 : 503);
              assert.equal(effects.clients, 0);
              assert.equal(effects.reservations, 0);
              assert.equal(effects.mockProvider, 0);
              if (mode === "installed")
                assert.equal((await result.error.json()).layer, "installed.integration");
            }
          },
        );
      const applicationSource = readFileSync(
        join(candidateRoot(), "src/lib/application-course-runtime.ts"),
        "utf8",
      );
      const installationDomain = await importCandidate<
        typeof import("../src/domain/course-installations/contracts")
      >("src/domain/course-installations/contracts.ts");
      for (const scenario of [
        { name: "missing cookie active default", cookie: undefined, active: true },
        { name: "invalid cookie active default", cookie: "invalid.bootstrap.cookie", active: true },
        {
          name: "invalid cookie compiled control",
          cookie: "invalid.bootstrap.cookie",
          active: false,
        },
      ])
        await bridgeCheck(
          "B13 real SSR resolver uses one bootstrap identity: " + scenario.name,
          async () => {
            const exports: Record<string, unknown> = {},
              defaultId = "compiled.bootstrap.fixture",
              bundle = copy(versions[0].prepared!.bundle);
            bundle.course.id = defaultId;
            bundle.coursePackage.id = defaultId;
            let compiledProjections = 0;
            const selection: RuntimeSelectionEnvelope = {
              schemaVersion: 1,
              userId: studentA,
              revision: 0,
              selection: null,
              updatedAt: null,
            };
            runInNewContext(compileVm(applicationSource), {
              ...vmGlobals,
              exports,
              require(id: string) {
                if (id === "server-only") return {};
                if (id === "@/content/course-registry")
                  return {
                    defaultCourseId: defaultId,
                    allCourseBundles: () => [bundle],
                    findCourseBundle: (courseId: string) =>
                      courseId === defaultId ? bundle : undefined,
                  };
                if (id === "@/content/public")
                  return {
                    publicCourse: (...args: Parameters<typeof publicCourse>) => {
                      compiledProjections++;
                      return publicCourse(...args);
                    },
                    publicRequirements: () => [],
                  };
                if (id === "@/engine/capabilities/availability-projection")
                  return { projectCapabilityAvailability: () => ({}) };
                if (id === "@/domain/installed-study/compatibility") return compatibility;
                if (id === "@/lib/capability-environment")
                  return { serverCapabilityEnvironment: () => ({}) };
                if (id === "@/domain/installed-study/contracts")
                  return { InstalledStudyError: DomainError };
                if (id === "@/domain/course-installations/contracts") return installationDomain;
                if (id === "@/lib/installed-runtime-scope")
                  return { installedRuntimeConfigured: () => true };
                if (id === "@/lib/installed-study-runtime")
                  return {
                    installedStudyPorts: () => ({
                      study: { getSelection: async () => selection },
                      catalog: {
                        listActive: async () =>
                          scenario.active
                            ? [{ courseId: defaultId, installationId: randomUUID(), revision: 1 }]
                            : [],
                      },
                      installations: {
                        resolveInstallation: async () => {
                          throw Error("QA installed default artifact unavailable");
                        },
                      },
                    }),
                  };
                if (id === "@/lib/course-installation-runtime")
                  return {
                    resolveRuntimeCourse: async () => {
                      throw Error("Operation resolver is outside SSR bootstrap test");
                    },
                  };
                throw Error("Unexpected SSR resolver dependency " + id);
              },
            });
            const resolver = exports.resolveApplicationRuntime as (
              userId: string,
              legacyCourseId?: string,
            ) => Promise<{
              source: string;
              view?: { course: { id: string } };
              bundle?: unknown;
              unavailable?: unknown;
            }>;
            const resolved = await resolver(studentA, scenario.cookie);
            assert.equal(resolved.source, scenario.active ? "unavailable" : "compiled");
            if (scenario.active) {
              assert.equal(resolved.view, undefined);
              assert.equal(resolved.bundle, undefined);
              assert(resolved.unavailable);
              assert.equal(
                compiledProjections,
                0,
                "Active default installed identity was silently projected from compiled content",
              );
            } else {
              assert.equal(resolved.view?.course.id, defaultId);
              assert.equal(compiledProjections, 1);
            }
          },
        );

      const malformedCases: Array<{
        name: string;
        edit: (envelope: Record<string, unknown>) => void;
      }> = [
        {
          name: "missing revision",
          edit: (body) => {
            delete body.revision;
          },
        },
        {
          name: "different session",
          edit: (body) => {
            body.versionSessionId = randomUUID();
          },
        },
        {
          name: "non-growing revision",
          edit: (body) => {
            body.revision = 0;
          },
        },
        {
          name: "null saved state",
          edit: (body) => {
            body.state = null;
          },
        },
        {
          name: "array saved state",
          edit: (body) => {
            body.state = [];
          },
        },
        {
          name: "different course state",
          edit: (body) => {
            body.state = { ...(body.state as object), courseId: "foreign.fixture" };
          },
        },
        {
          name: "invalid attempts collection",
          edit: (body) => {
            body.state = { ...(body.state as object), attempts: "illegible" };
          },
        },
        {
          name: "empty saved state",
          edit: (body) => {
            body.state = {};
          },
        },
        {
          name: "missing server updatedAt",
          edit: (body) => {
            delete body.updatedAt;
          },
        },
      ];
      for (const malformed of malformedCases)
        await bridgeCheck("B11 malformed save cannot acknowledge: " + malformed.name, async () => {
          const f = await bridgeFixture(),
            posts: InstalledProgressWrite[] = [];
          let malformedReply = true;
          const request: typeof fetch = async (_input, init) => {
            if (init?.method !== "POST") return response(f.envelope());
            const command = JSON.parse(String(init.body)) as InstalledProgressWrite;
            posts.push(copy(command));
            const body = f.envelope(copy(command.state), 1) as unknown as Record<string, unknown>;
            if (malformedReply) malformed.edit(body);
            return response(body);
          };
          const repository = new InstalledStudyHttpRepository(f.runtime, f.course, request),
            sync = new StudyProgressSync(f.fresh, f.cache);
          await sync.load(sync.beginLoading(), studentA, repository);
          const draft = f.fresh();
          draft.profile.goal = "Draft not acknowledged by malformed reply";
          sync.update(draft);
          await assert.rejects(
            () => sync.flush(),
            "Malformed HTTP200 was acknowledged as a successful save",
          );
          assert.equal(sync.getSnapshot().dirty, true);
          assert.equal(f.cache.read(studentA).pending?.profile.goal, draft.profile.goal);
          malformedReply = false;
          await sync.flush();
          assert.deepEqual(
            posts[1],
            posts[0],
            "Malformed response discarded original pending operationId",
          );
          assert.equal(sync.getSnapshot().dirty, false);
          assert.equal(f.cache.read(studentA).pending, null);
        });
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }

    assert.equal(forbiddenNetworkCalls, 0);
    assert.deepEqual(candidateHashes(paths), before, "Candidate bytes changed during QA run");
    console.log(
      JSON.stringify({
        taskId: "I8-QA-PURE",
        scope: "ports-producer-bridge-cache",
        checks: records.length + bridgeFailures.length,
        networkCalls: forbiddenNetworkCalls,
        records,
        failures: bridgeFailures,
        passed: records.length,
        failed: bridgeFailures.length,
        candidate: before,
      }),
    );
    assert.equal(
      bridgeFailures.length,
      0,
      "Independent bridge/cache failures: " + JSON.stringify(bridgeFailures),
    );
  } finally {
    fixture.cleanup();
    globalThis.fetch = originalFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
