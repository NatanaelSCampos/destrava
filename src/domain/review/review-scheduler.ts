export type ReviewSchedule = {
  id: string;
  nextReviewAt: string;
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
  masteryScore: number;
  consecutiveCorrect: number;
};

const intervals = [3, 7, 15, 30];

export class ReviewScheduler {
  static initial(now = new Date()): ReviewSchedule {
    return {
      id: crypto.randomUUID(),
      nextReviewAt: now.toISOString(),
      intervalDays: 0,
      easeFactor: 2.5,
      reviewCount: 0,
      masteryScore: 0,
      consecutiveCorrect: 0,
    };
  }

  static afterAnswer(previous: ReviewSchedule, correct: boolean, now = new Date()): ReviewSchedule {
    const consecutiveCorrect = correct ? previous.consecutiveCorrect + 1 : 0;
    const intervalDays = correct
      ? intervals[Math.min(consecutiveCorrect - 1, intervals.length - 1)]
      : 1;
    const next = new Date(now);
    next.setDate(next.getDate() + intervalDays);
    return {
      id: previous.id,
      nextReviewAt: next.toISOString(),
      intervalDays,
      easeFactor: Math.max(1.3, Math.min(2.5, previous.easeFactor + (correct ? 0.05 : -0.2))),
      reviewCount: previous.reviewCount + 1,
      masteryScore: Math.max(0, Math.min(100, previous.masteryScore + (correct ? 25 : -20))),
      consecutiveCorrect,
    };
  }

  static afterDifficulty(previous: ReviewSchedule, now = new Date()): ReviewSchedule {
    const missed = ReviewScheduler.afterAnswer(previous, false, now);
    return {
      ...missed,
      nextReviewAt: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      intervalDays: 0,
      easeFactor: Math.max(1.3, previous.easeFactor - 0.1),
      masteryScore: Math.max(0, previous.masteryScore - 10),
    };
  }

  static isDue(schedule: ReviewSchedule, now = new Date()) {
    return new Date(schedule.nextReviewAt).getTime() <= now.getTime();
  }
}
