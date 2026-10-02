import assert from "node:assert/strict";
import { frecuenciasA1, vocabularySeed } from "../src/content/frecuencias-a1";
import { publicCourse } from "../src/content/public";
import { buildLearningProfile } from "../src/domain/study/learning-profile";
import { LearningRecommendationEngine } from "../src/domain/study/learning-recommendation-engine";
import { buildLearningMemory } from "../src/domain/study/learning-memory";
import { recommendationLink } from "../src/lib/recommendation-link";
import { buildStudyPlan } from "../src/domain/study/study-planner";
import { buildPracticeHistory, sessionComparisons } from "../src/domain/study/practice-history";
import { initialStudyState, type StudyState } from "../src/domain/study/study-state";
import { ReviewScheduler } from "../src/domain/review/review-scheduler";
import { dueReviewCounts } from "../src/domain/review/due-review-counts";
import { wordReviewCard } from "../src/domain/review/review-card";
import { reviewClozeForms, visualVocabulary } from "../src/content/visual-vocabulary";
import {
  recordEvaluatedSpeaking,
  recordEvaluatedWriting,
  recordVocabularySignal,
  recordNumberAttempt,
  recordMicroLessonAttempt,
  recordAdaptiveAssessment,
  reviewVocabulary,
  reviewStructure,
} from "../src/domain/study/study-state";
import { vocabularyContext, vocabularyOccurrences } from "../src/content/vocabulary-context";
import {
  spanishRegion,
  spanishSpeechLocale,
  regionalVocabularyNote,
} from "../src/content/spanish-regions";
import { TutorContextBuilder } from "../src/domain/ai/tutor-context-builder";
import { reviewStructures } from "../src/content/review-structures";
import { conversationScenarios } from "../src/content/conversation-scenarios";
import { adaptiveAssessmentBank } from "../src/content/adaptive-assessment-bank";
import {
  adaptiveAssessmentReport,
  nextAdaptiveItem,
  type AdaptiveAnswer,
} from "../src/domain/study/adaptive-assessment";
import {
  appendConversationReply,
  finishConversation,
  startConversation,
} from "../src/domain/conversation/conversation-session";
import {
  findNumberPrompt,
  gradeNumberDictation,
  numberSpeechScore,
} from "../src/domain/numbers/number-practice";

