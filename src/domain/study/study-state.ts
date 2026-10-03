import type { GradeResult } from "@/domain/activities/grader";
import type { PronunciationFeedback } from "@/domain/activities/pronunciation";
import type { ReviewSchedule } from "@/domain/review/review-scheduler";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import type { PublicActivity, PublicCourse } from "@/content/public";
import type { Skill } from "@/content/schema";
import { writingFeedbackSchema } from "@/domain/ai/schemas";
import type { NumberMode } from "@/domain/numbers/number-practice";
import type { SpanishRegion } from "@/content/spanish-regions";
import type { ReviewStructure } from "@/content/review-structures";
import type { ConversationSession } from "@/domain/conversation/conversation-session";
import type { ImageDescriptionFeedback } from "@/domain/ai/schemas";
import type { AdaptiveAnswer } from "@/domain/study/adaptive-assessment";

export type StudentProfile = {
  goal: string;
  dailyMinutes: number;
  daysPerWeek: number;
  level: "A1";
  priorKnowledge: "none" | "some" | "returning";
  spanishRegion: SpanishRegion;
  onboarded: boolean;
};

export type Attempt = {
  id: string;
  activityId: string;
  answer: string;
  correct: boolean | null;
  skill: Skill;
  createdAt: string;
  sessionId: string | null;
};

export type VocabularyProgress = {
  id: string;
  status: "new" | "learning" | "known" | "difficult";
  schedule: ReviewSchedule;
};
export type SessionMode = "guided" | "difficulties";
export type PlannedReviewItem = { kind: "word" | "mistake" | "structure" | "pronunciation"; id: string };
export type StructureReviewProgress = { id: string; schedule: ReviewSchedule };
export type PronunciationReviewProgress = {
  id: string;
  activityId: string;
  term: string;
  referenceText: string;
  lastAccuracy: number | null;
  schedule: ReviewSchedule;
};
export type StructureReviewAttempt = {
  id: string;
  structureId: string;
  correct: boolean;
  createdAt: string;
};
export type PlannedItem = {
  kind: "activity" | "review" | "conversation";
  id: string;
  title: string;
  minutes: number;
  reviewItems?: PlannedReviewItem[];
};
export type Mistake = {
  id: string;
  activityId: string;
  courseId?: string;
  languageCode?: string;
  topicId?: string;
  category: Skill | "spelling";
  originalAnswer: string;
  correctAnswer: string;
  explanation: string;
  timesMissed: number;
  timesCorrect: number;
  lastMissedAt: string;
  lastReviewedAt: string | null;
  lastCorrectAt?: string | null;
  schedule: ReviewSchedule;
};

export type StudySession = {
  id: string;
  unitId: string;
  mode?: SessionMode;
  targetMinutes?: number;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number;
  activityIds: string[];
  correct: number;
  wrong: number;
  wordsReviewed: number;
  plan: PlannedItem[];
};

export type StudyEvent = {
  id: string;
  type: string;
  createdAt: string;
  activityId?: string;
  itemId?: string;
  metadata?: Record<string, string | number | boolean>;
};
export type ReviewEntry = {
  id: string;
  scheduleId: string;
  sessionId?: string | null;
  correct: boolean;
  reviewedAt: string;
  intervalBefore: number;
  intervalAfter: number;
};
export type AssessmentAttempt = {
  id: string;
  assessmentId: string;
  unitId: string;
  startedAt: string;
  finishedAt: string;
  objectiveScore: number;
};
export type WritingSubmission = {
  id: string;
  activityId: string;
  sessionId?: string | null;
  text: string;
  createdAt: string;
  feedback?: unknown;
};
export type SpeakingSubmission = {
  id: string;
  activityId: string;
  sessionId?: string | null;
  transcription: string;
  audioUrl: string | null;
  audioPath?: string;
  feedback?: PronunciationFeedback;
  practiceMode?: "lesson" | "shadowing" | "memory" | "own";
  createdAt: string;
};

