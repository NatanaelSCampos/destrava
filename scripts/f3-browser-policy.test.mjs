import assert from "node:assert/strict";
import test from "node:test";
import { createF3BrowserPolicy } from "./f3-browser-policy.mjs";

const APP = "http://127.0.0.1:3100",
  API = "http://127.0.0.1:55421";
const uid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const NOW = "2026-10-24T12:00:00.000Z";
const scope = {
  owner: uid(99),
  accessToken: "synthetic-access-token",
  publicKey: "synthetic-public-key",
  courseId: "new-compiled-course",
  languageId: "opaque-package-language",
  unitIds: ["unit-a", "unit-b"],
  lessonIds: ["lesson-a", "lesson-b"],
  activityIds: ["choice-a", "fill-a", "writing-a", "speaking-a", "choice-b"],
  vocabularyIds: ["word-a"],
  assessmentIds: ["diagnostic-a", "final-b"],
  segmentIds: ["segment-a", "segment-b"],
  notificationIds: Array.from({ length: 13 }, (_, index) => `notice-${index + 1}`),
};
const clone = (value) => structuredClone(value);
const schedule = (number) => ({
  id: uid(number),
  nextReviewAt: NOW,
  intervalDays: 0,
  easeFactor: 2.5,
  reviewCount: 0,
  masteryScore: 0,
  consecutiveCorrect: 0,
});
function state() {
  return {
    courseId: scope.courseId,
    languageCode: scope.languageId,
    profile: {
      learningPreferences: {
        goal: "general",
        contexts: [],
        skillPriorities: [],
        skillWeights: {
          speaking: 0.6,
          listening: 0.6,
          reading: 0.6,
          writing: 0.6,
        },
        preferredSessionMinutes: 15,
      },
      selfReportedLevel: null,
      onboardingStep: 0,
      goal: "Learn",
      dailyMinutes: 15,
      daysPerWeek: 4,
      level: "A1",
      priorKnowledge: "none",
      variantId: "declared-variant",
      onboarded: true,
    },
    completedActivityIds: ["choice-a"],
    attempts: [
      {
        id: uid(1),
        activityId: "choice-a",
        answer: "A",
        correct: true,
        skill: "grammar",
        createdAt: NOW,
        sessionId: uid(8),
      },
    ],
    writing: [
      {
        id: uid(2),
        activityId: "writing-a",
        text: "A manually entered text",
        createdAt: NOW,
        sessionId: null,
      },
    ],
    speaking: [
      {
        id: uid(3),
        activityId: "speaking-a",
        transcription: "Manually entered transcript",
        audioUrl: null,
        createdAt: NOW,
      },
    ],
    vocabulary: {
      "word-a": { id: uid(4), status: "learning", schedule: schedule(5) },
    },
    mistakes: {
      "fill-a": {
        id: uid(6),
        activityId: "fill-a",
        courseId: scope.courseId,
        languageCode: scope.languageId,
        category: "grammar",
        originalAnswer: "B",
        correctAnswer: "A",
        explanation: "Review",
        timesMissed: 1,
        timesCorrect: 0,
        lastMissedAt: NOW,
        lastReviewedAt: null,
        schedule: schedule(7),
      },
    },
    sessions: [
      {
        id: uid(8),
        unitId: "unit-a",
        startedAt: NOW,
        finishedAt: null,
        durationSeconds: 20,
        activityIds: ["choice-a"],
        correct: 1,
        wrong: 0,
        wordsReviewed: 0,
        plan: [
          { kind: "activity", id: "choice-a", title: "Choice", minutes: 1 },
          {
            kind: "review",
            id: "due",
            title: "Review",
            minutes: 1,
            reviewItems: [{ kind: "word", id: "word-a" }],
          },
        ],
      },
    ],
    events: [
      {
        id: uid(9),
        type: "activity_completed",
        activityId: "choice-a",
        createdAt: NOW,
        metadata: { courseId: scope.courseId },
      },
    ],
    reviews: [
      {
        id: uid(10),
        scheduleId: uid(5),
        sessionId: uid(8),
        correct: true,
        reviewedAt: NOW,
        intervalBefore: 0,
        intervalAfter: 3,
      },
    ],
    structureReviews: { "choice-a": { id: uid(12), schedule: schedule(13) } },
    pronunciationReviews: {
      "speaking-a": {
        id: uid(14),
        activityId: "speaking-a",
        term: "A",
        referenceText: "A",
        lastAccuracy: null,
        schedule: schedule(15),
      },
    },
    structureAttempts: [],
    assessmentAttempts: [
      {
        id: uid(11),
        courseId: scope.courseId,
        assessmentId: "diagnostic-a",
        startedAt: NOW,
        finishedAt: NOW,
        objectiveScore: 100,
        source: "server",
        answers: [
          {
            activityId: "choice-a",
            answer: "A",
            correct: true,
            skill: "grammar",
          },
        ],
      },
    ],
    adaptiveAssessments: [],
    adaptiveProgress: [],
    numberAttempts: [],
    regionalAttempts: [],
    microLessonAttempts: [],
    conversations: [],
    imageDescriptions: [],
    activeSessionId: uid(8),
  };
}
function restHeaders(extra = {}) {
  return {
    origin: APP,
    authorization: `Bearer ${scope.accessToken}`,
    apikey: scope.publicKey,
    "content-profile": "public",
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates",
    "x-client-info": "synthetic-sdk",
    ...extra,
  };
}
function request(body, headers = restHeaders()) {
  return { method: "POST", headers, postData: JSON.stringify(body) };
}
const conflicts = {
  user_course_state: "user_id,course_id",
  user_course_profiles: "user_id,course_id",
  user_activity_progress: "user_id,activity_id",
  study_sessions: "id",
  study_session_activities: "session_id,position",
  exercise_attempts: "id",
  user_vocabulary: "id",
  mistakes: "id",
  review_schedules: "id",
  user_review_targets: "user_id,course_id,target_kind,target_id",
  reviews: "id",
  writing_submissions: "id",
  speaking_submissions: "id",
  study_events: "id",
  lesson_progress: "user_id,lesson_id",
  unit_progress: "user_id,unit_id",
  skill_progress: "user_id,course_id,skill",
};
function rest(table, body) {
  const url = new URL(`${API}/rest/v1/${table}`);
  url.searchParams.set("on_conflict", conflicts[table] ?? "id");
  if (Array.isArray(body) && body.length)
    url.searchParams.set(
      "columns",
      [...new Set(body.flatMap(Object.keys))].map((column) => `"${column}"`).join(","),
    );
  return [url, request(body)];
}
function snapshot(value = state()) {
  return {
    user_id: scope.owner,
    course_id: scope.courseId,
    language_code: scope.languageId,
    state: value,
    updated_at: NOW,
  };
}
function seeded() {
  const policy = createF3BrowserPolicy(scope);
  assert.equal(
    policy.mutationAllowed(...rest("user_course_state", snapshot())),
    true,
    "Fixture state must be accepted",
  );
  return policy;
}
function projectedRows() {
  const owner = { user_id: scope.owner },
    course = { course_id: scope.courseId },
    stamp = { updated_at: NOW };
  const source = state();
  return {
    user_course_profiles: [
      {
        ...owner,
        ...course,
        goal: "Learn",
        daily_minutes: 15,
        days_per_week: 4,
        current_level: "A1",
        prior_knowledge: "none",
        variant_id: "declared-variant",
        learning_preferences: source.profile.learningPreferences,
        self_reported_level: null,
        onboarding_step: 0,
        onboarding_completed_at: NOW,
        ...stamp,
      },
    ],
    user_activity_progress: [{ ...owner, activity_id: "choice-a" }],
    study_sessions: [
      {
        id: uid(8),
        ...owner,
        unit_id: "unit-a",
        started_at: NOW,
        finished_at: null,
        duration_seconds: 20,
        performance: {
          plan: source.sessions[0].plan,
          mode: "guided",
          targetMinutes: null,
          activityIds: ["choice-a"],
          correct: 1,
          wrong: 0,
          wordsReviewed: 0,
        },
      },
    ],
    study_session_activities: [
      {
        ...owner,
        session_id: uid(8),
        activity_id: "choice-a",
        position: 1,
        planned_minutes: 1,
        finished_at: NOW,
        performance: { completed: true },
      },
    ],
    exercise_attempts: [
      {
        id: uid(1),
        ...owner,
        activity_id: "choice-a",
        session_id: uid(8),
        answer: { text: "A" },
        is_correct: true,
        score: 100,
        attempted_at: NOW,
      },
    ],
    user_vocabulary: [
      {
        id: uid(4),
        ...owner,
        vocabulary_item_id: "word-a",
        status: "learning",
        ...stamp,
      },
    ],
    mistakes: [
      {
        id: uid(6),
        ...owner,
        unit_id: "unit-a",
        ...course,
        language_code: scope.languageId,
        topic_id: null,
        activity_id: "fill-a",
        category: "grammar",
        original_answer: "B",
        correct_answer: "A",
        explanation: "Review",
        times_missed: 1,
        times_correct: 0,
        last_missed_at: NOW,
        last_reviewed_at: null,
        last_correct_at: null,
      },
    ],
    review_schedules: [
      {
        id: uid(5),
        ...owner,
        user_vocabulary_id: uid(4),
        mistake_id: null,
        next_review_at: NOW,
        interval_days: 0,
        ease_factor: 2.5,
        review_count: 0,
        mastery_score: 0,
        consecutive_correct: 0,
      },
      {
        id: uid(7),
        ...owner,
        user_vocabulary_id: null,
        mistake_id: uid(6),
        next_review_at: NOW,
        interval_days: 0,
        ease_factor: 2.5,
        review_count: 0,
        mastery_score: 0,
        consecutive_correct: 0,
      },
    ],
    user_review_targets: [
      {
        ...owner,
        ...course,
        target_kind: "structure",
        target_id: "choice-a",
        payload: {},
        schedule: source.structureReviews["choice-a"].schedule,
        ...stamp,
      },
      {
        ...owner,
        ...course,
        target_kind: "pronunciation",
        target_id: "speaking-a",
        payload: {
          activityId: "speaking-a",
          term: "A",
          referenceText: "A",
          lastAccuracy: null,
        },
        schedule: source.pronunciationReviews["speaking-a"].schedule,
        ...stamp,
      },
    ],
    reviews: [
      {
        id: uid(10),
        ...owner,
        schedule_id: uid(5),
        is_correct: true,
        reviewed_at: NOW,
        interval_before: 0,
        interval_after: 3,
      },
    ],
    writing_submissions: [
      {
        id: uid(2),
        ...owner,
        activity_id: "writing-a",
        text: "A manually entered text",
        created_at: NOW,
      },
    ],
    speaking_submissions: [
      {
        id: uid(3),
        ...owner,
        activity_id: "speaking-a",
        audio_path: null,
        transcription: "Manually entered transcript",
        created_at: NOW,
      },
    ],
    study_events: [
      {
        id: uid(9),
        ...owner,
        ...course,
        event_type: "activity_completed",
        activity_id: "choice-a",
        metadata: { courseId: scope.courseId },
        created_at: NOW,
      },
    ],
    lesson_progress: [
      {
        ...owner,
        lesson_id: "lesson-a",
        completion_percent: 10,
        completed_at: null,
        ...stamp,
      },
    ],
    unit_progress: [
      {
        ...owner,
        unit_id: "unit-a",
        content_version: "1.0.0",
        completion_percent: 10,
        participation_percent: 10,
        completed_at: null,
        mastered_at: null,
        exercise_score: 100,
        review_score: null,
        assessment_score: null,
        policy_state: { completion: {}, mastery: {} },
        ...stamp,
      },
    ],
    skill_progress: [
      {
        ...owner,
        ...course,
        skill: "grammar",
        practiced_count: 1,
        correct_count: 1,
        completed_count: 1,
        ...stamp,
      },
    ],
  };
}
function app(path, body) {
  return [new URL(APP + path), request(body, { origin: APP, "content-type": "application/json" })];
}
function rpc(path, body = {}) {
  const h = restHeaders();
  delete h.prefer;
  return [new URL(API + "/rest/v1/rpc/" + path), request(body, h)];
}
function preflight(url, rpc = false) {
  return [
    url,
    {
      method: "OPTIONS",
      headers: {
        origin: APP,
        "access-control-request-method": "POST",
        "access-control-request-headers": rpc
          ? "apikey,authorization,content-profile,content-type,x-client-info"
          : "apikey,authorization,content-profile,content-type,prefer,x-client-info",
      },
    },
  ];
}