const course = publicCourse(frecuenciasA1);
const adaptiveReview = recordAdaptiveAssessment(initialStudyState, course, {
  courseId: course.id,
  unitId: course.units[0].id,
  startedAt: new Date().toISOString(),
  answers: [
    {
      activityId: "assessment-2",
      skill: "grammar",
      difficulty: 2,
      correct: false,
      answer: "tiene",
      correctAnswer: "tengo",
      explanation: "Yo exige tengo.",
    },
  ],
});
assert.equal(adaptiveReview.mistakes["assessment-2"].correctAnswer, "tengo");
assert.equal(dueReviewCounts(adaptiveReview, vocabularySeed).mistakes, 1);
assert.equal(adaptiveReview.events[0].type, "adaptive_assessment_completed");
const adaptivePassed = recordAdaptiveAssessment(adaptiveReview, course, {
  courseId: course.id,
  unitId: course.units[0].id,
  startedAt: new Date().toISOString(),
  answers: [
    { activityId: "assessment-2", skill: "grammar", difficulty: 2, correct: true, answer: "tengo" },
  ],
});
assert(adaptivePassed.mistakes["assessment-2"]);
const firstAdaptive = nextAdaptiveItem(adaptiveAssessmentBank, []);
assert.equal(firstAdaptive?.skill, "vocabulary");
assert.equal(firstAdaptive?.difficulty, 2);
const wrongAdaptive: AdaptiveAnswer = {
  activityId: firstAdaptive!.activityId,
  skill: "vocabulary",
  difficulty: 2,
  correct: false,
  answer: "erro",
};
assert.equal(nextAdaptiveItem(adaptiveAssessmentBank, [wrongAdaptive])?.difficulty, 1);
const adaptiveAnswers: AdaptiveAnswer[] = [
  wrongAdaptive,
  { activityId: "grammar-2", skill: "grammar", difficulty: 1, correct: true, answer: "soy" },
  { activityId: "listening-1", skill: "listening", difficulty: 1, correct: true, answer: "" },
  {
    activityId: "assessment-4",
    skill: "writing",
    difficulty: 2,
    correct: true,
    answer: "Me llamo Luis",
  },
  {
    activityId: "assessment-6",
    skill: "grammar",
    difficulty: 3,
    correct: true,
    answer: "¿De dónde eres?",
  },
  {
    activityId: "assessment-5",
    skill: "reading",
    difficulty: 2,
    correct: true,
    answer: "Ela mora em Quito",
  },
];
assert.equal(adaptiveAssessmentReport(adaptiveAnswers).score, 83);
assert.equal(adaptiveAssessmentReport(adaptiveAnswers).wrong.length, 1);
assert.equal(nextAdaptiveItem(adaptiveAssessmentBank, adaptiveAnswers), null);
const adaptiveState: StudyState = {
  ...initialStudyState,
  adaptiveAssessments: [
    {
      id: "adaptive-1",
      courseId: course.id,
      unitId: course.units[0].id,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      answers: adaptiveAnswers,
    },
  ],
};
assert(
  (buildLearningProfile(course, adaptiveState, vocabularySeed).skills.find(
    (item) => item.id === "vocabulary",
  )?.evidenceCount ?? 0) > 0,
);
const mission = conversationScenarios[0];
const newConversation = startConversation({
  courseId: course.id,
  mode: "mission",
  scenario: mission,
  topic: "",
  pace: "beginner",
  correction: "end_of_conversation",
});
assert.equal(newConversation.turns[0]?.text, mission.opening);
const answeredConversation = appendConversationReply(
  newConversation,
  "Me llamo Ana.",
  {
    text: "Mucho gusto, Ana.",
    correction: "",
    correctionCategory: "none",
    completedObjectiveIds: ["say-name", "invalid"],
  },
  mission.objectives.map((item) => item.id),
);
assert.deepEqual(answeredConversation.completedObjectiveIds, ["say-name"]);
assert.equal(
  appendConversationReply(
    finishConversation(answeredConversation),
    "Hola",
    { text: "Hola", correction: "", correctionCategory: "none", completedObjectiveIds: [] },
    [],
  ).turns.length,
  answeredConversation.turns.length,
);
assert.equal(spanishRegion("invalid"), "general");
assert.equal(spanishSpeechLocale("argentina"), "es-AR");
assert.match(regionalVocabularyNote("celular", "spain") ?? "", /móvil/);
assert.match(
  vocabularyContext(
    { id: "llamarse", translation: "chamar-se", example: "Me llamo Ana." },
    "es",
    "argentina",
  ).regionalNote ?? "",
  /llamás/,
);
assert.equal(TutorContextBuilder.build(undefined, [], "mexico").spanishRegion, "México");
const now = new Date("2026-10-01T12:00:00.000Z");
const yesterday = "2026-09-30T12:00:00.000Z";

function recommend(state: StudyState) {
  const profile = buildLearningProfile(course, state, vocabularySeed, now);
  return LearningRecommendationEngine.recommend(course, state, profile, vocabularySeed, { now });
}

const correctedConversation = appendConversationReply(
  { ...newConversation, startedAt: yesterday },
  "Yo es Ana",
  {
    text: "Entiendo. ¿De dónde eres?",
    correction: "Diga 'yo soy'.",
    correctionCategory: "grammar",
    completedObjectiveIds: [],
  },
  [],
  "speech",
);
const correctedTwice = appendConversationReply(
  correctedConversation,
  "Yo es de Lima",
  {
    text: "¡Qué bien!",
    correction: "Use 'yo soy de'.",
    correctionCategory: "grammar",
    completedObjectiveIds: [],
  },
  [],
  "text",
);
const memoryState: StudyState = {
  ...initialStudyState,
  conversations: [correctedTwice],
  imageDescriptions: [1, 2].map((number) => ({
    id: `image-${number}`,
    sceneId: "kitchen",
    courseId: course.id,
    transcript: "Hay una mujer.",
    inputMode: "text" as const,
    feedback: {
      observed: "Uma mulher",
      strength: "Acertou",
      correction: "Use hay.",
      nextSentence: "Hay una mesa.",
    },
    createdAt: yesterday,
  })),
};
const memory = buildLearningMemory(memoryState, course.id);
assert.equal(memory.voiceTurns, 1);
assert.equal(memory.correctionPatterns[0]?.count, 2);
assert.equal(memory.unfinishedMissionIds[0], mission.id);
const conversationSuggestion = recommend(memoryState).find(
  (item) => item.kind === "conversation" && item.id === mission.id,
);
assert(conversationSuggestion);
assert.equal(
  recommendationLink(course.slug, conversationSuggestion),
  `/conversation?scenario=${mission.id}`,
);
const imageSuggestion = recommend(memoryState).find((item) => item.kind === "image");
assert(imageSuggestion);
assert.equal(recommendationLink(course.slug, imageSuggestion), "/describe?scene=kitchen");