export type NumberAttempt = {
  id: string;
  promptId: string;
  mode: NumberMode;
  answer: string;
  correct: boolean;
  score: number;
  createdAt: string;
};

export type MicroLessonAttempt = {
  id: string;
  activityId: string;
  question: string;
  selectedOption: string;
  correct: boolean;
  createdAt: string;
};

export type ImageDescriptionAttempt = {
  id: string;
  sceneId: string;
  courseId: string;
  transcript: string;
  inputMode: "speech" | "text";
  feedback: ImageDescriptionFeedback;
  createdAt: string;
};

export type AdaptiveAssessmentAttempt = {
  id: string;
  courseId: string;
  unitId: string;
  answers: AdaptiveAnswer[];
  startedAt: string;
  finishedAt: string;
};

export type StudyState = {
  courseId?: string;
  languageCode?: string;
  profile: StudentProfile;
  completedActivityIds: string[];
  attempts: Attempt[];
  vocabulary: Record<string, VocabularyProgress>;
  structureReviews: Record<string, StructureReviewProgress>;
  pronunciationReviews: Record<string, PronunciationReviewProgress>;
  structureAttempts: StructureReviewAttempt[];
  mistakes: Record<string, Mistake>;
  sessions: StudySession[];
  events: StudyEvent[];
  reviews: ReviewEntry[];
  assessmentAttempts: AssessmentAttempt[];
  writing: WritingSubmission[];
  speaking: SpeakingSubmission[];
  numberAttempts: NumberAttempt[];
  microLessonAttempts: MicroLessonAttempt[];
  conversations: ConversationSession[];
  imageDescriptions: ImageDescriptionAttempt[];
  adaptiveAssessments: AdaptiveAssessmentAttempt[];
  activeSessionId: string | null;
};

export const initialStudyState: StudyState = {
  profile: {
    goal: "Conversar com confiança",
    dailyMinutes: 45,
    daysPerWeek: 4,
    level: "A1",
    priorKnowledge: "none",
    spanishRegion: "general",
    onboarded: false,
  },
  completedActivityIds: [],
  attempts: [],
  vocabulary: {},
  structureReviews: {},
  pronunciationReviews: {},
  structureAttempts: [],
  mistakes: {},
  sessions: [],
  events: [],
  reviews: [],
  assessmentAttempts: [],
  writing: [],
  speaking: [],
  numberAttempts: [],
  microLessonAttempts: [],
  conversations: [],
  imageDescriptions: [],
  adaptiveAssessments: [],
  activeSessionId: null,
};

export function recordAdaptiveAssessment(
  state: StudyState,
  course: PublicCourse,
  input: Omit<AdaptiveAssessmentAttempt, "id" | "finishedAt">,
): StudyState {
  if (input.courseId !== course.id || !course.units.some((unit) => unit.id === input.unitId))
    return state;
  const activities = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) =>
        lesson.activities.map((activity) => [activity.id, activity] as const),
      ),
    ),
  );
  const finishedAt = new Date().toISOString();
  const mistakes = { ...state.mistakes };
  const reviewEvents: StudyEvent[] = [];
  for (const answer of input.answers) {
    const activity = activities.get(answer.activityId);
    if (answer.correct || !activity || !answer.correctAnswer?.trim()) continue;
    const previous = mistakes[answer.activityId];
    const schedule = previous
      ? { ...ReviewScheduler.afterAnswer(previous.schedule, false), nextReviewAt: finishedAt }
      : ReviewScheduler.initial(new Date(finishedAt));
    mistakes[answer.activityId] = {
      id: previous?.id ?? crypto.randomUUID(),
      activityId: answer.activityId,
      courseId: course.id,
      languageCode: course.languageCode,
      topicId: activity.conceptIds[0],
      category: activity.skill,
      originalAnswer: answer.answer,
      correctAnswer: answer.correctAnswer,
      explanation: answer.explanation ?? "Revise a explicação da atividade.",
      timesMissed: (previous?.timesMissed ?? 0) + 1,
      timesCorrect: previous?.timesCorrect ?? 0,
      lastMissedAt: finishedAt,
      lastReviewedAt: previous?.lastReviewedAt ?? null,
      schedule,
    };
    reviewEvents.push({
      id: crypto.randomUUID(),
      type: "adaptive_review_scheduled",
      activityId: answer.activityId,
      createdAt: finishedAt,
    });
  }
  return {
    ...state,
    mistakes,
    adaptiveAssessments: [
      { ...input, id: crypto.randomUUID(), finishedAt },
      ...(state.adaptiveAssessments ?? []),
    ].slice(0, 20),
    events: [
      {
        id: crypto.randomUUID(),
        type: "adaptive_assessment_completed",
        itemId: input.unitId,
        createdAt: finishedAt,
      },
      ...reviewEvents,
      ...state.events,
    ],
  };
}

