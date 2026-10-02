import assert from "node:assert/strict";
import { frecuenciasA1, vocabularySeed } from "../src/content/frecuencias-a1";
import { publicCourse } from "../src/content/public";
import { buildLearningProfile } from "../src/domain/study/learning-profile";
import { LearningRecommendationEngine } from "../src/domain/study/learning-recommendation-engine";
import { buildStudyPlan } from "../src/domain/study/study-planner";
import { initialStudyState, type StudyState } from "../src/domain/study/study-state";
import { ReviewScheduler } from "../src/domain/review/review-scheduler";

const course = publicCourse(frecuenciasA1);
const now = new Date("2026-10-01T12:00:00.000Z");
const yesterday = "2026-09-30T12:00:00.000Z";

function recommend(state: StudyState) {
  const profile = buildLearningProfile(course, state, vocabularySeed, now);
  return LearningRecommendationEngine.recommend(course, state, profile, vocabularySeed, { now });
}

const freshProfile = buildLearningProfile(course, initialStudyState, vocabularySeed, now);
assert.equal(freshProfile.languageCode, "es");
assert(freshProfile.skills.every((skill) => skill.score === null));
assert.equal(recommend(initialStudyState)[0]?.id, "intro-1");
assert.equal(buildStudyPlan(course, initialStudyState, 15, vocabularySeed, now)[0]?.id, "intro-1");

const grammarActivity = course.units
  .flatMap((unit) => unit.lessons)
  .flatMap((lesson) => lesson.activities)
  .find((activity) => activity.id === "grammar-3");
assert(grammarActivity);
const mistakeSchedule = {
  ...ReviewScheduler.initial(now),
  nextReviewAt: "2026-10-05T12:00:00.000Z",
};
const wrongGrammar: StudyState = {
  ...initialStudyState,
  completedActivityIds: [grammarActivity.id],
  attempts: [1, 2].map((number) => ({
    id: `attempt-${number}`,
    activityId: grammarActivity.id,
    answer: "incorrecto",
    correct: false,
    skill: grammarActivity.skill,
    createdAt: yesterday,
    sessionId: null,
  })),
  mistakes: {
    [grammarActivity.id]: {
      id: "mistake-grammar-3",
      activityId: grammarActivity.id,
      category: grammarActivity.skill,
      originalAnswer: "incorrecto",
      correctAnswer: "correcto",
      explanation: "",
      timesMissed: 2,
      timesCorrect: 0,
      lastMissedAt: yesterday,
      lastReviewedAt: null,
      schedule: mistakeSchedule,
    },
  },
};
const wrongProfile = buildLearningProfile(course, wrongGrammar, vocabularySeed, now);
assert((wrongProfile.concepts.find((concept) => concept.id === "age-tener")?.score ?? 100) < 50);
assert.equal(recommend(wrongGrammar)[0]?.id, "grammar-3");
assert.equal(buildStudyPlan(course, wrongGrammar, 15, vocabularySeed, now)[0]?.id, "grammar-3");

const dueMistake: StudyState = {
  ...wrongGrammar,
  mistakes: {
    [grammarActivity.id]: {
      ...wrongGrammar.mistakes[grammarActivity.id],
      schedule: { ...mistakeSchedule, nextReviewAt: yesterday },
    },
  },
};
const dueRecommendations = recommend(dueMistake);
assert.equal(dueRecommendations[0]?.kind, "review");
assert(!dueRecommendations.some((item) => item.source === "mistake" && item.id === "grammar-3"));
const reviewedMistake: StudyState = {
  ...wrongGrammar,
  reviews: [
    {
      id: "review-grammar-3",
      scheduleId: mistakeSchedule.id,
      correct: true,
      reviewedAt: yesterday,
      intervalBefore: 0,
      intervalAfter: 3,
    },
  ],
};
assert.equal(
  buildLearningProfile(course, reviewedMistake, vocabularySeed, now).concepts.find(
    (concept) => concept.id === "age-tener",
  )?.evidenceCount,
  3,
);