for (const [table, rows] of Object.entries(projectedRows())) {
  test(`actual normalized ${table} upsert succeeds after its owner/course state snapshot`, () =>
    assert.equal(seeded().mutationAllowed(...rest(table, rows)), true));
  test(`${table} refuses another owner and unknown columns`, () => {
    for (const changes of [{ user_id: uid(100) }, { sql: "select 1" }]) {
      const altered = clone(rows);
      Object.assign(altered[0], changes);
      assert.equal(seeded().mutationAllowed(...rest(table, altered)), false);
    }
  });
  test(`${table} has a bounded SDK preflight without fictitious bearer headers`, () => {
    const [url] = rest(table, rows),
      policy = seeded();
    assert.equal(policy.mutationAllowed(...preflight(url)), true);
    for (const change of [
      { origin: "http://localhost:3100" },
      { "access-control-request-method": "DELETE" },
      {
        "access-control-request-headers":
          "apikey,authorization,content-profile,content-type,prefer,x-client-info,x-admin",
      },
      { "access-control-request-headers": "apikey,authorization" },
    ]) {
      const [, req] = preflight(url);
      Object.assign(req.headers, change);
      assert.equal(policy.mutationAllowed(url, req), false);
    }
  });
}

test("state upsert requires exact owner, compiled course, language and references", () => {
  const variants = [
    (body) => {
      body.user_id = uid(100);
    },
    (body) => {
      body.course_id = "old-course";
    },
    (body) => {
      body.language_code = "es";
    },
    (body) => {
      body.state.courseId = "old-course";
    },
    (body) => {
      body.state.languageCode = "es";
    },
    (body) => {
      body.state.completedActivityIds.push("old-activity");
    },
    (body) => {
      body.state.attempts[0].activityId = "old-activity";
    },
    (body) => {
      body.state.sessions[0].unitId = "old-unit";
    },
    (body) => {
      body.state.vocabulary["old-word"] = body.state.vocabulary["word-a"];
    },
    (body) => {
      body.state.writing[0].feedback = { score: 100 };
    },
    (body) => {
      body.state.speaking[0].audioUrl = "data:audio/wav;base64,AAAA";
    },
    (body) => {
      body.state.versionSessionId = uid(77);
    },
    (body) => {
      body.state.profile.role = "admin";
    },
    (body) => {
      body.state.events[0].metadata = { installation_id: uid(77) };
    },
    (body) => {
      body.state.profile.learningPreferences = { sql: "delete" };
    },
  ];
  for (const alter of variants) {
    const body = snapshot();
    alter(body);
    assert.equal(
      createF3BrowserPolicy(scope).mutationAllowed(...rest("user_course_state", body)),
      false,
    );
  }
});

test("actual POST requires exact bearer, public key, origin, schema and merge-duplicate preference", () => {
  const [url, req] = rest("user_course_state", snapshot());
  for (const changes of [
    { authorization: "Bearer other-owner-token" },
    { authorization: undefined },
    { apikey: "wrong" },
    { origin: "http://localhost:3100" },
    { "content-profile": "private" },
    { prefer: "resolution=ignore-duplicates" },
    { prefer: "resolution=merge-duplicates,return=representation" },
    { "content-type": "text/plain" },
    { Authorization: "Bearer other-owner-token" },
    { "x-http-method-override": "DELETE" },
  ]) {
    const changed = clone(req);
    Object.assign(changed.headers, changes);
    assert.equal(createF3BrowserPolicy(scope).mutationAllowed(url, changed), false);
  }
});

test("query filters, duplicate parameters, conflict changes and unknown paths are denied", () => {
  const policy = seeded(),
    [url, req] = rest("writing_submissions", projectedRows().writing_submissions);
  for (const search of [
    url.search + "&user_id=eq.someone",
    url.search + "&on_conflict=id",
    "?on_conflict=user_id",
    url.search + "&select=*",
    url.search + "&columns=%22sql%22",
  ]) {
    const altered = new URL(url);
    altered.search = search;
    assert.equal(policy.mutationAllowed(altered, req), false);
  }
  for (const destination of [
    "http://localhost:55421/rest/v1/writing_submissions",
    "https://127.0.0.1:55421/rest/v1/writing_submissions",
    "http://127.0.0.1:55422/rest/v1/writing_submissions",
    "http://evil.invalid/rest/v1/writing_submissions",
    "http://user:pass@127.0.0.1:55421/rest/v1/writing_submissions",
    API + "/rest/v1/rpc/execute_sql",
    API + "/storage/v1/object/speaking-audio",
    API + "/rest/v1/ai_feedback",
  ])
    assert.equal(policy.mutationAllowed(new URL(destination), req), false);
  const fragment = new URL(url);
  fragment.hash = "extra";
  assert.equal(policy.mutationAllowed(fragment, req), false);
});

test("all unapproved methods and malformed or oversized bodies are denied", () => {
  const policy = seeded(),
    [url, req] = rest("writing_submissions", projectedRows().writing_submissions);
  for (const method of ["DELETE", "PATCH", "PUT", "GET", "HEAD", "post", "TRACE"])
    assert.equal(policy.mutationAllowed(url, { ...req, method }), false);
  for (const postData of ["{", "null", "[]", '"value"', "x".repeat(1024 * 1024 + 1)])
    assert.equal(policy.mutationAllowed(url, { ...req, postData }), false);
});

test("dynamic normalized record IDs and related session/schedule IDs must come from validated state", () => {
  const policy = seeded();
  for (const [table, property] of [
    ["exercise_attempts", "id"],
    ["exercise_attempts", "session_id"],
    ["writing_submissions", "id"],
    ["speaking_submissions", "id"],
    ["reviews", "schedule_id"],
    ["review_schedules", "mistake_id"],
    ["study_session_activities", "session_id"],
  ]) {
    const rows = clone(projectedRows()[table]);
    rows[0][property] = uid(999);
    assert.equal(policy.mutationAllowed(...rest(table, rows)), false);
  }
  const fresh = createF3BrowserPolicy(scope);
  assert.equal(
    fresh.mutationAllowed(...rest("writing_submissions", projectedRows().writing_submissions)),
    false,
  );
});

