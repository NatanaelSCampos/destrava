import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findCourseBundle } from "../src/content/course-registry";
import { coursePackageSchema } from "../src/content/contracts";
import { publicCourse } from "../src/content/public";
import { readCourseState, writeCourseState } from "../src/domain/study/course-state-storage";
import { buildLearningProfile } from "../src/domain/study/learning-profile";
import { LearningRecommendationEngine } from "../src/domain/study/learning-recommendation-engine";
import { buildStudyPlan } from "../src/domain/study/study-planner";
import {
  contentAffinityRank, createLearningPreferences, deriveSkillWeights, diagnosticAdvice,
  learningPreferencesSchema, orderByLearningAffinity,
} from "../src/domain/study/learning-preferences";
import { ReviewScheduler } from "../src/domain/review/review-scheduler";

const es = findCourseBundle("frecuencias-a1")!;
const en = findCourseBundle("pt-BR.en.a1.general")!;
const esCourse = publicCourse(es.course, es.language);
const enCourse = publicCourse(en.course, en.language);
const speaking = createLearningPreferences({ goal: "work", contexts: ["workplace"], skillPriorities: ["speaking", "listening"], preferredSessionMinutes: 15 });
const reading = createLearningPreferences({ goal: "travel", contexts: ["getting_around"], skillPriorities: ["speaking", "reading"], preferredSessionMinutes: 30 });
assert.deepEqual(deriveSkillWeights([]), { speaking: .6, listening: .6, reading: .6, writing: .6 });
assert.deepEqual(deriveSkillWeights(["speaking"]), { speaking: 1, listening: .55, reading: .55, writing: .55 });
assert.deepEqual(speaking.skillWeights, { speaking: 1, listening: .85, reading: .45, writing: .45 });
assert.equal(learningPreferencesSchema.safeParse({ ...speaking, skillPriorities: ["speaking", "speaking"] }).success, false);
assert.equal(learningPreferencesSchema.safeParse({ ...speaking, preferredSessionMinutes: 60 }).success, false);
assert.equal(coursePackageSchema.safeParse({ ...es.coursePackage, contexts: [{ id: "bad", label: "Bad", goal: "travel" }], missions: es.coursePackage.missions }).success, false);
assert.equal(diagnosticAdvice("zero"), "optional");
assert.equal(diagnosticAdvice("basic"), "recommended");
assert.equal(diagnosticAdvice("unknown"), "strongly_recommended");

const fresh = readCourseState(null, en.course.id, en.language.id);
assert.equal(fresh.profile.onboarded, false);
assert.equal(fresh.profile.onboardingStep, 0);
const old = readCourseState({ profile: { goal: "Minha meta", onboarded: false }, completedActivityIds: ["intro-1"] }, es.course.id, es.language.id);
assert.equal(old.profile.onboarded, true);
assert.deepEqual(old.completedActivityIds, ["intro-1"]);
assert.equal(old.profile.learningPreferences.goal, "general");

let stored = writeCourseState(null, en.course.id, {
  ...fresh, profile: { ...fresh.profile, learningPreferences: speaking, selfReportedLevel: "basic", onboardingStep: 6 },
});
stored = writeCourseState(stored, es.course.id, {
  ...readCourseState(null, es.course.id, es.language.id),
  profile: { ...readCourseState(null, es.course.id, es.language.id).profile, learningPreferences: reading, selfReportedLevel: "zero", onboarded: true },
  completedActivityIds: ["intro-1"],
});
assert.equal(readCourseState(stored, en.course.id).profile.learningPreferences.goal, "work");
assert.equal(readCourseState(stored, en.course.id).profile.onboardingStep, 6);
assert.equal(readCourseState(stored, es.course.id).profile.learningPreferences.goal, "travel");
assert.deepEqual(readCourseState(stored, es.course.id).completedActivityIds, ["intro-1"]);
const edited = { ...readCourseState(stored, es.course.id), profile: { ...readCourseState(stored, es.course.id).profile, learningPreferences: speaking } };
assert.deepEqual(edited.completedActivityIds, ["intro-1"]);
assert.equal(readCourseState(stored, en.course.id).profile.learningPreferences.goal, "work");