const freshProfile = buildLearningProfile(course, initialStudyState, vocabularySeed, now);
assert.equal(freshProfile.languageCode, "es");
assert(freshProfile.skills.every((skill) => skill.score === null));
assert.equal(recommend(initialStudyState)[0]?.id, "intro-1");
assert.equal(buildStudyPlan(course, initialStudyState, 15, vocabularySeed, now)[0]?.id, "intro-1");
const shortPlan = buildStudyPlan(course, initialStudyState, 5, vocabularySeed, now);
assert(shortPlan.length > 0);
assert(shortPlan.reduce((minutes, item) => minutes + item.minutes, 0) <= 5);
assert.equal(
  buildStudyPlan(course, initialStudyState, 15, vocabularySeed, now, "difficulties").length,
  0,
);

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
const focusedPlan = buildStudyPlan(course, wrongGrammar, 5, vocabularySeed, now, "difficulties");
assert.equal(focusedPlan[0]?.id, "grammar-3");
assert(focusedPlan.reduce((minutes, item) => minutes + item.minutes, 0) <= 5);
assert(focusedPlan.every((item) => item.id === "grammar-3"));

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
const focusedReview = buildStudyPlan(course, dueMistake, 5, vocabularySeed, now, "difficulties");
assert.equal(focusedReview[0]?.kind, "review");
assert.deepEqual(focusedReview[0]?.reviewItems, [{ kind: "mistake", id: "grammar-3" }]);
assert(!focusedReview.some((item) => item.kind === "activity" && item.id === "grammar-3"));
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
const focusedWord = buildStudyPlan(course, dueWord, 5, vocabularySeed, now, "difficulties");
assert.deepEqual(focusedWord[0]?.reviewItems, [{ kind: "word", id: word.id }]);
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
assert.equal(buildPracticeHistory(englishCourse, wrongGrammar, []).length, 0);

const sessionId = "focused-session-1";
const sessionState: StudyState = {
  ...wrongGrammar,
  attempts: [
    {
      id: "correct-in-session",
      activityId: grammarActivity.id,
      answer: "tiene",
      correct: true,
      skill: grammarActivity.skill,
      createdAt: "2026-10-01T11:30:00.000Z",
      sessionId,
    },
    ...wrongGrammar.attempts,
  ],
  speaking: [
    {
      ...poorSpeech.speaking[0],
      id: "speech-in-session",
      sessionId,
      createdAt: "2026-10-01T11:35:00.000Z",
      feedback: { ...poorSpeech.speaking[0].feedback!, accuracy: 70, fluency: 80 },
    },
    ...poorSpeech.speaking,
  ],
  sessions: [
    {
      id: sessionId,
      unitId: course.units[0].id,
      mode: "difficulties",
      targetMinutes: 15,
      startedAt: "2026-10-01T11:00:00.000Z",
      finishedAt: "2026-10-01T11:40:00.000Z",
      durationSeconds: 2400,
      activityIds: [grammarActivity.id, "speaking-repeat-1"],
      correct: 1,
      wrong: 0,
      wordsReviewed: 0,
      plan: focusedPlan,
    },
  ],
};
const practiceHistory = buildPracticeHistory(course, sessionState, vocabularySeed);
assert.equal(practiceHistory.find((item) => item.id === "exercise:grammar-3")?.points.length, 3);
const comparison = sessionComparisons(sessionState.sessions[0], practiceHistory);
assert.deepEqual(
  comparison.find((item) => item.id === "exercise:grammar-3"),
  {
    id: "exercise:grammar-3",
    title: grammarActivity.title,
    measure: "Acerto",
    before: 0,
    after: 100,
  },
);
assert.deepEqual(comparison.find((item) => item.id === "Pronúncia:speaking-repeat-1")?.after, 70);

