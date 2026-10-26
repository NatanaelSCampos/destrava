import type { InteractiveLessonProgressReceipt } from "@/domain/interactive-lesson/progress-receipt";
import type { GradeResult } from "@/domain/activities/grader";
import type { PronunciationFeedback } from "@/domain/activities/pronunciation";
import type { ReviewSchedule } from "@/domain/review/review-scheduler";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import type { PublicActivity, PublicCourse } from "@/content/public";
import type { Skill } from "@/content/schema";
import { writingFeedbackSchema } from "@/domain/ai/schemas";
import type { NumberMode } from "@/domain/numbers/number-practice";
import type { ReviewStructure } from "@/content/review-structures";
import type { ConversationSession } from "@/domain/conversation/conversation-session";
import type { ImageDescriptionFeedback } from "@/domain/ai/schemas";
import type { AdaptiveAnswer } from "@/domain/study/adaptive-assessment";
import type { ServerAssessmentResult } from "@/content/assessment-results";
import {
  defaultLearningPreferences,
  type LearningPreferences,
  type SelfReportedLevel,
} from "./learning-preferences";

export type StudentProfile = {
  learningPreferences: LearningPreferences;
  selfReportedLevel: SelfReportedLevel | null;
  onboardingStep: number;
  goal: string;
  dailyMinutes: number;
  daysPerWeek: number;
  level: "A1";
  priorKnowledge: "none" | "some" | "returning";
  variantId: string;
  onboarded: boolean;
};

export type Attempt = {
  serverReceipt?: string;
  interactiveReceipt?: true;
  id: string;
  activityId: string;
  answer: string;
  correct: boolean | null;
  skill: Skill;
  createdAt: string;
  sessionId: string | null;
  variantId?: string;
};

export type VocabularyProgress = {
  id: string;
  status: "new" | "learning" | "known" | "difficult";
  schedule: ReviewSchedule;
};
export type SessionMode = "guided" | "difficulties";
export type PlannedReviewItem = {
  kind: "word" | "mistake" | "structure" | "pronunciation";
  id: string;
};
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
  /** Internal checkpoint, independent of learning evidence. */
  cursor?: number;
  paused?: boolean;
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
  unitId?: string;
  startedAt: string;
  finishedAt: string;
  objectiveScore: number | null;
} & Partial<
  Omit<
    ServerAssessmentResult,
    "id" | "assessmentId" | "unitId" | "startedAt" | "finishedAt" | "objectiveScore" | "source"
  >
