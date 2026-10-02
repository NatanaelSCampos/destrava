import type { PublicCourse } from "@/content/public";
import type { Skill } from "@/content/schema";
import { writingFeedbackSchema } from "@/domain/ai/schemas";
import type { StudyState } from "./study-state";

export type LearningSkill = Skill | "pronunciation" | "fluency" | "comprehension";

export type MasteryMetric = {
  id: string;
  label: string;
  score: number | null;
  evidenceCount: number;
  lastPracticedAt: string | null;
};

export type LearningProfile = {
  courseId: string;
  languageCode: string;
  skills: MasteryMetric[];
  topics: MasteryMetric[];
  concepts: MasteryMetric[];
  items: MasteryMetric[];
};

type Evidence = { score: number; at: string };

const skillLabels: Array<{ id: LearningSkill; label: string }> = [
  { id: "vocabulary", label: "Vocabulário" },
  { id: "grammar", label: "Gramática" },
  { id: "listening", label: "Escuta" },
  { id: "reading", label: "Leitura" },
  { id: "writing", label: "Escrita" },
  { id: "speaking", label: "Fala" },
  { id: "pronunciation", label: "Pronúncia" },
  { id: "fluency", label: "Fluência" },
  { id: "comprehension", label: "Compreensão" },
];

function addEvidence(bucket: Map<string, Evidence[]>, id: string, score: number, at: string) {
  if (!Number.isFinite(score) || Number.isNaN(Date.parse(at))) return;
  const entries = bucket.get(id) ?? [];
  entries.push({ score: Math.max(0, Math.min(100, score)), at });
  bucket.set(id, entries);
}

function metric(id: string, label: string, evidence: Evidence[], now: Date): MasteryMetric {
  if (!evidence.length) return { id, label, score: null, evidenceCount: 0, lastPracticedAt: null };
  const nowMs = now.getTime();
  let totalWeight = 1.5;
  let weightedScore = 75;
  let latest = 0;
  for (const item of evidence) {
    const at = new Date(item.at).getTime();
    const ageDays = Math.max(0, (nowMs - at) / 86_400_000);
    const weight = Math.max(0.15, Math.exp(-ageDays / 60));
    totalWeight += weight;
    weightedScore += item.score * weight;
    latest = Math.max(latest, at);
  }
  let score = weightedScore / totalWeight;
  const daysSincePractice = Math.max(0, (nowMs - latest) / 86_400_000);
  if (score > 50 && daysSincePractice > 30) score -= Math.min(15, (daysSincePractice - 30) / 6);
  return {
    id,
    label,
    score: Math.round(Math.max(0, Math.min(100, score))),
    evidenceCount: evidence.length,
    lastPracticedAt: new Date(latest).toISOString(),
  };
}

