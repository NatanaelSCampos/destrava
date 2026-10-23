import { createHash } from "node:crypto";
import { z } from "zod";
import { evaluateWritingText } from "@/engine/text/representation";
import { objectiveActivityTypes } from "@/content/activity-data";
import { serverAssessmentResultSchema } from "@/content/assessment-results";
import { packageLimits } from "@/content/package-contract";
import { sameContentReference } from "@/domain/course-installations/artifact";
import type { ResolvedSession, VersionEvidence } from "@/domain/course-installations/contracts";
import { readCourseState, readPersistedCourseState } from "@/domain/study/course-state-storage";
import {
  recordAttempt,
  recordServerAssessment,
  type StudyState,
  type StudyRecordingContext,
} from "@/domain/study/study-state";
import {
  learningPreferencesSchema,
  selfReportedLevelSchema,
} from "@/domain/study/learning-preferences";
import { InstalledStudyError } from "./contracts";

const date = z.iso.datetime({ offset: true });
const identifier = z.string().min(1).max(1024);
const profileSchema = z
  .object({
    learningPreferences: learningPreferencesSchema,
    selfReportedLevel: selfReportedLevelSchema.nullable(),
    onboardingStep: z.number().int().min(0).max(10),
    goal: z.string().max(1000),
    dailyMinutes: z.number().min(1).max(1440),
    daysPerWeek: z.number().int().min(1).max(7),
    level: z.literal("A1"),
    priorKnowledge: z.enum(["none", "some", "returning"]),
    variantId: z.string().max(128),
    onboarded: z.boolean(),
  })
  .strict();
const plannedSchema = z
  .object({
    kind: z.enum(["activity", "review", "conversation"]),
    id: identifier,
    title: z.string().max(1000),
    minutes: z.number().positive().max(1440),
    reviewItems: z
      .array(
        z
          .object({
            kind: z.enum(["word", "mistake", "structure", "pronunciation"]),
            id: identifier,
          })
          .strict(),
      )
      .max(1000)
      .optional(),
  })
  .strict();
const sessionSchema = z
  .object({
    id: z.uuid(),
    unitId: identifier,
    mode: z.enum(["guided", "difficulties"]).optional(),
    targetMinutes: z.number().min(0).max(1440).optional(),
    startedAt: date,
    finishedAt: date.nullable(),
    durationSeconds: z.number().int().min(0).max(86400000),
    activityIds: z.array(identifier).max(10000),
    correct: z.number().int().nonnegative(),
    wrong: z.number().int().nonnegative(),
    wordsReviewed: z.number().int().nonnegative(),
    plan: z.array(plannedSchema).max(1000),
  })
  .strict();
const writingSchema = z
  .object({
    id: z.uuid(),
    activityId: identifier,
    sessionId: z.uuid().nullable().optional(),
    text: z.string().max(100000),
    createdAt: date,
    feedback: z.unknown().optional(),
  })
  .strict();
const gradeSchema = z
  .object({
    correct: z.boolean(),
    correctAnswer: z.string(),
    explanation: z.string(),
    completeAnswer: z.string().optional(),
    transcript: z.string().optional(),
    variantId: z.string().min(1).optional(),
  })
  .strict();
const evidenceSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    sessionId: z.uuid(),
    reference: z.unknown(),
    kind: z.enum(["activity", "assessment", "learning_policy"]),
    definitionId: identifier,
    input: z.json(),
    result: z.json(),
    createdAt: date,
  })
  .strict();

export function cloneInstalledJson<T>(value: T): T {
  let nodes = 0;
  const visit = (item: unknown, depth: number): unknown => {
    if (++nodes > packageLimits.jsonNodes || depth > packageLimits.jsonDepth) throw new Error();
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (Array.isArray(item)) {
      const descriptors = Object.getOwnPropertyDescriptors(item);
      if (
        Object.keys(descriptors).some(
          (key) =>
            key !== "length" && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= item.length),
        )
      )
        throw new Error();
      return Array.from({ length: item.length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable)
          throw new Error();
        return visit(descriptor.value, depth + 1);
      });
    }
    if (
      item &&
      typeof item === "object" &&
      [Object.prototype, null].includes(Object.getPrototypeOf(item))
    ) {
      const output: Record<string, unknown> = Object.create(null);
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
        if (
          ["__proto__", "prototype", "constructor"].includes(key) ||
          descriptor.get ||
          descriptor.set ||
          !descriptor.enumerable
        )
          throw new Error();
        output[key] = visit(descriptor.value, depth + 1);
      }
      return output;
    }
    throw new Error();
  };
  try {
    const text = JSON.stringify(visit(value, 0));
    if (Buffer.byteLength(text) > packageLimits.jsonBytes) throw new Error();
    return JSON.parse(text) as T;
  } catch {
    throw new InstalledStudyError("INVALID_INPUT");
  }
}

