const localTourIds = new Set([
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
]);
// Local browser-test boundary only. The caller independently verifies the real owner,
// local project identity and compiled catalogue before constructing this policy.
const APP = "http://127.0.0.1:3100";
const API = "http://127.0.0.1:55421";
const MAX_BODY = 1024 * 1024;
const skills = new Set(["vocabulary", "grammar", "listening", "writing", "speaking", "reading"]);
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const text = (value, max = 300) => typeof value === "string" && value.length <= max;
const id = (value) => text(value) && value.trim().length > 0 && !/[\u0000-\u001f]/u.test(value);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, allowed) =>
  object(value) && Object.keys(value).every((key) => allowed.includes(key));
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const date = (value) => text(value, 50) && Number.isFinite(Date.parse(value));
const nullable = (value, check) => value == null || check(value);
const list = (value, check, max = 5000) =>
  Array.isArray(value) && value.length <= max && value.every(check);
const empty = (value) => Array.isArray(value) && value.length === 0;
const sameSet = (left, right) =>
  left.length === right.length &&
  new Set(left).size === left.length &&
  left.every((value) => right.includes(value));
const sdkHeaders = [
  "apikey",
  "authorization",
  "content-profile",
  "content-type",
  "prefer",
  "x-client-info",
];
const rpcHeaders = sdkHeaders.filter((value) => value !== "prefer");
const fields = (names) => names.split(" ");
const tables = {
  user_course_state: [
    "user_id,course_id",
    fields("user_id course_id language_code state updated_at"),
  ],
  user_course_profiles: [
    "user_id,course_id",
    fields(
      "user_id course_id goal daily_minutes days_per_week current_level prior_knowledge variant_id learning_preferences self_reported_level onboarding_step onboarding_completed_at updated_at",
    ),
  ],
  user_activity_progress: ["user_id,activity_id", fields("user_id activity_id")],
  study_sessions: [
    "id",
    fields("id user_id unit_id started_at finished_at duration_seconds performance"),
  ],
  study_session_activities: [
    "session_id,position",
    fields("user_id session_id activity_id position planned_minutes finished_at performance"),
  ],
  exercise_attempts: [
    "id",
    fields("id user_id activity_id session_id answer is_correct score attempted_at"),
  ],
  user_vocabulary: ["id", fields("id user_id vocabulary_item_id status updated_at")],
  mistakes: [
    "id",
    fields(
      "id user_id unit_id course_id language_code topic_id activity_id category original_answer correct_answer explanation times_missed times_correct last_missed_at last_reviewed_at last_correct_at",
    ),
  ],
  review_schedules: [
    "id",
    fields(
      "id user_id user_vocabulary_id mistake_id next_review_at interval_days ease_factor review_count mastery_score consecutive_correct",
    ),
  ],
  user_review_targets: [
    "user_id,course_id,target_kind,target_id",
    fields("user_id course_id target_kind target_id payload schedule updated_at"),
  ],
  reviews: [
    "id",
    fields("id user_id schedule_id is_correct reviewed_at interval_before interval_after"),
  ],
  writing_submissions: ["id", fields("id user_id activity_id text created_at")],
  speaking_submissions: [
    "id",
    fields("id user_id activity_id audio_path transcription created_at"),
  ],
  study_events: ["id", fields("id user_id course_id event_type activity_id metadata created_at")],
  lesson_progress: [
    "user_id,lesson_id",
    fields("user_id lesson_id completion_percent completed_at updated_at"),
  ],
  unit_progress: [
    "user_id,unit_id",
    fields(
      "user_id unit_id content_version completion_percent participation_percent completed_at mastered_at exercise_score review_score assessment_score policy_state updated_at",
    ),
  ],
  skill_progress: [
    "user_id,course_id,skill",
    fields("user_id course_id skill practiced_count correct_count completed_count updated_at"),
  ],
};
const stateKeys = fields(
  "courseId languageCode profile completedActivityIds attempts vocabulary structureReviews pronunciationReviews structureAttempts mistakes sessions events reviews assessmentAttempts writing speaking numberAttempts regionalAttempts microLessonAttempts conversations imageDescriptions adaptiveAssessments adaptiveProgress activeSessionId",
);
const profileKeys = fields(
  "learningPreferences selfReportedLevel onboardingStep goal dailyMinutes daysPerWeek level priorKnowledge variantId onboarded",
);
const scheduleKeys = fields(
  "id nextReviewAt intervalDays easeFactor reviewCount masteryScore consecutiveCorrect",
);
const attemptKeys = fields(
  "interactiveReceipt id activityId answer correct skill createdAt sessionId variantId serverReceipt",
);
const writingKeys = fields("interactiveReceipt id activityId sessionId text createdAt feedback");
const speakingKeys = fields(
  "interactiveReceipt id activityId sessionId transcription audioUrl audioPath feedback practiceMode createdAt",
);
const sessionKeys = fields(
  "id unitId mode targetMinutes startedAt finishedAt durationSeconds activityIds correct wrong wordsReviewed plan cursor paused",
);
const mistakeKeys = fields(
  "id activityId courseId languageCode topicId category originalAnswer correctAnswer explanation timesMissed timesCorrect lastMissedAt lastReviewedAt lastCorrectAt schedule",
);
const resultKeys = fields(
  "id courseId assessmentId purpose method unitId lessonId contentVersion variantId startedAt finishedAt source status objectiveScore passed answers responseKey",
);
const runtimeKeys = fields(
  "schemaVersion evidenceScope segmentEvidence segmentAttemptSequences segmentFailures phase segmentIndex positionMs board completedSegmentIds checkpointPassed speakingSaved checkpointFailures slowdownCount resumePoint runtimePath message",
);
const scopeKeys = fields("userId courseId lessonId sessionId contentVersion definitionHash");
const forbiddenKeys = new Set(
  fields(
    "__proto__ prototype constructor versionsessionid installationid artifacthash sessionversion sessionversionid installationreference proto admin isadmin sql dml query rpc command",
  ),
);

