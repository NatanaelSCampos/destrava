import assert from "node:assert/strict";
import { allCourseBundles, findCourseBundle } from "../src/content/course-registry";
import { publicCourse } from "../src/content/public";
import { findActivity } from "../src/content/schema";
import { gradeActivity, normalizeAnswer } from "../src/domain/activities/grader";
import { readCourseState, writeCourseState } from "../src/domain/study/course-state-storage";
import { recordAttempt, recordVocabularySignal, reviewVocabulary } from "../src/domain/study/study-state";
import { projectStudyEvents } from "../src/repositories/study-event-projection";
import { buildLearningProfile } from "../src/domain/study/learning-profile";
import { skillProgress } from "../src/domain/study/progress";
import { LearningRecommendationEngine } from "../src/domain/study/learning-recommendation-engine";
import { dueReviewCounts } from "../src/domain/review/due-review-counts";
import { searchDictionary } from "../src/domain/vocabulary/dictionary-search";
import { TutorContextBuilder } from "../src/domain/ai/tutor-context-builder";
import { nextAdaptiveItem } from "../src/domain/study/adaptive-assessment";
import { speechLocale, textToSpeechLocale } from "../src/content/language-variant";
import { runtimeBundle } from "../src/content/runtime-package";

const es = findCourseBundle("frecuencias-a1")!;
const test = findCourseBundle("pt-BR.xx-Test.a1.general")!;
const en = findCourseBundle("pt-BR.en.a1.general")!;
assert.equal(allCourseBundles().length, 3);
assert.equal(es.language.id, "es");
assert.equal(test.language.id, "xx-Test");
assert.equal(en.language.id, "en");
assert.equal(test.resources.vocabulary.length, 5);
assert.equal(test.resources.alphabet.length, 4);
assert.equal(test.resources.numbers.length, 0);
assert.equal(speechLocale(test.language, "general", "recognitionLocale"), null);
assert.equal(test.language.capabilities.textToSpeech, false);
assert.equal(textToSpeechLocale(test.language, "general"), null);
assert.equal(textToSpeechLocale({
  ...test.language,
  speech: { ...test.language.speech, providers: {
    browser: { general: { recognitionLocale: null, assessmentLocale: null, ttsLocale: "xx-XX" } },
  } },
}, "general"), "xx-XX");
assert.equal(test.coursePackage.assessments.length, 1);
const extraUnit = {
  ...test.coursePackage.units[0], id: "xx.u02", slug: "novos-passos", order: 2,
  lessons: test.coursePackage.units[0].lessons.map((lesson) => ({
    ...lesson, id: `${lesson.id}.u02`, slug: `${lesson.slug}-u02`,
    activities: lesson.activities.map((activity) => ({ ...activity, id: `${activity.id}.u02` })),
  })),
};
assert.equal(runtimeBundle({
  course: { ...test.coursePackage, units: [...test.coursePackage.units, extraUnit] },
  language: test.language, moduleData: { alphabet: test.resources.alphabet },
}).course.units.length, 2);
assert.equal(nextAdaptiveItem(test.coursePackage.assessments[0].bank, [], test.coursePackage.assessments[0].skillPlan)?.activityId, "xx.act.choice");
assert.notEqual(normalizeAnswer("español", es.language.normalization), normalizeAnswer("espanol", es.language.normalization));