const writingFeedback = {
  correctedText: "Tengo 31 años.",
  errors: [
    { excerpt: "Soy 31 años", correction: "Tengo 31 años", explanation: "A idade usa tener." },
  ],
  naturalness: [],
  optionalSuggestions: [],
  score: { grammar: 60, vocabulary: 75, clarity: 80 },
};
const writingIssue = recordEvaluatedWriting(
  initialStudyState,
  "writing-1",
  "Soy 31 años",
  writingFeedback,
);
assert.equal(writingIssue.mistakes["writing-1"].category, "writing");
assert.equal(writingIssue.mistakes["writing-1"].correctAnswer, "Tengo 31 años.");
assert.equal(writingIssue.mistakes["writing-1"].timesMissed, 1);
const correctedWriting = recordEvaluatedWriting(writingIssue, "writing-1", "Tengo 31 años.", {
  ...writingFeedback,
  errors: [],
});
assert.equal(correctedWriting.mistakes["writing-1"].timesCorrect, 1);
assert.equal(
  recordEvaluatedWriting(initialStudyState, "writing-1", "texto", {}).mistakes["writing-1"],
  undefined,
);

const pronunciationIssue = recordEvaluatedSpeaking(
  initialStudyState,
  "speaking-repeat-1",
  poorSpeech.speaking[0].feedback,
);
assert.equal(pronunciationIssue.mistakes["speaking-repeat-1"].category, "speaking");
assert(pronunciationIssue.mistakes["speaking-repeat-1"].explanation.includes("Hola"));
const improvedSpeech = recordEvaluatedSpeaking(pronunciationIssue, "speaking-repeat-1", {
  ...poorSpeech.speaking[0].feedback!,
  accuracy: 90,
  fluency: 90,
  completeness: 95,
  words: [],
});
assert.equal(improvedSpeech.mistakes["speaking-repeat-1"].timesCorrect, 1);
const recalledSpeech: StudyState = {
  ...pronunciationIssue,
  reviews: [
    {
      id: "speech-recall",
      scheduleId: pronunciationIssue.mistakes["speaking-repeat-1"].schedule.id,
      correct: true,
      reviewedAt: yesterday,
      intervalBefore: 1,
      intervalAfter: 3,
    },
  ],
};
assert.equal(
  buildLearningProfile(course, recalledSpeech, vocabularySeed, now).skills.find(
    (skill) => skill.id === "speaking",
  )?.score,
  null,
);
assert.equal(dueReviewCounts(dueMistake, vocabularySeed, now, new Set(["other"])).mistakes, 0);