export function recordNumberAttempt(
  state: StudyState,
  input: Pick<NumberAttempt, "promptId" | "mode" | "answer" | "correct" | "score">,
): StudyState {
  const now = new Date().toISOString();
  return {
    ...state,
    numberAttempts: [
      { ...input, id: crypto.randomUUID(), createdAt: now },
      ...(state.numberAttempts ?? []),
    ],
    events: [
      {
        id: crypto.randomUUID(),
        type: input.correct ? "number_correct" : "number_wrong",
        itemId: input.promptId,
        createdAt: now,
      },
      ...state.events,
    ],
  };
}

export function recordMicroLessonAttempt(
  state: StudyState,
  input: Pick<MicroLessonAttempt, "activityId" | "question" | "selectedOption" | "correct">,
): StudyState {
  const now = new Date().toISOString();
  return {
    ...state,
    microLessonAttempts: [
      { ...input, id: crypto.randomUUID(), createdAt: now },
      ...(state.microLessonAttempts ?? []),
    ],
    events: [
      {
        id: crypto.randomUUID(),
        type: input.correct ? "micro_lesson_correct" : "micro_lesson_wrong",
        activityId: input.activityId,
        createdAt: now,
      },
      ...state.events,
    ],
  };
}

function event(type: string, activityId?: string): StudyEvent {
  return { id: crypto.randomUUID(), type, createdAt: new Date().toISOString(), activityId };
}

function updateEvaluatedMistake(
  state: StudyState,
  activityId: string,
  category: Mistake["category"],
  failed: boolean,
  originalAnswer: string,
  correctAnswer: string,
  explanation: string,
): StudyState {
  const previous = state.mistakes[activityId];
  if (!failed && !previous) return state;
  const now = new Date().toISOString();
  const next: Mistake = failed
    ? {
        id: previous?.id ?? crypto.randomUUID(),
        activityId,
        courseId: state.courseId,
        languageCode: state.languageCode,
        topicId: previous?.topicId,
        category,
        originalAnswer,
        correctAnswer,
        explanation,
        timesMissed: (previous?.timesMissed ?? 0) + 1,
        timesCorrect: previous?.timesCorrect ?? 0,
        lastMissedAt: now,
        lastReviewedAt: previous?.lastReviewedAt ?? null,
        lastCorrectAt: previous?.lastCorrectAt ?? null,
        schedule: ReviewScheduler.afterAnswer(
          previous?.schedule ?? ReviewScheduler.initial(),
          false,
        ),
      }
    : {
        ...previous!,
        timesCorrect: previous!.timesCorrect + 1,
        lastReviewedAt: now,
        lastCorrectAt: now,
        schedule: ReviewScheduler.afterAnswer(previous!.schedule, true),
      };
  return { ...state, mistakes: { ...state.mistakes, [activityId]: next } };
}

