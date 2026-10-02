import type { GradeResult } from "@/domain/activities/grader";
import type { PronunciationFeedback } from "@/domain/activities/pronunciation";
import type { ReviewSchedule } from "@/domain/review/review-scheduler";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import type { PublicActivity, PublicCourse } from "@/content/public";
import type { Skill } from "@/content/schema";

export type StudentProfile = {
  goal: string;
  dailyMinutes: number;
  daysPerWeek: number;
  level: "A1";
  priorKnowledge: "none" | "some" | "returning";
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
export type PlannedReviewItem = { kind: "word" | "mistake"; id: string };
export type PlannedItem = {
  kind: "activity" | "review";
  id: string;
  title: string;
  minutes: number;
  reviewItems?: PlannedReviewItem[];
};
export type Mistake = {
  id: string;
  activityId: string;
  category: Skill | "spelling";
  originalAnswer: string;
  correctAnswer: string;
  explanation: string;
  timesMissed: number;
  timesCorrect: number;
  lastMissedAt: string;
  lastReviewedAt: string | null;
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

export type StudyEvent = { id: string; type: string; createdAt: string; activityId?: string };
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
  createdAt: string;
};

export type StudyState = {
  profile: StudentProfile;
  completedActivityIds: string[];
  attempts: Attempt[];
  vocabulary: Record<string, VocabularyProgress>;
  mistakes: Record<string, Mistake>;
  sessions: StudySession[];
  events: StudyEvent[];
  reviews: ReviewEntry[];
  assessmentAttempts: AssessmentAttempt[];
  writing: WritingSubmission[];
  speaking: SpeakingSubmission[];
  activeSessionId: string | null;
};

export const initialStudyState: StudyState = {
  profile: {
    goal: "Conversar com confiança",
    dailyMinutes: 45,
    daysPerWeek: 4,
    level: "A1",
    priorKnowledge: "none",
    onboarded: false,
  },
  completedActivityIds: [],
  attempts: [],
  vocabulary: {},
  mistakes: {},
  sessions: [],
  events: [],
  reviews: [],
  assessmentAttempts: [],
  writing: [],
  speaking: [],
  activeSessionId: null,
};

function event(type: string, activityId?: string): StudyEvent {
  return { id: crypto.randomUUID(), type, createdAt: new Date().toISOString(), activityId };
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
      category: activity.skill,
      originalAnswer: answer,
      correctAnswer: result.correctAnswer,
      explanation: result.explanation,
      timesMissed: (previous?.timesMissed ?? 0) + 1,
      timesCorrect: previous?.timesCorrect ?? 0,
      lastMissedAt: createdAt,
      lastReviewedAt: previous?.lastReviewedAt ?? null,
      schedule: ReviewScheduler.afterAnswer(previous?.schedule ?? ReviewScheduler.initial(), false),
    };
  } else if (mistakes[activity.id]) {
    const previous = mistakes[activity.id];
    mistakes[activity.id] = {
      ...previous,
      timesCorrect: previous.timesCorrect + 1,
      lastReviewedAt: createdAt,
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
  correct: boolean,
): StudyState {
  const current = state.vocabulary[vocabularyId] ?? {
    id: crypto.randomUUID(),
    status: "new",
    schedule: ReviewScheduler.initial(),
  };
  const schedule = ReviewScheduler.afterAnswer(current.schedule, correct);
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
        status: correct ? (schedule.masteryScore >= 75 ? "known" : "learning") : "difficult",
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
      event(correct ? "flashcard_known" : "flashcard_missed", vocabularyId),
      event("review_completed", vocabularyId),
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
