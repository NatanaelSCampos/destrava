import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AuthorizationGuard,
  Installation,
  VersionSession,
} from "../src/domain/course-installations/contracts";
import {
  candidateHashes,
  cloneFiles,
  digest,
  editPackageJson,
  externalVersionFixtures,
  importCandidate,
  jsonFile,
} from "./course-installation-test-fixtures";

/** The Lead runs this only through run-course-installations-local.mjs in the primary checkout. */
async function main() {
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "Local test activation is unavailable in production",
  );
  const local = await importCandidate<typeof import("./local-environment.mjs")>(
    "scripts/local-environment.mjs",
  );
  const env = local.localEnvironment();
  local.assertLocalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, local.localApi);
  const proof = local.assertLocalDocker();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    local.assertLocalUrl(typeof input === "string" || input instanceof URL ? input : input.url, [
      local.localApi,
      local.localApp,
      "http://127.0.0.1:9337",
    ]);
    return originalFetch(input, { ...init, redirect: "manual" });
  };
  const { createLocalCourseInstallationContext } = await importCandidate<{
    createLocalCourseInstallationContext(): Promise<{
      db: SupabaseClient;
      authorizer: AuthorizationGuard;
      authority: unknown;
    }>;
  }>("scripts/course-installation-local-authority.ts");
  const { CourseInstallationService } = await importCandidate<
    typeof import("../src/domain/course-installations/service")
  >("src/domain/course-installations/service.ts");
  const { SupabaseCourseInstallationCatalog, SupabaseCourseArtifactStore } = await importCandidate<
    typeof import("../src/repositories/supabase-course-installations")
  >("src/repositories/supabase-course-installations.ts");
  const { evaluateUnitPolicies } = await importCandidate<
    typeof import("../src/domain/study/learning-policy-engine")
  >("src/domain/study/learning-policy-engine.ts");
  const { readCourseState } = await importCandidate<
    typeof import("../src/domain/study/course-state-storage")
  >("src/domain/study/course-state-storage.ts");
  const { recordServerAssessment } = await importCandidate<
    typeof import("../src/domain/study/study-state")
  >("src/domain/study/study-state.ts");
  const { publicCourse } =
    await importCandidate<typeof import("../src/content/public")>("src/content/public.ts");

  const { defaultCourseId, requireCourseBundle } = await importCandidate<
    typeof import("../src/content/course-registry")
  >("src/content/course-registry.ts");
  const { SupabaseStudyRepository } = await importCandidate<
    typeof import("../src/repositories/supabase-study-repository")
  >("src/repositories/supabase-study-repository.ts");

  const context = await createLocalCourseInstallationContext();
  const browserState: {
    current: Awaited<
      ReturnType<(typeof import("./checkpoint-browser.mjs"))["checkpointBrowser"]>
    > | null;
  } = { current: null };
  const playbackEnvironment = {
    dependencies: { "client.media_playback": { state: "available" as const } },
  };
  const retainedUsers = new Set<string>();
  const retainedAuxiliaryCourseIds = new Set<string>();
  const retainedAuxiliaryInstallationIds = new Set<string>();
  const users: string[] = [],
    uploads: Array<{ bucket: string; path: string }> = [];
  const fixture = externalVersionFixtures();
  const expectedCourseTitle = jsonFile(fixture.v1, "documents/course.json").title;
  assert(typeof expectedCourseTitle === "string" && expectedCourseTitle.trim().length > 0);
  assert.equal(jsonFile(fixture.v2, "documents/course.json").title, expectedCourseTitle);
  type Student = { id: string; client: SupabaseClient; cookies: Map<string, string> };
  const records: Array<{ scenario: string; result: "passed" }> = [];
  const check = async (name: string, run: () => Promise<void>) => {
    await run();
    records.push({ scenario: name, result: "passed" });
    console.log("OK " + name);
  };
  // Observe only upload destinations, never credentials or resource/document bodies.
  const trackUploads = (db: SupabaseClient): SupabaseClient => {
    const trackedStorage = new Proxy(db.storage, {
      get(storage, property) {
        if (property === "from")
          return (bucket: string) => {
            const client = storage.from(bucket);
            return new Proxy(client, {
              get(target, member) {
                const value = Reflect.get(target, member, target);
                if (member === "upload")
                  return (...args: unknown[]) => {
                    assert.equal(typeof args[0], "string");
                    uploads.push({ bucket, path: args[0] as string });
                    return Reflect.apply(value, target, args);
                  };
                return typeof value === "function" ? value.bind(target) : value;
              },
            });
          };
        const value = Reflect.get(storage, property, storage);
        return typeof value === "function" ? value.bind(storage) : value;
      },
    });
    return new Proxy(db, {
      get(target, property) {
        if (property === "storage") return trackedStorage;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
  const trackedDb = trackUploads(context.db);
  const catalog = new SupabaseCourseInstallationCatalog(context.db);
  const store = new SupabaseCourseArtifactStore(trackedDb);
  const service = new CourseInstallationService({
    catalog,
    store,
    authorizer: context.authorizer,
    environment: playbackEnvironment,
  });
  const peerDb = createClient(local.localApi, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: local.localFetch },
  });
  const peerCatalog = new SupabaseCourseInstallationCatalog(peerDb);
  const peerService = new CourseInstallationService({
    catalog: peerCatalog,
    store: new SupabaseCourseArtifactStore(trackUploads(peerDb)),
    authorizer: context.authorizer,
    environment: playbackEnvironment,
  });

  const student = async (): Promise<Student> => {
    const email = "i7-qa-" + randomUUID() + "@example.test",
      password = "I7-QA-" + randomUUID() + "!";
    const created = await context.db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    assert(created.data.user);
    users.push(created.data.user.id);
    const cookies = new Map<string, string>();
    const client = createServerClient(local.localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (items) => {
          for (const item of items) cookies.set(item.name, item.value);
        },
      },
      global: { fetch: local.localFetch },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    assert.equal(login.error, null);
    return { id: created.data.user.id, client, cookies };
  };
  const api = (owner: Student | null, path: string, method = "GET", body?: unknown) =>
    local.localFetch(new URL(path, local.localApp), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(owner
          ? { Cookie: [...owner.cookies].map(([name, value]) => name + "=" + value).join("; ") }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const assertNoPrivate = (value: unknown) => {
    const serialized = JSON.stringify(value);
    for (const canary of fixture.rubricCanaries)
      assert(!serialized.includes(canary), "Private correction criteria leaked");
    for (const answer of fixture.answers)
      assert(!serialized.includes(answer), "Unattempted answer leaked");
  };
  const ready = async (files: ReadonlyMap<string, Uint8Array>) => {
    const row = await service.install(files, context.authority);
    await service.prepareForHomologation(row.reference.installationId, context.authority);
    return service.recordLocalApproval(row.reference.installationId, context.authority);
  };
  const command = (row: Installation, revision: number) => ({
    courseId: row.reference.courseId,
    installationId: row.reference.installationId,
    expectedRevision: revision,
    operationId: randomUUID(),
  });
  const createSession = async (owner: Student): Promise<VersionSession> => {
    retainedUsers.add(owner.id); // A response can be lost after the immutable session committed.
    const id = randomUUID();
    const response = await api(owner, "/api/course-installations/sessions", "POST", {
      courseId: fixture.courseId,
      sessionId: id,
    });
    assert.equal(
      response.status,
      200,
      "Real session route must resolve external content without build/catalog recompilation",
    );
    const body = await response.json();
    assertNoPrivate(body);
    assert.equal(body.session.id, id);
    assert.equal(body.session.userId, owner.id);
    assert.equal(body.course.id, fixture.courseId);
    return body.session;
  };
  const grade = async (
    owner: Student,
    session: VersionSession,
    answer: string,
    evidenceId = randomUUID(),
  ) => {
    const response = await api(owner, "/api/grade", "POST", {
      courseId: fixture.courseId,
      activityId: fixture.activityId,
      answer,
      versionSessionId: session.id,
      evidenceId,
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const evaluate = async (owner: Student, session: VersionSession, answer: string) => {
    const input = {
      courseId: fixture.courseId,
      assessmentId: fixture.assessmentId,
      attemptId: randomUUID(),
      startedAt: new Date().toISOString(),
      responses: [{ activityId: fixture.activityId, answer }],
      versionSessionId: session.id,
    };
    const response = await api(owner, "/api/assessments", "POST", input);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.objectiveScore, 100);
    assert.equal(result.contentVersion, session.reference.contentVersion);
    return { input, result };
  };
  const policies = async (
    owner: Student,
    session: VersionSession,
    evaluation?: Awaited<ReturnType<typeof evaluate>>,
  ) => {
    const response = await api(owner, "/api/course-installations/policies", "POST", {
      versionSessionId: session.id,
      unitId: fixture.unitId,
      evidenceId: randomUUID(),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.reference, session.reference);
    assert.equal(body.versionSessionId, session.id);
    assertNoPrivate(body);
    const resolved = await service.resolveSession(owner.id, session.id),
      bundle = resolved.content.prepared.bundle;
    const course = publicCourse(bundle.course, bundle.language);
    let state = readCourseState(null, course.id, course.languageCode);
    if (evaluation) state = recordServerAssessment(state, course, evaluation.result);
    const unit = course.units.find((item) => item.id === fixture.unitId)!;
    const expected = JSON.parse(JSON.stringify(evaluateUnitPolicies(unit, state, course)));
    assert.deepEqual(
      body.result,
      expected,
      "HTTP policy result must use the existing evaluator and the pinned definition",
    );
    const evidence = await service.listEvidence(owner.id, session.id);
    assert(
      evidence.some(
        (entry) =>
          entry.kind === "learning_policy" &&
          entry.definitionId === fixture.unitId &&
          entry.reference.installationId === session.reference.installationId,
      ),
    );
    return body;
  };

  try {
    const a = await student(),
      b = await student();
    const anonymous = createClient(local.localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: local.localFetch },
    });
    await check("protected local proof, real auth and anonymous session rejection", async () => {
      assert(proof.localDaemon);
      assert.throws(() => local.assertLocalUrl("https://example.supabase.co"));
      assert.throws(() => local.assertLocalUrl("http://localhost:54321"));
      const response = await api(null, "/api/course-installations/sessions", "POST", {
        courseId: fixture.courseId,
      });
      assert.equal(response.status, 401);
      await assert.rejects(() =>
        service.install(fixture.v1, JSON.parse(JSON.stringify(context.authority))),
      );
    });
    let first!: Installation;
    await check(
      "two independent SQL and Storage clients concurrently install one immutable V1 artifact",
      async () => {
        const installed = await Promise.all([
          service.install(fixture.v1, context.authority),
          peerService.install(cloneFiles(fixture.v1), context.authority),
        ]);
        assert.equal(installed[0].state, "installed");
        assert.equal(installed[1].state, "installed");
        assert.deepEqual(installed[0].reference, installed[1].reference);
        first = installed[0];
        assert.equal((await catalog.list(fixture.courseId)).length, 1);
        const transitions = await catalog.transitions(fixture.courseId);
        assert.equal(transitions.filter((entry) => entry.action === "reserve").length, 1);
        assert.equal(transitions.filter((entry) => entry.action === "confirm").length, 1);
      },
    );

    await check(
      "V1 persists, exact retry preserves identity and installation never activates",
      async () => {
        const repeat = await service.install(cloneFiles(fixture.v1), context.authority);
        assert.deepEqual(repeat.reference, first.reference);
        assert.equal(first.state, "installed");
        assert.equal(first.approval, "not_reviewed");
        assert.equal(first.preparation, "not_prepared");
        assert.equal((await catalog.getActive(fixture.courseId)).installationId, null);
        assert.equal((await catalog.list(fixture.courseId)).length, 1);
        await assert.rejects(() => service.activate(command(first, 0), context.authority));
      },
    );
    await check(
      "real private snapshot/RPCs and artifact objects are denied to learners and anonymous clients",
      async () => {
        for (const client of [anonymous, a.client, b.client]) {
          const unprivileged = new SupabaseCourseInstallationCatalog(client);
          await assert.rejects(() => unprivileged.list(fixture.courseId));
          await assert.rejects(() =>
            unprivileged.activate(command(first, 0), "activate", first.reference, {
              actorId: "forged-actor",
              localToken: "forged-nonce",
            }),
          );
          for (const upload of uploads) {
            const result = await client.storage.from(upload.bucket).download(upload.path);
            assert(
              result.error,
              "Raw artifact object must remain private even for an enrolled user",
            );
          }
        }
        let observedManifest = false;
        for (const upload of uploads) {
          const raw = await context.db.storage.from(upload.bucket).download(upload.path);
          assert.equal(raw.error, null);
          assert(raw.data);
          if (
            digest(new Uint8Array(await raw.data.arrayBuffer())) ===
            digest(fixture.v1.get("manifest.json")!)
          )
            observedManifest = true;
        }
        assert(observedManifest, "The privacy test must include the actual raw manifest object");
      },
    );
    await check(
      "same version changed manifest is a real catalog conflict without replacement",
      async () => {
        const changed = cloneFiles(fixture.v1);
        editPackageJson(changed, "manifest.json", (m) => {
          m.producer.name = "Conflicting independent source claim";
        });
        await assert.rejects(
          () => service.install(changed, context.authority),
          (error: unknown) => {
            assert.equal((error as { code?: unknown }).code, "VERSION_CONFLICT");
            return true;
          },
        );
        assert.equal((await catalog.list(fixture.courseId)).length, 1);
        assert.deepEqual(
          (await service.resolveInstallation(first.reference.installationId)).installation
            .reference,
          first.reference,
        );
      },
    );
    await check(
      "SQL reserve rejects invalid paths byte counts and totals without poison rows",
      async () => {
        const invalid: Array<{
          label: string;
          mutate(
            input: import("../src/domain/course-installations/contracts").InstallationReservation,
          ): void;
        }> = [
          {
            label: "reserved-windows-name-case-insensitive",
            mutate(input) {
              input.inventory[0].path = "CON.json";
            },
          },
          {
            label: "intermediate-directory-trailing-dot",
            mutate(input) {
              input.inventory[0].path = "dir./data.json";
            },
          },

          {
            label: "manifest-filename-must-be-case-exact",
            mutate(input) {
              input.inventory = input.inventory.map((file) =>
                file.path === "manifest.json" ? { ...file, path: "Manifest.json" } : file,
              );
            },
          },
          {
            label: "uppercase-manifest-only",
            mutate(input) {
              const manifest = input.inventory.find((file) => file.path === "manifest.json");
              assert(manifest);
              input.inventory = [{ ...manifest, path: "Manifest.json" }];
            },
          },

          {
            label: "bytes-missing",
            mutate(input) {
              delete (input.inventory[0] as unknown as Record<string, unknown>).bytes;
            },
          },
          {
            label: "bytes-null",
            mutate(input) {
              (input.inventory[0] as unknown as Record<string, unknown>).bytes = null;
            },
          },
          {
            label: "bytes-string",
            mutate(input) {
              (input.inventory[0] as unknown as Record<string, unknown>).bytes = "100";
            },
          },
          {
            label: "bytes-zero",
            mutate(input) {
              input.inventory[0].bytes = 0;
            },
          },
          {
            label: "bytes-negative",
            mutate(input) {
              input.inventory[0].bytes = -1;
            },
          },
          {
            label: "bytes-fractional",
            mutate(input) {
              input.inventory[0].bytes = 1.5;
            },
          },
          {
            label: "bytes-too-large",
            mutate(input) {
              input.inventory[0].bytes = 16 * 1024 * 1024 + 1;
            },
          },
          {
            label: "total-too-large",
            mutate(input) {
              input.inventory = [
                { path: "manifest.json", bytes: 1, sha256: first.inventory[0].sha256 },
                ...["a", "b", "c"].map((name) => ({
                  path: "resources/" + name + ".wav",
                  bytes: 12 * 1024 * 1024,
                  sha256: first.inventory[0].sha256,
                })),
              ];
            },
          },
        ];
        for (const item of invalid) {
          const courseId = "qa.invalid-reservation." + randomUUID();
          const validation = structuredClone(first.validation);
          assert(validation.identity);
          validation.identity.id = courseId;
          const input: import("../src/domain/course-installations/contracts").InstallationReservation =
            {
              identity: {
                courseId,
                contentVersion: first.reference.contentVersion,
                contractVersion: first.reference.contractVersion,
                envelopeVersion: first.reference.envelopeVersion,
                languageContractVersion: first.reference.languageContractVersion,
                artifactHash: first.reference.artifactHash,
              },
              inventory: structuredClone(first.inventory),
              provenance: structuredClone(first.provenance),
              capabilityRequirements: structuredClone(first.capabilityRequirements),
              validation,
            };
          item.mutate(input);
          assert.deepEqual(await catalog.list(courseId), []);
          const rejected = await context.db.rpc("i7_installation_reserve", {
            p_input: input,
            p_actor_id: "qa-boundary-operator",
          });
          assert(rejected.error, "SQL accepted malformed inventory: " + item.label);
          assert.deepEqual(
            await catalog.list(courseId),
            [],
            "A malformed reserve must not persist a poison installation",
          );
          assert.deepEqual(
            await catalog.transitions(courseId),
            [],
            "Rejected reserve must not emit a committed transition",
          );
        }
      },
    );

    await service.prepareForHomologation(first.reference.installationId, context.authority);
    await service.recordLocalApproval(first.reference.installationId, context.authority);
    await check(
      "SQL activation rejects missing/null/negative/type/fractional revision before pointer or audit writes",
      async () => {
        const grant = await context.authorizer.assert(
          context.authority,
          "activate",
          first.reference,
        );
        const beforeInstallation = await catalog.get(first.reference.installationId);
        const beforeActive = await catalog.getActive(fixture.courseId),
          beforeHistory = await catalog.transitions(fixture.courseId);
        for (const bad of [undefined, null, -1, "0", true, 0.5, [], {}]) {
          const input: Record<string, unknown> = { ...command(first, 0) };
          if (bad === undefined) delete input.expectedRevision;
          else input.expectedRevision = bad;
          const rejected = await context.db.rpc("i7_installation_activate", {
            p_command: input,
            p_action: "activate",
            p_reference: first.reference,
            p_actor_id: grant.actorId,
            p_local_token: grant.localToken,
          });
          assert(rejected.error, "Malformed SQL activation revision was accepted");
          assert.deepEqual(await catalog.get(first.reference.installationId), beforeInstallation);
          assert.deepEqual(await catalog.getActive(fixture.courseId), beforeActive);
          assert.deepEqual(await catalog.transitions(fixture.courseId), beforeHistory);
        }
      },
    );
    await check(
      "SQL confirm prepare and approve reject null artifact hash without state transitions",
      async () => {
        const grant = await context.authorizer.assert(
          context.authority,
          "approve",
          first.reference,
        );
        const beforeInstallation = await catalog.get(first.reference.installationId);
        const beforeActive = await catalog.getActive(fixture.courseId),
          beforeHistory = await catalog.transitions(fixture.courseId);
        for (const rpc of [
          "i7_installation_confirm",
          "i7_installation_prepare",
          "i7_installation_approve",
        ]) {
          const params: Record<string, unknown> = {
            p_installation_id: first.reference.installationId,
            p_artifact_hash: null,
            p_actor_id: grant.actorId,
          };
          if (rpc === "i7_installation_approve") params.p_local_token = grant.localToken;
          const rejected = await context.db.rpc(rpc, params);
          assert(rejected.error, "SQL accepted a null artifact hash");
          assert.deepEqual(await catalog.get(first.reference.installationId), beforeInstallation);
          assert.deepEqual(await catalog.getActive(fixture.courseId), beforeActive);
          assert.deepEqual(await catalog.transitions(fixture.courseId), beforeHistory);
        }
      },
    );

    const activation1Command = command(first, 0);
    const activated1 = await service.activate(activation1Command, context.authority);
    const session1 = await createSession(a);
    let evaluated1!: Awaited<ReturnType<typeof evaluate>>;
    await check(
      "V1 executes existing grade/evaluator APIs and records pinned evidence",
      async () => {
        assert.equal(session1.reference.installationId, first.reference.installationId);
        assert.equal((await grade(a, session1, fixture.answers[0])).correct, true);
        evaluated1 = await evaluate(a, session1, fixture.answers[0]);
        const evidence = await service.listEvidence(a.id, session1.id);
        assert(evidence.some((e) => e.kind === "activity"));
        assert(evidence.some((e) => e.kind === "assessment"));
        assert(
          evidence.every((e) => e.reference.installationId === first.reference.installationId),
        );
      },
    );
    await check(
      "SQL evidence rejects missing/null/invalid kind definition and reference without persisting malformed history",
      async () => {
        const beforeEvidence = await service.listEvidence(a.id, session1.id);
        const beforeInstallation = await catalog.get(first.reference.installationId);
        const beforeHistory = await catalog.transitions(fixture.courseId);
        const mutations: Array<
          (params: Record<string, unknown>, input: Record<string, unknown>) => void
        > = [
          (_params, input) => {
            void _params;
            delete input.kind;
          },
          (_params, input) => {
            void _params;
            input.kind = null;
          },
          (_params, input) => {
            void _params;
            input.kind = "unregistered-kind";
          },
          (_params, input) => {
            void _params;
            input.kind = 7;
          },
          (_params, input) => {
            void _params;
            delete input.definitionId;
          },
          (_params, input) => {
            void _params;
            input.definitionId = null;
          },
          (_params, input) => {
            void _params;
            input.definitionId = "";
          },
          (_params, input) => {
            void _params;
            input.definitionId = 7;
          },
          (_params, input) => {
            void _params;
            delete input.input;
          },
          (_params, input) => {
            void _params;
            delete input.result;
          },
          (params) => {
            params.p_reference = null;
          },
          (params) => {
            params.p_reference = {};
          },
          (params) => {
            const ref = { ...session1.reference } as Record<string, unknown>;
            delete ref.installationId;
            params.p_reference = ref;
          },
          (params) => {
            const ref = { ...session1.reference } as Record<string, unknown>;
            delete ref.artifactHash;
            params.p_reference = ref;
          },
          (params) => {
            const ref = { ...session1.reference } as Record<string, unknown>;
            ref.contentVersion = null;
            params.p_reference = ref;
          },
        ];
        for (const mutate of mutations) {
          const input: Record<string, unknown> = {
            id: randomUUID(),
            kind: "activity",
            definitionId: fixture.activityId,
            input: null,
            result: null,
          };
          const params: Record<string, unknown> = {
            p_user_id: a.id,
            p_session_id: session1.id,
            p_reference: session1.reference,
            p_evidence: input,
          };
          mutate(params, input);
          const rejected = await context.db.rpc("i7_evidence_append", params);
          assert(rejected.error, "SQL accepted malformed evidence metadata");
          assert.deepEqual(await service.listEvidence(a.id, session1.id), beforeEvidence);
          assert.deepEqual(await catalog.get(first.reference.installationId), beforeInstallation);
          assert.deepEqual(await catalog.transitions(fixture.courseId), beforeHistory);
        }
      },
    );

    await check(
      "real media route serves V1 bytes and rejects private documents/traversal/foreign session",
      async () => {
        const path =
          "/api/course-installations/media?sessionId=" +
          session1.id +
          "&path=" +
          encodeURIComponent(fixture.mediaPath);
        const media = await api(a, path);
        assert.equal(media.status, 200);
        assert.match(media.headers.get("content-type") ?? "", /^audio\/wav/);
        assert.match(media.headers.get("cache-control") ?? "", /no-store/);
        assert.deepEqual(
          new Uint8Array(await media.arrayBuffer()),
          fixture.v1.get(fixture.mediaPath),
        );
        assert.equal((await api(null, path)).status, 401);
        assert([403, 404].includes((await api(b, path)).status));
        for (const resource of [
          "manifest.json",
          "curriculum/unit-0.json",
          "../manifest.json",
          "https://example.com/media.wav",
        ]) {
          const rejected = await api(
            a,
            "/api/course-installations/media?sessionId=" +
              session1.id +
              "&path=" +
              encodeURIComponent(resource),
          );
          assert([400, 403, 404].includes(rejected.status));
          assertNoPrivate(await rejected.json());
        }
      },
    );
    await check(
      "V1 HTTP policy records mastery against its own threshold and assessment evidence",
      async () => {
        const policy = await policies(a, session1, evaluated1);
        assert.equal(policy.result.mastery.status, "satisfied");
        assert.equal(policy.result.mastery.requirements[0].minimumScore, 100);
      },
    );

    const evidenceBeforeV2 = await service.listEvidence(a.id, session1.id);
    const second = await ready(fixture.v2);
    const activated2 = await service.activate(
      command(second, activated1.selection.revision),
      context.authority,
    );
    const session2 = await createSession(a);
    let evaluated2!: Awaited<ReturnType<typeof evaluate>>;
    await check(
      "new V2 session policy cannot inherit V1 mastery despite shared definition IDs",
      async () => {
        const policy = await policies(a, session2);
        assert.equal(policy.result.mastery.status, "not_assessed");
        assert.equal(policy.result.mastery.requirements[0].minimumScore, 75);
      },
    );

    await check(
      "V2 coexists with V1; original sessions execute distinct definitions and media",
      async () => {
        assert.equal((await catalog.list(fixture.courseId)).length, 2);
        assert.equal(session2.reference.installationId, second.reference.installationId);
        assert.equal((await grade(a, session2, fixture.answers[0])).correct, false);
        assert.equal((await grade(a, session1, fixture.answers[0])).correct, true);
        assert.equal((await grade(a, session2, fixture.answers[1])).correct, true);
        evaluated2 = await evaluate(a, session2, fixture.answers[1]);
        const media = await api(
          a,
          "/api/course-installations/media?sessionId=" +
            session2.id +
            "&path=" +
            encodeURIComponent(fixture.mediaPath),
        );
        assert.equal(media.status, 200);
        assert.deepEqual(
          new Uint8Array(await media.arrayBuffer()),
          fixture.v2.get(fixture.mediaPath),
        );
        const original = await service.resolveSession(a.id, session1.id);
        assert.equal(original.content.prepared.bundle.course.contentVersion, "1.0.0");
        assert.deepEqual(
          (await service.listEvidence(a.id, session1.id)).slice(0, evidenceBeforeV2.length),
          evidenceBeforeV2,
        );
      },
    );
    await check("late retry of V1 activation cannot revert a later V2 decision", async () => {
      const retry = await service.activate(activation1Command, context.authority);
      assert.deepEqual(retry, activated1);
      assert.deepEqual(await catalog.getActive(fixture.courseId), activated2.selection);
    });
    const auditBeforeRollback = await catalog.transitions(fixture.courseId);
    const evidence1 = await service.listEvidence(a.id, session1.id),
      evidence2 = await service.listEvidence(a.id, session2.id);
    const rolledBack = await service.rollback(
      command(first, activated2.selection.revision),
      context.authority,
    );
    const session3 = await createSession(a);
    await check(
      "rollback selects V1 for new sessions and preserves V2 sessions/evidence/history",
      async () => {
        assert.equal(session3.reference.installationId, first.reference.installationId);
        assert.equal((await grade(a, session2, fixture.answers[1])).correct, true);
        assert.equal((await grade(a, session3, fixture.answers[0])).correct, true);
        assert.equal((await catalog.list(fixture.courseId)).length, 2);
        const audit = await catalog.transitions(fixture.courseId);
        assert.deepEqual(audit.slice(0, auditBeforeRollback.length), auditBeforeRollback);
        assert.equal(audit.at(-1)!.action, "rollback");
        assert.deepEqual(
          (await service.listEvidence(a.id, session1.id)).slice(0, evidence1.length),
          evidence1,
        );
        assert.deepEqual(
          (await service.listEvidence(a.id, session2.id)).slice(0, evidence2.length),
          evidence2,
        );
      },
    );
    await check(
      "V2 HTTP policy uses V2 assessment and V1 policy remains pinned after rollback",
      async () => {
        const v2Policy = await policies(a, session2, evaluated2);
        assert.equal(v2Policy.result.mastery.status, "satisfied");
        assert.equal(v2Policy.result.mastery.requirements[0].minimumScore, 75);
        const v1Policy = await policies(a, session1, evaluated1);
        assert.equal(v1Policy.result.mastery.requirements[0].minimumScore, 100);
      },
    );

    await check(
      "real assessment reload/retry interprets V1 and V2 using original pinned definitions",
      async () => {
        for (const [session, evaluation] of [
          [session1, evaluated1],
          [session2, evaluated2],
        ] as const) {
          const response = await api(
            a,
            "/api/assessments?courseId=" + fixture.courseId + "&versionSessionId=" + session.id,
          );
          assert.equal(response.status, 200);
          const body = await response.json();
          const result = body.results.find(
            (entry: { id: string }) => entry.id === evaluation.input.attemptId,
          );
          assert(result);
          assert.equal(result.objectiveScore, 100);
          assert.equal(result.contentVersion, session.reference.contentVersion);
          const repeated = await api(a, "/api/assessments", "POST", evaluation.input);
          assert.equal(repeated.status, 200);
          assert.deepEqual(await repeated.json(), evaluation.result);
        }
      },
    );
    await check(
      "cross-owner sessions cannot expose, grade, evaluate or write pinned evidence",
      async () => {
        const get = await api(b, "/api/course-installations/sessions?sessionId=" + session1.id);
        assert([403, 404].includes(get.status));
        assertNoPrivate(await get.json());
        const gradeResponse = await api(b, "/api/grade", "POST", {
          courseId: fixture.courseId,
          activityId: fixture.activityId,
          answer: fixture.answers[0],
          versionSessionId: session1.id,
          evidenceId: randomUUID(),
        });
        assert([403, 404].includes(gradeResponse.status));
        const assessmentResponse = await api(b, "/api/assessments", "POST", {
          ...evaluated1.input,
          attemptId: randomUUID(),
        });
        assert([403, 404].includes(assessmentResponse.status));
        await assert.rejects(() =>
          service.recordEvidence(b.id, session1.id, {
            id: randomUUID(),
            kind: "activity",
            definitionId: fixture.activityId,
            input: null,
            result: true,
          }),
        );
      },
    );
    await check(
      "existing AudioPlayer in a real local browser resolves each session media after rollback",
      async () => {
        // AppShell reads the compiled course's onboarding state before rendering these installed-course children.
        // Only this freshly created synthetic user's UI prerequisite is prepared; I7 evidence remains version-bound.
        const uiBundle = requireCourseBundle(defaultCourseId);
        const uiCourse = publicCourse(uiBundle.course, uiBundle.language);
        const uiRepository = new SupabaseStudyRepository(a.client, a.id);
        const uiState =
          (await uiRepository.load(uiCourse.id, uiCourse.languageCode)) ??
          readCourseState(null, uiCourse.id, uiCourse.languageCode);
        uiState.profile = {
          ...uiState.profile,
          onboarded: true,
          onboardingStep: 0,
          variantId: uiBundle.course.defaultVariant ?? uiBundle.language.speech.defaultVariant,
        };
        await uiRepository.save(uiState, uiCourse, uiBundle.resources.vocabulary);
        assert.equal(
          (await uiRepository.load(uiCourse.id, uiCourse.languageCode))?.profile.onboarded,
          true,
        );

        const { checkpointBrowser } = await importCandidate<
          typeof import("./checkpoint-browser.mjs")
        >("scripts/checkpoint-browser.mjs");
        const browser = await checkpointBrowser();
        browserState.current = browser;
        await browser.cookies([...a.cookies].map(([name, value]) => ({ name, value })));
        await browser.cookies([{ name: "destrava-active-course", value: defaultCourseId }]);
        for (const session of [session1, session2]) {
          await browser.navigate("/installed-courses/" + session.id);
          await browser.waitText(expectedCourseTitle);
          const metadata = (await browser.evaluate(`new Promise((resolve, reject) => {
          const audio = document.querySelector("audio");
          if (!audio) return reject(new Error("Existing AudioPlayer element missing"));
          const finish = () => resolve({ src: audio.currentSrc || audio.src, duration: audio.duration, readyState: audio.readyState });
          if (Number.isFinite(audio.duration) && audio.duration > 0) return finish();
          const timer = setTimeout(() => reject(new Error("Audio metadata timeout")), 20000);
          audio.addEventListener("loadedmetadata", () => { clearTimeout(timer); finish(); }, { once: true });
          audio.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Audio resource decoding failed")); }, { once: true });
          audio.load();
        })`)) as { src: string; duration: number; readyState: number };
          assert(Number.isFinite(metadata.duration) && metadata.duration > 0);
          const src = local.assertLocalUrl(metadata.src, [local.localApp]);
          assert.equal(src.searchParams.get("sessionId"), session.id);
          assert.equal(src.searchParams.get("path"), fixture.mediaPath);
          assertNoPrivate(await browser.evaluate("document.body.innerText"));
        }
        const browserProof = browser.proof();
        assert.equal(browserProof.blockedRequests, 0);
        assert.equal(browserProof.runtimeErrors, 0);
        console.log(
          JSON.stringify({
            realPlayer: true,
            browser: browserProof,
            sessionVersions: ["1.0.0", "2.0.0"],
          }),
        );
        await browser.close();
        browserState.current = null;
      },
    );
    await check(
      "SQL activation CAS has one winner; independent consumers resolve final committed selection",
      async () => {
        const parallel = new CourseInstallationService({
          catalog: new SupabaseCourseInstallationCatalog(peerDb),
          store: new SupabaseCourseArtifactStore(peerDb),
          authorizer: context.authorizer,
          environment: playbackEnvironment,
        });
        const outcomes = await Promise.allSettled([
          service.activate(command(first, rolledBack.selection.revision), context.authority),
          parallel.activate(command(second, rolledBack.selection.revision), context.authority),
        ]);
        assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
        const loser = outcomes.find((o) => o.status === "rejected");
        assert(loser?.status === "rejected");
        assert.equal(loser.reason.code, "REVISION_CONFLICT");
        const selection = await catalog.getActive(fixture.courseId);
        assert.equal(selection.revision, rolledBack.selection.revision + 1);
        assert.equal(
          (await parallel.resolveActive(fixture.courseId)).installation.reference.installationId,
          selection.installationId,
        );
        await assert.rejects(() =>
          service.rollback(command(first, rolledBack.selection.revision), context.authority),
        );
        assert.deepEqual(await catalog.getActive(fixture.courseId), selection);
      },
    );
    await check(
      "real activation rollback race and sessions observe committed revisions and remain pinned after another change",
      async () => {
        const before = await catalog.getActive(fixture.courseId);
        assert(before.installationId);
        assert(
          [first.reference.installationId, second.reference.installationId].includes(
            before.installationId,
          ),
        );
        const beforeReference =
          before.installationId === first.reference.installationId
            ? first.reference
            : second.reference;
        const changing = Promise.allSettled([
          service.activate(command(second, before.revision), context.authority),
          peerService.rollback(command(first, before.revision), context.authority),
        ]);
        const opening = Promise.all([
          service.createSession(a.id, fixture.courseId, randomUUID()),
          peerService.createSession(a.id, fixture.courseId, randomUUID()),
        ]);
        void opening.catch(() => undefined); // The original promise is awaited below and failures remain test failures.
        const [changes, opened] = await Promise.all([changing, opening]);
        const winner = changes.find((entry) => entry.status === "fulfilled"),
          loser = changes.find((entry) => entry.status === "rejected");
        assert(winner?.status === "fulfilled");
        assert(loser?.status === "rejected");
        assert.equal(loser.reason.code, "REVISION_CONFLICT");
        assert.deepEqual(await catalog.getActive(fixture.courseId), winner.value.selection);
        const references = new Map([
          [before.revision, beforeReference],
          [winner.value.selection.revision, winner.value.reference],
        ]);
        for (const session of opened) {
          const reference = references.get(session.activeRevision);
          assert(reference, "A session observed a revision that was never committed");
          assert.deepEqual(session.reference, reference);
          assert.deepEqual((await peerService.resolveSession(a.id, session.id)).session, session);
        }
        const fresh = await peerService.createSession(a.id, fixture.courseId, randomUUID());
        assert.deepEqual(fresh.reference, winner.value.reference);
        assert.equal(fresh.activeRevision, winner.value.selection.revision);
        const other =
          winner.value.reference.installationId === first.reference.installationId ? second : first;
        await service.activate(command(other, winner.value.selection.revision), context.authority);
        for (const session of [...opened, fresh]) {
          const restored = await service.resolveSession(a.id, session.id);
          assert.deepEqual(restored.session, session);
          assert.deepEqual(restored.content.installation.reference, session.reference);
        }
      },
    );

    await check(
      "privileged Storage overwrite and delete preserve installed resource bytes or fail integrity closed",
      async () => {
        const observations: Array<{
          operation: string;
          sdkRejected: boolean;
          rawBytesPreserved: boolean;
          canonicalResolution: string;
        }> = [];
        for (const operation of ["overwrite", "delete"] as const) {
          const files = cloneFiles(fixture.v1),
            courseId = "qa.storage-immutability." + randomUUID();
          editPackageJson(files, "documents/course.json", (course) => {
            course.id = courseId;
            course.slug = courseId.replaceAll(".", "-");
          });
          editPackageJson(files, "manifest.json", (manifest) => {
            manifest.id = courseId;
          });
          retainedAuxiliaryCourseIds.add(courseId);
          const uploadStart = uploads.length;
          const installed = await service.install(files, context.authority);
          retainedAuxiliaryInstallationIds.add(installed.reference.installationId);
          const expected = files.get(fixture.mediaPath)!;
          let resource: { bucket: string; path: string } | undefined;
          for (const upload of uploads.slice(uploadStart)) {
            const raw = await context.db.storage.from(upload.bucket).download(upload.path);
            assert.equal(raw.error, null);
            assert(raw.data);
            if (digest(new Uint8Array(await raw.data.arrayBuffer())) === digest(expected))
              resource = upload;
          }
          assert(resource, "Dedicated synthetic installed media object was not observed");
          const changed = expected.slice();
          changed[55] ^= 1;
          const attempted =
            operation === "overwrite"
              ? await context.db.storage
                  .from(resource.bucket)
                  .upload(
                    resource.path,
                    new Blob([new Uint8Array(changed)], { type: "audio/wav" }),
                    { upsert: true, contentType: "audio/wav" },
                  )
              : await context.db.storage.from(resource.bucket).remove([resource.path]);
          const reread = await context.db.storage.from(resource.bucket).download(resource.path);
          const rawBytesPreserved =
            !reread.error &&
            reread.data !== null &&
            digest(new Uint8Array(await reread.data.arrayBuffer())) === digest(expected);
          let canonicalResolution = "not-checked";
          try {
            const resolved = await service.resolveInstallation(installed.reference.installationId);
            const bytes = resolved.prepared.assets.get(fixture.mediaPath);
            canonicalResolution =
              bytes && digest(bytes) === digest(expected)
                ? "original-bytes"
                : "unsafe-changed-bytes";
          } catch (caught) {
            canonicalResolution =
              (caught as { code?: unknown }).code === "ARTIFACT_INTEGRITY"
                ? "integrity-blocked"
                : "unexpected-error";
          }
          observations.push({
            operation,
            sdkRejected: attempted.error !== null,
            rawBytesPreserved,
            canonicalResolution,
          });
        }
        console.log(JSON.stringify({ storageImmutability: observations }));
        for (const observation of observations) {
          assert(
            observation.sdkRejected,
            "Installed object mutation succeeded: " + observation.operation,
          );
          assert(
            observation.rawBytesPreserved,
            "Metadata rejection did not preserve real S3 bytes: " + observation.operation,
          );
          assert.equal(
            observation.canonicalResolution,
            "original-bytes",
            "Canonical resolver lost the intact installed artifact",
          );
        }
      },
    );

    console.log(
      JSON.stringify({
        independentLocalQA: "I7",
        isolation: proof,
        scenarios: records,
        passed: records.length,
        candidate: candidateHashes([
          "src/domain/course-installations/contracts.ts",
          "src/domain/course-installations/service.ts",
          "src/repositories/supabase-course-installations.ts",
          "scripts/course-installation-local-authority.ts",
          "src/app/api/course-installations/sessions/route.ts",
          "src/app/api/course-installations/media/route.ts",
          "src/app/api/grade/route.ts",
          "src/app/api/assessments/route.ts",
          "src/app/api/course-installations/policies/route.ts",
          "supabase/migrations/20261010000300_course_installations.sql",
        ]),
        retainedCourseId: fixture.courseId,
        retainedSyntheticUsers: [...retainedUsers],
        retainedAuxiliaryCourseIds: [...retainedAuxiliaryCourseIds],
        retainedAuxiliaryInstallationIds: [...retainedAuxiliaryInstallationIds],
        retainedInstallations: [first.reference.installationId, second.reference.installationId],
        paidCalls: 0,
        remoteOperations: 0,
        realPublicationOperations: 0,
      }),
    );
  } finally {
    try {
      if (browserState.current) await browserState.current.close();
      for (const id of users.filter((id) => !retainedUsers.has(id))) {
        const removed = await context.db.auth.admin.deleteUser(id);
        if (removed.error) throw new Error("Synthetic local QA account cleanup failed");
      }
    } finally {
      console.log(
        JSON.stringify({
          retainedSyntheticUsers: [...retainedUsers],
          retainedAuxiliaryCourseIds: [...retainedAuxiliaryCourseIds],
          retainedAuxiliaryInstallationIds: [...retainedAuxiliaryInstallationIds],
          retainedCourseId: fixture.courseId,
          reason: "Immutable version sessions and evidence remain available for inspection",
        }),
      );
      fixture.cleanup();
      globalThis.fetch = originalFetch;
    }
  }
}
void main().catch((caught: unknown) => {
  // Do not print adapter response bodies, tokens, nonce, or environment contents.
  console.error(
    caught instanceof Error ? caught.message : "Independent local I7 integration failed",
  );
  process.exitCode = 1;
});
