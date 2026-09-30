import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicCourse } from "@/content/public";
import type { VocabularyItem } from "@/components/study-provider";
import type { StudyState } from "@/domain/study/study-state";
import { skillProgress, unitProgress } from "@/domain/study/progress";
import type { Skill } from "@/content/schema";

const skills: Skill[] = ["vocabulary", "grammar", "listening", "writing", "speaking", "reading"];

export class SupabaseStudyRepository {
  private uploadedAudioIds = new Set<string>();

  constructor(
    private db: SupabaseClient,
    private userId: string,
  ) {}

  async load(): Promise<StudyState | null> {
    const { data, error } = await this.db
      .from("user_study_state")
      .select("state")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw new Error(`Não foi possível carregar seu progresso: ${error.message}`);
    if (!data?.state) return null;
    const state = data.state as StudyState;
    const speaking = await Promise.all(
      (state.speaking ?? []).map(async (submission) => {
        if (!submission.audioPath) return submission;
        const { data: signed } = await this.db.storage
          .from("speaking-audio")
          .createSignedUrl(submission.audioPath, 60 * 60);
        return { ...submission, audioUrl: signed?.signedUrl ?? null };
      }),
    );
    return { ...state, speaking };
  }

  async save(state: StudyState, course: PublicCourse, vocabularyItems: VocabularyItem[]) {
    const remoteState: StudyState = {
      ...state,
      speaking: await Promise.all(
        state.speaking.map((submission) => this.prepareAudio(submission)),
      ),
    };
    const { error } = await this.db
      .from("user_study_state")
      .upsert(
        { user_id: this.userId, state: remoteState, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(`Não foi possível salvar seu progresso: ${error.message}`);
    await this.projectNormalizedData(remoteState, course, vocabularyItems);
  }

  private async prepareAudio(submission: StudyState["speaking"][number]) {
    if (submission.audioPath) return { ...submission, audioUrl: null };
    if (!submission.audioUrl?.startsWith("data:")) return submission;
    const blob = await fetch(submission.audioUrl).then((response) => response.blob());
    const extension = blob.type.includes("mp4")
      ? "m4a"
      : blob.type.includes("ogg")
        ? "ogg"
        : "webm";
    const path = `${this.userId}/${submission.id}.${extension}`;
    if (!this.uploadedAudioIds.has(submission.id)) {
      const { error } = await this.db.storage
        .from("speaking-audio")
        .upload(path, blob, { upsert: true, contentType: blob.type || "audio/webm" });
      if (error) throw new Error(`Não foi possível salvar a gravação: ${error.message}`);
      this.uploadedAudioIds.add(submission.id);
    }
    return { ...submission, audioPath: path, audioUrl: null };
  }

  private async upsert(table: string, rows: Record<string, unknown>[], onConflict = "id") {
    if (!rows.length) return;
    const { error } = await this.db.from(table).upsert(rows, { onConflict });
    if (error) throw new Error(`Falha ao atualizar ${table}: ${error.message}`);
  }

  private async projectNormalizedData(
    state: StudyState,
    course: PublicCourse,
    vocabularyItems: VocabularyItem[],
  ) {
    const uid = this.userId;
    const now = new Date().toISOString();
    const units = course.units;
    const activityToUnit = new Map(
      units.flatMap((unit) =>
        unit.lessons.flatMap((lesson) =>
          lesson.activities.map((activity) => [activity.id, unit.id] as const),
        ),
      ),
    );

    await this.upsert("profiles", [
      {
        id: uid,
        goal: state.profile.goal,
        daily_minutes: state.profile.dailyMinutes,
        days_per_week: state.profile.daysPerWeek,
        current_level: state.profile.level,
        prior_knowledge: state.profile.priorKnowledge,
        onboarding_completed_at: state.profile.onboarded ? now : null,
        updated_at: now,
      },
    ]);
    await this.upsert(
      "user_activity_progress",
      state.completedActivityIds.map((activityId) => ({ user_id: uid, activity_id: activityId })),
      "user_id,activity_id",
    );
    await this.upsert(
      "study_sessions",
      state.sessions.map((session) => ({
        id: session.id,
        user_id: uid,
        unit_id: session.unitId,
        started_at: session.startedAt,
        finished_at: session.finishedAt,
        duration_seconds: session.durationSeconds,
        performance: {
          plan: session.plan ?? [],
          activityIds: session.activityIds,
          correct: session.correct,
          wrong: session.wrong,
          wordsReviewed: session.wordsReviewed,
        },
      })),
    );
    await this.upsert(
      "assessment_attempts",
      (state.assessmentAttempts ?? []).map((attempt) => ({
        id: attempt.id,
        user_id: uid,
        assessment_id: attempt.assessmentId,
        started_at: attempt.startedAt,
        finished_at: attempt.finishedAt,
        objective_score: attempt.objectiveScore,
        result: { unitId: attempt.unitId },
      })),
    );
    await this.upsert(
      "study_session_activities",
      state.sessions.flatMap((session) =>
        (session.plan ?? [])
          .filter((entry) => entry.kind === "activity")
          .map((entry, index) => ({
            user_id: uid,
            session_id: session.id,
            activity_id: entry.id,
            position: index + 1,
            planned_minutes: entry.minutes,
            finished_at: session.activityIds.includes(entry.id)
              ? (session.finishedAt ?? now)
              : null,
            performance: { completed: session.activityIds.includes(entry.id) },
          })),
      ),
      "session_id,position",
    );
    await this.upsert(
      "exercise_attempts",
      state.attempts.map((attempt) => ({
        id: attempt.id,
        user_id: uid,
        activity_id: attempt.activityId,
        session_id: attempt.sessionId,
        answer: { text: attempt.answer },
        is_correct: attempt.correct,
        score: attempt.correct === null ? null : attempt.correct ? 100 : 0,
        attempted_at: attempt.createdAt,
      })),
    );
    await this.upsert(
      "user_vocabulary",
      Object.entries(state.vocabulary).map(([itemId, progress]) => ({
        id: progress.id,
        user_id: uid,
        vocabulary_item_id: itemId,
        status: progress.status,
        updated_at: now,
      })),
    );
    await this.upsert(
      "mistakes",
      Object.values(state.mistakes)
        .filter((mistake) => activityToUnit.has(mistake.activityId))
        .map((mistake) => ({
          id: mistake.id,
          user_id: uid,
          unit_id: activityToUnit.get(mistake.activityId),
          activity_id: mistake.activityId,
          category: mistake.category,
          original_answer: mistake.originalAnswer,
          correct_answer: mistake.correctAnswer,
          explanation: mistake.explanation,
          times_missed: mistake.timesMissed,
          times_correct: mistake.timesCorrect,
          last_missed_at: mistake.lastMissedAt,
          last_reviewed_at: mistake.lastReviewedAt,
        })),
    );
    await this.upsert("review_schedules", [
      ...Object.values(state.vocabulary).map((item) => ({
        id: item.schedule.id,
        user_id: uid,
        user_vocabulary_id: item.id,
        mistake_id: null,
        next_review_at: item.schedule.nextReviewAt,
        interval_days: item.schedule.intervalDays,
        ease_factor: item.schedule.easeFactor,
        review_count: item.schedule.reviewCount,
        mastery_score: item.schedule.masteryScore,
        consecutive_correct: item.schedule.consecutiveCorrect,
      })),
      ...Object.values(state.mistakes).map((item) => ({
        id: item.schedule.id,
        user_id: uid,
        user_vocabulary_id: null,
        mistake_id: item.id,
        next_review_at: item.schedule.nextReviewAt,
        interval_days: item.schedule.intervalDays,
        ease_factor: item.schedule.easeFactor,
        review_count: item.schedule.reviewCount,
        mastery_score: item.schedule.masteryScore,
        consecutive_correct: item.schedule.consecutiveCorrect,
      })),
    ]);
    await this.upsert(
      "reviews",
      (state.reviews ?? []).map((review) => ({
        id: review.id,
        user_id: uid,
        schedule_id: review.scheduleId,
        is_correct: review.correct,
        reviewed_at: review.reviewedAt,
        interval_before: review.intervalBefore,
        interval_after: review.intervalAfter,
      })),
    );
    await this.upsert(
      "writing_submissions",
      state.writing.map((item) => ({
        id: item.id,
        user_id: uid,
        activity_id: item.activityId,
        text: item.text,
        created_at: item.createdAt,
      })),
    );
    await this.upsert(
      "speaking_submissions",
      state.speaking.map((item) => ({
        id: item.id,
        user_id: uid,
        activity_id: item.activityId,
        audio_path: item.audioPath ?? null,
        transcription: item.transcription,
        created_at: item.createdAt,
      })),
    );
    await this.upsert(
      "ai_feedback",
      state.writing
        .filter((item) => item.feedback)
        .map((item) => ({
          id: item.id,
          user_id: uid,
          writing_submission_id: item.id,
          speaking_submission_id: null,
          feature: "writing",
          payload: item.feedback,
          created_at: item.createdAt,
        })),
    );
    await this.upsert(
      "study_events",
      state.events.map((item) => ({
        id: item.id,
        user_id: uid,
        event_type: item.type,
        activity_id: item.activityId ?? null,
        created_at: item.createdAt,
      })),
    );
    await this.upsert(
      "lesson_progress",
      units.flatMap((unit) =>
        unit.lessons.map((lesson) => {
          const completed = lesson.activities.filter((activity) =>
            state.completedActivityIds.includes(activity.id),
          ).length;
          const percent = Math.round((100 * completed) / lesson.activities.length);
          return {
            user_id: uid,
            lesson_id: lesson.id,
            completion_percent: percent,
            completed_at: percent === 100 ? now : null,
            updated_at: now,
          };
        }),
      ),
      "user_id,lesson_id",
    );
    await this.upsert(
      "unit_progress",
      units.map((unit) => {
        const progress = unitProgress(unit, state, vocabularyItems);
        return {
          user_id: uid,
          unit_id: unit.id,
          completion_percent: progress.percentage,
          completed_at: progress.isCompleted ? now : null,
          mastered_at: progress.isMastered ? now : null,
          exercise_score: progress.exerciseScore,
          review_score: progress.reviewScore,
          assessment_score: progress.assessmentFinished ? progress.assessmentScore : null,
          updated_at: now,
        };
      }),
      "user_id,unit_id",
    );
    await this.upsert(
      "skill_progress",
      skills.map((skill) => {
        const data = skillProgress(course, state, skill);
        const attempts = state.attempts.filter((attempt) => attempt.skill === skill);
        return {
          user_id: uid,
          course_id: course.id,
          skill,
          practiced_count: attempts.length,
          correct_count: attempts.filter((attempt) => attempt.correct).length,
          completed_count: data.completed,
          updated_at: now,
        };
      }),
      "user_id,course_id,skill",
    );
  }
}
