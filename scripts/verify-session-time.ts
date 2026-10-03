import assert from "node:assert/strict";
import {
  advanceActiveStudySeconds,
  boundedStudySeconds,
  countedStudySeconds,
  sessionTimeNeedsCorrection,
} from "../src/domain/study/session-time";
import type { StudySession } from "../src/domain/study/study-state";

const session: StudySession = {
  id: "example",
  unitId: "unit-1",
  startedAt: "2026-10-01T10:00:00.000Z",
  finishedAt: "2026-10-01T10:15:00.000Z",
  durationSeconds: 15 * 60,
  activityIds: [],
  correct: 0,
  wrong: 0,
  wordsReviewed: 0,
  plan: [],
};

assert.equal(countedStudySeconds(session), 900);
assert.equal(countedStudySeconds({ ...session, finishedAt: null }), 0);
assert.equal(sessionTimeNeedsCorrection({ ...session, durationSeconds: 1594 * 60 }), true);
assert.equal(countedStudySeconds({ ...session, durationSeconds: 1594 * 60 }), 0);
assert.equal(boundedStudySeconds(Number.POSITIVE_INFINITY), 0);
assert.equal(advanceActiveStudySeconds(30, 1000, 2000, 1000, true), 31);
assert.equal(advanceActiveStudySeconds(30, 1000, 2000, 1000, false), 30);
assert.equal(advanceActiveStudySeconds(30, 1000, 1000 + 24 * 60 * 60 * 1000, 1000, true), 32);
assert.equal(advanceActiveStudySeconds(30, 301000, 302000, 0, true), 30);

console.info("session time: ok");