test("accepted snapshot bindings survive asynchronous later snapshots without permitting scope expansion", () => {
  const policy = seeded(),
    later = state();
  later.writing = [];
  later.sessions[0].plan.push({
    kind: "activity",
    id: "choice-b",
    title: "Known later activity",
    minutes: 1,
  });
  assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(later))), true);
  assert.equal(
    policy.mutationAllowed(...rest("writing_submissions", projectedRows().writing_submissions)),
    true,
  );
  const rows = projectedRows().study_session_activities;
  rows[0].activity_id = "choice-b";
  assert.equal(policy.mutationAllowed(...rest("study_session_activities", rows)), true);
});

test("a rejected snapshot cannot register IDs for later normalized writes", () => {
  const policy = seeded(),
    invalid = state();
  invalid.writing[0].id = uid(888);
  invalid.writing[0].activityId = "other-course-activity";
  assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(invalid))), false);
  const rows = projectedRows().writing_submissions;
  rows[0].id = uid(888);
  assert.equal(policy.mutationAllowed(...rest("writing_submissions", rows)), false);
});

test("compiled selection, real grade and assessment routes allow only declared course/reference bodies", () => {
  const policy = seeded();
  const bodies = [
    [
      "/api/course/active",
      {
        courseId: scope.courseId,
        source: "compiled",
        expectedRevision: 0,
        operationId: uid(70),
      },
    ],
    ["/api/grade", { courseId: scope.courseId, activityId: "choice-a", answer: "A" }],
    [
      "/api/assessments",
      {
        courseId: scope.courseId,
        assessmentId: "diagnostic-a",
        attemptId: uid(71),
        startedAt: NOW,
        responses: [{ activityId: "choice-a", answer: "A" }],
      },
    ],
  ];
  for (const [path, body] of bodies) {
    assert.equal(policy.mutationAllowed(...app(path, body)), true);
    for (const changes of [
      { courseId: "old-course" },
      { versionSessionId: uid(70) },
      { userId: uid(100) },
      { sql: "select 1" },
    ])
      assert.equal(policy.mutationAllowed(...app(path, { ...body, ...changes })), false);
  }
  assert.equal(
    policy.mutationAllowed(
      ...app("/api/course/active", {
        courseId: scope.courseId,
        source: "installed",
      }),
    ),
    false,
  );
  assert.equal(
    policy.mutationAllowed(
      ...app("/api/grade", {
        courseId: scope.courseId,
        activityId: "unknown",
        answer: "A",
      }),
    ),
    false,
  );
  assert.equal(
    policy.mutationAllowed(
      ...app("/api/assessments", {
        ...bodies[2][1],
        responses: [{ activityId: "unknown", answer: "A" }],
      }),
    ),
    false,
  );
  for (const path of [
    "/api/exercises/grade",
    "/api/ai/tutor",
    "/api/ai/writing",
    "/api/pronunciation",
    "/api/course-installations/progress",
  ])
    assert.equal(policy.mutationAllowed(...app(path, bodies[1][1])), false);
  const [url, req] = app("/api/grade", bodies[1][1]);
  url.search = "?courseId=old-course";
  assert.equal(policy.mutationAllowed(url, req), false);
});

function classroomSession() {
  return {
    courseId: scope.courseId,
    lessonId: "lesson-a",
    contentVersion: "1.0.0",
    revision: null,
    runtime: {
      schemaVersion: 2,
      evidenceScope: {
        userId: scope.owner,
        courseId: scope.courseId,
        lessonId: "lesson-a",
        sessionId: uid(80),
        contentVersion: "1.0.0",
        definitionHash: "a".repeat(64),
      },
      segmentEvidence: {},
      segmentAttemptSequences: {},
      segmentFailures: {},
      phase: "paused",
      segmentIndex: 0,
      positionMs: 100,
      board: {
        elements: [],
        highlightedIds: [],
        translationVisible: false,
        caption: "Text",
        teacherState: "paused",
      },
      completedSegmentIds: [],
      checkpointPassed: false,
      speakingSaved: false,
      checkpointFailures: 0,
      slowdownCount: 0,
      resumePoint: null,
      runtimePath: [{ id: "canonical-node", segmentId: "segment-a", kind: "canonical" }],
      message: "",
    },
  };
}
test("interactive session and JSON segment submission bind owner, lesson, activity and segment IDs", () => {
  const policy = seeded(),
    session = classroomSession();
  assert.equal(policy.mutationAllowed(...app("/api/interactive-lessons/session", session)), true);
  const body = {
    courseId: scope.courseId,
    lessonId: "lesson-a",
    contentVersion: "1.0.0",
    sessionId: uid(80),
    revision: 1,
    segmentId: "segment-a",
    activityId: "choice-a",
    attemptId: uid(81),
    answer: "A",
  };
  assert.equal(policy.mutationAllowed(...app("/api/interactive-lessons/segment", body)), true);
  for (const change of [
    { lessonId: "lesson-b" },
    { sessionId: uid(999) },
    { segmentId: "foreign-segment" },
    { activityId: "foreign-activity" },
    { userId: uid(100) },
    { versionSessionId: uid(999) },
  ])
    assert.equal(
      policy.mutationAllowed(...app("/api/interactive-lessons/segment", { ...body, ...change })),
      false,
    );
  for (const alter of [
    (value) => {
      value.runtime.evidenceScope.userId = uid(100);
    },
    (value) => {
      value.runtime.completedSegmentIds = ["foreign-segment"];
    },
    (value) => {
      value.runtime.runtimePath[0].segmentId = "foreign-segment";
    },
    (value) => {
      value.runtime.segmentFailures["foreign-segment"] = 1;
    },
    (value) => {
      value.runtime.resumePoint = {
        segmentId: "foreign-segment",
        playbackPositionMs: 0,
        anchorMs: 0,
        board: {},
        reason: "ask",
      };
    },
  ]) {
    const changed = clone(session);
    alter(changed);
    assert.equal(
      policy.mutationAllowed(...app("/api/interactive-lessons/session", changed)),
      false,
    );
  }
});

test("MFA read requires exact empty body and current-owner credentials", () => {
  const policy = seeded(),
    [url, req] = rpc("mfa_access_allowed");
  assert.equal(policy.mutationAllowed(url, req), true);
  assert.equal(policy.mutationAllowed(...preflight(url, true)), true);
  for (const body of [
    { p_user_id: scope.owner },
    { user_id: uid(100) },
    [],
    null,
    { sql: "select 1" },
  ])
    assert.equal(policy.mutationAllowed(url, request(body, req.headers)), false);
  for (const change of [
    { authorization: "Bearer wrong-owner" },
    { apikey: "wrong" },
    { origin: "http://evil.invalid" },
    { "content-profile": "private" },
  ])
    assert.equal(
      policy.mutationAllowed(url, {
        ...req,
        headers: { ...req.headers, ...change },
      }),
      false,
    );
  for (const method of ["DELETE", "PATCH", "PUT"])
    assert.equal(policy.mutationAllowed(url, { ...req, method }), false);
  for (const name of ["execute_sql", "mfa_access_allowed_extra", "claim_feature_announcements"])
    assert.equal(policy.mutationAllowed(...rpc(name)), false);
});

test("announcements remain blocked and only the exact scoped payload is an expected local block", () => {
  const policy = seeded(),
    [url, req] = rpc("claim_feature_announcements", {
      p_ids: [...scope.notificationIds].reverse(),
    });
  assert.equal(policy.mutationAllowed(url, req), false);
  assert.equal(policy.expectedLocalBlock(url, req), true);
  assert.equal(policy.mutationAllowed(...preflight(url, true)), true);
  for (const body of [
    { p_ids: ["other"] },
    { p_ids: [...scope.notificationIds, scope.notificationIds[0]] },
    { p_ids: scope.notificationIds, role: "admin" },
  ])
    assert.equal(policy.expectedLocalBlock(url, request(body, req.headers)), false);
  assert.equal(
    policy.expectedLocalBlock(url, {
      ...req,
      headers: { ...req.headers, origin: "http://localhost:3100" },
    }),
    false,
  );
  assert.equal(
    policy.expectedLocalBlock(url, {
      ...req,
      headers: { ...req.headers, authorization: "Bearer wrong" },
    }),
    false,
  );
  assert.equal(policy.expectedLocalBlock(url, { ...req, method: "OPTIONS" }), false);
  assert.equal(policy.expectedLocalBlock(new URL(API + "/rest/v1/rpc/execute_sql"), req), false);
});

test("unknown preflight targets or methods do not gain a generic OPTIONS allowance", () => {
  const policy = seeded();
  for (const destination of [
    APP + "/api/grade",
    API + "/rest/v1/ai_feedback",
    API + "/rest/v1/rpc/execute_sql",
    API + "/storage/v1/object/speaking-audio",
    API + "/auth/v1/token",
  ])
    assert.equal(policy.mutationAllowed(...preflight(new URL(destination))), false);
});