/** Store only user-authored study metadata and ungraded submissions. */
export function sanitizeInstalledDraft(raw: unknown, resolved: ResolvedSession): StudyState {
  try {
    const { course } = resolved.content.prepared.bundle;
    const copy = cloneInstalledJson(raw);
    if (!copy || typeof copy !== "object" || Array.isArray(copy)) throw new Error();
    const object = copy as Record<string, unknown>;
    if (
      (object.courseId !== undefined && object.courseId !== course.id) ||
      (object.languageCode !== undefined && object.languageCode !== course.languageCode)
    )
      throw new Error();
    for (const key of Object.keys(readCourseState(null, course.id, course.languageCode)))
      if (!["courseId", "languageCode"].includes(key) && !(key in object)) throw new Error();
    const parsed = readPersistedCourseState(copy, course.id, course.languageCode);
    if (!parsed || (parsed.languageCode && parsed.languageCode !== course.languageCode))
      throw new Error();
    const profile = profileSchema.parse(parsed.profile);
    const activities = new Map(
      course.units.flatMap((unit) =>
        unit.lessons.flatMap((lesson) =>
          lesson.activities.map((activity) => [activity.id, activity] as const),
        ),
      ),
    );
    const units = new Set(course.units.map((unit) => unit.id));
    if (
      profile.variantId &&
      !resolved.content.prepared.bundle.language.variants.some(
        (variant) => variant.id === profile.variantId,
      )
    )
      throw new Error();
    for (const key of [
      "speaking",
      "conversations",
      "imageDescriptions",
      "microLessonAttempts",
      "reviews",
      "structureAttempts",
    ] as const)
      if (parsed[key].length) throw new InstalledStudyError("INTEGRATION_UNAVAILABLE");
    const sessions = z
      .array(sessionSchema)
      .max(10000)
      .parse(parsed.sessions)
      .map((session) => {
        if (!units.has(session.unitId)) throw new Error();
        for (const item of session.plan) {
          if (item.kind === "conversation")
            throw new InstalledStudyError("INTEGRATION_UNAVAILABLE");
          if (item.kind === "activity" && !activities.has(item.id)) throw new Error();
        }
        if (session.finishedAt && Date.parse(session.finishedAt) < Date.parse(session.startedAt))
          throw new Error();
        return { ...session, correct: 0, wrong: 0, wordsReviewed: 0, activityIds: [] };
      });
    if (new Set(sessions.map((session) => session.id)).size !== sessions.length) throw new Error();
    const sessionIds = new Set(sessions.map((session) => session.id));
    const writing = z
      .array(writingSchema)
      .max(10000)
      .parse(parsed.writing)
      .map((item) => {
        const activity = activities.get(item.activityId);
        if (activity?.type !== "writing" || (item.sessionId && !sessionIds.has(item.sessionId)))
          throw new Error();
        if (!evaluateWritingText(item.text, activity).accepted) throw new Error();
        const { feedback: ignored, ...submission } = item;
        void ignored;
        return submission;
      });
    if (new Set(writing.map((item) => item.id)).size !== writing.length) throw new Error();
    const activeSessionId = parsed.activeSessionId;
    if (
      activeSessionId !== null &&
      (!z.uuid().safeParse(activeSessionId).success || !sessionIds.has(activeSessionId))
    )
      throw new Error();
    const completed = z
      .array(identifier)
      .max(10000)
      .parse(parsed.completedActivityIds)
      .filter((id) => {
        const activity = activities.get(id);
        if (!activity) throw new Error();
        return (
          !objectiveActivityTypes.some((type) => type === activity.type) &&
          activity.type !== "speaking" &&
          (activity.type !== "writing" ||
            writing.some((item) => item.activityId === id && item.text.trim().length > 0))
        );
      });
    return {
      ...readCourseState(null, course.id, course.languageCode),
      profile,
      sessions,
      writing,
      completedActivityIds: [...new Set(completed)],
      activeSessionId,
    };
  } catch (error) {
    if (error instanceof InstalledStudyError) throw error;
    throw new InstalledStudyError("INVALID_INPUT");
  }
}