const esActivity = findActivity(es.course, "grammar-3")!;
const testActivity = findActivity(test.course, "xx.act.choice")!;
assert.equal(gradeActivity(testActivity, "olá", test.language.normalization)?.correct, true);
assert.equal(gradeActivity(testActivity, "ola", test.language.normalization)?.correct, false);
const esPublicActivity = publicCourse(es.course).units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities)).find((activity) => activity.id === esActivity.id)!;
const testPublicActivity = publicCourse(test.course).units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities)).find((activity) => activity.id === testActivity.id)!;
const esInitial = readCourseState(null, es.course.id, es.language.id);
const testInitial = readCourseState(null, test.course.id, test.language.id);
const esAnswer = gradeActivity(esActivity, "Es tiene", es.language.normalization)!;
const testAnswer = gradeActivity(testActivity, "olá", test.language.normalization)!;
const esState = recordAttempt(esInitial, esPublicActivity, "Es tiene", esAnswer);
const testState = recordVocabularySignal(recordVocabularySignal(recordVocabularySignal(
  recordAttempt(testInitial, testPublicActivity, "olá", testAnswer), "xx.lex.milo", "vocabulary_search",
), "xx.lex.milo", "vocabulary_search"), "xx.lex.milo", "vocabulary_search");
let stored = writeCourseState(null, es.course.id, esState);
stored = writeCourseState(stored, test.course.id, testState);
const loadedEs = readCourseState(stored, es.course.id, es.language.id);
const loadedTest = readCourseState(stored, test.course.id, test.language.id);
assert.deepEqual(loadedEs.completedActivityIds, ["grammar-3"]);
assert.deepEqual(loadedTest.completedActivityIds, ["xx.act.choice"]);
assert.equal(Object.keys(loadedEs.mistakes).length, 1);
assert.equal(Object.keys(loadedTest.mistakes).length, 0);
assert.equal(loadedEs.vocabulary["xx.lex.milo"], undefined);
assert.equal(loadedTest.vocabulary["xx.lex.milo"].status, "learning");
const reviewedTest = reviewVocabulary(loadedTest, "xx.lex.milo", true);
assert.equal(reviewedTest.events[0].itemId, "xx.lex.milo");
assert.equal(reviewedTest.events[0].activityId, undefined);
const projectedEvents = projectStudyEvents(
  [
    ...reviewedTest.events,
    { id: "legacy-review", type: "review_completed", activityId: "xx.lex.milo", createdAt: "2026-10-03T00:00:00.000Z" },
  ],
  "test-user", test.course.id, new Set(["xx.act.choice"]),
);
assert.equal(projectedEvents[0].activity_id, null);
assert.equal(projectedEvents[0].metadata.itemId, "xx.lex.milo");
assert.equal(projectedEvents.at(-1)?.activity_id, null);
assert.equal(projectedEvents.at(-1)?.metadata.unresolvedActivityId, "xx.lex.milo");
assert.equal(projectedEvents.find((item) => item.event_type === "exercise_answered")?.activity_id, "xx.act.choice");
assert.equal(loadedEs.attempts.length, 1);
assert.equal(loadedTest.attempts.length, 1);
const testProfile = buildLearningProfile(publicCourse(test.course), loadedTest, test.resources.vocabulary, test.resources);
assert.equal(testProfile.courseId, test.course.id);
assert((testProfile.skills.find((skill) => skill.id === "vocabulary")?.evidenceCount ?? 0) >= 1);
assert.equal(testProfile.skills.find((skill) => skill.id === "reading")?.evidenceCount, 1);
assert.equal(skillProgress(publicCourse(test.course), loadedTest, "reading").performance, 100);
assert.equal(buildLearningProfile(publicCourse(es.course), loadedEs, es.resources.vocabulary, es.resources).courseId, es.course.id);
stored = writeCourseState(stored, es.course.id, { ...loadedEs, completedActivityIds: [] });
assert.deepEqual(readCourseState(stored, test.course.id).completedActivityIds, ["xx.act.choice"]);

assert.deepEqual(en.language.variants.map((variant) => variant.id), ["general", "en-US", "en-GB"]);
for (const variant of ["general", "en-US", "en-GB"]) {
  const locale = variant === "en-GB" ? "en-GB" : "en-US";
  assert.equal(speechLocale(en.language, variant, "recognitionLocale"), locale);
  assert.equal(speechLocale(en.language, variant, "assessmentLocale"), locale);
  assert.equal(textToSpeechLocale(en.language, variant), locale);
}
assert.equal(en.resources.alphabet.length, 26);
assert.equal(en.resources.numbers.length, 7);
assert.equal(en.resources.regionalTopics.length, 2);
assert.equal(en.course.units.length, 1);
assert.equal(en.course.units[0].lessons.length, 3);
assert.equal(en.course.units[0].lessons.flatMap((lesson) => lesson.activities).length, 18);
assert.equal(en.resources.vocabulary.length, en.coursePackage.lexicon.length);
assert.equal(en.resources.conversationScenarios.length, 1);
assert.equal(en.coursePackage.roleplays.length, 1);
assert.equal(en.coursePackage.assessments[0].bank.length, 5);
assert.equal(en.coursePackage.assessments[0].passingPolicy.overall, 0.6);
assert.equal(en.resources.imageScenes[0].image, es.resources.imageScenes.find((scene) => scene.id === "cafe")?.image);
assert.notEqual(en.resources.imageScenes[0].prompt, es.resources.imageScenes.find((scene) => scene.id === "cafe")?.prompt);
assert.equal(searchDictionary(en.resources, "hello")[0]?.id, "en.lex.hello");
assert.equal(searchDictionary(en.resources, "olá").length, 1);
assert.equal(searchDictionary(es.resources, "hello").length, 0);
assert.equal(searchDictionary(en.resources, "tener").length, 0);