test("scope is snapshotted, validates configuration, and malformed requests fail closed", () => {
  const input = clone(scope),
    policy = createF3BrowserPolicy(input);
  input.activityIds.push("later-injected");
  input.courseId = "other-course";
  assert.equal(
    policy.mutationAllowed(
      ...app("/api/grade", {
        courseId: scope.courseId,
        activityId: "later-injected",
        answer: "A",
      }),
    ),
    false,
  );
  for (const changes of [
    { owner: "not-a-uuid" },
    { accessToken: "" },
    { unitIds: ["one"] },
    { activityIds: ["same", "same"] },
    { segmentIds: undefined },
  ])
    assert.throws(() => createF3BrowserPolicy({ ...scope, ...changes }));
  assert.equal(policy.mutationAllowed(null, null), false);
  assert.equal(policy.mutationAllowed(new URL(APP + "/api/grade"), {}), false);
});

// Technical container bytes only: these fixtures make no claim about voice or decoding quality.
const WEBM = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84]),
  Buffer.from("webm"),
  Buffer.alloc(32),
]);
function pendingRecording(submissionId = uid(83)) {
  const value = state();
  value.speaking.push({
    id: submissionId,
    activityId: "speaking-a",
    transcription: "Synthetic technical recording",
    audioUrl: `data:audio/webm;codecs=opus;base64,${WEBM.toString("base64")}`,
    createdAt: NOW,
  });
  return value;
}
function storageUpload(submissionId = uid(83), bytes = WEBM) {
  const boundary = "----SyntheticBrowserBoundary";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="cacheControl"\r\n\r\n3600\r\n--${boundary}\r\nContent-Disposition: form-data; name=""; filename="blob"\r\nContent-Type: audio/webm;codecs=opus\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return [
    new URL(`${API}/storage/v1/object/speaking-audio/${scope.owner}/${submissionId}.webm`),
    {
      method: "POST",
      hasPostData: true,
      postDataEntries: [{ bytes: body.toString("base64") }],
      headers: {
        origin: APP,
        authorization: `Bearer ${scope.accessToken}`,
        apikey: scope.publicKey,
        "x-client-info": "synthetic-sdk",
        "x-upsert": "true",
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
    },
  ];
}
function uploaded() {
  const policy = seeded();
  assert.equal(
    policy.registerStorageSubmission(uid(83), {
      owner: scope.owner,
      state: pendingRecording(),
    }),
    true,
  );
  assert.equal(policy.mutationAllowed(...storageUpload()), true);
  return policy;
}

test("Storage requires explicit registration from the validated owner's current compiled state", () => {
  const policy = seeded();
  assert.equal(policy.mutationAllowed(...storageUpload()), false);
  for (const candidate of [
    { owner: uid(100), state: pendingRecording() },
    {
      owner: scope.owner,
      state: { ...pendingRecording(), courseId: "old-course" },
    },
    { owner: scope.owner, state: state() },
  ])
    assert.equal(policy.registerStorageSubmission(uid(83), candidate), false);
  const foreign = pendingRecording();
  foreign.speaking.at(-1).activityId = "foreign-activity";
  assert.equal(
    policy.registerStorageSubmission(uid(83), {
      owner: scope.owner,
      state: foreign,
    }),
    false,
  );
  assert.equal(
    policy.registerStorageSubmission(uid(83), {
      owner: scope.owner,
      state: pendingRecording(),
    }),
    true,
  );
  const [url] = storageUpload();
  assert.equal(
    policy.mutationAllowed(url, {
      method: "OPTIONS",
      headers: {
        origin: APP,
        "access-control-request-method": "POST",
        "access-control-request-headers": "apikey,authorization,x-client-info,x-upsert",
      },
    }),
    true,
  );
  assert.equal(policy.mutationAllowed(...storageUpload()), true);
  assert.equal(
    policy.mutationAllowed(...storageUpload()),
    false,
    "No overwrites or duplicate uploads",
  );
});

test("Storage binary body must be fully observable, bounded, genuine registered WebM bytes", () => {
  for (const alter of [
    (req) => {
      delete req.postDataEntries;
    },
    (req) => {
      req.hasPostData = false;
    },
    (req) => {
      req.postDataEntries[0].bytes = "invalid-base64";
    },
    (req) => {
      req.headers["content-type"] = "audio/wav";
    },
    (req) => {
      req.headers["content-length"] = "1";
    },
  ]) {
    const policy = seeded();
    policy.registerStorageSubmission(uid(83), {
      owner: scope.owner,
      state: pendingRecording(),
    });
    const [url, req] = storageUpload();
    alter(req);
    assert.equal(policy.mutationAllowed(url, req), false);
  }
  const policy = seeded();
  policy.registerStorageSubmission(uid(83), {
    owner: scope.owner,
    state: pendingRecording(),
  });
  assert.equal(
    policy.mutationAllowed(...storageUpload(uid(83), Buffer.from("RIFF-fake-webm"))),
    false,
  );
  const other = Buffer.from(WEBM);
  other[other.length - 1] = 1;
  assert.equal(policy.mutationAllowed(...storageUpload(uid(83), other)), false);
  assert.equal(
    policy.mutationAllowed(...storageUpload(uid(83), Buffer.alloc(1024 * 1024 + 1))),
    false,
  );
});

test("Storage paths, MIME, SDK headers and methods cannot expand the registered upload", () => {
  const policy = seeded();
  policy.registerStorageSubmission(uid(83), {
    owner: scope.owner,
    state: pendingRecording(),
  });
  const [url, req] = storageUpload();
  for (const changes of [
    { authorization: "Bearer another-owner" },
    { apikey: "wrong" },
    { origin: "http://evil.invalid" },
    { "x-upsert": "false" },
    { "content-profile": "private" },
    { "x-metadata": "extra" },
  ])
    assert.equal(
      policy.mutationAllowed(url, {
        ...req,
        headers: { ...req.headers, ...changes },
      }),
      false,
    );
  for (const changed of [
    url.href.replace(scope.owner, uid(100)),
    url.href.replace("speaking-audio", "other-bucket"),
    url.href.replace(uid(83), uid(84)),
    url.href.replace(".webm", ".wav"),
    url.href + "?upsert=true",
  ])
    assert.equal(policy.mutationAllowed(new URL(changed), req), false);
  for (const method of ["PUT", "DELETE", "PATCH"])
    assert.equal(policy.mutationAllowed(url, { ...req, method }), false);
});

test("accepted upload path is the only persisted audio path allowed for that submission", () => {
  const policy = uploaded(),
    remote = pendingRecording();
  const submission = remote.speaking.at(-1);
  submission.audioUrl = null;
  submission.audioPath = `${scope.owner}/${uid(83)}.webm`;
  assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(remote))), true);
  const row = [
    {
      id: uid(83),
      user_id: scope.owner,
      activity_id: "speaking-a",
      audio_path: submission.audioPath,
      transcription: submission.transcription,
      created_at: NOW,
    },
  ];
  assert.equal(policy.mutationAllowed(...rest("speaking_submissions", row)), true);
  row[0].audio_path = `${scope.owner}/${uid(84)}.webm`;
  assert.equal(policy.mutationAllowed(...rest("speaking_submissions", row)), false);
});

test("signed URL creation is bounded to one accepted path and exactly expiresIn=3600", () => {
  const policy = uploaded();
  const url = new URL(
    `${API}/storage/v1/object/sign/speaking-audio/${scope.owner}/${uid(83)}.webm`,
  );
  const headers = {
    origin: APP,
    authorization: `Bearer ${scope.accessToken}`,
    apikey: scope.publicKey,
    "x-client-info": "synthetic-sdk",
    "content-type": "application/json",
  };
  assert.equal(policy.mutationAllowed(url, request({ expiresIn: 3600 }, headers)), true);
  assert.equal(
    policy.mutationAllowed(url, {
      method: "OPTIONS",
      headers: {
        origin: APP,
        "access-control-request-method": "POST",
        "access-control-request-headers": "apikey,authorization,content-type,x-client-info",
      },
    }),
    true,
  );
  for (const body of [
    { expiresIn: 7200 },
    { expiresIn: 3600, transform: {} },
    { expiresIn: 3600, path: "other" },
  ])
    assert.equal(policy.mutationAllowed(url, request(body, headers)), false);
  assert.equal(
    policy.mutationAllowed(
      new URL(url.href.replace(uid(83), uid(84))),
      request({ expiresIn: 3600 }, headers),
    ),
    false,
  );
});

test("Storage read helper accepts only own paths already accepted by this policy", () => {
  const policy = uploaded();
  const signed = new URL(
    `${API}/storage/v1/object/sign/speaking-audio/${scope.owner}/${uid(83)}.webm?token=${"synthetic-server-token-".repeat(30)}`,
  );
  assert.equal(policy.storageReadAllowed(signed, { method: "GET", headers: {} }), true);
  assert.equal(policy.storageReadAllowed(signed, { method: "HEAD", headers: {} }), true);
  for (const changed of [
    signed.href.replace(scope.owner, uid(100)),
    signed.href.replace(uid(83), uid(84)),
    signed.href + "&token=duplicate",
    signed.href + "&download=true",
  ])
    assert.equal(
      policy.storageReadAllowed(new URL(changed), {
        method: "GET",
        headers: {},
      }),
      false,
    );
  assert.equal(policy.storageReadAllowed(signed, { method: "POST", headers: {} }), false);
  assert.equal(
    policy.storageReadAllowed(signed, {
      method: "GET",
      headers: { authorization: "Bearer another-owner" },
    }),
    false,
  );
  assert.equal(
    policy.mutationAllowed(signed, { method: "GET", headers: {} }),
    false,
    "Read helper must be wired explicitly",
  );
});