const searchedOnce = recordVocabularySignal(initialStudyState, "tener", "vocabulary_search");
const searchedTwice = recordVocabularySignal(searchedOnce, "tener", "vocabulary_search");
const searchedThrice = recordVocabularySignal(searchedTwice, "tener", "vocabulary_search");
assert.equal(searchedTwice.vocabulary.tener, undefined);
assert.equal(searchedThrice.vocabulary.tener.status, "learning");
assert.equal(searchedThrice.events.filter((item) => item.itemId === "tener").length, 3);
assert.deepEqual(
  buildStudyPlan(course, searchedThrice, 5, vocabularySeed, now, "difficulties")[0]?.reviewItems,
  [{ kind: "word", id: "tener" }],
);
assert.equal(wordReviewCard(word, 0).front, word.spanish);
assert.equal(wordReviewCard(word, 1).front, word.translation);
assert.equal(wordReviewCard(word, 2).frontLabel, "ESCUTA");
assert.equal(wordReviewCard(word, 3).presentation, "cloze");
assert.match(wordReviewCard(word, 3).front, /_____/);
assert.equal(wordReviewCard(vocabularySeed[6], 3).presentation, "standard");
assert.equal(
  wordReviewCard(vocabularySeed[6], 3, { clozeForms: reviewClozeForms.tener }).presentation,
  "cloze",
);
assert.match(
  wordReviewCard(vocabularySeed[6], 3, { clozeForms: reviewClozeForms.tener }).back,
  /Tengo/,
);
assert.equal(
  wordReviewCard(vocabularySeed[12], 0, { visual: visualVocabulary.medico }).presentation,
  "image",
);
const hardWord = reviewVocabulary(initialStudyState, "medico", "difficult");
assert.equal(hardWord.vocabulary.medico.status, "difficult");
assert.equal(hardWord.vocabulary.medico.schedule.intervalDays, 0);
assert.equal(
  reviewVocabulary(initialStudyState, "medico", false).vocabulary.medico.status,
  "learning",
);
const structureIssue = reviewStructure(initialStudyState, reviewStructures[1].id, false);
const structureDate = new Date(structureIssue.structureAttempts[0].createdAt);
assert.equal(structureIssue.structureReviews[reviewStructures[1].id].schedule.intervalDays, 1);
assert.equal(
  dueReviewCounts(
    structureIssue,
    vocabularySeed,
    new Date(structureDate.getTime() + 2 * 86_400_000),
  ).structures,
  1,
);
assert(
  (buildLearningProfile(course, structureIssue, vocabularySeed, structureDate).concepts.find(
    (item) => item.id === "age-tener",
  )?.evidenceCount ?? 0) > 0,
);
assert.equal(vocabularyContext(vocabularySeed[6], "es").senses.length, 3);
assert(vocabularyOccurrences(course, vocabularySeed[6]).length > 0);

const fortySeven = findNumberPrompt("47")!;
assert(gradeNumberDictation(fortySeven, "47"));
assert(!gradeNumberDictation(fortySeven, "70"));
assert(!gradeNumberDictation(fortySeven, "abc47"));
assert(gradeNumberDictation(findNumberPrompt("money-12-50")!, "12.50"));
assert(gradeNumberDictation(findNumberPrompt("time-08-15")!, "8:15"));
assert.deepEqual(
  numberSpeechScore({ ...poorSpeech.speaking[0].feedback!, accuracy: 80, completeness: 80 }),
  { score: 80, correct: true },
);
const numberIssue = recordNumberAttempt(initialStudyState, {
  promptId: "47",
  mode: "dictation",
  answer: "70",
  correct: false,
  score: 0,
});
const numberNow = new Date(numberIssue.numberAttempts[0].createdAt);
assert.equal(numberIssue.events[0].itemId, "47");
assert(
  (buildLearningProfile(course, numberIssue, vocabularySeed, numberNow).concepts.find(
    (item) => item.id === "numbers",
  )?.evidenceCount ?? 0) > 0,
);
assert(recommend(numberIssue).some((item) => item.kind === "number" && item.id === "47"));
const otherCourse = { ...course, id: "french-a1", languageCode: "fr" };
assert.equal(
  buildLearningProfile(otherCourse, numberIssue, vocabularySeed, numberNow).concepts.find(
    (item) => item.id === "numbers",
  )?.evidenceCount,
  0,
);
assert(
  !LearningRecommendationEngine.recommend(
    otherCourse,
    numberIssue,
    buildLearningProfile(otherCourse, numberIssue, vocabularySeed, numberNow),
    vocabularySeed,
    { now: numberNow },
  ).some((item) => item.kind === "number"),
);

const practicedMistake = recordMicroLessonAttempt(wrongGrammar, {
  activityId: grammarActivity.id,
  question: "Qual forma usa tener?",
  selectedOption: "Tengo 31 años",
  correct: true,
});
assert.equal(practicedMistake.microLessonAttempts[0].correct, true);
assert.equal(practicedMistake.events[0].type, "micro_lesson_correct");
assert(
  (buildLearningProfile(
    course,
    practicedMistake,
    vocabularySeed,
    new Date(practicedMistake.microLessonAttempts[0].createdAt),
  ).concepts.find((item) => item.id === "age-tener")?.evidenceCount ?? 0) >
    wrongProfile.concepts.find((item) => item.id === "age-tener")!.evidenceCount,
);

console.log(
  "Learning profile, focused plans, review cards, errors, vocabulary, numbers and micro-lessons verified.",
);