function replayContext(evidence: VersionEvidence): StudyRecordingContext {
  return {
    now: new Date(evidence.createdAt),
    idFor: (key) => {
      const hex = createHash("sha256")
        .update(evidence.id + ":" + key)
        .digest("hex");
      return (
        hex.slice(0, 8) +
        "-" +
        hex.slice(8, 12) +
        "-4" +
        hex.slice(13, 16) +
        "-8" +
        hex.slice(17, 20) +
        "-" +
        hex.slice(20, 32)
      );
    },
  };
}

/** Normalize the whole second by offset; keep the complete fractional part as decimal digits. */
function evidenceInstant(value: string) {
  const match = /^(.+?)(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error();
  const second = Date.parse(match[1] + match[3]);
  if (!Number.isFinite(second)) throw new Error();
  return { second, fraction: (match[2] ?? "").replace(/0+$/, "") };
}

function compareEvidenceInstants(
  left: ReturnType<typeof evidenceInstant>,
  right: ReturnType<typeof evidenceInstant>,
) {
  const whole = left.second - right.second;
  if (whole) return whole;
  const precision = Math.max(left.fraction.length, right.fraction.length);
  const a = left.fraction.padEnd(precision, "0");
  const b = right.fraction.padEnd(precision, "0");
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Replay trusted I7 evidence using the existing recorders and original identity/time. */
export function projectInstalledEvidence(
  draft: StudyState,
  resolved: ResolvedSession,
  evidence: VersionEvidence[],
): StudyState {
  try {
    const course = resolved.content.prepared.bundle.course;
    const activeSessionId = draft.activeSessionId;
    let state: StudyState = { ...draft, activeSessionId: null };
    const seen = new Set<string>();
    const ordered = evidence
      .map((raw) => {
        const entry = evidenceSchema.parse(raw) as VersionEvidence;
        return { entry, instant: evidenceInstant(entry.createdAt) };
      })
      .sort(
        (a, b) =>
          compareEvidenceInstants(a.instant, b.instant) || a.entry.id.localeCompare(b.entry.id),
      );
    for (const { entry } of ordered) {
      if (
        entry.userId !== resolved.session.userId ||
        !sameContentReference(entry.reference, resolved.session.reference) ||
        seen.has(entry.id)
      )
        throw new Error();
      seen.add(entry.id);
      const input =
        entry.input && typeof entry.input === "object" && !Array.isArray(entry.input)
          ? entry.input
          : null;
      const studySessionId = input?.studySessionId;
      state = {
        ...state,
        activeSessionId:
          typeof studySessionId === "string" &&
          state.sessions.some((session) => session.id === studySessionId)
            ? studySessionId
            : null,
      };
      const context = replayContext(entry);
      if (entry.kind === "activity") {
        const activity = course.units
          .flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
          .find((item) => item.id === entry.definitionId);
        if (
          !activity ||
          !objectiveActivityTypes.some((type) => type === activity.type) ||
          typeof input?.answer !== "string"
        )
          throw new Error();
        state = recordAttempt(state, activity, input.answer, gradeSchema.parse(entry.result), {
          ...context,
          idFor: (key) => (key.startsWith("attempt:") ? entry.id : context.idFor!(key)),
        });
      } else if (entry.kind === "assessment") {
        const result = serverAssessmentResultSchema.parse(entry.result);
        if (
          result.id !== entry.id ||
          result.assessmentId !== entry.definitionId ||
          result.courseId !== course.id ||
          result.contentVersion !== course.contentVersion ||
          result.installationId !== resolved.session.reference.installationId ||
          result.artifactHash !== resolved.session.reference.artifactHash ||
          result.versionSessionId !== entry.sessionId ||
          !course.assessments.some(
            (assessment) =>
              assessment.id === result.assessmentId &&
              assessment.method === result.method &&
              assessment.purpose === result.purpose,
          )
        )
          throw new Error();
        state = recordServerAssessment(state, course, result, context);
      } else if (!course.units.some((unit) => unit.id === entry.definitionId)) throw new Error();
    }
    return { ...state, activeSessionId };
  } catch {
    throw new InstalledStudyError("READ_FAILED");
  }
}