> & { source?: "server" | "historical" };
export type WritingSubmission = {
  interactiveReceipt?: true;
  id: string;
  activityId: string;
  sessionId?: string | null;
  text: string;
  createdAt: string;
  feedback?: unknown;
};
export type SpeakingSubmission = {
  interactiveReceipt?: true;
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

export type RegionalAttempt = {
  id: string;
  topicId: string;
  selectedAnswer: string;
  correct: boolean;
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
  unitId?: string;
  assessmentId?: string;
  method?: "adaptive";
  purpose?: ServerAssessmentResult["purpose"];
  contentVersion?: string;
  source?: "server" | "historical";
  objectiveScore?: number | null;
  passed?: boolean | null;
  status?: ServerAssessmentResult["status"];
  responseKey?: string;
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
  regionalAttempts: RegionalAttempt[];
  microLessonAttempts: MicroLessonAttempt[];
  conversations: ConversationSession[];
  imageDescriptions: ImageDescriptionAttempt[];
  adaptiveAssessments: AdaptiveAssessmentAttempt[];
  /** Submitted adaptive prefixes only. No editor drafts or official results. */
  adaptiveProgress?: import("@/domain/assessments/adaptive-progress").AdaptiveProgress[];
  activeSessionId: string | null;
};

export const initialStudyState: StudyState = {
  profile: {
    learningPreferences: defaultLearningPreferences,
    selfReportedLevel: null,
    onboardingStep: 0,
    goal: "Conversar com confiança",
    dailyMinutes: 45,
    daysPerWeek: 4,
    level: "A1",
    priorKnowledge: "none",
    variantId: "",
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
  regionalAttempts: [],
  microLessonAttempts: [],
  conversations: [],
  imageDescriptions: [],
  adaptiveAssessments: [],
  activeSessionId: null,
};

/** Optional server replay context; ordinary recording retains its clock and IDs. */
export type StudyRecordingContext = { now?: Date; idFor?: (key: string) => string };
const recordingId = (context: StudyRecordingContext | undefined, key: string) =>
  context?.idFor?.(key) ?? crypto.randomUUID();

export function recordAdaptiveAssessment(
  state: StudyState,
  course: PublicCourse,
  input: Omit<AdaptiveAssessmentAttempt, "id" | "finishedAt"> & {
    id?: string;
    finishedAt?: string;
  },
  context?: StudyRecordingContext,
): StudyState {
  if (
    input.courseId !== course.id ||
    (input.unitId && !course.units.some((unit) => unit.id === input.unitId))
  )
    return state;
  const activities = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) =>
        lesson.activities.map((activity) => [activity.id, activity] as const),
      ),
    ),
  );
  const finishedAt = input.finishedAt ?? (context?.now ?? new Date()).toISOString();
  const mistakes = { ...state.mistakes };
  const reviewEvents: StudyEvent[] = [];
  for (const answer of input.answers) {
    if (answer.ceiling) continue;
    const activity = activities.get(answer.activityId);
    if (answer.correct || !activity || !answer.correctAnswer?.trim()) continue;
    const previous = mistakes[answer.activityId];
    const schedule = previous
      ? {
          ...ReviewScheduler.afterAnswer(previous.schedule, false, context?.now),
          nextReviewAt: finishedAt,
        }
      : ReviewScheduler.initial(
          new Date(finishedAt),
          context?.idFor?.("adaptive:schedule:" + activity.id),
        );
    mistakes[answer.activityId] = {
      id: previous?.id ?? recordingId(context, "adaptive:mistake:" + activity.id),
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
      id: recordingId(context, "adaptive:review:" + activity.id),
      type: "adaptive_review_scheduled",
      activityId: answer.activityId,
      createdAt: finishedAt,
    });
  }
  return {
    ...state,
    mistakes,
    adaptiveAssessments: [
      { ...input, id: input.id ?? recordingId(context, "adaptive:attempt"), finishedAt },
      ...(state.adaptiveAssessments ?? []).filter((item) => !input.id || item.id !== input.id),
    ].slice(0, 20),
    events: [
      {
        id: recordingId(context, "adaptive:completed"),
        type: "adaptive_assessment_completed",
        itemId: input.assessmentId ?? input.unitId,
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

export function recordRegionalAttempt(
  state: StudyState,
  input: Pick<RegionalAttempt, "topicId" | "selectedAnswer" | "correct">,
): StudyState {
  const createdAt = new Date().toISOString();
  return {
    ...state,
    regionalAttempts: [
      { ...input, id: crypto.randomUUID(), createdAt },
      ...(state.regionalAttempts ?? []),
    ].slice(0, 200),
    events: [
      {
        id: crypto.randomUUID(),
        type: input.correct ? "regional_check_correct" : "regional_check_wrong",
        itemId: input.topicId,
        metadata: { selectedAnswer: input.selectedAnswer },
        createdAt,
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

function event(type: string, activityId?: string, context?: StudyRecordingContext): StudyEvent {
  return {
    id: recordingId(context, "event:" + type + ":" + (activityId ?? "")),
    type,
    createdAt: (context?.now ?? new Date()).toISOString(),
    activityId,
  };
}

function itemEvent(type: string, itemId: string): StudyEvent {
  return { id: crypto.randomUUID(), type, createdAt: new Date().toISOString(), itemId };
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
    const schedule = ReviewScheduler.afterAnswer(
      previous?.schedule ?? ReviewScheduler.initial(now),
      correct,
      now,
    );
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

export function markActivityComplete(
  state: StudyState,
  activityId: string,
  context?: StudyRecordingContext,
): StudyState {
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
      : [event("lesson_completed", activityId, context), ...state.events],
  };
}

export function recordAttempt(
  state: StudyState,
  activity: PublicActivity,
  answer: string,
  result: GradeResult,
  context?: StudyRecordingContext,
): StudyState {
  const now = context?.now ?? new Date();
  const createdAt = now.toISOString();
  const attempt: Attempt = {
    id: recordingId(context, "attempt:" + activity.id),
    activityId: activity.id,
    answer,
    correct: result.correct,
    ...(result.completionReceipt ? { serverReceipt: result.completionReceipt } : {}),
    ...(result.variantId ? { variantId: result.variantId } : {}),
    skill: activity.skill,
    createdAt,
    sessionId: state.activeSessionId,
  };
  const mistakes = { ...state.mistakes };
  if (!result.correct) {
    const previous = mistakes[activity.id];
    mistakes[activity.id] = {
      id: previous?.id ?? recordingId(context, "mistake:" + activity.id),
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
      schedule: ReviewScheduler.afterAnswer(
        previous?.schedule ??
          ReviewScheduler.initial(now, context?.idFor?.("schedule:" + activity.id)),
        false,
        now,
      ),
    };
  } else if (mistakes[activity.id]) {
    const previous = mistakes[activity.id];
    mistakes[activity.id] = {
      ...previous,
      timesCorrect: previous.timesCorrect + 1,
      lastReviewedAt: createdAt,
      lastCorrectAt: createdAt,
      schedule: ReviewScheduler.afterAnswer(previous.schedule, true, now),
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
      event(result.correct ? "exercise_correct" : "exercise_wrong", activity.id, context),
      event("exercise_answered", activity.id, context),
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
      itemEvent(
        correct
          ? "flashcard_known"
          : rating === "difficult"
            ? "flashcard_difficult"
            : "flashcard_missed",
        vocabularyId,
      ),
      itemEvent("review_completed", vocabularyId),
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
        lastCorrectAt: correct ? new Date().toISOString() : (mistake.lastCorrectAt ?? null),
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

function matchesAssessmentResult(course: PublicCourse, result: ServerAssessmentResult) {
  const definition = course.assessments.find((item) => item.id === result.assessmentId);
  return Boolean(
    definition &&
    result.courseId === course.id &&
    result.contentVersion === course.contentVersion &&
    result.purpose === definition.purpose &&
    result.method === definition.method,
  );
}

export function recordServerAssessment(
  state: StudyState,
  course: PublicCourse,
  result: ServerAssessmentResult,
  context?: StudyRecordingContext,
): StudyState {
  if (!matchesAssessmentResult(course, result)) return state;
  if (result.method === "adaptive") {
    if (
      state.adaptiveAssessments.some(
        (item) => item.id === result.id && item.responseKey === result.responseKey,
      )
    )
      return state;
    if (result.answers.some((answer) => answer.correct === null || !answer.difficulty))
      return state;
    return recordAdaptiveAssessment(
      state,
      course,
      {
        ...result,
        method: "adaptive",
        answers: result.answers.map((answer) => ({
          ...answer,
          correct: answer.correct === true,
          difficulty: answer.difficulty!,
        })),
      },
      context,
    );
  }
  if (
    state.assessmentAttempts.some(
      (item) => item.id === result.id && item.responseKey === result.responseKey,
    )
  )
    return state;
  let next = state;
  const activities = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) => lesson.activities.map((item) => [item.id, item] as const)),
    ),
  );
  for (const answer of result.answers) {
    const activity = activities.get(answer.activityId);
    if (!activity) continue;
    if (answer.correct !== null)
      next = recordAttempt(
        next,
        activity,
        answer.answer,
        {
          variantId: answer.variantId,
          correct: answer.correct,
          correctAnswer: answer.correctAnswer ?? "",
          explanation: answer.explanation ?? "",
        },
        context,
      );
    else if (activity.type === "writing") {
      next = markActivityComplete(next, activity.id, context);
      if (
        !next.writing.some((item) => item.activityId === activity.id && item.text === answer.answer)
      )
        next = {
          ...next,
          writing: [
            {
              id: recordingId(context, "assessment:writing:" + activity.id),
              activityId: activity.id,
              text: answer.answer,
              createdAt: result.finishedAt,
              sessionId: state.activeSessionId,
            },
            ...next.writing,
          ],
        };
    }
  }
  return {
    ...next,
    assessmentAttempts: [
      result,
      ...next.assessmentAttempts.filter((item) => item.id !== result.id),
    ],
    events: [
      {
        id: recordingId(context, "assessment:completed"),
        type: "assessment_completed",
        itemId: result.assessmentId,
        createdAt: result.finishedAt,
        metadata: { purpose: result.purpose, method: result.method },
      },
      ...next.events,
    ],
  };
}

/** Refresh current results from the server; cached rows are retained only as history. */
export function restoreServerAssessmentResults(
  state: StudyState,
  course: PublicCourse,
  results: ServerAssessmentResult[],
): StudyState {
  const fixed: AssessmentAttempt[] = state.assessmentAttempts.map((item) =>
    item.source === "server" ? { ...item, source: "historical" as const } : item,
  );
  const adaptive: AdaptiveAssessmentAttempt[] = state.adaptiveAssessments.map((item) =>
    item.source === "server" ? { ...item, source: "historical" as const } : item,
  );
  const valid = results.filter((result) => matchesAssessmentResult(course, result));
  for (const result of valid) {
    if (result.method === "fixed") {
      const existing = fixed.findIndex((item) => item.id === result.id);
      if (existing >= 0) fixed.splice(existing, 1);
      fixed.push(result);
    } else if (result.answers.every((answer) => answer.correct !== null && answer.difficulty)) {
      const existing = adaptive.findIndex((item) => item.id === result.id);
      if (existing >= 0) adaptive.splice(existing, 1);
      adaptive.push({
        ...result,
        method: "adaptive",
        answers: result.answers.map((answer) => ({
          ...answer,
          correct: answer.correct === true,
          difficulty: answer.difficulty!,
        })),
      });
    }
  }
  const completed = new Set(state.completedActivityIds);
  for (const result of valid.filter((item) => item.method === "fixed"))
    for (const answer of result.answers) completed.add(answer.activityId);
  return {
    ...state,
    completedActivityIds: [...completed],
    assessmentAttempts: fixed.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)),
    adaptiveAssessments: adaptive.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)),
  };
}

/** Reuse the existing projection rules; this DTO cannot authorize interactive session progress. */
export function recordInteractiveLessonReceipt(
  state: StudyState,
  course: PublicCourse,
  receipt: InteractiveLessonProgressReceipt,
): StudyState {
  const proof = receipt.evidence;
  if (
    state.courseId !== course.id ||
    proof.courseId !== course.id ||
    proof.contentVersion !== course.contentVersion
  )
    return state;
  const activity = course.units
    .flatMap((unit) => unit.lessons)
    .find((lesson) => lesson.id === proof.lessonId)
    ?.activities.find((item) => item.id === proof.activityId);
  if (
    !activity ||
    (proof.kind === "speaking_submitted") !== (activity.type === "speaking") ||
    (proof.kind === "writing_submitted") !== (activity.type === "writing")
  )
    return state;
  const context: StudyRecordingContext = {
    now: new Date(receipt.createdAt),
    idFor: (key) => {
      if (key === "attempt:" + activity.id) return proof.attemptId;
      const id = receipt.recordingIds[key];
      if (!id) throw new Error("Recibo de aula sem identidade de projeção.");
      return id;
    },
  };
  if (proof.kind === "objective_correct") {
    if (
      !receipt.grade ||
      receipt.grade.correct !== proof.accepted ||
      state.attempts.some((item) => item.id === proof.attemptId)
    )
      return state;
    // A receipt belongs to the interactive session; never credit an unrelated active study session during replay.
    const next = recordAttempt(
      { ...state, activeSessionId: null },
      activity,
      receipt.answer,
      receipt.grade,
      context,
    );
    const newer = state.attempts.some(
      (item) =>
        item.activityId === activity.id &&
        Date.parse(item.createdAt) > Date.parse(receipt.createdAt),
    );
    return {
      ...next,
      activeSessionId: state.activeSessionId,
      mistakes: newer ? state.mistakes : next.mistakes,
      attempts: next.attempts.map((item) =>
        item.id === proof.attemptId ? { ...item, interactiveReceipt: true } : item,
      ),
    };
  }
  if (!proof.accepted) return state;
  if (proof.kind === "writing_submitted") {
    if (state.writing.some((item) => item.id === proof.attemptId)) return state;
    const next = markActivityComplete({ ...state, activeSessionId: null }, activity.id, context);
    return {
      ...next,
      activeSessionId: state.activeSessionId,
      writing: [
        {
          id: proof.attemptId,
          interactiveReceipt: true,
          activityId: activity.id,
          sessionId: null,
          text: receipt.answer,
          createdAt: receipt.createdAt,
        },
        ...next.writing,
      ],
    };
  }
  if (state.speaking.some((item) => item.id === proof.attemptId)) return state;
  const next = markActivityComplete({ ...state, activeSessionId: null }, activity.id, context);
  return {
    ...next,
    activeSessionId: state.activeSessionId,
    speaking: [
      {
        id: proof.attemptId,
        interactiveReceipt: true,
        activityId: activity.id,
        sessionId: null,
        transcription: receipt.answer,
        audioUrl: null,
        createdAt: receipt.createdAt,
        practiceMode: "lesson",
      },
      ...next.speaking,
    ],
  };
}