const enActivity = findActivity(en.course, "en.act.14.job-choice")!;
assert.equal(gradeActivity(enActivity, "I am a teacher.", en.language.normalization)?.correct, true);
assert.equal(gradeActivity(enActivity, "I are a teacher.", en.language.normalization)?.correct, false);
const enPublic = publicCourse(en.course, en.language);
const enPublicActivity = enPublic.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
  .find((activity) => activity.id === enActivity.id)!;
const enState = recordAttempt(
  readCourseState(null, en.course.id, en.language.id), enPublicActivity, "I are a teacher.",
  gradeActivity(enActivity, "I are a teacher.", en.language.normalization)!,
);
stored = writeCourseState(stored, en.course.id, enState);
assert.deepEqual(readCourseState(stored, en.course.id).completedActivityIds, [enActivity.id]);
assert.deepEqual(readCourseState(stored, test.course.id).completedActivityIds, [testActivity.id]);
assert.equal(readCourseState(stored, es.course.id).mistakes[enActivity.id], undefined);
assert.equal(readCourseState(stored, en.course.id).mistakes[esActivity.id], undefined);

const esPublic = publicCourse(es.course, es.language);
const enProfile = buildLearningProfile(enPublic, enState, en.resources.vocabulary, en.resources);
const esProfile = buildLearningProfile(esPublic, esState, es.resources.vocabulary, es.resources);
assert.equal(enProfile.courseId, en.course.id);
assert.equal(enProfile.concepts.find((concept) => concept.id === "en.work.profession")?.evidenceCount, 1);
assert.equal(esProfile.concepts.some((concept) => concept.id.startsWith("en.")), false);
assert.equal(buildLearningProfile(enPublic, esState, en.resources.vocabulary, en.resources)
  .skills.find((skill) => skill.id === "grammar")?.evidenceCount, 0);
const enRecommendations = LearningRecommendationEngine.recommend(enPublic, enState, enProfile, en.resources.vocabulary, en.resources, { includeReviews: false });
const esRecommendations = LearningRecommendationEngine.recommend(esPublic, esState, esProfile, es.resources.vocabulary, es.resources, { includeReviews: false });
assert(enRecommendations.some((item) => item.source === "mistake" && item.id === enActivity.id));
assert(esRecommendations.some((item) => item.source === "mistake" && item.id === esActivity.id));
assert(!enRecommendations.some((item) => item.id === esActivity.id));
assert(!esRecommendations.some((item) => item.id === enActivity.id));
assert.equal(dueReviewCounts(enState, en.resources.vocabulary, new Date(Date.now() + 86_400_000),
  new Set(enPublic.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id)))),
  en.resources.structures).mistakes, 1);
assert.equal(dueReviewCounts(esState, en.resources.vocabulary, new Date(Date.now() + 86_400_000),
  new Set(enPublic.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.id))))).mistakes, 0);
const enTutorContext = TutorContextBuilder.build(en.course, en.language, enActivity.id, [], "en-GB");
assert.equal(enTutorContext.language, "English");
assert.equal(enTutorContext.variant, "Inglês do Reino Unido");
assert.equal(enTutorContext.activity?.title, enActivity.title);
assert(!/Frecuencias|tener|español/i.test(JSON.stringify(enTutorContext)));

console.log("ES, EN and xx-Test packages, speech locales, curriculum, adaptive state, review, dictionary and tutor isolation: ok");
