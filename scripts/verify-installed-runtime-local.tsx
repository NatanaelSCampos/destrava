import assert from "node:assert/strict";
import { runCiclo2Journey } from "./ciclo2-local-journey";
import { randomUUID } from "node:crypto";
import { renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Installation,
  InstalledContentReference,
  VersionEvidence,
} from "../src/domain/course-installations/contracts";
import type {
  InstalledProgressEnvelope,
  InstalledStudyCatalog,
} from "../src/domain/installed-study/contracts";
import {
  candidateHashes,
  candidateRoot,
  independentLearningFixtures,
  importCandidate,
  jsonFile,
} from "./installed-runtime-test-fixtures";

/** Lead only: protected local wrapper, primary checkout, sequential DB/browser ownership. */
async function main() {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.equal(
    resolve(process.cwd()).toLowerCase(),
    candidateRoot().toLowerCase(),
    "Local integration must run in the primary candidate checkout",
  );
  const local = await importCandidate<typeof import("./local-environment.mjs")>(
    "scripts/local-environment.mjs",
  );
  const env = local.localEnvironment(),
    isolation = local.assertLocalDocker();
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, local.localApi);
  assert.equal(env.APP_ORIGIN, local.localApp);
  const originalFetch = globalThis.fetch;
  let externalAttempts = 0;
  globalThis.fetch = (input, init) => {
    try {
      local.assertLocalUrl(typeof input === "string" || input instanceof URL ? input : input.url, [
        local.localApi,
        local.localApp,
        "http://127.0.0.1:9337",
      ]);
    } catch {
      externalAttempts++;
      throw Error("External destination forbidden in I8 local integration");
    }
    return originalFetch(input, { ...init, redirect: "manual" });
  };
  const { createLocalCourseInstallationContext } = await importCandidate<
    typeof import("./course-installation-local-authority")
  >("scripts/course-installation-local-authority.ts");
  const { CourseInstallationService } = await importCandidate<
    typeof import("../src/domain/course-installations/service")
  >("src/domain/course-installations/service.ts");
  const { SupabaseCourseInstallationCatalog, SupabaseCourseArtifactStore } = await importCandidate<
    typeof import("../src/repositories/supabase-course-installations")
  >("src/repositories/supabase-course-installations.ts");
  const { installedCapabilityEnvironment } = await importCandidate<{
    installedCapabilityEnvironment(): unknown;
  }>("src/domain/installed-study/compatibility.ts");
  const context = await createLocalCourseInstallationContext();
  const catalog = new SupabaseCourseInstallationCatalog(context.db);
  const service = new CourseInstallationService({
    catalog,
    store: new SupabaseCourseArtifactStore(context.db),
    authorizer: context.authorizer,
    environment: installedCapabilityEnvironment() as NonNullable<
      ConstructorParameters<typeof CourseInstallationService>[0]["environment"]
    >,
  });
  const fixture = independentLearningFixtures({ retainFiles: process.env.C2_LOCAL_JOURNEY === "1" || process.env.C2_RETAIN_FILES === "1" });
  const mandatory = fixture.produce(
    "mandatory-ai",
    "1.0.0",
    ["--mandatory=ai.writing_feedback"],
    "qa.i8.mandatory." + randomUUID(),
  );
  // Auxiliary identity remains external data; preserve immutable course version conflicts.
  const mandatoryCourseId = jsonFile(mandatory.files, "manifest.json").id;
  const records: Array<{ scenario: string; result: "passed" }> = [],
    retainedUsers: string[] = [];
  const candidatePaths = [
    "src/domain/installed-study/contracts.ts",
    "src/domain/installed-study/service.ts",
    "src/domain/installed-study/compatibility.ts",
    "src/app/api/course/active/route.ts",
    "src/app/api/course-installations/progress/route.ts",
    "src/app/api/grade/route.ts",
    "src/app/api/assessments/route.ts",
    "scripts/produce-independent-learning-course.mjs",
    "scripts/verify-installed-runtime-local.tsx",
  ];
  const before = candidateHashes(candidatePaths);
  type Browser = Awaited<
    ReturnType<(typeof import("./checkpoint-browser.mjs"))["checkpointBrowser"]>
  >;
  let browser: Browser | null = null;
  type Student = { id: string; client: SupabaseClient; cookies: Map<string, string> };
  let runningScenario = "setup";
  const check = async (scenario: string, run: () => Promise<void>) => {
    runningScenario = scenario;
    await run();
    records.push({ scenario, result: "passed" });
    console.log("OK " + scenario);
  };
  const student = async (): Promise<Student> => {
    const email = "i8-qa-" + randomUUID() + "@example.test",
      password = "I8-QA-" + randomUUID() + "!";
    const created = await context.db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert(!created.error && created.data.user, "Local synthetic account creation failed");
    retainedUsers.push(created.data.user.id);
    const cookies = new Map<string, string>();
    const client = createServerClient(local.localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (entries) => {
          entries.forEach(({ name, value }) => cookies.set(name, value));
        },
      },
      global: { fetch: local.localFetch },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    assert(!login.error, "Local synthetic account login failed");
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
  const active = async (owner: Student) => {
    const response = await api(owner, "/api/course/active");
    assert.equal(response.status, 200);
    assert(/no-store/.test(response.headers.get("cache-control") ?? ""));
    const body = await response.json();
    fixture.assertNoPrivate(body);
    return body;
  };
  const progress = async (
    owner: Student,
    sessionId: string,
  ): Promise<InstalledProgressEnvelope> => {
    const response = await api(
      owner,
      "/api/course-installations/progress?versionSessionId=" + sessionId,
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const waitForProgress = async (
    owner: Student,
    sessionId: string,
    matches: (value: InstalledProgressEnvelope) => boolean,
    description: string,
  ): Promise<InstalledProgressEnvelope> => {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const loaded = await progress(owner, sessionId);
      if (matches(loaded)) return loaded;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error("Remote progress did not reach expected state: " + description);
  };
  const prepared = async (files: ReadonlyMap<string, Uint8Array>) => {
    const row = await service.install(files, context.authority);
    await service.prepareForHomologation(row.reference.installationId, context.authority);
    return service.recordLocalApproval(row.reference.installationId, context.authority);
  };
  const command = (row: Installation, expectedRevision: number) => ({
    courseId: row.reference.courseId,
    installationId: row.reference.installationId,
    expectedRevision,
    operationId: randomUUID(),
  });
  const waitUi = async (
    expression: string,
    description: string,
    beforeCheck?: () => Promise<void>,
  ) => {
    assert(browser);
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      try {
        await beforeCheck?.();
        if (await browser.evaluate(expression)) return;
      } catch {
        /* A normal full reload replaces the execution context; retry its rendered state. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Normal UI did not reach rendered state: " + description);
  };
  const dismissOverlays = async () => {
    assert(browser);
    await browser.evaluate("document.querySelector('.page-tour-close')?.click();document.querySelector('button[aria-label=\"Fechar novidades\"]')?.click()");
    for (let attempt = 0; attempt < 6; attempt++) {
      const label = (await browser.evaluate(
        "(() => { const candidates = [...document.querySelectorAll('button[aria-label]')].filter(node => ['Pular guia','Fechar novidades'].includes(node.getAttribute('aria-label')) && !node.disabled); const node = candidates.find(node => { const rect = node.getBoundingClientRect(); const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return rect.width > 0 && rect.height > 0 && (hit === node || node.contains(hit)); }); if (!node) return null; return node.getAttribute('aria-label'); })()",
      )) as string | null;
      if (!label) return;
      // Both public dialogs support Escape on document; guide autofocus cannot redirect it.
      const visibleDialogControl = `Boolean(document.querySelector('button[aria-label="' + ${JSON.stringify(label)} + '"]'))`;
      await waitUi(
        `!(${visibleDialogControl})`,
        "overlay dismissed by native Escape " + label,
        async () => {
          if (await browser!.evaluate(visibleDialogControl))
            await browser!.key("Escape", "Escape", {
              windowsVirtualKeyCode: 27,
              nativeVirtualKeyCode: 27,
            });
        },
      );
    }
    throw new Error("Normal overlay dismissal did not finish");
  };
  const clickText = async (text: string, selector = "button,a") => {
    await dismissOverlays();
    await waitUi(
      `(() => { const node = [...document.querySelectorAll(${JSON.stringify(selector)})].find(x => (x.textContent.trim() === ${JSON.stringify(text)} || (${JSON.stringify(selector)} !== "button,a" && x.textContent.includes(${JSON.stringify(text)}))) && !x.disabled && x.getAttribute('aria-disabled') !== 'true'); if (!node) return false; node.scrollIntoView({block:'center'}); const rect = node.getBoundingClientRect(); const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); if (!rect.width || !rect.height || !(hit === node || node.contains(hit))) return false; node.focus(); return true; })()`,
      "visible enabled action " + text,
      dismissOverlays,
    );
    await browser!.key("Enter", "Enter", { windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  };
  const onboardingHeading = async () =>
    (await browser!.evaluate(
      "document.querySelector('.pedagogical-onboarding h1')?.textContent ?? null",
    )) as string | null;
  const advanceOnboarding = async (label: string) => {
    const previous = await onboardingHeading();
    assert(previous, "Normal onboarding heading missing before advancement");
    await clickText(label);
    await waitUi(
      `(() => { const heading = document.querySelector('.pedagogical-onboarding h1')?.textContent; return Boolean(heading && heading !== ${JSON.stringify(previous)}); })()`,
      "next onboarding heading",
    );
  };
  const clickHref = async (path: string) => {
    assert(browser);
    await dismissOverlays();
    await waitUi(
      `(() => { const node = [...document.querySelectorAll('a[href]')].find(x => new URL(x.href).pathname + new URL(x.href).search === ${JSON.stringify(path)} && x.getClientRects().length); if (!node) return false; node.scrollIntoView({block:'center'}); const rect = node.getBoundingClientRect(); const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); if (!(hit === node || node.contains(hit))) return false; node.focus(); return true; })()`,
      "visible curriculum link " + path,
      dismissOverlays,
    );
    await browser.key("Enter", "Enter", { windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await waitUi(
      `location.pathname + location.search === ${JSON.stringify(path)} && document.readyState !== 'loading' && !document.querySelector('.main-content .page-loading')`,
      "curriculum route committed " + path,
    );
    await dismissOverlays();
  };
  const settle = async () => {
    assert(browser);
    await browser.evaluate("new Promise(resolve => setTimeout(resolve, 700))");
  };
  const runtime = async (expected: InstalledContentReference) => {
    assert(browser);
    await browser.waitText("Versão " + expected.contentVersion);
    const metadata = (await browser.evaluate(
      `(() => { const node = document.querySelector('[data-runtime-source]'); return node ? { source: node.getAttribute('data-runtime-source'), version: node.getAttribute('data-content-version'), sessionId: node.getAttribute('data-version-session'), installationId: node.getAttribute('data-installation-id') } : null; })()`,
    )) as { source: string; version: string; sessionId: string; installationId: string } | null;
    assert(metadata);
    assert.equal(metadata.source, "installed");
    assert.equal(metadata.version, expected.contentVersion);
    assert.equal(metadata.installationId, expected.installationId);
    assert(/^[0-9a-f-]{36}$/i.test(metadata.sessionId));
    return metadata.sessionId;
  };
  const monitor = async () => {
    assert(browser);
    await browser.evaluate(
      `(() => { window.__i8Responses = []; if (window.__i8Fetch) return; window.__i8Fetch = window.fetch; window.fetch = async (...args) => { const response = await window.__i8Fetch(...args); const raw = typeof args[0] === 'string' ? args[0] : args[0].url; const path = new URL(raw, location.origin).pathname; if (['/api/grade','/api/assessments','/api/course-installations/progress'].includes(path)) { let value = null; try { value = await response.clone().json(); } catch {} window.__i8Responses.push({ path, status: response.status, value }); } return response; }; })()`,
    );
  };
  const responseFromClick = async (path: string) => {
    assert(browser);
    const result = (await browser.evaluate(
      `new Promise((resolve, reject) => { const start = Date.now(); const poll = () => { const item = (window.__i8Responses || []).find(x => x.path === ${JSON.stringify(path)}); if (item) return resolve(item); if (Date.now() - start > 20000) return reject(new Error('Normal UI did not call its API')); setTimeout(poll, 100); }; poll(); })`,
    )) as { status: number; value: Record<string, unknown> };
    assert.equal(result.status, 200, "Normal UI API rejected its own action");
    return result.value;
  };
  const ordering = async (indices: number[]) => {
    assert(browser);
    await dismissOverlays();
    for (const index of indices) {
      const selectedBefore = (await browser.evaluate(
        "document.querySelectorAll('.ordering-answer [data-token-id]').length",
      )) as number;
      await waitUi(
        `(() => { const candidates = [...document.querySelectorAll('[data-token-id]')].filter(x => !x.closest('.ordering-answer') && !x.disabled); const token = candidates.find(x => x.textContent.trim() === ${JSON.stringify(["I8 alpha", "I8 beta", "I8 gamma"][index])}); if (!token) return false; token.scrollIntoView({block:"center"}); const rect = token.getBoundingClientRect(); const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); if (!rect.width || !rect.height || !(hit === token || token.contains(hit))) return false; token.focus(); return true; })()`,
        "visible ordering token control " + index,
        dismissOverlays,
      );
      await browser.key("Enter", "Enter", { windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await waitUi(
        `document.querySelectorAll('.ordering-answer [data-token-id]').length === ${selectedBefore + 1}`,
        "ordering token selected through normal control",
      );
    }
    await monitor();
    await clickText("Verificar resposta");
    return responseFromClick("/api/grade");
  };
    const { checkpointBrowser } = await importCandidate<typeof import("./checkpoint-browser.mjs")>(
      "scripts/checkpoint-browser.mjs",
    );
  try {
    if (process.env.C2_ONLY === "1") {
      browser = await checkpointBrowser();
      await browser.viewport(1280,900);
      await runCiclo2Journey({ browser, fixture, service, authority: context.authority, student, prepared, active, progress, api, waitUi, clickText, dismissOverlays, check });
      const proof=browser.proof();assert.equal(proof.blockedRequests,0);assert.equal(proof.runtimeErrors,0);assert.equal(externalAttempts,0);
      console.log(JSON.stringify({scenarios:records,browser:proof,isolation,paidCalls:0,remoteOperations:0}));
      return;
    }
    const a = await student(),
      b = await student();
    let first!: Installation, second!: Installation;
    await check(
      "local-only guard/auth and unapproved installs absent from normal selector",
      async () => {
        assert(isolation.localDaemon);
        assert.throws(() => local.assertLocalUrl("https://example.supabase.co"));
        first = await service.install(fixture.v1, context.authority);
        const list = await active(a);
        assert(!JSON.stringify(list.courses).includes(fixture.courseId));
        const anonymous = await api(
          null,
          "/api/course-installations/progress?versionSessionId=" + randomUUID(),
        );
        assert.equal(anonymous.status, 401);
        const rejected = await api(a, "/api/course/active", "POST", {
          source: "installed",
          courseId: fixture.courseId,
          expectedRevision: list.selection.revision,
          operationId: randomUUID(),
        });
        assert(rejected.status >= 400);
        assert.equal((await catalog.getActive(fixture.courseId)).installationId, null);
        first = await prepared(fixture.v1);
        await service.activate(command(first, 0), context.authority);
        assert(JSON.stringify((await active(a)).courses).includes(fixture.courseId));
      },
    );
    await check(
      "mandatory implemented AI cannot activate even global operational dependency is available",
      async () => {
        const globalService = new CourseInstallationService({
          catalog,
          store: new SupabaseCourseArtifactStore(context.db),
          authorizer: context.authorizer,
          environment: { dependencies: { "ai.text_service": { state: "available" } } },
        });
        const installed = await globalService.install(mandatory.files, context.authority);
        await assert.rejects(async () => {
          await globalService.prepareForHomologation(
            installed.reference.installationId,
            context.authority,
          );
          await globalService.recordLocalApproval(
            installed.reference.installationId,
            context.authority,
          );
          await globalService.activate(command(installed, 0), context.authority);
        });
        assert.equal((await catalog.getActive(mandatoryCourseId)).installationId, null);
        assert(!JSON.stringify((await active(a)).courses).includes(mandatoryCourseId));
        assert.equal(externalAttempts, 0);
      },
    );
    await check(
      "I8 SQL selection CAS has one winner and old operation retry never reverts later selection",
      async () => {
        const current = await active(b);
        const compiled = current.courses.find(
          (option: { id: string; source?: string }) =>
            option.id !== fixture.courseId && option.source !== "installed",
        );
        assert(compiled, "Synthetic selection CAS needs a normal bootstrap compiled option");
        const attempts = [0, 1].map(() => ({
          courseId: fixture.courseId,
          source: "installed",
          expectedRevision: current.selection.revision,
          operationId: randomUUID(),
        }));
        const responses = await Promise.all(
          attempts.map((body) => api(b, "/api/course/active", "POST", body)),
        );
        assert.deepEqual(
          responses.map((item) => item.status).sort((left, right) => left - right),
          [200, 409],
        );
        const winner = responses.findIndex((item) => item.status === 200),
          original = await responses[winner].json();
        assert.equal(original.selection.revision, current.selection.revision + 1);
        assert.equal(original.selection.selection.source, "installed");
        const switched = await api(b, "/api/course/active", "POST", {
          courseId: compiled.id,
          source: "compiled",
          expectedRevision: original.selection.revision,
          operationId: randomUUID(),
        });
        assert.equal(switched.status, 200);
        const later = await switched.json();
        assert.equal(later.selection.selection.source, "compiled");
        const retried = await api(b, "/api/course/active", "POST", attempts[winner]);
        assert.equal(retried.status, 200);
        const receipt = await retried.json();
        assert.deepEqual(
          receipt.selection,
          original.selection,
          "Selection retry changed the original SQL receipt",
        );
        assert.deepEqual(
          (await active(b)).selection,
          later.selection,
          "Old receipt reversed the user's newer selection",
        );
        assert.equal(
          (await catalog.getActive(fixture.courseId)).installationId,
          first.reference.installationId,
        );
      },
    );
    const c = await student();
    let auxiliarySession = "",
      auxiliaryProgress!: InstalledProgressEnvelope;
    await check(
      "I8 SQL progress CAS and original receipt survive newer data and trusted evidence",
      async () => {
        const selected = await api(c, "/api/course/active", "POST", {
          courseId: fixture.courseId,
          source: "installed",
          expectedRevision: 0,
          operationId: randomUUID(),
        });
        assert.equal(selected.status, 200);
        const body = await selected.json();
        assert.equal(body.selection.selection.source, "installed");
        auxiliarySession = body.selection.selection.versionSessionId;
        const current = await progress(c, auxiliarySession);
        const { readCourseState } = await importCandidate<
          typeof import("../src/domain/study/course-state-storage")
        >("src/domain/study/course-state-storage.ts");
        const initial =
          current.state ??
          readCourseState(
            null,
            fixture.courseId,
            jsonFile(fixture.v1, "documents/language.json").id,
          );
        const drafts = [
          "Concurrent installed snapshot left",
          "Concurrent installed snapshot right",
        ].map((goal) => ({
          versionSessionId: auxiliarySession,
          expectedRevision: current.revision,
          operationId: randomUUID(),
          state: { ...initial, profile: { ...initial.profile, goal } },
        }));
        const responses = await Promise.all(
          drafts.map((command) => api(c, "/api/course-installations/progress", "POST", command)),
        );
        assert.deepEqual(
          responses.map((item) => item.status).sort((left, right) => left - right),
          [200, 409],
        );
        const winner = responses.findIndex((item) => item.status === 200),
          original = (await responses[winner].json()) as InstalledProgressEnvelope;
        assert.equal(original.revision, current.revision + 1);
        assert.deepEqual(original.reference, first.reference);
        assert.equal(original.state?.profile.goal, drafts[winner].state.profile.goal);
        assert(original.state);
        const { SupabaseInstalledStudyCatalog } = await importCandidate<{
          SupabaseInstalledStudyCatalog: new (db: SupabaseClient) => InstalledStudyCatalog;
        }>("src/repositories/supabase-installed-study.ts");
        const progressCatalog = new SupabaseInstalledStudyCatalog(context.db);
        const versionSession = (await service.resolveSession(c.id, auxiliarySession)).session;
        assert.deepEqual(versionSession.reference, first.reference);
        const rawOriginalReceipt = await progressCatalog.writeProgress(
          c.id,
          versionSession,
          drafts[winner],
          original.state,
        );
        const evidenceId = randomUUID();
        const graded = await api(c, "/api/grade", "POST", {
          courseId: fixture.courseId,
          activityId: fixture.activityId,
          answer: fixture.answers[0],
          versionSessionId: auxiliarySession,
          evidenceId,
        });
        assert.equal(graded.status, 200);
        const grade = await graded.json();
        assert.equal(grade.correct, true);
        assert.equal(grade.metadata.evidenceId, evidenceId);
        assert.deepEqual(grade.metadata.reference, first.reference);
        assert.equal(grade.metadata.versionSessionId, auxiliarySession);
        const withEvidence = await progress(c, auxiliarySession);
        assert(withEvidence.state);
        assert(
          withEvidence.state.attempts.some(
            (attempt) => attempt.id === evidenceId && attempt.correct === true,
          ),
        );
        const latestCommand = {
          versionSessionId: auxiliarySession,
          expectedRevision: original.revision,
          operationId: randomUUID(),
          state: {
            ...withEvidence.state,
            profile: { ...withEvidence.state.profile, goal: "New snapshot after trusted grade" },
          },
        };
        const advanced = await api(c, "/api/course-installations/progress", "POST", latestCommand);
        assert.equal(advanced.status, 200);
        auxiliaryProgress = await advanced.json();
        assert.equal(auxiliaryProgress.revision, original.revision + 1);
        const retried = await api(c, "/api/course-installations/progress", "POST", drafts[winner]);
        assert.equal(retried.status, 200);
        const projectedReceipt = (await retried.json()) as InstalledProgressEnvelope;
        const rawRetriedReceipt = await progressCatalog.writeProgress(
          c.id,
          versionSession,
          drafts[winner],
          auxiliaryProgress.state!,
        );
        assert.deepEqual(
          rawRetriedReceipt,
          rawOriginalReceipt,
          "Stored SQL receipt changed after newer draft and trusted evidence",
        );
        for (const field of [
          "schemaVersion",
          "versionSessionId",
          "reference",
          "revision",
          "updatedAt",
        ] as const)
          assert.deepEqual(
            projectedReceipt[field],
            original[field],
            "API retry changed original receipt metadata: " + field,
          );
        assert(projectedReceipt.state);
        for (const field of ["profile", "writing", "sessions", "activeSessionId"] as const)
          assert.deepEqual(
            projectedReceipt.state[field],
            original.state![field],
            "API retry changed original user-authored fields: " + field,
          );
        const trustedEvidence = await service.listEvidence(c.id, auxiliarySession);
        assert.equal(
          trustedEvidence.length,
          1,
          "Auxiliary receipt fixture must have exactly its one trusted grade",
        );
        assert.equal(trustedEvidence[0].id, evidenceId);
        assert.equal(trustedEvidence[0].kind, "activity");
        assert.equal(trustedEvidence[0].definitionId, fixture.activityId);
        assert.equal(trustedEvidence[0].userId, c.id);
        assert.deepEqual(trustedEvidence[0].reference, first.reference);
        assert.equal(projectedReceipt.state.attempts.length, 1);
        const addedAttempt = projectedReceipt.state.attempts[0];
        assert.equal(addedAttempt.id, evidenceId);
        assert.equal(addedAttempt.activityId, fixture.activityId);
        assert.equal(addedAttempt.answer, fixture.answers[0]);
        assert.equal(addedAttempt.correct, grade.correct);
        assert.equal(Date.parse(addedAttempt.createdAt), Date.parse(trustedEvidence[0].createdAt));
        assert.equal(projectedReceipt.state.events.length, 2);
        assert.deepEqual(projectedReceipt.state.events.map((event) => event.type).sort(), [
          "exercise_answered",
          "exercise_correct",
        ]);
        assert(
          projectedReceipt.state.events.every(
            (event) =>
              event.activityId === fixture.activityId &&
              Date.parse(event.createdAt) === Date.parse(trustedEvidence[0].createdAt),
          ),
        );
        const latest = await progress(c, auxiliarySession);
        assert.equal(latest.revision, auxiliaryProgress.revision);
        assert.equal(latest.state?.profile.goal, "New snapshot after trusted grade");
        assert(
          latest.state?.attempts.some(
            (attempt) => attempt.id === evidenceId && attempt.correct === true,
          ),
        );
        assert.deepEqual(
          (await active(a)).selection.selection,
          null,
          "Auxiliary CAS altered browser user A selection",
        );
      },
    );
    await check(
      "I8 public RPCs are known to service role and denied to authenticated/anonymous roles",
      async () => {
        const anonymous = createClient(local.localApi, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { fetch: local.localFetch },
        });
        const ownedSelection = (await active(c)).selection;
        assert(auxiliaryProgress.state);
        const write = {
          versionSessionId: auxiliarySession,
          expectedRevision: auxiliaryProgress.revision,
          operationId: randomUUID(),
          state: auxiliaryProgress.state,
        };
        const compiled = (await active(c)).courses.find(
          (option: { id: string; source?: string }) =>
            option.id !== fixture.courseId && option.source !== "installed",
        );
        assert(compiled);
        const calls: Array<{ name: string; args: Record<string, unknown> }> = [
          { name: "i8_selection_get", args: { p_user_id: c.id } },
          { name: "i8_selection_receipt", args: { p_user_id: c.id, p_operation_id: randomUUID() } },
          { name: "i8_active_list", args: {} },
          {
            name: "i8_selection_select",
            args: {
              p_user_id: c.id,
              p_command: {
                source: "compiled",
                courseId: compiled.id,
                expectedRevision: ownedSelection.revision,
                operationId: randomUUID(),
              },
              p_active_selection: null,
              p_reference: null,
            },
          },
          { name: "i8_progress_read", args: { p_user_id: c.id, p_reference: first.reference } },
          {
            name: "i8_progress_write",
            args: {
              p_user_id: c.id,
              p_session_id: auxiliarySession,
              p_reference: first.reference,
              p_command: write,
              p_state: auxiliaryProgress.state,
            },
          },
          {
            name: "i8_version_evidence_list",
            args: { p_user_id: c.id, p_reference: first.reference },
          },
        ];
        for (const call of calls) {
          for (const client of [anonymous, c.client]) {
            const result = await client.rpc(call.name, call.args);
            assert(result.error, "Unprivileged I8 RPC unexpectedly executed: " + call.name);
            assert.equal(
              result.error.code,
              "42501",
              "RPC failure must prove execute permission denial: " + call.name,
            );
          }
        }
        const visibleToService = await context.db.rpc("i8_selection_get", { p_user_id: c.id });
        assert(!visibleToService.error);
        assert.deepEqual(visibleToService.data, ownedSelection);
        assert.deepEqual((await active(c)).selection, ownedSelection);
        assert.deepEqual(await progress(c, auxiliarySession), auxiliaryProgress);
        assert.deepEqual(
          (await active(a)).selection.selection,
          null,
          "Unprivileged probes altered browser user A selection",
        );
      },
    );

    browser = await checkpointBrowser();
    await browser.viewport(1280, 900);
    await browser.cookies([...a.cookies].map(([name, value]) => ({ name, value })));
    const assessmentTitle = jsonFile(fixture.v1, "sections/assessments.json")[0].title;
    const course = jsonFile(fixture.v1, "documents/course.json"),
      unit = jsonFile(fixture.v1, "curriculum/unit-0.json"),
      lesson = unit.lessons[0];
    const coursePath = "/course/" + course.slug;
    let unitPath = "",
      lessonPath = "";
    const curriculumHref = async (title: string, parent: string) => {
      await waitUi(
        `[...document.querySelectorAll('a[href]')].some(x => x.textContent.includes(${JSON.stringify(title)}) && new URL(x.href).pathname.startsWith(${JSON.stringify(parent)}))`,
        "curriculum content rendered " + title,
      );
      const path = (await browser!.evaluate(
        `(() => { const node = [...document.querySelectorAll('a[href]')].find(x => x.textContent.includes(${JSON.stringify(title)}) && new URL(x.href).pathname.startsWith(${JSON.stringify(parent)})); return node ? new URL(node.href).pathname + new URL(node.href).search : null; })()`,
      )) as string | null;
      assert(path, "Normal public curriculum link missing: " + title);
      assert(path.startsWith(parent));
      return path;
    };
    const completeOnboarding = async (courseTitle: string) => {
      await waitUi(
        "Boolean(document.querySelector('.pedagogical-onboarding h1'))",
        "fresh version onboarding mounted",
      );
      await clickText(courseTitle, ".onboarding-choices button");
      await waitUi(
        `(() => { const selected = [...document.querySelectorAll('.onboarding-choices button[aria-pressed="true"]')].find(x => x.textContent.includes(${JSON.stringify(courseTitle)})); const next = [...document.querySelectorAll('.onboarding-actions button')].find(x => x.textContent.trim() === 'Continuar'); return Boolean(selected && !selected.disabled && next && !next.disabled); })()`,
        "selected installed course after hydration/reload",
      );
      await advanceOnboarding("Continuar");
      for (let step = 0; step < 12; step++) {
        await waitUi(
          "Boolean(document.querySelector('.pedagogical-onboarding h1') && document.querySelector('.onboarding-actions button'))",
          "onboarding controls mounted",
        );
        const state = (await browser!.evaluate(
          `(() => { const buttons = [...document.querySelectorAll('button')]; const enabled = text => buttons.some(x => x.textContent.trim() === text && !x.disabled); return { end: enabled('Ir para meu curso'), diagnostic: enabled('Ver diagnóstico') }; })()`,
        )) as { end: boolean; diagnostic: boolean };
        if (state.end) {
          await clickText("Ir para meu curso");
          break;
        }
        if (state.diagnostic) {
          await advanceOnboarding("Ver diagnóstico");
          continue;
        }
        const chose = await browser!.evaluate(
          "(() => { const node = document.querySelector('.onboarding-choices button:not([disabled])'); if (!node) return false; node.click(); return true; })()",
        );
        assert(chose, "Normal onboarding choice missing");
        await waitUi(
          "Boolean(document.querySelector('.onboarding-choices button[aria-pressed=true]'))",
          "onboarding choice rendered as selected",
        );
        await advanceOnboarding("Continuar");
      }

      await waitUi(
        "!document.querySelector('.pedagogical-onboarding') && location.pathname === '/dashboard' && !document.querySelector('.main-content .page-loading')",
        "onboarding completed through normal controls",
      );
      await dismissOverlays();
    };
    const openNormalLesson = async (unitTitle: string, lessonTitle: string) => {
      await clickHref(coursePath);
      unitPath = await curriculumHref(unitTitle, coursePath + "/unit/");
      await clickHref(unitPath);
      lessonPath = await curriculumHref(lessonTitle, unitPath + "/lesson/");
      await clickHref(lessonPath);
      await browser!.waitText("Conteúdo independente");
    };
    let session1 = "",
      session2 = "";
    await check(
      "real onboarding chooses external installed course through normal controls",
      async () => {
        await browser!.navigate("/");
        await browser!.waitText("Qual idioma você quer aprender?");
        fixture.assertNoPrivate(await browser!.evaluate("document.documentElement.outerHTML"));
        await completeOnboarding(course.title);
        session1 = await runtime(first.reference);
        await browser!.screenshot("increment8-onboarding.png");
        const selected = await active(a);
        assert.equal(selected.selection.selection.source, "installed");
        assert.equal(selected.selection.selection.versionSessionId, session1);
      },
    );
    await check(
      "normal course unit lesson traversal submits activity, grade and progress V1",
      async () => {
        await clickHref(coursePath);
        await browser!.waitText(unit.title);
        unitPath = await curriculumHref(unit.title, coursePath + "/unit/");
        await clickHref(unitPath);
        await browser!.waitText(lesson.title);
        lessonPath = await curriculumHref(lesson.title, unitPath + "/lesson/");
        await clickHref(lessonPath);
        await browser!.waitText("Conteúdo independente");
        const beforeGradeHtml = await api(a, lessonPath);
        assert.equal(beforeGradeHtml.status, 200);
        fixture.assertNoPrivate(await beforeGradeHtml.text());
        const rsc = await local.localFetch(new URL(lessonPath, local.localApp), {
          headers: {
            RSC: "1",
            Cookie: [...a.cookies].map(([name, value]) => name + "=" + value).join("; "),
          },
        });
        fixture.assertNoPrivate(await rsc.text());
        await clickText("Marcar como estudado");
        await waitUi(
          "Boolean([...document.querySelectorAll('.activity-panel button')].find(node => node.textContent.trim() === 'Conte\u00fado conclu\u00eddo'))",
          "manual content completion rendered",
        );
        await clickText("Pr\u00f3xima atividade", ".lesson-controls button");
        const grade = await ordering([0, 1, 2]);
        assert.equal(grade.correct, true);
        assert.equal((grade.metadata as { versionSessionId: string }).versionSessionId, session1);
        assert.deepEqual(
          (grade.metadata as { reference: InstalledContentReference }).reference,
          first.reference,
        );
        assert.equal(typeof (grade.metadata as { evidenceId: string }).evidenceId, "string");
        assert.equal(typeof (grade.metadata as { createdAt: string }).createdAt, "string");
        assert.equal(await runtime(first.reference), session1);
        await settle();
        const loaded = await progress(a, session1);
        assert.deepEqual(loaded.reference, first.reference);
        assert(
          loaded.state?.attempts.some(
            (attempt) => attempt.activityId === fixture.activityId && attempt.correct === true,
          ),
        );
        const writingActivity = lesson.activities.find(
          (entry: { id: string }) => entry.id === fixture.writingActivityId,
        );
        assert(writingActivity, "Public manual writing definition missing");
        const minimum = writingActivity.payload.textRequirement?.minimum ?? 2;
        const maximum = writingActivity.payload.textRequirement?.maximum ?? 40;
        const writingText = "x".repeat(Math.max(minimum, 2));
        assert(writingText.length <= maximum, "Manual test text violates its public requirement");
        await clickText("Pr\u00f3xima atividade", ".lesson-controls button");
        await waitUi(
          `document.getElementById(${JSON.stringify("writing-" + fixture.writingActivityId)})?.tagName === 'TEXTAREA'`,
          "manual writing activity mounted after normal next action",
        );
        const writingFocused = await browser!.evaluate(
          `(() => { const node = document.getElementById(${JSON.stringify("writing-" + fixture.writingActivityId)}); if (!node || node.tagName !== 'TEXTAREA') return false; node.focus(); return true; })()`,
        );
        assert(writingFocused, "Normal manual writing textarea missing");
        await browser!.insertText(writingText);
        await clickText("Salvar texto");
        await browser!.waitText("Seu texto foi salvo no histórico.");
        const written = await waitForProgress(
          a,
          session1,
          (loaded) =>
            Boolean(
              loaded.state?.writing.some(
                (entry) =>
                  entry.activityId === fixture.writingActivityId && entry.text === writingText,
              ),
            ),
          "V1 manual writing saved remotely with its exact activityId and text",
        );
        assert(
          written.state?.writing.some(
            (entry) => entry.activityId === fixture.writingActivityId && entry.text === writingText,
          ),
        );
        await browser!.screenshot("increment8-v1-grade.png");
      },
    );
    await check(
      "normal final assessment records canonical V1 result then reload recovers",
      async () => {
        await browser!.navigate(unitPath);
        await browser!.waitText(lesson.title);
        const finalPath = (await browser!.evaluate(
          `(() => { const node = [...document.querySelectorAll('a[href]')].find(x => new URL(x.href).pathname === '/assessment' && new URL(x.href).searchParams.get('assessmentId') === ${JSON.stringify(fixture.assessmentId)}); return node ? new URL(node.href).pathname + new URL(node.href).search : null; })()`,
        )) as string | null;
        assert(finalPath, "Declared final assessment is not linked from normal unit UI");
        await clickHref(finalPath);
        await browser!.waitText(assessmentTitle);
        await clickText("Começar avaliação");
        await settle();
        await ordering([0, 1, 2]);
        await browser!.waitText("Concluir avaliação");
        await monitor();
        await clickText("Concluir avaliação");
        const result = await responseFromClick("/api/assessments");
        assert.equal(result.objectiveScore, 100);
        assert.equal(result.passed, true);
        assert.equal(result.contentVersion, "1.0.0");
        assert.equal(result.versionSessionId, session1);
        await browser!.navigate(lessonPath);
        assert.equal(await runtime(first.reference), session1);
        const loaded = await progress(a, session1);
        assert(
          loaded.state?.assessmentAttempts.some(
            (entry) => entry.id === result.id && entry.objectiveScore === 100,
          ),
        );
        await browser!.screenshot("increment8-v1-reload.png");
      },
    );
    const evidence1 = await service.listEvidence(a.id, session1);
    await check("active V2 preserves old browser V1 and new normal selection pins V2", async () => {
      second = await prepared(fixture.v2);
      await service.activate(command(second, 1), context.authority);
      await browser!.navigate(lessonPath);
      assert.equal(await runtime(first.reference), session1);
      const oldCorrect = await api(a, "/api/grade", "POST", {
        courseId: fixture.courseId,
        activityId: fixture.activityId,
        answer: fixture.answers[0],
        versionSessionId: session1,
        evidenceId: randomUUID(),
      });
      assert.equal(oldCorrect.status, 200);
      assert.equal((await oldCorrect.json()).correct, true);
      await clickText("Estudar versão atual");
      await waitUi(
        `location.pathname === '/dashboard' && document.body.getAttribute('data-content-version') === ${JSON.stringify(second.reference.contentVersion)}`,
        "fresh V2 server context mounted",
      );
      const selectedV2 = await active(a);
      assert.equal(selectedV2.selection.selection.source, "installed");
      session2 = selectedV2.selection.selection.versionSessionId;
      assert.notEqual(session2, session1);
      const freshV2 = await progress(a, session2);
      assert.deepEqual(freshV2.reference, second.reference);
      assert.equal(
        freshV2.state?.profile.onboarded ?? false,
        false,
        "V1 onboarding profile was copied into V2",
      );
      assert.equal(
        freshV2.state?.attempts.length ?? 0,
        0,
        "Stale V1 cache leaked attempts into V2",
      );
      assert.equal(freshV2.state?.writing.length ?? 0, 0, "Stale V1 cache leaked writing into V2");
      assert.equal(
        freshV2.state?.assessmentAttempts.length ?? 0,
        0,
        "Stale V1 cache leaked final results into V2",
      );
      const secondCourse = jsonFile(fixture.v2, "documents/course.json"),
        secondUnit = jsonFile(fixture.v2, "curriculum/unit-0.json");
      await completeOnboarding(secondCourse.title);
      assert.equal(await runtime(second.reference), session2);
      await openNormalLesson(secondUnit.title, secondUnit.lessons[0].title);
      await clickText("Marcar como estudado");
      await waitUi(
        "Boolean([...document.querySelectorAll('.activity-panel button')].find(node => node.textContent.trim() === 'Conte\u00fado conclu\u00eddo'))",
        "V2 manual content completion rendered",
      );
      await clickText("Pr\u00f3xima atividade", ".lesson-controls button");
      const newCorrect = await ordering([2, 1, 0]);
      assert.equal(newCorrect.correct, true);
      assert.equal(
        (newCorrect.metadata as { versionSessionId: string }).versionSessionId,
        session2,
      );
      assert.deepEqual(
        (newCorrect.metadata as { reference: InstalledContentReference }).reference,
        second.reference,
      );
      const oldAnswer = await api(a, "/api/grade", "POST", {
        courseId: fixture.courseId,
        activityId: fixture.activityId,
        answer: fixture.answers[0],
        versionSessionId: session2,
        evidenceId: randomUUID(),
      });
      assert.equal(oldAnswer.status, 200);
      assert.equal((await oldAnswer.json()).correct, false);
      assert.deepEqual((await progress(a, session2)).reference, second.reference);
      await browser!.screenshot("increment8-v2-grade.png");
    });
    const evidence2 = await service.listEvidence(a.id, session2);
    await check(
      "cross-owner progress/grade access and missing version scope are rejected",
      async () => {
        const protectedEvidenceBefore = await service.listEvidence(a.id, session1);
        const crossRead = await api(
          b,
          "/api/course-installations/progress?versionSessionId=" + session1,
        );
        assert([403, 404].includes(crossRead.status));
        const crossGrade = await api(b, "/api/grade", "POST", {
          courseId: fixture.courseId,
          activityId: fixture.activityId,
          answer: fixture.answers[0],
          versionSessionId: session1,
          evidenceId: randomUUID(),
        });
        assert([403, 404].includes(crossGrade.status));
        const protectedSnapshot = await progress(a, session1);
        assert(protectedSnapshot.state);
        const crossWrite = await api(b, "/api/course-installations/progress", "POST", {
          versionSessionId: session1,
          expectedRevision: protectedSnapshot.revision,
          operationId: randomUUID(),
          state: protectedSnapshot.state,
        });
        assert([403, 404].includes(crossWrite.status));
        assert.deepEqual(await progress(a, session1), protectedSnapshot);
        const noScope = await api(a, "/api/grade", "POST", {
          courseId: fixture.courseId,
          activityId: fixture.activityId,
          answer: fixture.answers[1],
          evidenceId: randomUUID(),
        });
        assert(noScope.status >= 400);
        assert.deepEqual(await service.listEvidence(a.id, session1), protectedEvidenceBefore);
      },
    );
    await check(
      "rollback recovers V1 snapshot and preserves all previous V1/V2 evidence",
      async () => {
        await service.rollback(command(first, 2), context.authority);
        await clickText("Estudar versão atual");
        await settle();
        await waitUi(
          `location.pathname === "/dashboard" && document.body.getAttribute("data-content-version") === ${JSON.stringify(first.reference.contentVersion)}`,
          "rollback V1 server context mounted",
        );
        const rolled = await runtime(first.reference);
        assert.notEqual(rolled, session2);
        await openNormalLesson(unit.title, lesson.title);
        const recovered = await progress(a, rolled);
        assert(recovered.state?.assessmentAttempts.some((entry) => entry.objectiveScore === 100));
        assert.equal(
          (await service.resolveSession(a.id, session2)).session.reference.contentVersion,
          "2.0.0",
        );
        assert.deepEqual(
          (await service.listEvidence(a.id, session1)).slice(0, evidence1.length),
          evidence1,
        );
        assert.deepEqual(await service.listEvidence(a.id, session2), evidence2);
        await browser!.screenshot("increment8-rollback.png");
      },
    );
    await check(
      "installed runtime continues after producer and public authoring assets are unavailable",
      async () => {
        renameSync(fixture.producer, fixture.producer + ".offline");
        renameSync(fixture.contracts, fixture.contracts + ".offline");
        for (const directory of fixture.directories) renameSync(directory, directory + ".offline");
        await browser!.navigate(lessonPath);
        await runtime(first.reference);
        assert((await progress(a, session1)).state?.assessmentAttempts.length);
      },
    );
    await check(
      "blocked installed AI/voice/interactive endpoints consume no quota or external provider",
      async () => {
        const usageBefore = await context.db
          .from("ai_requests")
          .select("id", { count: "exact", head: true })
          .eq("user_id", a.id);
        assert(!usageBefore.error);
        assert.equal(usageBefore.count, 0);
        const previous = await progress(a, session1);
        const previousEvidence: VersionEvidence[] = await service.listEvidence(a.id, session1);
        for (const [path, body] of [
          [
            "/api/ai/tutor",
            {
              courseId: fixture.courseId,
              question: "Pergunta sintética",
              versionSessionId: session1,
            },
          ],
          [
            "/api/interactive-lessons/session",
            { courseId: fixture.courseId, lessonId: fixture.lessonId, versionSessionId: session1 },
          ],
        ] as const) {
          const response = await api(a, path, "POST", body);
          assert(
            response.status >= 400 && response.status <= 503,
            "Blocked feature claimed success",
          );
        }
        const form = new FormData();
        form.set("courseId", fixture.courseId);
        form.set("versionSessionId", session1);
        const wave = new Uint8Array(44);
        new DataView(wave.buffer).setUint32(0, 0x52494646);
        new DataView(wave.buffer).setUint32(8, 0x57415645);
        form.set("audio", new Blob([wave], { type: "audio/wav" }), "synthetic.wav");
        const voice = await local.localFetch(new URL("/api/pronunciation", local.localApp), {
          method: "POST",
          headers: { Cookie: [...a.cookies].map(([name, value]) => name + "=" + value).join("; ") },
          body: form,
        });
        assert(voice.status >= 400 && voice.status <= 503);
        const usageAfter = await context.db
          .from("ai_requests")
          .select("id", { count: "exact", head: true })
          .eq("user_id", a.id);
        assert(!usageAfter.error);
        assert.equal(usageAfter.count, usageBefore.count);
        assert.deepEqual(await progress(a, session1), previous);
        assert.deepEqual(await service.listEvidence(a.id, session1), previousEvidence);
        assert.equal(externalAttempts, 0);
      },
    );
    if (process.env.C2_LOCAL_JOURNEY === "1") {
      await browser.viewport(1280, 900);
      await runCiclo2Journey({ browser, fixture: independentLearningFixtures({ retainFiles: true }), service, authority: context.authority, student, prepared, active, progress, api, waitUi, clickText, dismissOverlays, check });
    }
    const proof = browser.proof();
    assert.equal(proof.blockedRequests, 0);
    assert.equal(proof.runtimeErrors, 0);
    assert.equal(externalAttempts, 0);
    assert.deepEqual(
      candidateHashes(candidatePaths),
      before,
      "Candidate changed during browser proof",
    );
    console.log(
      JSON.stringify({
        taskId: "I8-QA-LOCAL",
        checks: records.length,
        records,
        isolation,
        browser: proof,
        candidate: before,
        normalFlow: true,
        courseId: fixture.courseId,
        versions: [first.reference, second.reference],
        sessions: [session1, session2],
        retainedSyntheticUsers: retainedUsers,
        mandatoryFixtureCourseId: mandatoryCourseId,
        mandatoryFixtureNotActivated: true,
        paidCalls: 0,
        remoteOperations: 0,
      }),
    );
  } catch (error) {
    const at =
      error instanceof Error
        ? (error.stack ?? "")
            .split(/\r?\n/)
            .filter(
              (line) =>
                line.trimStart().startsWith("at ") &&
                /scripts[\\/]verify-installed-runtime-local/.test(line),
            )
            .map((line) => line.trim())
            .slice(0, 8)
        : [];
    console.error(JSON.stringify({ failedScenario: runningScenario, at, message: error instanceof Error ? error.message : "Unknown synthetic test error" }));
    if (browser) {
      const artifact = "increment8-failure-" + Date.now();
      try {
        await browser.screenshot(artifact + ".png");
      } catch {
        /* Preserve original failure. */
      }
      try {
        const html = await browser.evaluate(
          "(() => { const clone = document.documentElement.cloneNode(true); clone.querySelectorAll('script').forEach(node => node.remove()); clone.querySelectorAll('input').forEach(node => node.removeAttribute('value')); return clone.outerHTML; })()",
        );
        if (typeof html === "string") {
          let safe = html;
          for (const marker of [...fixture.answers, ...fixture.rubricCanaries])
            safe = safe.split(marker).join("[PRIVATE_FIXTURE_REDACTED]");
          writeFileSync(resolve(local.workspace, ".tmp", artifact + ".html"), safe);
        }
      } catch {
        /* Preserve original failure. */
      }
      console.log(
        JSON.stringify({
          diagnosticArtifactPrefix: artifact,
          syntheticOnly: true,
          scriptsAndInputValuesRemoved: true,
        }),
      );
    }
    throw error;
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      fixture.cleanup();
      globalThis.fetch = originalFetch;
      console.log(
        JSON.stringify({
          retainedSyntheticUsers: retainedUsers,
          retainedCourseId: fixture.courseId,
          reason: "Version-bound local evidence retained for inspection",
        }),
      );
    }
  }
}
main().catch(() => {
  console.error("Local I8 integration failed; inspect the sanitized scenario/line diagnostic.");
  process.exitCode = 1;
});
