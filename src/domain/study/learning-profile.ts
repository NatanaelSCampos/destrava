import type { PublicCourse } from "@/content/public";
import type { Skill } from "@/content/schema";
import { writingFeedbackSchema } from "@/domain/ai/schemas";
import type { LanguageResources } from "@/content/language-resources";
import type { StudyState } from "./study-state";
import { buildLearningMemory } from "./learning-memory";

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
  practice: {
    conversationTurns: number;
    voiceTurns: number;
    imageDescriptions: number;
    conversationCorrections: number;
    unfinishedMissions: number;
  };
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
  vocabularyItems: ReadonlyArray<{ id: string; term: string; lessonId: string }>,
  resources: Pick<LanguageResources, "numbers" | "numberCategoryLabels" | "structures" | "regionalTopics">,
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
    const skills = skill ? [skill] :
      (context.activity.skills.length ? context.activity.skills : [context.activity.skill]);
    for (const assessedSkill of new Set(skills))
      addEvidence(skillEvidence, assessedSkill, score, at);
    addEvidence(topicEvidence, context.lesson.id, score, at);
    for (const conceptId of context.activity.conceptIds)
      addEvidence(conceptEvidence, conceptId, score, at);
    if (!skills.includes("comprehension") &&
        (skills.includes("reading") || skills.includes("listening")))
      addEvidence(skillEvidence, "comprehension", score, at);
  }

  for (const attempt of state.attempts) {
    if (attempt.correct === null) continue;
    addActivityScore(attempt.activityId, attempt.correct ? 100 : 0, attempt.createdAt);
  }

  for (const assessment of state.adaptiveAssessments ?? []) {
    if (assessment.courseId !== course.id) continue;
    for (const answer of assessment.answers)
      if (!answer.ceiling)
        addActivityScore(answer.activityId, answer.correct ? 100 : 0, assessment.finishedAt);
  }

  for (const attempt of state.numberAttempts ?? []) {
    const prompt = resources.numbers.find((entry) => entry.id === attempt.promptId);
    if (!prompt) continue;
    const score = attempt.score;
    addEvidence(
      skillEvidence,
      attempt.mode === "dictation" ? "listening" : "speaking",
      score,
      attempt.createdAt,
    );
    if (attempt.mode === "dictation")
      addEvidence(skillEvidence, "comprehension", score, attempt.createdAt);
    else addEvidence(skillEvidence, "pronunciation", score, attempt.createdAt);
    addEvidence(conceptEvidence, "numbers", score, attempt.createdAt);
    addEvidence(itemEvidence, `number:${prompt.id}`, score, attempt.createdAt);
  }

  for (const attempt of state.regionalAttempts ?? []) {
    const topic = resources.regionalTopics.find((entry) => entry.id === attempt.topicId);
    if (!topic) continue;
    const score = attempt.correct ? 100 : 0;
    addEvidence(skillEvidence, "comprehension", score, attempt.createdAt);
    addEvidence(conceptEvidence, "regional-variants", score, attempt.createdAt);
    addEvidence(itemEvidence, `region:${topic.id}`, score, attempt.createdAt);
  }

  for (const attempt of state.microLessonAttempts ?? [])
    addActivityScore(attempt.activityId, attempt.correct ? 100 : 0, attempt.createdAt);

  if (resources.structures.length) {
    const lessonIds = new Set(
      course.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)),
    );
    for (const attempt of state.structureAttempts ?? []) {
      const structure = resources.structures.find((entry) => entry.id === attempt.structureId);
      if (!structure || !lessonIds.has(structure.lessonId)) continue;
      const score = attempt.correct ? 100 : 0;
      addEvidence(skillEvidence, "grammar", score, attempt.createdAt);
      addEvidence(topicEvidence, structure.lessonId, score, attempt.createdAt);
      addEvidence(conceptEvidence, structure.conceptId, score, attempt.createdAt);
      addEvidence(itemEvidence, `structure:${structure.id}`, score, attempt.createdAt);
    }
  }

  const mistakeBySchedule = new Map(
    Object.values(state.mistakes).map((mistake) => [mistake.schedule.id, mistake]),
  );
  for (const review of state.reviews) {
    const mistake = mistakeBySchedule.get(review.scheduleId);
    if (mistake && mistake.category !== "writing" && mistake.category !== "speaking")
      addActivityScore(mistake.activityId, review.correct ? 100 : 0, review.reviewedAt);
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
  const conceptMetrics = [
    ...course.learningConcepts.map(({ id, label }) =>
      metric(id, label, conceptEvidence.get(id) ?? [], now)),
    ...(conceptEvidence.has("regional-variants") ? [metric(
      "regional-variants", "Variações regionais", conceptEvidence.get("regional-variants") ?? [], now,
    )] : []),
  ];
  const itemMetrics = [
    ...vocabularyItems
      .filter((word) => itemEvidence.has(`word:${word.id}`))
      .map((word) =>
        metric(`word:${word.id}`, word.term, itemEvidence.get(`word:${word.id}`) ?? [], now),
      ),
    ...[...itemEvidence.entries()]
      .filter(([id]) => id.startsWith("pronunciation:"))
      .map(([id, evidence]) => metric(id, id.slice("pronunciation:".length), evidence, now)),
    ...[...itemEvidence.entries()]
      .filter(([id]) => id.startsWith("number:"))
      .map(([id, evidence]) => {
        const prompt = resources.numbers.find((entry) => entry.id === id.slice("number:".length));
        return metric(
          id,
          prompt ? `${resources.numberCategoryLabels[prompt.category] ?? prompt.category} · ${prompt.display}` : id,
          evidence,
          now,
        );
      }),
    ...[...itemEvidence.entries()]
      .filter(([id]) => id.startsWith("region:"))
      .map(([id, evidence]) => metric(
        id,
        resources.regionalTopics.find((entry) => entry.id === id.slice("region:".length))?.title ?? id,
        evidence,
        now,
      )),
    ...[...itemEvidence.entries()]
      .filter(([id]) => id.startsWith("structure:"))
      .map(([id, evidence]) =>
        metric(
          id,
          resources.structures.find((entry) => entry.id === id.slice("structure:".length))?.title ?? id,
          evidence,
          now,
        ),
      ),
  ];

  const conversations = (state.conversations ?? []).filter(
    (session) => session.courseId === course.id,
  );
  const memory = buildLearningMemory(state, course.id);

  return {
    courseId: course.id,
    languageCode: course.languageCode,
    skills: skillMetrics,
    topics: topicMetrics,
    concepts: conceptMetrics,
    items: itemMetrics,
    practice: {
      conversationTurns: conversations.reduce(
        (count, session) => count + session.turns.filter((turn) => turn.role === "student").length,
        0,
      ),
      voiceTurns: memory.voiceTurns,
      imageDescriptions: (state.imageDescriptions ?? []).filter(
        (attempt) => attempt.courseId === course.id,
      ).length,
      conversationCorrections: conversations.reduce(
        (count, session) =>
          count +
          session.turns.filter(
            (turn) => turn.role === "partner" && Boolean(turn.correction?.trim()),
          ).length,
        0,
      ),
      unfinishedMissions: memory.unfinishedMissionIds.length,
    },
  };
}