test("bounded number dictation and regional practice persist only explicitly mapped IDs", () => {
  const policy = createF3BrowserPolicy({
    ...scope,
    numberPromptIds: ["number-a"],
    regionalTopicIds: ["region-a"],
  });
  const value = state();
  value.numberAttempts = [
    {
      id: uid(501),
      promptId: "number-a",
      mode: "dictation",
      answer: "3",
      correct: true,
      score: 100,
      createdAt: NOW,
    },
  ];
  value.regionalAttempts = [
    {
      id: uid(502),
      topicId: "region-a",
      selectedAnswer: "A",
      correct: false,
      createdAt: NOW,
    },
  ];
  value.events.push(
    {
      id: uid(503),
      type: "number_correct",
      itemId: "number-a",
      createdAt: NOW,
    },
    {
      id: uid(504),
      type: "regional_check_wrong",
      itemId: "region-a",
      createdAt: NOW,
    },
  );
  assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), true);
});
for (const change of [
  (value) => {
    value.numberAttempts[0].promptId = "foreign-number";
  },
  (value) => {
    value.numberAttempts[0].mode = "speaking";
  },
  (value) => {
    value.numberAttempts[0].score = 99;
  },
  (value) => {
    value.numberAttempts[0].feedback = { accuracy: 100 };
  },
  (value) => {
    value.regionalAttempts[0].topicId = "foreign-region";
  },
  (value) => {
    value.regionalAttempts[0].owner = uid(999);
  },
  (value) => {
    value.regionalAttempts[0].id = "not-a-uuid";
  },
])
  test("fundamentals scope rejects foreign or fabricated attempts", () => {
    const policy = createF3BrowserPolicy({
      ...scope,
      numberPromptIds: ["number-a"],
      regionalTopicIds: ["region-a"],
    });
    const value = state();
    value.numberAttempts = [
      {
        id: uid(501),
        promptId: "number-a",
        mode: "dictation",
        answer: "3",
        correct: true,
        score: 100,
        createdAt: NOW,
      },
    ];
    value.regionalAttempts = [
      {
        id: uid(502),
        topicId: "region-a",
        selectedAnswer: "A",
        correct: false,
        createdAt: NOW,
      },
    ];
    change(value);
    assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), false);
  });
test("fundamentals default empty scopes cannot gain access by caller mutation", () => {
  const config = { ...scope, numberPromptIds: [], regionalTopicIds: [] },
    policy = createF3BrowserPolicy(config);
  config.regionalTopicIds.push("region-a");
  const value = state();
  value.regionalAttempts = [
    {
      id: uid(502),
      topicId: "region-a",
      selectedAnswer: "A",
      correct: true,
      createdAt: NOW,
    },
  ];
  assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), false);
});

function rehydratedRecording(submissionId = uid(83)) {
  const entry = pendingRecording(submissionId).speaking.at(-1);
  entry.audioPath = scope.owner + "/" + submissionId + ".webm";
  entry.audioUrl =
    API +
    "/storage/v1/object/sign/speaking-audio/" +
    entry.audioPath +
    "?token=synthetic-opaque-server-token";
  return entry;
}
function secondRecording() {
  const value = pendingRecording(uid(84));
  value.speaking.push(rehydratedRecording());
  return value;
}
test("accepted signed recording survives reload while a new local WebM is registered", () => {
  const policy = uploaded();
  assert.equal(
    policy.registerStorageSubmission(uid(84), {
      owner: scope.owner,
      state: secondRecording(),
    }),
    true,
  );
  assert.equal(policy.mutationAllowed(...storageUpload(uid(84))), true);
});
for (const [name, alter] of [
  [
    "unaccepted prior upload",
    (value) => {
      value.speaking.at(-1).id = uid(85);
      value.speaking.at(-1).audioPath = scope.owner + "/" + uid(85) + ".webm";
      value.speaking.at(-1).audioUrl = rehydratedRecording(uid(85)).audioUrl;
    },
  ],
  [
    "wrong owner URL",
    (value) => {
      value.speaking.at(-1).audioUrl = value.speaking
        .at(-1)
        .audioUrl.replace(scope.owner, uid(100));
    },
  ],
  [
    "wrong path ID",
    (value) => {
      value.speaking.at(-1).audioUrl = value.speaking.at(-1).audioUrl.replace(uid(83), uid(84));
    },
  ],
  [
    "missing accepted path",
    (value) => {
      delete value.speaking.at(-1).audioPath;
    },
  ],
  [
    "off-origin URL",
    (value) => {
      value.speaking.at(-1).audioUrl = value.speaking
        .at(-1)
        .audioUrl.replace(API, "https://example.invalid");
    },
  ],
  [
    "extra query",
    (value) => {
      value.speaking.at(-1).audioUrl += "&download=true";
    },
  ],
  [
    "duplicate token",
    (value) => {
      value.speaking.at(-1).audioUrl += "&token=second";
    },
  ],
  [
    "wrong activity",
    (value) => {
      value.speaking.at(-1).activityId = "choice-a";
    },
  ],
  [
    "raw object URL",
    (value) => {
      value.speaking.at(-1).audioUrl = value.speaking
        .at(-1)
        .audioUrl.replace("/object/sign/", "/object/");
    },
  ],
  [
    "pending recording is signed instead of local bytes",
    (value) => {
      const pending = value.speaking.find((e) => e.id === uid(84));
      pending.audioUrl = rehydratedRecording().audioUrl;
    },
  ],
])
  test("signed cached recording rejects " + name, () => {
    const policy = uploaded(),
      value = secondRecording();
    alter(value);
    assert.equal(
      policy.registerStorageSubmission(uid(84), {
        owner: scope.owner,
        state: value,
      }),
      false,
    );
  });
test("signed URL exception cannot inject remote primary state", () => {
  const policy = uploaded(),
    value = state();
  value.speaking.push(rehydratedRecording());
  assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), false);
});
function canonicalWav(length = 32044) {
  const bytes = Buffer.alloc(length);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24);
  bytes.writeUInt32LE(32000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(length - 44, 40);
  return bytes;
}
const segmentFields = () => ({
  courseId: scope.courseId,
  lessonId: "lesson-a",
  contentVersion: "1.0.0",
  sessionId: uid(80),
  revision: "1",
  segmentId: "segment-a",
  activityId: "speaking-a",
  attemptId: uid(81),
  answer: "Synthetic technical audio, manually typed text.",
});
function wavSegment(fields = segmentFields(), audio = canonicalWav(), extras = []) {
  const boundary = "----SyntheticSegmentBoundary";
  const parts = Object.entries(fields).map(([name, value]) =>
    Buffer.from('Content-Disposition: form-data; name="' + name + '"\r\n\r\n' + value),
  );
  parts.push(
    Buffer.concat([
      Buffer.from(
        'Content-Disposition: form-data; name="audio"; filename="attempt.wav"\r\nContent-Type: audio/wav\r\n\r\n',
      ),
      audio,
    ]),
  );
  parts.push(...extras.map((value) => Buffer.from(value)));
  const body = Buffer.concat([
    Buffer.from("--" + boundary + "\r\n"),
    ...parts.flatMap((part, index) =>
      index ? [Buffer.from("\r\n--" + boundary + "\r\n"), part] : [part],
    ),
    Buffer.from("\r\n--" + boundary + "--\r\n"),
  ]);
  return [
    new URL(APP + "/api/interactive-lessons/segment"),
    {
      method: "POST",
      hasPostData: true,
      headers: {
        origin: APP,
        "content-type": "multipart/form-data; boundary=" + boundary,
      },
      postDataEntries: [{ bytes: body.toString("base64") }],
    },
  ];
}
function speakingSession() {
  const policy = seeded();
  const value = classroomSession();
  value.runtime.phase = "speaking";
  assert.equal(policy.mutationAllowed(...app("/api/interactive-lessons/session", value)), true);
  return policy;
}
test("guided speaking accepts exact local multipart fields and canonical bounded WAV after runtime binding", () => {
  const policy = speakingSession();
  assert.equal(policy.mutationAllowed(...wavSegment()), true);
  assert.equal(policy.mutationAllowed(...wavSegment(segmentFields(), canonicalWav(640044))), true);
});
for (const [name, change] of [
  [
    "course",
    (value) => {
      value.courseId = "old-course";
    },
  ],
  [
    "lesson",
    (value) => {
      value.lessonId = "lesson-b";
    },
  ],
  [
    "session",
    (value) => {
      value.sessionId = uid(999);
    },
  ],
  [
    "segment",
    (value) => {
      value.segmentId = "foreign-segment";
    },
  ],
  [
    "activity",
    (value) => {
      value.activityId = "foreign-activity";
    },
  ],
  [
    "content version",
    (value) => {
      value.contentVersion = "2.0.0";
    },
  ],
  [
    "attempt ID",
    (value) => {
      value.attemptId = "not-a-uuid";
    },
  ],
  [
    "noncanonical revision",
    (value) => {
      value.revision = "01";
    },
  ],
  [
    "fraction revision",
    (value) => {
      value.revision = "1.5";
    },
  ],
  [
    "oversized revision",
    (value) => {
      value.revision = "2147483646";
    },
  ],
  [
    "blank transcript",
    (value) => {
      value.answer = " ";
    },
  ],
  [
    "long transcript",
    (value) => {
      value.answer = "x".repeat(3001);
    },
  ],
  [
    "owner/admin extra field",
    (value) => {
      value.userId = scope.owner;
    },
  ],
  [
    "missing field",
    (value) => {
      delete value.answer;
    },
  ],
])
  test("guided multipart rejects " + name, () => {
    const fields = segmentFields();
    change(fields);
    assert.equal(speakingSession().mutationAllowed(...wavSegment(fields)), false);
  });