export function buildLearningProfile(
  course: PublicCourse,
  state: StudyState,
  vocabularyItems: ReadonlyArray<{ id: string; spanish: string; lessonId: string }>,
  now = new Date(),
): LearningProfile {
  const activities = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) =>
        lesson.activities.map((activity) => [activity.id, { activity, lesson }] as const),
      ),
    ),
  );
  const skillEvidence = new Map<string, Evidence[]>();
  const topicEvidence = new Map<string, Evidence[]>();
  const conceptEvidence = new Map<string, Evidence[]>();
  const itemEvidence = new Map<string, Evidence[]>();

  function addActivityScore(activityId: string, score: number, at: string, skill?: LearningSkill) {
    const context = activities.get(activityId);
    if (!context) return;
    addEvidence(skillEvidence, skill ?? context.activity.skill, score, at);
    addEvidence(topicEvidence, context.lesson.id, score, at);
    for (const conceptId of context.activity.conceptIds)
      addEvidence(conceptEvidence, conceptId, score, at);
    if (context.activity.skill === "reading" || context.activity.skill === "listening")
      addEvidence(skillEvidence, "comprehension", score, at);
  }

  for (const attempt of state.attempts) {
    if (attempt.correct === null) continue;
    addActivityScore(attempt.activityId, attempt.correct ? 100 : 0, attempt.createdAt);
  }

  const mistakeBySchedule = new Map(
    Object.values(state.mistakes).map((mistake) => [mistake.schedule.id, mistake.activityId]),
  );
  for (const review of state.reviews) {
    const activityId = mistakeBySchedule.get(review.scheduleId);
    if (activityId) addActivityScore(activityId, review.correct ? 100 : 0, review.reviewedAt);
  }

  for (const submission of state.writing) {
    if (!activities.has(submission.activityId)) continue;
    const result = writingFeedbackSchema.safeParse(submission.feedback);
    if (!result.success) continue;
    const scores = result.data.score;
    addActivityScore(
      submission.activityId,
      (scores.grammar + scores.vocabulary + scores.clarity) / 3,
      submission.createdAt,
      "writing",
    );
    addEvidence(skillEvidence, "grammar", scores.grammar, submission.createdAt);
    addEvidence(skillEvidence, "vocabulary", scores.vocabulary, submission.createdAt);
  }

  for (const submission of state.speaking) {
    if (!activities.has(submission.activityId) || !submission.feedback) continue;
    const { accuracy, fluency, completeness } = submission.feedback;
    addActivityScore(
      submission.activityId,
      (accuracy + fluency + completeness) / 3,
      submission.createdAt,
      "speaking",
    );
    addEvidence(skillEvidence, "pronunciation", accuracy, submission.createdAt);
    addEvidence(skillEvidence, "fluency", fluency, submission.createdAt);
    for (const word of submission.feedback.words) {
      if (word.accuracy !== null)
        addEvidence(
          itemEvidence,
          `pronunciation:${word.text.toLowerCase()}`,
          word.accuracy,
          submission.createdAt,
        );
    }
  }

  const latestReview = new Map<string, string>();
  for (const review of state.reviews) {
    const previous = latestReview.get(review.scheduleId);
    if (!previous || review.reviewedAt > previous)
      latestReview.set(review.scheduleId, review.reviewedAt);
  }
  const lessons = new Set(course.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)));
  for (const word of vocabularyItems) {
    if (!lessons.has(word.lessonId)) continue;
    const progress = state.vocabulary[word.id];
    if (!progress || progress.status === "new") continue;
    const score = progress.schedule.reviewCount
      ? progress.schedule.masteryScore
      : progress.status === "known"
        ? 70
        : progress.status === "difficult"
          ? 25
          : 50;
    const at = latestReview.get(progress.schedule.id) ?? progress.schedule.nextReviewAt;
    addEvidence(skillEvidence, "vocabulary", score, at);
    addEvidence(topicEvidence, word.lessonId, score, at);
    addEvidence(itemEvidence, `word:${word.id}`, score, at);
  }

  const skillMetrics = skillLabels.map(({ id, label }) =>
    metric(id, label, skillEvidence.get(id) ?? [], now),
  );
  const topicMetrics = course.units.flatMap((unit) =>
    unit.lessons.map((lesson) =>
      metric(lesson.id, lesson.title, topicEvidence.get(lesson.id) ?? [], now),
    ),
  );
  const conceptMetrics = course.learningConcepts.map(({ id, label }) =>
    metric(id, label, conceptEvidence.get(id) ?? [], now),
  );
  const itemMetrics = [
    ...vocabularyItems
      .filter((word) => itemEvidence.has(`word:${word.id}`))
      .map((word) =>
        metric(`word:${word.id}`, word.spanish, itemEvidence.get(`word:${word.id}`) ?? [], now),
      ),
    ...[...itemEvidence.entries()]
      .filter(([id]) => id.startsWith("pronunciation:"))
      .map(([id, evidence]) => metric(id, id.slice("pronunciation:".length), evidence, now)),
  ];

  return {
    courseId: course.id,
    languageCode: course.languageCode,
    skills: skillMetrics,
    topics: topicMetrics,
    concepts: conceptMetrics,
    items: itemMetrics,
  };
}