const scenarios = es.resources.conversationScenarios;
assert.equal(contentAffinityRank(scenarios.find((item) => item.id === "new-colleague")!, speaking), 3);
assert.equal(orderByLearningAffinity(scenarios, reading)[0].id, "directions");
const unmatched = createLearningPreferences({ goal: "study", contexts: [], skillPriorities: [], preferredSessionMinutes: 15 });
assert.equal(orderByLearningAffinity(scenarios, unmatched).length, scenarios.length);
assert.equal(contentAffinityRank({ goals: ["travel"] }, unmatched), 0);
assert.equal(contentAffinityRank({}, unmatched), 1);
assert.deepEqual(orderByLearningAffinity([
  { id: "general" }, { id: "goal", goals: ["work"] },
  { id: "context", goals: ["work"], contexts: ["workplace"] },
], speaking).map((item) => item.id), ["context", "goal", "general"]);

const now = new Date("2026-10-03T12:00:00.000Z");
const state = readCourseState(null, es.course.id, es.language.id);
const withSpeaking = { ...state, profile: { ...state.profile, learningPreferences: speaking } };
const due = {
  ...withSpeaking,
  vocabulary: { [es.resources.vocabulary[0].id]: { id: es.resources.vocabulary[0].id, status: "learning" as const, schedule: ReviewScheduler.initial(new Date("2026-10-02T12:00:00.000Z")) } },
};
const profile = buildLearningProfile(esCourse, due, es.resources.vocabulary, es.resources, now);
const recommendations = LearningRecommendationEngine.recommend(esCourse, due, profile, es.resources.vocabulary, es.resources, { now });
assert.equal(recommendations[0].kind, "review");
assert(recommendations.find((item) => item.kind === "activity" && item.source === "curriculum")!.priority < recommendations[0].priority);
const withoutReview = LearningRecommendationEngine.recommend(esCourse, withSpeaking,
  buildLearningProfile(esCourse, withSpeaking, es.resources.vocabulary, es.resources, now),
  es.resources.vocabulary, es.resources, { now, includeReviews: false });
assert.equal(withoutReview[0].id, "intro-1"); // The first required course step survives a speaking preference.
const readingState = { ...state, profile: { ...state.profile, learningPreferences: createLearningPreferences({ goal: "travel", contexts: ["getting_around"], skillPriorities: ["reading"], preferredSessionMinutes: 15 }) } };
const speakingState = { ...state, profile: { ...state.profile, learningPreferences: createLearningPreferences({ goal: "work", contexts: ["workplace"], skillPriorities: ["speaking"], preferredSessionMinutes: 15 }) } };
const all = esCourse.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities));
const completedActivityIds = all.slice(0, 25).map((item) => item.id);
const planSpeak = buildStudyPlan(esCourse, { ...speakingState, completedActivityIds }, 15, es.resources.vocabulary, es.resources, now);
const planRead = buildStudyPlan(esCourse, { ...readingState, completedActivityIds }, 15, es.resources.vocabulary, es.resources, now);
assert.notDeepEqual(planSpeak.map((item) => item.id), planRead.map((item) => item.id));
assert(planSpeak.reduce((sum, item) => sum + item.minutes, 0) <= 15);
assert(planRead.reduce((sum, item) => sum + item.minutes, 0) <= 15);
assert(enCourse.units.length > 0);

const migration = readFileSync("supabase/migrations/20261003000700_pedagogical_onboarding.sql", "utf8");
assert(migration.includes("alter table public.user_course_profiles"));
assert(migration.includes("learning_preferences jsonb"));
assert(!/drop table|disable row level security/i.test(migration));
const policies = readFileSync("supabase/migrations/20261003000400_course_profiles.sql", "utf8");
assert(policies.includes("user_course_profiles_own"));
assert(policies.includes("user_course_profiles_mfa"));
console.log("pedagogical onboarding: ok");