for (const [name, mutate] of [
  [
    "missing observed binary",
    (req) => {
      delete req.postDataEntries;
    },
  ],
  [
    "text-only CDP body",
    (req) => {
      delete req.postDataEntries;
      req.postData = "file omitted";
    },
  ],
  [
    "unconfirmed body",
    (req) => {
      delete req.hasPostData;
    },
  ],
  [
    "truncated bytes",
    (req) => {
      const b = Buffer.from(req.postDataEntries[0].bytes, "base64");
      req.postDataEntries[0].bytes = b.subarray(0, b.length - 10).toString("base64");
    },
  ],
  [
    "wrong MIME",
    (req) => {
      req.headers["content-type"] = "audio/wav";
    },
  ],
  [
    "bad auth",
    (req) => {
      req.headers.authorization = "Bearer wrong";
    },
  ],
  [
    "bad key",
    (req) => {
      req.headers.apikey = "wrong";
    },
  ],
  [
    "off-origin",
    (req) => {
      req.headers.origin = "http://localhost:3100";
    },
  ],
  [
    "method PUT",
    (req) => {
      req.method = "PUT";
    },
  ],
  [
    "false length",
    (req) => {
      req.headers["content-length"] = "1";
    },
  ],
])
  test("guided multipart rejects " + name, () => {
    const [url, req] = wavSegment();
    mutate(req);
    assert.equal(speakingSession().mutationAllowed(url, req), false);
  });
for (const [name, mutate] of [
  ["stereo", (b) => b.writeUInt16LE(2, 22)],
  ["sample rate", (b) => b.writeUInt32LE(44100, 24)],
  ["compressed format", (b) => b.writeUInt16LE(3, 20)],
  ["bit depth", (b) => b.writeUInt16LE(8, 34)],
  ["invalid byte rate", (b) => b.writeUInt32LE(64000, 28)],
  ["block alignment", (b) => b.writeUInt16LE(4, 32)],
  ["RIFF size", (b) => b.writeUInt32LE(1, 4)],
  ["data size", (b) => b.writeUInt32LE(1, 40)],
  ["fmt chunk size", (b) => b.writeUInt32LE(18, 16)],
  ["wrong magic", (b) => b.write("OggS", 0)],
])
  test("guided WAV rejects " + name, () => {
    const bytes = canonicalWav();
    mutate(bytes);
    assert.equal(speakingSession().mutationAllowed(...wavSegment(segmentFields(), bytes)), false);
  });
test("guided multipart rejects unbound runtime, duplicate fields, routing, short/odd/oversized audio", () => {
  assert.equal(seeded().mutationAllowed(...wavSegment()), false);
  const policy = speakingSession();
  assert.equal(
    policy.mutationAllowed(
      ...wavSegment(segmentFields(), canonicalWav(), [
        'Content-Disposition: form-data; name="answer"\r\n\r\nsecond',
      ]),
    ),
    false,
  );
  for (const length of [44, 16042, 32045, 640046])
    assert.equal(
      policy.mutationAllowed(...wavSegment(segmentFields(), canonicalWav(length))),
      false,
    );
  for (const path of ["/api/ai/speaking", "/api/pronunciation", "/api/grade"]) {
    const [, req] = wavSegment();
    assert.equal(policy.mutationAllowed(new URL(APP + path), req), false);
  }
  const [url, req] = wavSegment();
  url.search = "?admin=true";
  assert.equal(policy.mutationAllowed(url, req), false);
});
function authPreflight() {
  return [
    new URL(API + "/auth/v1/user"),
    {
      method: "OPTIONS",
      headers: {
        origin: APP,
        "access-control-request-method": "GET",
        "access-control-request-headers":
          "apikey,authorization,x-client-info,x-supabase-api-version",
      },
    },
  ];
}
test("actual auth getUser preflight allows only GET fixed route and exact SDK headers", () => {
  assert.equal(seeded().mutationAllowed(...authPreflight()), true);
});
for (const [name, mutate] of [
  [
    "requested method",
    (url, req) => {
      req.headers["access-control-request-method"] = "POST";
    },
  ],
  [
    "actual method",
    (url, req) => {
      req.method = "POST";
    },
  ],
  [
    "route",
    (url) => {
      url.pathname = "/auth/v1/token";
    },
  ],
  [
    "query",
    (url) => {
      url.search = "?admin=true";
    },
  ],
  [
    "destination",
    (url) => {
      url.port = "55422";
    },
  ],
  [
    "origin",
    (url, req) => {
      req.headers.origin = "http://localhost:3100";
    },
  ],
  [
    "header removed",
    (url, req) => {
      req.headers["access-control-request-headers"] = "apikey,authorization,x-client-info";
    },
  ],
  [
    "header added",
    (url, req) => {
      req.headers["access-control-request-headers"] += ",content-type";
    },
  ],
  [
    "header duplicated",
    (url, req) => {
      req.headers["access-control-request-headers"] += ",apikey";
    },
  ],
  [
    "request header case duplicate",
    (url, req) => {
      req.headers.Origin = APP;
    },
  ],
])
  test("auth preflight rejects " + name, () => {
    const [url, req] = authPreflight();
    mutate(url, req);
    assert.equal(seeded().mutationAllowed(url, req), false);
  });

const retainedScope = () => [
  {
    id: uid(83),
    activityId: "speaking-a",
    audioPath: scope.owner + "/" + uid(83) + ".webm",
  },
];
function retainedPolicy() {
  return createF3BrowserPolicy({
    ...scope,
    retainedStorageSubmissions: retainedScope(),
  });
}
test("RLS-derived retained paths permit exact reload signing/read and remote path persistence", () => {
  const policy = retainedPolicy();
  const entry = rehydratedRecording();
  assert.equal(
    policy.storageReadAllowed(new URL(entry.audioUrl), {
      method: "GET",
      headers: {},
    }),
    true,
  );
  const url = new URL(entry.audioUrl);
  url.search = "";
  const req = {
    method: "POST",
    headers: {
      origin: APP,
      authorization: "Bearer " + scope.accessToken,
      apikey: scope.publicKey,
      "content-type": "application/json",
    },
    postData: JSON.stringify({ expiresIn: 3600 }),
  };
  assert.equal(policy.mutationAllowed(url, req), true);
  const value = state();
  value.speaking.push({ ...entry, audioUrl: null });
  assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), true);
  assert.equal(
    policy.registerStorageSubmission(uid(84), {
      owner: scope.owner,
      state: secondRecording(),
    }),
    true,
  );
  assert.equal(policy.mutationAllowed(...storageUpload(uid(84))), true);
});
test("retained paths can never register bytes or authorize re-upload/upsert", () => {
  const policy = retainedPolicy();
  assert.equal(
    policy.registerStorageSubmission(uid(83), {
      owner: scope.owner,
      state: pendingRecording(),
    }),
    false,
  );
  assert.equal(policy.mutationAllowed(...storageUpload()), false);
  const [url] = storageUpload();
  assert.equal(
    policy.mutationAllowed(url, {
      method: "OPTIONS",
      headers: {
        origin: APP,
        "access-control-request-method": "POST",
        "access-control-request-headers": "apikey,authorization,x-client-info,x-upsert",
      },
    }),
    false,
  );
  const value = state();
  value.speaking.push(rehydratedRecording());
  assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), false);
});
for (const [name, change] of [
  [
    "foreign owner path",
    (v) => {
      v[0].audioPath = uid(999) + "/" + uid(83) + ".webm";
    },
  ],
  [
    "foreign URL path",
    (v) => {
      v[0].audioPath = API + "/storage/v1/object/speaking-audio/" + v[0].audioPath;
    },
  ],
  [
    "mismatched UUID",
    (v) => {
      v[0].audioPath = scope.owner + "/" + uid(84) + ".webm";
    },
  ],
  [
    "invalid UUID",
    (v) => {
      v[0].id = "unknown";
    },
  ],
  [
    "unknown activity",
    (v) => {
      v[0].activityId = "foreign";
    },
  ],
  [
    "extra field",
    (v) => {
      v[0].bytes = "fake";
    },
  ],
  [
    "missing field",
    (v) => {
      delete v[0].audioPath;
    },
  ],
  [
    "duplicate entry",
    (v) => {
      v.push({ ...v[0] });
    },
  ],
])
  test("retained config rejects " + name, () => {
    const entries = retainedScope();
    change(entries);
    assert.throws(() => createF3BrowserPolicy({ ...scope, retainedStorageSubmissions: entries }));
  });