export function recordEvaluatedWriting(
  state: StudyState,
  activityId: string,
  text: string,
  feedback: unknown,
): StudyState {
  const result = writingFeedbackSchema.safeParse(feedback);
  if (!result.success) return state;
  const errors = result.data.errors;
  return updateEvaluatedMistake(
    state,
    activityId,
    "writing",
    errors.length > 0,
    text,
    result.data.correctedText,
    errors.map((item) => `${item.excerpt} → ${item.correction}: ${item.explanation}`).join("\n"),
  );
}

export function recordEvaluatedSpeaking(
  state: StudyState,
  activityId: string,
  feedback?: PronunciationFeedback,
): StudyState {
  if (!feedback?.referenceText) return state;
  const weakWords = feedback.words.filter(
    (word) => word.errorType !== "None" || (word.accuracy !== null && word.accuracy < 75),
  );
  const failed = feedback.accuracy < 75 || feedback.fluency < 75 || feedback.completeness < 75;
  const now = new Date();
  const pronunciationReviews = { ...state.pronunciationReviews };
  for (const word of feedback.words) {
    const term = word.text.trim().toLocaleLowerCase();
    if (!term) continue;
    const id = `${activityId}:${term}`;
    const previous = pronunciationReviews[id];
    const correct = word.errorType === "None" && word.accuracy !== null && word.accuracy >= 75;
    if (!previous && correct) continue;
    const schedule = ReviewScheduler.afterAnswer(previous?.schedule ?? ReviewScheduler.initial(now), correct, now);
    pronunciationReviews[id] = {
      id,
      activityId,
      term: word.text,
      referenceText: feedback.referenceText,
      lastAccuracy: word.accuracy,
      schedule: correct ? schedule : { ...schedule, nextReviewAt: now.toISOString() },
    };
  }
  const next = updateEvaluatedMistake(
    state,
    activityId,
    "speaking",
    failed,
    feedback.recognizedText || "Trecho não reconhecido",
    feedback.referenceText,
    weakWords.length
      ? `Trechos para repetir: ${weakWords.map((word) => word.text).join(", ")}. Clareza ${Math.round(feedback.accuracy)}/100; fluência ${Math.round(feedback.fluency)}/100.`
      : `Clareza ${Math.round(feedback.accuracy)}/100; fluência ${Math.round(feedback.fluency)}/100.`,
  );
  return { ...next, pronunciationReviews };
}

export function recordVocabularySignal(
  state: StudyState,
  vocabularyId: string,
  signal: "vocabulary_search" | "vocabulary_audio",
): StudyState {
  const signalCount =
    state.events.filter((item) => item.type === signal && item.itemId === vocabularyId).length + 1;
  const entry: StudyEvent = {
    id: crypto.randomUUID(),
    type: signal,
    itemId: vocabularyId,
    createdAt: new Date().toISOString(),
  };
  if (signalCount < 3 || state.vocabulary[vocabularyId])
    return { ...state, events: [entry, ...state.events] };
  return {
    ...state,
    vocabulary: {
      ...state.vocabulary,
      [vocabularyId]: {
        id: crypto.randomUUID(),
        status: "learning",
        schedule: ReviewScheduler.initial(),
      },
    },
    events: [entry, ...state.events],
  };
}

export function markActivityComplete(state: StudyState, activityId: string): StudyState {
  const alreadyCompleted = state.completedActivityIds.includes(activityId);
  const sessions = state.sessions.map((session) =>
    session.id === state.activeSessionId && !session.activityIds.includes(activityId)
      ? { ...session, activityIds: [...session.activityIds, activityId] }
      : session,
  );
  if (alreadyCompleted && sessions.every((session, index) => session === state.sessions[index]))
    return state;
  return {
    ...state,
    sessions,
    completedActivityIds: alreadyCompleted
      ? state.completedActivityIds
      : [...state.completedActivityIds, activityId],
    events: alreadyCompleted
      ? state.events
      : [event("lesson_completed", activityId), ...state.events],
  };
}