export function createF3BrowserPolicy(config) {
  if (
    !object(config) ||
    !uuid(config.owner) ||
    !id(config.courseId) ||
    !id(config.languageId) ||
    !text(config.accessToken, 20000) ||
    !config.accessToken ||
    !text(config.publicKey, 20000) ||
    !config.publicKey ||
    /[\r\n]/.test(config.accessToken + config.publicKey)
  )
    throw new Error("Invalid local browser scope");
  const sets = {};
  for (const name of [
    "unitIds",
    "lessonIds",
    "activityIds",
    "vocabularyIds",
    "assessmentIds",
    "notificationIds",
    "segmentIds",
  ]) {
    const values = config[name];
    if (!list(values, id) || new Set(values).size !== values.length)
      throw new Error(`Invalid scope list: ${name}`);
    sets[name] = new Set(values);
  }
  for (const name of ["numberPromptIds", "regionalTopicIds"]) {
    const values = config[name] ?? [];
    if (!list(values, id) || new Set(values).size !== values.length)
      throw new Error("Invalid bounded fundamentals scope");
    sets[name] = new Set(values);
  }
  if (sets.unitIds.size !== 2 || !sets.lessonIds.size || !sets.activityIds.size)
    throw new Error("Expected a bounded two-unit compiled scope");
  // Copy all scope values: later caller mutations cannot expand this policy.
  const { owner, courseId, languageId, accessToken, publicKey, contentVersion = "1.0.0" } = config;
  if (typeof contentVersion !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(contentVersion))
    throw new Error("Invalid compiled content version");
  const notifications = [...sets.notificationIds];
  const known = (name, value) => sets[name].has(value);
  const curriculumId = (value) =>
    known("activityIds", value) ||
    known("vocabularyIds", value) ||
    known("numberPromptIds", value) ||
    known("regionalTopicIds", value);
  const bindings = Object.fromEntries(
    [
      "sessions",
      "attempts",
      "writing",
      "speaking",
      "vocabulary",
      "mistakes",
      "schedules",
      "reviews",
      "events",
      "targets",
      "interactive",
    ].map((key) => [key, new Map()]),
  );

  const pendingUploads = new Map(),
    acceptedUploads = new Map();
  // Supplied only by the consumer after an authenticated owner/course RLS read.
  // Retained paths support rehydration/signing, never registration or re-upload.
  const retained = config.retainedStorageSubmissions ?? [];
  if (
    !list(
      retained,
      (value) =>
        keys(value, ["id", "activityId", "audioPath"]) &&
        Object.keys(value).length === 3 &&
        uuid(value.id) &&
        known("activityIds", value.activityId) &&
        value.audioPath === `${owner}/${value.id}.webm`,
      50,
    ) ||
    new Set(retained.map((value) => value.id)).size !== retained.length
  )
    throw new Error("Invalid retained storage scope");
  for (const value of retained)
    acceptedUploads.set(value.id, { activity: value.activityId, bytes: null });
  function base64Bytes(value) {
    if (
      !text(value, MAX_BODY * 2) ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
    )
      return null;
    const bytes = Buffer.from(value, "base64");
    return bytes.length > 0 && bytes.length <= MAX_BODY && bytes.toString("base64") === value
      ? bytes
      : null;
  }
  function webm(bytes) {
    return (
      bytes &&
      bytes.length >= 16 &&
      bytes.length <= MAX_BODY &&
      bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
      bytes.subarray(0, 4096).includes(Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]))
    );
  }
  function dataWebm(value) {
    if (typeof value !== "string") return null;
    const match = /^data:audio\/webm(?:;codecs=opus)?;base64,([A-Za-z0-9+/=]+)$/.exec(value);
    const bytes = match && base64Bytes(match[1]);
    return webm(bytes) ? bytes : null;
  }
  function registerStorageSubmission(submissionId, candidate) {
    try {
      if (
        !uuid(submissionId) ||
        !keys(candidate, ["owner", "state"]) ||
        candidate.owner !== owner ||
        pendingUploads.has(submissionId) ||
        acceptedUploads.has(submissionId) ||
        pendingUploads.size + acceptedUploads.size >= 50
      )
        return false;
      const state = candidate.state;
      if (
        Buffer.byteLength(JSON.stringify(state), "utf8") > MAX_BODY ||
        !validateState(state, submissionId)
      )
        return false;
      const submission = state.speaking.find((entry) => entry.id === submissionId);
      const bytes = submission && dataWebm(submission.audioUrl);
      if (!bytes || !submission.transcription.trim()) return false;
      pendingUploads.set(submissionId, {
        bytes,
        activity: submission.activityId,
      });
      return true;
    } catch {
      return false;
    }
  }
  function storagePath(url, signing = false) {
    const prefix = `/storage/v1/object/${signing ? "sign/" : ""}speaking-audio/${owner}/`;
    if (!url.pathname.startsWith(prefix)) return null;
    const filename = url.pathname.slice(prefix.length);
    const submission = filename.endsWith(".webm") ? filename.slice(0, -5) : "";
    return uuid(submission) ? submission : null;
  }
  function storageCredentials(h) {
    return (
      h.authorization === `Bearer ${accessToken}` &&
      h.apikey === publicKey &&
      h.origin === APP &&
      !h["content-profile"] &&
      !h.prefer &&
      Object.keys(h)
        .filter((key) => key.startsWith("x-"))
        .every((key) => ["x-client-info", "x-upsert"].includes(key))
    );
  }
  function multipartWebm(request, h) {
    if (
      request.hasPostData !== true ||
      !list(
        request.postDataEntries,
        (entry) => keys(entry, ["bytes"]) && !!base64Bytes(entry.bytes),
        128,
      ) ||
      !request.postDataEntries.length
    )
      return null;
    const bytes = Buffer.concat(request.postDataEntries.map((entry) => base64Bytes(entry.bytes)));
    if (
      bytes.length > MAX_BODY ||
      (h["content-length"] !== undefined && h["content-length"] !== String(bytes.length))
    )
      return null;
    const match =
      /^multipart\/form-data;\s*boundary=(?:"([A-Za-z0-9_-]{1,70})"|([A-Za-z0-9_-]{1,70}))$/.exec(
        h["content-type"] ?? "",
      );
    if (!match) return null;
    const boundary = match[1] ?? match[2],
      serialized = bytes.toString("latin1");
    const start = `--${boundary}\r\n`,
      separator = `\r\n--${boundary}\r\n`;
    const ends = [`\r\n--${boundary}--\r\n`, `\r\n--${boundary}--`];
    const end = ends.find((value) => serialized.endsWith(value));
    if (!serialized.startsWith(start) || !end) return null;
    const parts = serialized.slice(start.length, -end.length).split(separator);
    if (
      parts.length !== 2 ||
      parts[0] !== 'Content-Disposition: form-data; name="cacheControl"\r\n\r\n3600'
    )
      return null;
    const split = parts[1].indexOf("\r\n\r\n");
    if (
      split < 0 ||
      !/^Content-Disposition: form-data; name=""; filename="blob"\r\nContent-Type: audio\/webm(?:;\s*codecs=opus)?$/i.test(
        parts[1].slice(0, split),
      )
    )
      return null;
    const file = Buffer.from(parts[1].slice(split + 4), "latin1");
    return webm(file) ? file : null;
  }
  // Complete CDP bytes are required; textual postData omits binary file bytes.
  function multipartSegment(request, h) {
    if (
      request.hasPostData !== true ||
      !list(
        request.postDataEntries,
        (entry) => keys(entry, ["bytes"]) && !!base64Bytes(entry.bytes),
        128,
      ) ||
      !request.postDataEntries.length
    )
      return null;
    const bytes = Buffer.concat(request.postDataEntries.map((entry) => base64Bytes(entry.bytes)));
    if (
      bytes.length > 750000 ||
      (h["content-length"] !== undefined && h["content-length"] !== String(bytes.length))
    )
      return null;
    const match =
      /^multipart\/form-data;\s*boundary=(?:"([A-Za-z0-9_-]{1,70})"|([A-Za-z0-9_-]{1,70}))$/.exec(
        h["content-type"] ?? "",
      );
    if (!match) return null;
    const boundary = match[1] ?? match[2],
      serialized = bytes.toString("latin1");
    const start = `--${boundary}\r\n`,
      separator = `\r\n--${boundary}\r\n`;
    const end = [`\r\n--${boundary}--\r\n`, `\r\n--${boundary}--`].find((value) =>
      serialized.endsWith(value),
    );
    if (!serialized.startsWith(start) || !end) return null;
    const parts = serialized.slice(start.length, -end.length).split(separator);
    const names = fields(
      "courseId lessonId contentVersion sessionId revision segmentId activityId attemptId answer",
    );
    if (parts.length !== names.length + 1) return null;
    const body = Object.create(null);
    let audio = null;
    for (const part of parts) {
      const split = part.indexOf("\r\n\r\n");
      if (split < 0) return null;
      const header = part.slice(0, split),
        value = Buffer.from(part.slice(split + 4), "latin1");
      if (
        header ===
        'Content-Disposition: form-data; name="audio"; filename="attempt.wav"\r\nContent-Type: audio/wav'
      ) {
        if (audio) return null;
        audio = value;
        continue;
      }
      const field = /^Content-Disposition: form-data; name="([A-Za-z]+)"$/.exec(header)?.[1];
      if (!names.includes(field) || Object.hasOwn(body, field)) return null;
      const decoded = value.toString("utf8");
      if (!Buffer.from(decoded, "utf8").equals(value)) return null;
      body[field] = decoded;
    }
    if (
      !names.every((name) => Object.hasOwn(body, name)) ||
      body.contentVersion !== contentVersion ||
      !/^[1-9][0-9]{0,9}$/.test(body.revision) ||
      Number(body.revision) > 2147483645 ||
      !body.answer.trim() ||
      !audio
    )
      return null;
    body.revision = Number(body.revision);
    // Same canonical mono PCM16/16kHz envelope enforced by the real segment route.
    if (
      audio.length < 16044 ||
      audio.length > 640044 ||
      (audio.length - 44) % 2 ||
      audio.toString("ascii", 0, 4) !== "RIFF" ||
      audio.toString("ascii", 8, 12) !== "WAVE" ||
      audio.toString("ascii", 12, 16) !== "fmt " ||
      audio.toString("ascii", 36, 40) !== "data" ||
      audio.readUInt32LE(4) !== audio.length - 8 ||
      audio.readUInt32LE(16) !== 16 ||
      audio.readUInt16LE(20) !== 1 ||
      audio.readUInt16LE(22) !== 1 ||
      audio.readUInt32LE(24) !== 16000 ||
      audio.readUInt32LE(28) !== 32000 ||
      audio.readUInt16LE(32) !== 2 ||
      audio.readUInt16LE(34) !== 16 ||
      audio.readUInt32LE(40) !== audio.length - 44
    )
      return null;
    return body;
  }
  function storageMutation(url, request, h) {
    const upload = storagePath(url),
      signing = storagePath(url, true);
    if (url.search || !storageCredentials(h)) return false;
    if (signing) {
      const body = parse(request);
      return (
        acceptedUploads.has(signing) &&
        !h["x-upsert"] &&
        h["content-type"] === "application/json" &&
        keys(body, ["expiresIn"]) &&
        body.expiresIn === 3600
      );
    }
    const registered = pendingUploads.get(upload);
    if (!registered || acceptedUploads.has(upload) || h["x-upsert"] !== "true") return false;
    const bytes = multipartWebm(request, h);
    if (!bytes || !bytes.equals(registered.bytes)) return false;
    acceptedUploads.set(upload, registered);
    pendingUploads.delete(upload);
    return true;
  }
  function storageReadAllowed(url, request) {
    try {
      if (!destination(url) || url.origin !== API || !["GET", "HEAD"].includes(request?.method))
        return false;
      const signing = storagePath(url, true),
        raw = storagePath(url);
      if (!acceptedUploads.has(signing ?? raw)) return false;
      const h = headers({ headers: request.headers ?? {} });
      if (
        !h ||
        (h.authorization && h.authorization !== `Bearer ${accessToken}`) ||
        (h.apikey && h.apikey !== publicKey) ||
        (h.origin && h.origin !== APP)
      )
        return false;
      const query = [...url.searchParams];
      return signing
        ? query.length === 1 &&
            query[0][0] === "token" &&
            text(query[0][1], 20000) &&
            query[0][1].length > 0 &&
            !/[\r\n]/.test(query[0][1])
        : !url.search && h.authorization === `Bearer ${accessToken}` && h.apikey === publicKey;
    } catch {
      return false;
    }
  }
  function headers(request) {
    if (!object(request?.headers)) return null;
    const normalized = Object.create(null);
    for (const [name, value] of Object.entries(request.headers)) {
      const lower = name.toLowerCase();
      if (Object.hasOwn(normalized, lower) || typeof value !== "string") return null;
      normalized[lower] = value;
    }
    if (normalized["x-http-method-override"] || normalized["x-method-override"]) return null;
    return normalized;
  }
  function destination(url) {
    return (
      url instanceof URL &&
      [APP, API].includes(url.origin) &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  }
  function parse(request) {
    if (!text(request.postData, MAX_BODY) || Buffer.byteLength(request.postData, "utf8") > MAX_BODY)
      return null;
    try {
      return JSON.parse(request.postData);
    } catch {
      return null;
    }
  }
  function authenticated(h) {
    return (
      h.authorization === `Bearer ${accessToken}` &&
      h.apikey === publicKey &&
      h.origin === APP &&
      h["content-profile"] === "public" &&
      h["content-type"] === "application/json"
    );
  }
  function referenceTree(value, depth = 0, trail = []) {
    if (depth > 24) return false;
    if (value === null || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "string") return value.length <= MAX_BODY;
    if (Array.isArray(value))
      return (
        value.length <= 5000 &&
        value.every((child, index) => referenceTree(child, depth + 1, [...trail, index]))
      );
    if (!object(value)) return false;
    for (const [key, child] of Object.entries(value)) {
      const normalized = key.replaceAll("_", "").replaceAll("-", "").toLowerCase();
      const exactAnnotationPath =
        trail.length === 6 &&
        ["assessmentAttempts", "adaptiveAssessments"].includes(trail[0]) &&
        integer(trail[1]) &&
        trail[2] === "answers" &&
        integer(trail[3]) &&
        trail[4] === "presentation" &&
        trail[5] === "annotations";
      const feedbackAnnotation =
        key === "feedback" &&
        exactAnnotationPath &&
        list(
          child,
          (span) =>
            keys(span, ["text", "occurrence", "item", "role"]) &&
            text(span.text, 500) &&
            span.text.trim().length > 0 &&
            Number.isSafeInteger(span.occurrence) &&
            span.occurrence >= 1 &&
            span.occurrence <= 100 &&
            integer(span.item) &&
            span.item <= 100 &&
            ["target", "source"].includes(span.role),
          100,
        ) &&
        child.length > 0;
      if (
        forbiddenKeys.has(normalized) ||
        (["feedback", "aifeedback"].includes(normalized) && child != null && !feedbackAnnotation) ||
        (normalized === "source" && child === "installed")
      )
        return false;
      const references = {
        unitid: "unitIds",
        lessonid: "lessonIds",
        activityid: "activityIds",
        vocabularyitemid: "vocabularyIds",
        vocabularyid: "vocabularyIds",
        assessmentid: "assessmentIds",
        segmentid: "segmentIds",
      };
      if (child != null && references[normalized] && !known(references[normalized], child))
        return false;
      if (child != null && ["userid", "owner"].includes(normalized) && child !== owner)
        return false;
      if (child != null && normalized === "courseid" && child !== courseId) return false;
      if (
        child != null &&
        ["languagecode", "languageid"].includes(normalized) &&
        child !== languageId
      )
        return false;
      if (
        normalized === "completedsegmentids" &&
        !list(child, (entry) => known("segmentIds", entry))
      )
        return false;
      if (
        ["completedactivityids", "activityids"].includes(normalized) &&
        !list(child, (entry) => known("activityIds", entry))
      )
        return false;
      if (!referenceTree(child, depth + 1, [...trail, key])) return false;
    }
    return true;
  }
  function schedule(value) {
    return (
      keys(value, scheduleKeys) &&
      uuid(value.id) &&
      date(value.nextReviewAt) &&
      ["intervalDays", "easeFactor", "reviewCount", "masteryScore", "consecutiveCorrect"].every(
        (key) => typeof value[key] === "number" && value[key] >= 0 && Number.isFinite(value[key]),
      )
    );
  }
  function preferences(value) {
    return (
      keys(value, fields("goal contexts skillPriorities skillWeights preferredSessionMinutes")) &&
      id(value.goal) &&
      list(value.contexts, id, 3) &&
      list(
        value.skillPriorities,
        (entry) => ["speaking", "listening", "reading", "writing"].includes(entry),
        2,
      ) &&
      keys(value.skillWeights, fields("speaking listening reading writing")) &&
      Object.values(value.skillWeights).every(
        (entry) => typeof entry === "number" && entry >= 0 && entry <= 1,
      ) &&
      [5, 15, 30, 45].includes(value.preferredSessionMinutes)
    );
  }
  function profile(value) {
    return (
      keys(value, profileKeys) &&
      preferences(value.learningPreferences) &&
      text(value.goal) &&
      integer(value.onboardingStep) &&
      integer(value.dailyMinutes) &&
      integer(value.daysPerWeek) &&
      value.level === "A1" &&
      ["none", "some", "returning"].includes(value.priorKnowledge) &&
      text(value.variantId) &&
      typeof value.onboarded === "boolean" &&
      nullable(value.selfReportedLevel, id)
    );
  }
  function plan(value, localMistakes) {
    return list(
      value,
      (entry) =>
        keys(entry, fields("kind id title minutes reviewItems")) &&
        text(entry.title) &&
        integer(entry.minutes) &&
        (entry.kind === "activity"
          ? known("activityIds", entry.id) && entry.reviewItems === undefined
          : entry.kind === "review" &&
            entry.id === "due" &&
            list(
              entry.reviewItems,
              (item) =>
                keys(item, ["kind", "id"]) &&
                (item.kind === "word"
                  ? known("vocabularyIds", item.id)
                  : item.kind === "mistake"
                    ? known("activityIds", item.id) || localMistakes.has(item.id)
                    : ["structure", "pronunciation"].includes(item.kind) && curriculumId(item.id)),
              100,
            )),
      100,
    );
  }
  function validateState(state, pendingStorageId = null) {
    if (
      !keys(state, stateKeys) ||
      state.courseId !== courseId ||
      state.languageCode !== languageId ||
      !referenceTree(state) ||
      !profile(state.profile)
    )
      return null;
    if (
      !list(
        state.numberAttempts,
        (entry) =>
          keys(entry, fields("id promptId mode answer correct score createdAt")) &&
          uuid(entry.id) &&
          known("numberPromptIds", entry.promptId) &&
          entry.mode === "dictation" &&
          text(entry.answer, 1000) &&
          typeof entry.correct === "boolean" &&
          entry.score === (entry.correct ? 100 : 0) &&
          date(entry.createdAt),
      )
    )
      return null;
    if (
      !list(
        state.regionalAttempts,
        (entry) =>
          keys(entry, fields("id topicId selectedAnswer correct createdAt")) &&
          uuid(entry.id) &&
          known("regionalTopicIds", entry.topicId) &&
          text(entry.selectedAnswer, 1000) &&
          typeof entry.correct === "boolean" &&
          date(entry.createdAt),
      )
    )
      return null;
    for (const key of ["microLessonAttempts", "conversations", "imageDescriptions"])
      if (!empty(state[key])) return null;
    for (const key of ["vocabulary", "mistakes", "structureReviews", "pronunciationReviews"])
      if (!object(state[key])) return null;
    for (const key of [
      "attempts",
      "writing",
      "speaking",
      "sessions",
      "events",
      "reviews",
      "assessmentAttempts",
      "adaptiveAssessments",
      "structureAttempts",
    ])
      if (!list(state[key], object)) return null;
    if (!list(state.completedActivityIds, (entry) => known("activityIds", entry))) return null;
    const next = Object.fromEntries(Object.keys(bindings).map((key) => [key, new Map()]));
    const add = (kind, key, value) => {
      if (next[kind].has(key)) throw new Error("Duplicate scoped record");
      next[kind].set(key, value);
    };
    for (const [target, value] of Object.entries(state.vocabulary)) {
      if (
        !known("vocabularyIds", target) ||
        !keys(value, ["id", "status", "schedule"]) ||
        !uuid(value.id) ||
        !["new", "learning", "known", "difficult"].includes(value.status) ||
        !schedule(value.schedule)
      )
        return null;
      add("vocabulary", value.id, target);
      add("schedules", value.schedule.id, {
        vocabulary: value.id,
        mistake: null,
      });
    }
    for (const [target, value] of Object.entries(state.mistakes)) {
      if (
        !known("activityIds", value?.activityId) ||
        ![value.activityId, value.id].includes(target) ||
        !keys(value, mistakeKeys) ||
        !uuid(value.id) ||
        !schedule(value.schedule)
      )
        return null;
      add("mistakes", value.id, value.activityId);
      add("schedules", value.schedule.id, {
        vocabulary: null,
        mistake: value.id,
      });
    }
    for (const session of state.sessions) {
      if (
        !keys(session, sessionKeys) ||
        !uuid(session.id) ||
        !known("unitIds", session.unitId) ||
        !list(session.activityIds, (value) => known("activityIds", value)) ||
        !plan(session.plan ?? [], next.mistakes) ||
        !date(session.startedAt) ||
        !nullable(session.finishedAt, date)
      )
        return null;
      add("sessions", session.id, {
        unit: session.unitId,
        activities: (session.plan ?? [])
          .filter((item) => item.kind === "activity")
          .map((item) => item.id),
      });
    }
    if (!nullable(state.activeSessionId, (value) => next.sessions.has(value))) return null;
    for (const kind of ["attempts", "writing", "speaking"])
      for (const entry of state[kind]) {
        if (
          !keys(
            entry,
            kind === "attempts" ? attemptKeys : kind === "writing" ? writingKeys : speakingKeys,
          ) ||
          !uuid(entry.id) ||
          !known("activityIds", entry.activityId) ||
          !nullable(entry.sessionId, (value) => next.sessions.has(value)) ||
          !date(entry.createdAt) ||
          (entry.interactiveReceipt !== undefined && entry.interactiveReceipt !== true)
        )
          return null;
        if (
          kind === "attempts" &&
          ((entry.serverReceipt !== undefined &&
            (typeof entry.serverReceipt !== "string" ||
              entry.serverReceipt.length > 16384 ||
              !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(entry.serverReceipt))) ||
            !text(entry.answer, 10000) ||
            !skills.has(entry.skill) ||
            !nullable(entry.correct, (value) => typeof value === "boolean"))
        )
          return null;
        if (kind === "writing" && !text(entry.text, 100000)) return null;
        if (kind === "speaking") {
          if (!text(entry.transcription, 100000)) return null;
          const accepted = acceptedUploads.get(entry.id);
          if (
            entry.audioPath != null &&
            (!accepted ||
              entry.audioPath !== `${owner}/${entry.id}.webm` ||
              accepted.activity !== entry.activityId)
          )
            return null;
          if (entry.audioUrl != null) {
            if (!pendingStorageId || (entry.id !== pendingStorageId && !accepted)) return null;
            const bytes = dataWebm(entry.audioUrl);
            if (!bytes) {
              // A prior accepted recording may have been rehydrated as a signed URL.
              // This exception exists only while registering another local recording.
              if (
                entry.id === pendingStorageId ||
                !accepted ||
                entry.audioPath !== `${owner}/${entry.id}.webm`
              )
                return null;
              let signed;
              try {
                signed = new URL(entry.audioUrl);
              } catch {
                return null;
              }
              if (
                storagePath(signed, true) !== entry.id ||
                !storageReadAllowed(signed, { method: "GET", headers: {} })
              )
                return null;
            } else if (accepted && (!accepted.bytes || !bytes.equals(accepted.bytes))) return null;
          }
        }
        add(kind, entry.id, {
          activity: entry.activityId,
          session: entry.sessionId ?? null,
          ...(kind === "speaking" ? { audioPath: entry.audioPath ?? null } : {}),
        });
      }
    for (const review of state.reviews) {
      if (
        !keys(
          review,
          fields("id scheduleId sessionId correct reviewedAt intervalBefore intervalAfter"),
        ) ||
        !uuid(review.id) ||
        !next.schedules.has(review.scheduleId) ||
        !nullable(review.sessionId, (value) => next.sessions.has(value))
      )
        return null;
      add("reviews", review.id, review.scheduleId);
    }
    for (const event of state.events) {
      const linkedSession = state.sessions.find((session) => session.id === event.itemId);
      let sessionEvent = false;
      if (linkedSession) {
        const names =
          event.type === "lesson_started"
            ? ["courseId", "unitId", "mode", "targetMinutes"]
            : ["courseId"];
        sessionEvent =
          ["guided", "difficulties"].includes(linkedSession.mode) &&
          [5, 15, 30, 45].includes(linkedSession.targetMinutes) &&
          event.activityId === undefined &&
          keys(event.metadata, names) &&
          Object.keys(event.metadata).length === names.length &&
          event.metadata.courseId === courseId &&
          (event.type === "lesson_started"
            ? event.createdAt === linkedSession.startedAt &&
              event.metadata.unitId === linkedSession.unitId &&
              ["guided", "difficulties"].includes(linkedSession.mode) &&
              [5, 15, 30, 45].includes(linkedSession.targetMinutes) &&
              event.metadata.mode === linkedSession.mode &&
              event.metadata.targetMinutes === linkedSession.targetMinutes
            : event.type === "lesson_finished" &&
              date(linkedSession.finishedAt) &&
              event.createdAt === linkedSession.finishedAt);
        if (!sessionEvent) return null;
      }
      const tourEvent = event.type === "page_tour_seen";
      if (
        tourEvent &&
        (!localTourIds.has(event.itemId) ||
          event.activityId !== undefined ||
          !(
            event.metadata === undefined ||
            (object(event.metadata) && Object.keys(event.metadata).length === 0)
          ))
      )
        return null;
      if (
        !keys(event, fields("id type createdAt activityId itemId metadata")) ||
        !uuid(event.id) ||
        !id(event.type) ||
        !date(event.createdAt) ||
        (event.itemId !== undefined &&
          !curriculumId(event.itemId) &&
          !known("unitIds", event.itemId) &&
          !known("lessonIds", event.itemId) &&
          !known("assessmentIds", event.itemId) &&
          !(
            event.type === "page_tour_seen" &&
            localTourIds.has(event.itemId) &&
            event.activityId === undefined &&
            (event.metadata === undefined ||
              (object(event.metadata) && Object.keys(event.metadata).length === 0))
          ) &&
          !next.mistakes.has(event.itemId) &&
          !sessionEvent)
      )
        return null;
      add("events", event.id, {
        type: event.type,
        ...(tourEvent ? { tourId: event.itemId } : {}),
        ...(sessionEvent
          ? {
              sessionMetadata:
                event.type === "lesson_started"
                  ? {
                      courseId,
                      unitId: linkedSession.unitId,
                      mode: linkedSession.mode,
                      targetMinutes: linkedSession.targetMinutes,
                      itemId: event.itemId,
                    }
                  : { courseId, itemId: event.itemId },
              createdAt: event.createdAt,
            }
          : {}),
        activity: known("activityIds", event.activityId) ? event.activityId : null,
      });
    }
    for (const [kind, values] of [
      ["structure", state.structureReviews],
      ["pronunciation", state.pronunciationReviews],
    ])
      for (const [target, value] of Object.entries(values)) {
        if (
          !curriculumId(target) ||
          !keys(value, fields("id activityId term referenceText lastAccuracy schedule")) ||
          !uuid(value.id) ||
          !schedule(value.schedule)
        )
          return null;
        add("targets", `${kind}:${target}`, true);
      }
    if (
      !state.structureAttempts.every((value) => curriculumId(value.structureId) && uuid(value.id))
    )
      return null;
    for (const result of [...state.assessmentAttempts, ...state.adaptiveAssessments]) {
      if (
        !keys(result, resultKeys) ||
        !uuid(result.id) ||
        !known("assessmentIds", result.assessmentId) ||
        !nullable(result.unitId, (value) => known("unitIds", value)) ||
        !nullable(result.courseId, (value) => value === courseId) ||
        (result.answers !== undefined &&
          !list(result.answers, (value) => known("activityIds", value.activityId)))
      )
        return null;
    }
    if (
      state.adaptiveProgress !== undefined &&
      !list(
        state.adaptiveProgress,
        (value) =>
          keys(value, fields("attemptId assessmentId startedAt responses answers")) &&
          uuid(value.attemptId) &&
          known("assessmentIds", value.assessmentId) &&
          list(
            value.responses,
            (entry) =>
              keys(entry, ["activityId", "answer"]) &&
              known("activityIds", entry.activityId) &&
              text(entry.answer, 100000),
            1000,
          ),
      )
    )
      return null;
    return next;
  }
  function commit(next) {
    // Retain prior accepted bindings for normalized writes queued across asynchronous saves.
    for (const [kind, entries] of Object.entries(next))
      for (const [key, value] of entries) {
        const old = bindings[kind].get(key);
        if (kind === "sessions" && old !== undefined) {
          if (old.unit !== value.unit) return false;
        } else if (old !== undefined && JSON.stringify(old) !== JSON.stringify(value)) return false;
      }
    for (const [kind, entries] of Object.entries(next))
      for (const [key, value] of entries) {
        const old = bindings[kind].get(key);
        bindings[kind].set(
          key,
          kind === "sessions" && old
            ? {
                unit: value.unit,
                activities: [...new Set([...old.activities, ...value.activities])],
              }
            : value,
        );
      }
    return true;
  }
  function routeQuery(url, table, rows) {
    const query = [...url.searchParams];
    if (
      query.some(([key]) => !["on_conflict", "columns"].includes(key)) ||
      new Set(query.map(([key]) => key)).size !== query.length ||
      url.searchParams.get("on_conflict") !== tables[table][0]
    )
      return false;
    const value = url.searchParams.get("columns");
    if (table === "user_course_state") return value === null;
    if (!value) return false;
    const columns = value.split(",");
    if (
      new Set(columns).size !== columns.length ||
      columns.some(
        (column) => !/^"[a-z_]+"$/.test(column) || !tables[table][1].includes(column.slice(1, -1)),
      )
    )
      return false;
    return (
      !rows || rows.every((row) => Object.keys(row).every((key) => columns.includes(`"${key}"`)))
    );
  }
  function rowTypes(row) {
    for (const [key, value] of Object.entries(row)) {
      if (
        [
          "updated_at",
          "created_at",
          "started_at",
          "finished_at",
          "attempted_at",
          "next_review_at",
          "last_missed_at",
          "last_reviewed_at",
          "last_correct_at",
          "completed_at",
          "mastered_at",
          "onboarding_completed_at",
          "reviewed_at",
        ].includes(key) &&
        !nullable(value, date)
      )
        return false;
      if (
        [
          "duration_seconds",
          "position",
          "planned_minutes",
          "times_missed",
          "times_correct",
          "review_count",
          "consecutive_correct",
          "daily_minutes",
          "days_per_week",
          "onboarding_step",
          "practiced_count",
          "correct_count",
          "completed_count",
        ].includes(key) &&
        !integer(value)
      )
        return false;
      if (
        [
          "score",
          "completion_percent",
          "participation_percent",
          "exercise_score",
          "review_score",
          "assessment_score",
          "mastery_score",
        ].includes(key) &&
        !nullable(value, (entry) => typeof entry === "number" && entry >= 0 && entry <= 100)
      )
        return false;
      if (
        ["interval_days", "ease_factor", "interval_before", "interval_after"].includes(key) &&
        !(typeof value === "number" && Number.isFinite(value) && value >= 0)
      )
        return false;
      if (key === "is_correct" && !nullable(value, (entry) => typeof entry === "boolean"))
        return false;
      if (
        [
          "answer",
          "metadata",
          "performance",
          "learning_preferences",
          "policy_state",
          "schedule",
          "payload",
        ].includes(key) &&
        !object(value)
      )
        return false;
    }
    return true;
  }
  function rowAllowed(table, row) {
    if (
      !keys(row, tables[table][1]) ||
      !tables[table][1].every((key) => Object.hasOwn(row, key)) ||
      row.user_id !== owner ||
      !referenceTree(row) ||
      !rowTypes(row)
    )
      return false;
    const match = (kind) => bindings[kind].get(row.id);
    switch (table) {
      case "user_course_profiles":
        return row.course_id === courseId && preferences(row.learning_preferences);
      case "user_activity_progress":
        return known("activityIds", row.activity_id);
      case "study_sessions":
        return (
          match("sessions")?.unit === row.unit_id &&
          plan(row.performance?.plan ?? [], bindings.mistakes) &&
          list(row.performance?.activityIds, (value) => known("activityIds", value))
        );
      case "study_session_activities":
        return (
          bindings.sessions.get(row.session_id)?.activities.includes(row.activity_id) === true &&
          integer(row.position) &&
          row.position > 0
        );
      case "exercise_attempts":
        return (
          match("attempts")?.activity === row.activity_id &&
          match("attempts")?.session === row.session_id &&
          keys(row.answer, ["text"]) &&
          text(row.answer.text, 10000)
        );
      case "user_vocabulary":
        return (
          match("vocabulary") === row.vocabulary_item_id &&
          known("vocabularyIds", row.vocabulary_item_id)
        );
      case "mistakes":
        return (
          match("mistakes") === row.activity_id &&
          row.course_id === courseId &&
          row.language_code === languageId &&
          known("unitIds", row.unit_id)
        );
      case "review_schedules":
        return (
          !!match("schedules") &&
          match("schedules").vocabulary === row.user_vocabulary_id &&
          match("schedules").mistake === row.mistake_id
        );
      case "user_review_targets":
        return (
          row.course_id === courseId &&
          bindings.targets.has(`${row.target_kind}:${row.target_id}`) &&
          (row.target_kind === "structure"
            ? keys(row.payload, [])
            : keys(row.payload, fields("activityId term referenceText lastAccuracy"))) &&
          schedule(row.schedule)
        );
      case "reviews":
        return match("reviews") === row.schedule_id && bindings.schedules.has(row.schedule_id);
      case "writing_submissions":
        return match("writing")?.activity === row.activity_id && text(row.text, 100000);
      case "speaking_submissions":
        return (
          match("speaking")?.activity === row.activity_id &&
          row.audio_path === (match("speaking")?.audioPath ?? null) &&
          text(row.transcription, 100000)
        );
      case "study_events":
        return (
          row.course_id === courseId &&
          match("events")?.type === row.event_type &&
          match("events")?.activity === row.activity_id &&
          (!match("events")?.sessionMetadata ||
            (row.created_at === match("events").createdAt &&
              keys(row.metadata, Object.keys(match("events").sessionMetadata)) &&
              Object.keys(row.metadata).length ===
                Object.keys(match("events").sessionMetadata).length &&
              Object.entries(match("events").sessionMetadata).every(
                ([key, value]) => row.metadata[key] === value,
              ))) &&
          (row.event_type !== "page_tour_seen" ||
            (row.activity_id === null &&
              keys(row.metadata, ["itemId"]) &&
              Object.keys(row.metadata).length === 1 &&
              row.metadata.itemId === match("events")?.tourId))
        );
      case "lesson_progress":
        return (
          known("lessonIds", row.lesson_id) &&
          row.completion_percent >= 0 &&
          row.completion_percent <= 100
        );
      case "unit_progress":
        return (
          known("unitIds", row.unit_id) &&
          row.completion_percent >= 0 &&
          row.completion_percent <= 100 &&
          row.participation_percent >= 0 &&
          row.participation_percent <= 100
        );
      case "skill_progress":
        return (
          row.course_id === courseId &&
          skills.has(row.skill) &&
          [row.practiced_count, row.correct_count, row.completed_count].every(integer)
        );
      default:
        return false;
    }
  }
  function evidenceScope(value, lesson) {
    return (
      keys(value, scopeKeys) &&
      value.userId === owner &&
      value.courseId === courseId &&
      value.lessonId === lesson &&
      uuid(value.sessionId) &&
      id(value.contentVersion) &&
      /^[a-f0-9]{64}$/.test(value.definitionHash)
    );
  }
  function application(url, body) {
    if (!object(body) || body.courseId !== courseId || !referenceTree(body)) return false;
    switch (url.pathname) {
      case "/api/course/active":
        return (
          keys(body, fields("courseId source expectedRevision operationId")) &&
          (body.source === undefined || body.source === "compiled") &&
          (body.expectedRevision === undefined || integer(body.expectedRevision)) &&
          (body.operationId === undefined || uuid(body.operationId))
        );
      case "/api/grade":
        return (
          keys(body, fields("courseId activityId answer")) &&
          known("activityIds", body.activityId) &&
          text(body.answer, 1000)
        );
      case "/api/assessments":
        return (
          keys(body, fields("courseId assessmentId attemptId startedAt responses")) &&
          known("assessmentIds", body.assessmentId) &&
          uuid(body.attemptId) &&
          date(body.startedAt) &&
          list(
            body.responses,
            (value) =>
              keys(value, ["activityId", "answer"]) &&
              known("activityIds", value.activityId) &&
              text(value.answer, 10000),
            100,
          ) &&
          body.responses.length > 0
        );
      case "/api/interactive-lessons/session": {
        if (
          !keys(body, fields("courseId lessonId contentVersion revision runtime")) ||
          !known("lessonIds", body.lessonId) ||
          !id(body.contentVersion) ||
          !(body.revision === null || (integer(body.revision) && body.revision > 0)) ||
          !keys(body.runtime, runtimeKeys) ||
          !runtimeKeys.every((key) => Object.hasOwn(body.runtime, key)) ||
          body.runtime.schemaVersion !== 2 ||
          !list(body.runtime.completedSegmentIds, (value) => known("segmentIds", value), 256) ||
          !list(
            body.runtime.runtimePath,
            (value) =>
              keys(value, ["id", "segmentId", "kind", "reason"]) &&
              id(value.id) &&
              known("segmentIds", value.segmentId) &&
              ["canonical", "reinforcement"].includes(value.kind),
            257,
          )
        )
          return false;
        if (
          !["checkpointPassed", "speakingSaved"].every(
            (key) => typeof body.runtime[key] === "boolean",
          ) ||
          !["segmentIndex", "positionMs", "checkpointFailures", "slowdownCount"].every((key) =>
            integer(body.runtime[key]),
          ) ||
          !keys(
            body.runtime.board,
            fields(
              "elements highlightedIds translationVisible caption captionPresentation teacherState",
            ),
          ) ||
          !list(body.runtime.board.elements, object, 24) ||
          !list(body.runtime.board.highlightedIds, id, 8) ||
          typeof body.runtime.board.translationVisible !== "boolean" ||
          !text(body.runtime.board.caption, 300) ||
          !["speaking", "paused", "listening"].includes(body.runtime.board.teacherState) ||
          !text(body.runtime.message, 1500)
        )
          return false;
        if (
          body.runtime.resumePoint !== null &&
          (!keys(
            body.runtime.resumePoint,
            fields("segmentId playbackPositionMs anchorMs board reason"),
          ) ||
            !known("segmentIds", body.runtime.resumePoint.segmentId) ||
            !integer(body.runtime.resumePoint.playbackPositionMs) ||
            !integer(body.runtime.resumePoint.anchorMs) ||
            !object(body.runtime.resumePoint.board))
        )
          return false;
        const scope = body.runtime.evidenceScope;
        if (
          scope !== null &&
          (!evidenceScope(scope, body.lessonId) || scope.contentVersion !== body.contentVersion)
        )
          return false;
        if (
          !object(body.runtime.segmentEvidence) ||
          !object(body.runtime.segmentAttemptSequences) ||
          !object(body.runtime.segmentFailures) ||
          [
            body.runtime.segmentEvidence,
            body.runtime.segmentAttemptSequences,
            body.runtime.segmentFailures,
          ].some((value) => Object.keys(value).some((key) => !known("segmentIds", key))) ||
          !integer(body.runtime.segmentIndex) ||
          !integer(body.runtime.positionMs) ||
          ![
            "idle",
            "presenting",
            "paused",
            "intervening",
            "checkpoint",
            "speaking",
            "reinforcement",
            "completed",
            "error",
          ].includes(body.runtime.phase) ||
          !object(body.runtime.board)
        )
          return false;
        for (const value of Object.values(body.runtime.segmentEvidence))
          if (
            !evidenceScope(
              Object.fromEntries(scopeKeys.map((key) => [key, value[key]])),
              body.lessonId,
            ) ||
            !known("activityIds", value.activityId)
          )
            return false;
        if (scope) {
          if (
            bindings.interactive.has(scope.sessionId) &&
            (bindings.interactive.get(scope.sessionId).lessonId !== body.lessonId ||
              bindings.interactive.get(scope.sessionId).contentVersion !== body.contentVersion)
          )
            return false;
          bindings.interactive.set(scope.sessionId, {
            lessonId: body.lessonId,
            contentVersion: body.contentVersion,
          });
        }
        return true;
      }
      case "/api/interactive-lessons/segment":
        return (
          keys(
            body,
            fields(
              "courseId lessonId contentVersion sessionId revision segmentId activityId attemptId answer",
            ),
          ) &&
          known("lessonIds", body.lessonId) &&
          id(body.contentVersion) &&
          bindings.interactive.get(body.sessionId)?.lessonId === body.lessonId &&
          bindings.interactive.get(body.sessionId)?.contentVersion === body.contentVersion &&
          integer(body.revision) &&
          body.revision > 0 &&
          known("segmentIds", body.segmentId) &&
          known("activityIds", body.activityId) &&
          uuid(body.attemptId) &&
          text(body.answer, 3000)
        );
      default:
        return false;
    }
  }
  function compiledReadQuery(url) {
    if (!destination(url) || url.origin !== API) return false;
    const expected =
      url.pathname === "/rest/v1/user_course_state"
        ? { select: "state", user_id: "eq." + owner, course_id: "eq." + courseId }
        : url.pathname === "/rest/v1/user_study_state"
          ? { select: "state", user_id: "eq." + owner }
          : null;
    if (!expected) return false;
    const entries = [...url.searchParams];
    return (
      entries.length === Object.keys(expected).length &&
      new Set(entries.map((x) => x[0])).size === entries.length &&
      entries.every(([k, v]) => expected[k] === v)
    );
  }
  function readAllowed(url, request) {
    try {
      if (
        !compiledReadQuery(url) ||
        request.method !== "GET" ||
        request.hasPostData === true ||
        request.postData
      )
        return false;
      const h = headers(request);
      return (
        !!h &&
        h.origin === APP &&
        h.authorization === "Bearer " + accessToken &&
        h.apikey === publicKey &&
        h["accept-profile"] === "public" &&
        !h["content-profile"] &&
        !h.prefer &&
        (h["x-retry-count"] === undefined || /^[1-3]$/.test(h["x-retry-count"])) &&
        Object.keys(h)
          .filter((k) => k.startsWith("x-"))
          .every((k) => ["x-client-info", "x-retry-count"].includes(k))
      );
    } catch {
      return false;
    }
  }
  function compiledReadPreflight(url, h) {
    if (!compiledReadQuery(url) || h["access-control-request-method"] !== "GET") return false;
    const requested = (h["access-control-request-headers"] ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase());
    const base = ["accept-profile", "apikey", "authorization", "x-client-info"];
    return sameSet(requested, base) || sameSet(requested, [...base, "x-retry-count"]);
  }
  function mutationAllowed(url, request) {
    try {
      if (!destination(url)) return false;
      const h = headers(request);
      if (!h || h.origin !== APP) return false;
      const table =
        url.origin === API && url.pathname.startsWith("/rest/v1/")
          ? url.pathname.slice("/rest/v1/".length)
          : null;
      if (request.method === "OPTIONS") {
        if (url.origin !== API) return false;
        if (url.pathname === "/auth/v1/user")
          return (
            !url.search &&
            h["access-control-request-method"] === "GET" &&
            sameSet(
              (h["access-control-request-headers"] ?? "")
                .split(",")
                .map((value) => value.trim().toLowerCase()),
              ["apikey", "authorization", "x-client-info", "x-supabase-api-version"],
            )
          );
        if (h["access-control-request-method"] === "GET") return compiledReadPreflight(url, h);
        if (h["access-control-request-method"] !== "POST") return false;
        if (url.pathname.startsWith("/storage/v1/")) {
          const upload = storagePath(url),
            signing = storagePath(url, true);
          if (url.search || !(pendingUploads.has(upload) || acceptedUploads.has(signing)))
            return false;
          return sameSet(
            (h["access-control-request-headers"] ?? "")
              .split(",")
              .map((value) => value.trim().toLowerCase()),
            signing
              ? ["apikey", "authorization", "content-type", "x-client-info"]
              : ["apikey", "authorization", "x-client-info", "x-upsert"],
          );
        }
        const knownRpc =
          [
            "/rest/v1/rpc/claim_feature_announcements",
            "/rest/v1/rpc/mfa_access_allowed",
            "/rest/v1/rpc/list_trusted_devices",
          ].includes(url.pathname) && !url.search;
        if (!(Object.hasOwn(tables, table) && routeQuery(url, table)) && !knownRpc) return false;
        return sameSet(
          (h["access-control-request-headers"] ?? "")
            .split(",")
            .map((value) => value.trim().toLowerCase()),
          knownRpc ? rpcHeaders : sdkHeaders,
        );
      }
      if (request.method !== "POST") return false;
      if (url.origin === API && url.pathname.startsWith("/storage/v1/"))
        return storageMutation(url, request, h);
      const body = parse(request);
      if (url.origin === APP) {
        if (
          url.search ||
          (h.authorization && h.authorization !== `Bearer ${accessToken}`) ||
          (h.apikey && h.apikey !== publicKey)
        )
          return false;
        if (h["content-type"] === "application/json") return application(url, body);
        return (
          url.pathname === "/api/interactive-lessons/segment" &&
          application(url, multipartSegment(request, h))
        );
      }
      if (
        ["/rest/v1/rpc/mfa_access_allowed", "/rest/v1/rpc/list_trusted_devices"].includes(
          url.pathname,
        )
      )
        return (
          !url.search &&
          authenticated(h) &&
          !h.prefer &&
          keys(body, []) &&
          Object.keys(body).length === 0
        );
      if (
        !Object.hasOwn(tables, table) ||
        !authenticated(h) ||
        h.prefer !== "resolution=merge-duplicates"
      )
        return false;
      const rows = table === "user_course_state" ? [body] : body;
      if (!list(rows, object) || !rows.length || !routeQuery(url, table, rows)) return false;
      if (table === "user_course_state") {
        if (
          rows.length !== 1 ||
          !keys(body, tables[table][1]) ||
          body.user_id !== owner ||
          body.course_id !== courseId ||
          body.language_code !== languageId ||
          !date(body.updated_at)
        )
          return false;
        const next = validateState(body.state);
        return !!next && commit(next);
      }
      return rows.every((row) => rowAllowed(table, row));
    } catch {
      return false;
    }
  }
  function expectedLocalBlock(url, request) {
    try {
      if (
        !destination(url) ||
        url.origin !== API ||
        url.pathname !== "/rest/v1/rpc/claim_feature_announcements" ||
        url.search ||
        request.method !== "POST" ||
        !notifications.length
      )
        return false;
      const h = headers(request),
        body = parse(request);
      return (
        !!h &&
        authenticated(h) &&
        keys(body, ["p_ids"]) &&
        Array.isArray(body.p_ids) &&
        sameSet(body.p_ids, notifications)
      );
    } catch {
      return false;
    }
  }
  return Object.freeze({
    mutationAllowed,
    expectedLocalBlock,
    registerStorageSubmission,
    storageReadAllowed,
    readAllowed,
  });
}