test("retained scope copies values and denies unknown signed path UUIDs", () => {
  const entries = retainedScope(),
    policy = createF3BrowserPolicy({
      ...scope,
      retainedStorageSubmissions: entries,
    });
  entries.push({
    id: uid(84),
    activityId: "speaking-a",
    audioPath: scope.owner + "/" + uid(84) + ".webm",
  });
  entries[0].id = uid(85);
  assert.equal(
    policy.storageReadAllowed(new URL(rehydratedRecording().audioUrl), {
      method: "GET",
      headers: {},
    }),
    true,
  );
  assert.equal(
    policy.storageReadAllowed(new URL(rehydratedRecording(uid(84)).audioUrl), {
      method: "GET",
      headers: {},
    }),
    false,
  );
});

test("multipart content version must also match the bound runtime scope", () => {
  const policy = seeded(),
    session = classroomSession();
  session.contentVersion = "2.0.0";
  session.runtime.evidenceScope.contentVersion = "2.0.0";
  assert.equal(policy.mutationAllowed(...app("/api/interactive-lessons/session", session)), true);
  assert.equal(policy.mutationAllowed(...wavSegment()), false);
  const conflict = classroomSession();
  assert.equal(policy.mutationAllowed(...app("/api/interactive-lessons/session", conflict)), false);
});

for (const path of ["user_course_state", "user_study_state"])
  test("compiled owner read and exact GET preflight " + path, () => {
    const policy = createF3BrowserPolicy(scope),
      url = new URL(API + "/rest/v1/" + path);
    url.searchParams.set("select", "state");
    url.searchParams.set("user_id", "eq." + scope.owner);
    if (path === "user_course_state") url.searchParams.set("course_id", "eq." + scope.courseId);
    const h = {
      origin: APP,
      apikey: scope.publicKey,
      authorization: "Bearer " + scope.accessToken,
      "accept-profile": "public",
      "x-client-info": "sdk",
    };
    assert.equal(policy.readAllowed(url, { method: "GET", headers: h }), true);
    for (const retry of ["1", "2", "3"])
      assert.equal(
        policy.readAllowed(url, { method: "GET", headers: { ...h, "x-retry-count": retry } }),
        true,
      );
    for (const retry of ["0", "4", "-1", "abc"])
      assert.equal(
        policy.readAllowed(url, { method: "GET", headers: { ...h, "x-retry-count": retry } }),
        false,
      );
    for (const requested of [
      "accept-profile,apikey,authorization,x-client-info",
      "accept-profile,apikey,authorization,x-client-info,x-retry-count",
    ])
      assert.equal(
        policy.mutationAllowed(url, {
          method: "OPTIONS",
          headers: {
            origin: APP,
            "access-control-request-method": "GET",
            "access-control-request-headers": requested,
          },
        }),
        true,
      );
    for (const change of [
      (u) => u.searchParams.set("user_id", "eq." + uid(800)),
      (u) => u.searchParams.set("select", "*"),
      (u) => u.searchParams.append("select", "state"),
      (u) => u.searchParams.set("order", "id"),
      (u) => (u.pathname = "/rest/v1/profiles"),
      (u) => (u.hostname = "localhost"),
    ]) {
      const u = new URL(url);
      change(u);
      assert.equal(policy.readAllowed(u, { method: "GET", headers: h }), false);
      assert.equal(
        policy.mutationAllowed(u, {
          method: "OPTIONS",
          headers: {
            origin: APP,
            "access-control-request-method": "GET",
            "access-control-request-headers": "accept-profile,apikey,authorization,x-client-info",
          },
        }),
        false,
      );
    }
    for (const changes of [
      { origin: "https://other.invalid" },
      { apikey: "other" },
      { authorization: "Bearer other" },
      { "accept-profile": "storage" },
      { "x-method-override": "DELETE" },
      { "x-unknown": "yes" },
    ])
      assert.equal(
        policy.readAllowed(url, { method: "GET", headers: { ...h, ...changes } }),
        false,
      );
    assert.equal(policy.readAllowed(url, { method: "POST", headers: h }), false);
    assert.equal(policy.readAllowed(url, { method: "GET", headers: h, postData: "{}" }), false);
    for (const requested of [
      "apikey,authorization,x-client-info",
      "accept-profile,apikey,authorization,x-client-info,sql",
      "accept-profile,apikey,authorization,x-client-info,apikey",
    ])
      assert.equal(
        policy.mutationAllowed(url, {
          method: "OPTIONS",
          headers: {
            origin: APP,
            "access-control-request-method": "GET",
            "access-control-request-headers": requested,
          },
        }),
        false,
      );
  });

const tourIdsC5 = [
  "dashboard",
  "course",
  "unit",
  "lesson",
  "basics",
  "alphabet",
  "numbers",
  "study-start",
  "study-running",
  "review",
  "assessment",
  "vocabulary",
  "mistakes",
  "history",
  "progress",
  "settings",
  "live-classes",
];
for (const tourId of tourIdsC5) {
  test("tour event accepted for exact local UI " + tourId, () => {
    const value = state();
    value.events.push({ id: uid(300), type: "page_tour_seen", itemId: tourId, createdAt: NOW });
    const policy = createF3BrowserPolicy(scope);
    assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), true);
  });
  test("tour id does not authorize another event " + tourId, () => {
    const value = state();
    value.events.push({ id: uid(300), type: "other_event", itemId: tourId, createdAt: NOW });
    const policy = createF3BrowserPolicy(scope);
    assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), false);
  });
}
for (const change of [
  { itemId: "foreign-course" },
  { itemId: "conversation" },
  { itemId: "describe" },
  { itemId: "micro-lesson" },
  { metadata: { extra: "arbitrary" } },
  { activityId: "choice-a" },
])
  test("adversarial tour scope remains denied " + JSON.stringify(change), () => {
    const value = state();
    value.events.push({
      id: uid(300),
      type: "page_tour_seen",
      itemId: "lesson",
      createdAt: NOW,
      ...change,
    });
    assert.equal(
      createF3BrowserPolicy(scope).mutationAllowed(...rest("user_course_state", snapshot(value))),
      false,
    );
  });

for (const change of [
  { itemId: undefined },
  { itemId: "choice-a" },
  { itemId: "choice-a", metadata: { extra: "x" } },
  { itemId: "choice-a", activityId: "choice-a" },
])
  test("tour mandatory branch rejects " + JSON.stringify(change), () => {
    const value = state();
    value.events.push({
      id: uid(300),
      type: "page_tour_seen",
      itemId: "lesson",
      createdAt: NOW,
      ...change,
    });
    assert.equal(
      createF3BrowserPolicy(scope).mutationAllowed(...rest("user_course_state", snapshot(value))),
      false,
    );
  });
for (const change of [
  {},
  { metadata: { itemId: "settings" } },
  { metadata: { itemId: "lesson", extra: "x" } },
  { metadata: {} },
  { activity_id: "choice-a" },
])
  test("tour normalized exact metadata " + JSON.stringify(change), () => {
    const value = state();
    value.events.push({ id: uid(300), type: "page_tour_seen", itemId: "lesson", createdAt: NOW });
    const policy = createF3BrowserPolicy(scope);
    assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), true);
    const row = {
      id: uid(300),
      user_id: scope.owner,
      course_id: scope.courseId,
      event_type: "page_tour_seen",
      activity_id: null,
      metadata: { itemId: "lesson" },
      created_at: NOW,
      ...change,
    };
    assert.equal(
      policy.mutationAllowed(...rest("study_events", [row])),
      Object.keys(change).length === 0,
    );
  });

test("settings device-list is read-only, owner-bound and exact; administrative RPCs remain denied", () => {
  const policy = seeded(),
    [url, req] = rpc("list_trusted_devices");
  assert.equal(policy.mutationAllowed(url, req), true);
  assert.equal(policy.mutationAllowed(...preflight(url, true)), true);
  for (const body of [
    { user_id: scope.owner },
    { p_device_id: uid(90) },
    { sql: "select 1" },
    [],
    null,
  ])
    assert.equal(policy.mutationAllowed(url, request(body, req.headers)), false);
  for (const changes of [
    { authorization: "Bearer wrong-owner" },
    { apikey: "wrong" },
    { origin: "http://evil.invalid" },
    { "content-profile": "private" },
    { prefer: "resolution=merge-duplicates" },
  ])
    assert.equal(
      policy.mutationAllowed(url, { ...req, headers: { ...req.headers, ...changes } }),
      false,
    );
  for (const method of ["GET", "DELETE", "PUT", "PATCH"])
    assert.equal(policy.mutationAllowed(url, { ...req, method }), false);
  const query = new URL(url);
  query.search = "?user_id=" + scope.owner;
  assert.equal(policy.mutationAllowed(query, req), false);
  for (const name of [
    "list_trusted_devices_extra",
    "register_trusted_device",
    "revoke_trusted_device",
    "resume_trusted_device",
    "execute_sql",
  ])
    assert.equal(policy.mutationAllowed(...rpc(name)), false);
  const [u, pre] = preflight(url, true);
  assert.equal(
    policy.mutationAllowed(u, {
      ...pre,
      headers: { ...pre.headers, "access-control-request-method": "DELETE" },
    }),
    false,
  );
  assert.equal(
    policy.mutationAllowed(u, {
      ...pre,
      headers: {
        ...pre.headers,
        "access-control-request-headers":
          "apikey,authorization,content-profile,content-type,prefer,x-client-info",
      },
    }),
    false,
  );
});