export function recordAttempt(
  state: StudyState,
  activity: PublicActivity,
  answer: string,
  result: GradeResult,
): StudyState {
  const createdAt = new Date().toISOString();
  const attempt: Attempt = {
    id: crypto.randomUUID(),
    activityId: activity.id,
    answer,
    correct: result.correct,
    skill: activity.skill,
    createdAt,
    sessionId: state.activeSessionId,
  };
  const mistakes = { ...state.mistakes };
  if (!result.correct) {
    const previous = mistakes[activity.id];
    mistakes[activity.id] = {
      id: previous?.id ?? crypto.randomUUID(),
      activityId: activity.id,
      courseId: state.courseId,
      languageCode: state.languageCode,
      topicId: activity.conceptIds[0],
      category: activity.skill,
      originalAnswer: answer,
      correctAnswer: result.correctAnswer,
      explanation: result.explanation,
      timesMissed: (previous?.timesMissed ?? 0) + 1,
      timesCorrect: previous?.timesCorrect ?? 0,
      lastMissedAt: createdAt,
      lastReviewedAt: previous?.lastReviewedAt ?? null,
      lastCorrectAt: previous?.lastCorrectAt ?? null,
      schedule: ReviewScheduler.afterAnswer(previous?.schedule ?? ReviewScheduler.initial(), false),
    };
  } else if (mistakes[activity.id]) {
    const previous = mistakes[activity.id];
    mistakes[activity.id] = {
      ...previous,
      timesCorrect: previous.timesCorrect + 1,
      lastReviewedAt: createdAt,
      lastCorrectAt: createdAt,
      schedule: ReviewScheduler.afterAnswer(previous.schedule, true),
    };
  }
  const sessions = state.sessions.map((session) =>
    session.id === state.activeSessionId
      ? {
          ...session,
          activityIds: [...session.activityIds, activity.id],
          correct: session.correct + Number(result.correct),
          wrong: session.wrong + Number(!result.correct),
        }
      : session,
  );
  return {
    ...state,
    mistakes,
    sessions,
    attempts: [attempt, ...state.attempts],
    completedActivityIds: state.completedActivityIds.includes(activity.id)
      ? state.completedActivityIds
      : [...state.completedActivityIds, activity.id],
    events: [
      event(result.correct ? "exercise_correct" : "exercise_wrong", activity.id),
      event("exercise_answered", activity.id),
      ...state.events,
    ],
  };
}

export function reviewVocabulary(
  state: StudyState,
  vocabularyId: string,
  rating: boolean | "difficult",
): StudyState {
  const correct = rating === true;
  const current = state.vocabulary[vocabularyId] ?? {
    id: crypto.randomUUID(),
    status: "new",
    schedule: ReviewScheduler.initial(),
  };
  const schedule =
    rating === "difficult"
      ? ReviewScheduler.afterDifficulty(current.schedule)
      : ReviewScheduler.afterAnswer(current.schedule, correct);
  const sessions = state.sessions.map((session) =>
    session.id === state.activeSessionId
      ? { ...session, wordsReviewed: session.wordsReviewed + 1 }
      : session,
  );
  return {
    ...state,
    sessions,
    vocabulary: {
      ...state.vocabulary,
      [vocabularyId]: {
        id: current.id,
        status: correct
          ? schedule.masteryScore >= 75
            ? "known"
            : "learning"
          : rating === "difficult"
            ? "difficult"
            : "learning",
        schedule,
      },
    },
    reviews: [
      {
        id: crypto.randomUUID(),
        scheduleId: schedule.id,
        sessionId: state.activeSessionId,
        correct,
        reviewedAt: new Date().toISOString(),
        intervalBefore: current.schedule.intervalDays,
        intervalAfter: schedule.intervalDays,
      },
      ...state.reviews,
    ],
    events: [
      event(
        correct
          ? "flashcard_known"
          : rating === "difficult"
            ? "flashcard_difficult"
            : "flashcard_missed",
        vocabularyId,
      ),
      event("review_completed", vocabularyId),
      ...state.events,
    ],
  };
}