const word = vocabularySeed[0];
const dueWord: StudyState = {
  ...initialStudyState,
  vocabulary: {
    [word.id]: {
      id: "progress-word",
      status: "learning",
      schedule: {
        ...ReviewScheduler.initial(now),
        id: "word-schedule",
        nextReviewAt: yesterday,
        reviewCount: 1,
        masteryScore: 40,
      },
    },
  },
};
assert.equal(recommend(dueWord)[0]?.kind, "review");
assert(
  buildLearningProfile(course, dueWord, vocabularySeed, now).items.some(
    (item) => item.id === `word:${word.id}`,
  ),
);

const poorSpeech: StudyState = {
  ...initialStudyState,
  speaking: [
    {
      id: "speech-1",
      activityId: "speaking-repeat-1",
      transcription: "Hola",
      audioUrl: null,
      createdAt: yesterday,
      feedback: {
        referenceText: "Hola",
        recognizedText: "Hola",
        accuracy: 35,
        fluency: 55,
        completeness: 80,
        words: [{ text: "Hola", accuracy: 35, errorType: "Mispronunciation" }],
      },
    },
  ],
};
const speechProfile = buildLearningProfile(course, poorSpeech, vocabularySeed, now);
assert((speechProfile.skills.find((skill) => skill.id === "pronunciation")?.score ?? 100) < 50);
assert(speechProfile.items.some((item) => item.id === "pronunciation:hola"));
assert.equal(recommend(poorSpeech)[0]?.source, "pronunciation");

const poorFluency: StudyState = {
  ...poorSpeech,
  speaking: [
    {
      ...poorSpeech.speaking[0],
      feedback: { ...poorSpeech.speaking[0].feedback!, accuracy: 90, fluency: 30 },
    },
  ],
};
assert.equal(recommend(poorFluency)[0]?.source, "fluency");

const reviewedWriting: StudyState = {
  ...initialStudyState,
  writing: [
    {
      id: "writing-submission-1",
      activityId: "writing-1",
      text: "Hola",
      createdAt: yesterday,
      feedback: {
        correctedText: "Hola.",
        errors: [],
        naturalness: [],
        optionalSuggestions: [],
        score: { grammar: 30, vocabulary: 40, clarity: 50 },
      },
    },
  ],
};
const writingProfile = buildLearningProfile(course, reviewedWriting, vocabularySeed, now);
assert((writingProfile.skills.find((skill) => skill.id === "writing")?.score ?? 100) < 50);
assert((writingProfile.skills.find((skill) => skill.id === "grammar")?.score ?? 100) < 50);

const oldCorrect: StudyState = {
  ...initialStudyState,
  attempts: [1, 2, 3].map((number) => ({
    id: `correct-${number}`,
    activityId: grammarActivity.id,
    answer: "correcto",
    correct: true,
    skill: grammarActivity.skill,
    createdAt: yesterday,
    sessionId: null,
  })),
};
const recentScore = buildLearningProfile(course, oldCorrect, vocabularySeed, now).concepts.find(
  (concept) => concept.id === "age-tener",
)?.score;
const staleScore = buildLearningProfile(
  course,
  oldCorrect,
  vocabularySeed,
  new Date("2027-10-01T12:00:00.000Z"),
).concepts.find((concept) => concept.id === "age-tener")?.score;
assert(recentScore !== null && recentScore !== undefined);
assert(staleScore !== null && staleScore !== undefined && staleScore < recentScore);

const englishCourse = {
  ...course,
  id: "english-a1",
  languageCode: "en",
  units: course.units.map((unit) => ({
    ...unit,
    lessons: unit.lessons.map((lesson) => ({
      ...lesson,
      id: `en-${lesson.id}`,
      activities: lesson.activities.map((activity) => ({ ...activity, id: `en-${activity.id}` })),
    })),
  })),
};
const englishProfile = buildLearningProfile(englishCourse, wrongGrammar, vocabularySeed, now);
assert(englishProfile.skills.every((skill) => skill.score === null));
assert.equal(englishProfile.languageCode, "en");
assert.equal(
  LearningRecommendationEngine.recommend(englishCourse, wrongGrammar, englishProfile, [], {
    now,
  })[0]?.id,
  "en-intro-1",
);

console.log(
  "Learning profile and recommendations verified across fresh, mistakes, reviews, writing, speech, recency and language isolation.",
);