function sessionEventFixture(kind = "lesson_started", mode = "guided") {
  const value = state(),
    session = value.sessions[0];
  session.mode = mode;
  session.targetMinutes = mode === "guided" ? 15 : 5;
  if (kind === "lesson_finished") {
    session.finishedAt = NOW;
    value.activeSessionId = null;
  }
  const event = {
    id: uid(700),
    type: kind,
    itemId: session.id,
    createdAt: NOW,
    metadata:
      kind === "lesson_started"
        ? {
            courseId: scope.courseId,
            unitId: session.unitId,
            mode,
            targetMinutes: session.targetMinutes,
          }
        : { courseId: scope.courseId },
  };
  value.events.push(event);
  return { value, event, session };
}
for (const mode of ["guided", "difficulties"])
  for (const kind of ["lesson_started", "lesson_finished"])
    test(
      "canonical own-session event " + kind + " " + mode + " is owner/snapshot/metadata bound",
      () => {
        const { value, event } = sessionEventFixture(kind, mode),
          policy = createF3BrowserPolicy(scope);
        assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(value))), true);
        const row = {
          id: event.id,
          user_id: scope.owner,
          course_id: scope.courseId,
          event_type: kind,
          activity_id: null,
          metadata: { ...event.metadata, itemId: event.itemId },
          created_at: NOW,
        };
        assert.equal(policy.mutationAllowed(...rest("study_events", [row])), true);
        for (const patch of [
          { metadata: { ...row.metadata, itemId: uid(999) } },
          { metadata: { ...row.metadata, extra: true } },
          { metadata: {} },
          { user_id: uid(999) },
          { event_type: "other" },
          { activity_id: "choice-a" },
        ])
          assert.equal(
            policy.mutationAllowed(...rest("study_events", [{ ...row, ...patch }])),
            false,
          );
      },
    );
for (const [name, change] of [
  ["foreign-session", (f) => (f.event.itemId = uid(999))],
  ["wrong-type", (f) => (f.event.type = "other_event")],
  ["foreign-course", (f) => (f.event.metadata.courseId = "foreign")],
  ["foreign-unit", (f) => (f.event.metadata.unitId = "unit-b")],
  ["mode", (f) => (f.event.metadata.mode = "difficulties")],
  ["minutes", (f) => (f.event.metadata.targetMinutes = 45)],
  ["extra", (f) => (f.event.metadata.extra = true)],
  ["missing", (f) => delete f.event.metadata.unitId],
  ["timestamp", (f) => (f.event.createdAt = "2026-10-24T12:00:01.000Z")],
  ["activity", (f) => (f.event.activityId = "choice-a")],
])
  test("session event rejects " + name, () => {
    const f = sessionEventFixture();
    change(f);
    assert.equal(
      createF3BrowserPolicy(scope).mutationAllowed(...rest("user_course_state", snapshot(f.value))),
      false,
    );
  });

for (const [field, value] of [
  ["mode", "UNSUPPORTED"],
  ["targetMinutes", 999],
])
  test("finished session event rejects unsupported " + field, () => {
    const f = sessionEventFixture("lesson_finished");
    f.session[field] = value;
    assert.equal(
      createF3BrowserPolicy(scope).mutationAllowed(...rest("user_course_state", snapshot(f.value))),
      false,
    );
  });

for (const kind of ["lesson_started", "lesson_finished"])
  test("session event binding survives JSON object key reordering " + kind, () => {
    const f = sessionEventFixture(kind),
      policy = createF3BrowserPolicy(scope);
    assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(f.value))), true);
    const reloaded = structuredClone(f.value);
    reloaded.events.at(-1).metadata = Object.fromEntries(
      Object.entries(reloaded.events.at(-1).metadata).reverse(),
    );
    assert.equal(policy.mutationAllowed(...rest("user_course_state", snapshot(reloaded))), true);
  });

test("assessment feedback annotations require the exact metadata path and public span bounds", () => {
  const span = { text: "An expression", occurrence: 1, item: 0, role: "target" };
  for (const name of ["assessmentAttempts", "adaptiveAssessments"]) {
    const s = state();
    const r = structuredClone(s.assessmentAttempts[0]);
    s.assessmentAttempts = [];
    s.adaptiveAssessments = [];
    r.answers[0].presentation = { annotations: { feedback: [span] } };
    s[name] = [r];
    const [url, req] = rest("user_course_state", snapshot(s));
    assert.equal(createF3BrowserPolicy(scope).mutationAllowed(url, req), true);
    for (const bad of [
      [],
      Array(101).fill(span),
      [{ ...span, role: "admin" }],
      [{ ...span, text: " " }],
      [{ ...span, text: "a".repeat(501) }],
      [{ ...span, item: -1 }],
      [{ ...span, item: 101 }],
      [{ ...span, occurrence: 0 }],
      [{ ...span, occurrence: 101 }],
      [{ ...span, occurrence: 1.5 }],
      [{ ...span, extra: true }],
    ]) {
      const n = structuredClone(s);
      n[name][0].answers[0].presentation.annotations.feedback = bad;
      const [u, q] = rest("user_course_state", snapshot(n));
      assert.equal(createF3BrowserPolicy(scope).mutationAllowed(u, q), false);
    }
    for (const mutate of [
      (x) => {
        delete x[name][0].answers[0].presentation;
        x[name][0].answers[0]["presentation.annotations"] = { feedback: [span] };
      },
      (x) => (x.profile.feedback = [span]),
      (x) => (x[name][0].answers[0].feedback = [span]),
      (x) => (x[name][0].answers[0].presentation.feedback = [span]),
      (x) => (x[name][0].answers[0].presentation.annotations.aifeedback = [span]),
      (x) => (x[name][0].answers[0].presentation.annotations.Feedback = [span]),
      (x) => (x[name][0].courseId = "other-course"),
    ]) {
      const n = structuredClone(s);
      mutate(n);
      const [u, q] = rest("user_course_state", snapshot(n));
      assert.equal(createF3BrowserPolicy(scope).mutationAllowed(u, q), false);
    }
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const [u, q] = rest("user_course_state", snapshot(s));
      q.method = method;
      assert.equal(createF3BrowserPolicy(scope).mutationAllowed(u, q), false);
    }
  }
});

test("guided multipart binds the explicit compiled edition without opening other versions", () => {
  const policy = createF3BrowserPolicy({ ...scope, contentVersion: "1.4.0" }),
    session = classroomSession();
  session.contentVersion = "1.4.0";
  session.runtime.evidenceScope.contentVersion = "1.4.0";
  session.runtime.phase = "speaking";
  assert.equal(policy.mutationAllowed(...app("/api/interactive-lessons/session", session)), true);
  assert.equal(
    policy.mutationAllowed(...wavSegment({ ...segmentFields(), contentVersion: "1.4.0" })),
    true,
  );
  for (const version of ["1.0.0", "1.3.0", "1.4.1", "2.0.0", "remote"]) {
    assert.equal(
      policy.mutationAllowed(...wavSegment({ ...segmentFields(), contentVersion: version })),
      false,
    );
  }
  for (const version of [null, 1, "", "arbitrary", "1.4.0\n", "1.4.0/remote"]) {
    assert.throws(() => createF3BrowserPolicy({ ...scope, contentVersion: version }));
  }
});

test("signed participation is a bounded opaque field; it does not open arbitrary state metadata", () => {
  const valid =
    Buffer.from(JSON.stringify({ v: 1, owner: scope.owner, courseId: scope.courseId })).toString(
      "base64url",
    ) +
    "." +
    "a".repeat(43);
  const current = state();
  current.attempts[0].serverReceipt = valid;
  assert.equal(
    createF3BrowserPolicy(scope).mutationAllowed(...rest("user_course_state", snapshot(current))),
    true,
  );
  for (const token of [
    "",
    false,
    {},
    "x".repeat(17000),
    "payload.signature.extra",
    "https://foreign.example/key",
    "payload." + "a".repeat(42),
  ]) {
    const bad = state();
    bad.attempts[0].serverReceipt = token;
    assert.equal(
      createF3BrowserPolicy(scope).mutationAllowed(...rest("user_course_state", snapshot(bad))),
      false,
    );
  }
  const foreign = state();
  foreign.attempts[0].serverReceipt = valid;
  foreign.attempts[0].privateKey = "anything";
  assert.equal(
    createF3BrowserPolicy(scope).mutationAllowed(...rest("user_course_state", snapshot(foreign))),
    false,
  );
});