export function reviewStructure(
  state: StudyState,
  structureId: string,
  correct: boolean,
  structures: ReadonlyArray<ReviewStructure>,
): StudyState {
  if (!structures.some((item) => item.id === structureId)) return state;
  const current = state.structureReviews?.[structureId] ?? {
    id: crypto.randomUUID(),
    schedule: ReviewScheduler.initial(),
  };
  const schedule = ReviewScheduler.afterAnswer(current.schedule, correct);
  const now = new Date().toISOString();
  return {
    ...state,
    structureReviews: {
      ...state.structureReviews,
      [structureId]: { id: current.id, schedule },
    },
    structureAttempts: [
      { id: crypto.randomUUID(), structureId, correct, createdAt: now },
      ...(state.structureAttempts ?? []),
    ],
    events: [
      {
        id: crypto.randomUUID(),
        type: correct ? "structure_known" : "structure_missed",
        itemId: structureId,
        createdAt: now,
      },
      ...state.events,
    ],
  };
}

export function reviewMistake(state: StudyState, activityId: string, correct: boolean): StudyState {
  const mistake = state.mistakes[activityId];
  if (!mistake) return state;
  const schedule = ReviewScheduler.afterAnswer(mistake.schedule, correct);
  return {
    ...state,
    mistakes: {
      ...state.mistakes,
      [activityId]: {
        ...mistake,
        timesCorrect: mistake.timesCorrect + Number(correct),
        timesMissed: mistake.timesMissed + Number(!correct),
        lastReviewedAt: new Date().toISOString(),
        lastCorrectAt: correct ? new Date().toISOString() : mistake.lastCorrectAt ?? null,
        schedule,
      },
    },
    reviews: [
      {
        id: crypto.randomUUID(),
        scheduleId: schedule.id,
        sessionId: state.activeSessionId,
        correct,
        reviewedAt: new Date().toISOString(),
        intervalBefore: mistake.schedule.intervalDays,
        intervalAfter: schedule.intervalDays,
      },
      ...state.reviews,
    ],
    events: [event("review_completed", activityId), ...state.events],
  };
}

const objectiveTypes = new Set([
  "multiple_choice",
  "true_false",
  "fill_blank",
  "ordering",
  "short_answer",
  "listening",
]);

export function reconcileAssessments(state: StudyState, course: PublicCourse): StudyState {
  let next = state;
  for (const unit of course.units) {
    const lesson = unit.lessons.find((item) =>
      item.activities.some((activity) => activity.type === "quiz"),
    );
    if (!lesson) continue;
    const objective = lesson.activities.filter((activity) => objectiveTypes.has(activity.type));
    const writing = lesson.activities.filter((activity) => activity.type === "writing");
    const attempts = objective.map((activity) =>
      state.attempts.find((attempt) => attempt.activityId === activity.id),
    );
    const submissions = writing.map((activity) =>
      state.writing.find((submission) => submission.activityId === activity.id),
    );
    if (attempts.some((item) => !item) || submissions.some((item) => !item)) continue;
    const dates = [
      ...attempts.map((item) => item!.createdAt),
      ...submissions.map((item) => item!.createdAt),
    ].sort();
    const assessmentId = `${unit.id}-final`;
    const latest = next.assessmentAttempts.find((item) => item.assessmentId === assessmentId);
    if (latest && dates.some((date) => date <= latest.finishedAt)) continue;
    const objectiveScore = objective.length
      ? Math.round((100 * attempts.filter((item) => item?.correct).length) / objective.length)
      : 0;
    const finishedAt = new Date().toISOString();
    next = {
      ...next,
      assessmentAttempts: [
        {
          id: crypto.randomUUID(),
          assessmentId,
          unitId: unit.id,
          startedAt: dates[0] ?? finishedAt,
          finishedAt,
          objectiveScore,
        },
        ...next.assessmentAttempts,
      ],
      events: [
        { id: crypto.randomUUID(), type: "assessment_completed", createdAt: finishedAt },
        ...next.events,
      ],
    };
  }
  return next;
}
