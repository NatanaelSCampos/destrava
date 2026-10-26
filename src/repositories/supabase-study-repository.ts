import type { InteractiveLessonProgressReceipt } from "@/domain/interactive-lesson/progress-receipt";
import { recordInteractiveLessonReceipt } from "@/domain/study/study-state";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicCourse } from "@/content/public";
import type { VocabularyItem } from "@/components/study-provider";
import type { StudyState } from "@/domain/study/study-state";
import { readPersistedCourseState, readCourseState } from "@/domain/study/course-state-storage";
import { restoreServerAssessmentResults } from "@/domain/study/study-state";
import type { ServerAssessmentResult } from "@/content/assessment-results";
import { skillProgress } from "@/domain/study/progress";
import { projectUnitProgress } from "./unit-progress-projection";
import type { Skill } from "@/content/schema";
import { projectStudyEvents } from "./study-event-projection";

const skills: Skill[] = ["vocabulary", "grammar", "listening", "writing", "speaking", "reading"];

export class SupabaseStudyRepository {
  private uploadedAudioIds = new Set<string>();

  constructor(
    private db: SupabaseClient,
    private userId: string,
    private assessmentSync?: { course: PublicCourse; load: () => Promise<ServerAssessmentResult[]> },
    private interactiveSync?: { course: PublicCourse; load: () => Promise<InteractiveLessonProgressReceipt[]> },
  ) {}

  async load(courseId: string, languageCode: string): Promise<StudyState | null> {
    const { data: courseData, error: courseError } = await this.db
      .from("user_course_state")
      .select("state")
      .eq("user_id", this.userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (courseError) throw new Error(`Não foi possível carregar seu progresso: ${courseError.message}`);
    let state: StudyState | null;
    if (courseData !== null) {
      state = readPersistedCourseState(courseData.state, courseId, languageCode);
    } else {
      const { data: legacy, error } = await this.db.from("user_study_state")
        .select("state").eq("user_id", this.userId).maybeSingle();
      if (error) throw new Error(`Não foi possível carregar seu progresso anterior: ${error.message}`);
      state = legacy === null ? null : readPersistedCourseState(legacy.state, courseId, languageCode, true);
    }
    if (this.assessmentSync) {
      const results = await this.assessmentSync.load();
      if (state || results.length) state = restoreServerAssessmentResults(state ?? readCourseState(null, courseId, languageCode), this.assessmentSync.course, results);
    }
    if (this.interactiveSync) {
      const receipts = await this.interactiveSync.load();
      if (state || receipts.length) {
        state ??= readCourseState(null, courseId, languageCode);
        for (const receipt of receipts) state = recordInteractiveLessonReceipt(state, this.interactiveSync.course, receipt);
      }
    }
    if (state === null) return null;
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
      .from("user_course_state")
      .upsert(
        { user_id: this.userId, course_id: course.id, language_code: course.languageCode,
          state: remoteState, updated_at: new Date().toISOString() },
        { onConflict: "user_id,course_id" },
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
          [...lesson.activities, ...(lesson.deferredRecovery?.rules.map((rule) => rule.activity) ?? [])]
            .map((activity) => [activity.id, unit.id] as const),
        ),
      ),
    );

    await this.upsert("user_course_profiles", [
      {
        user_id: uid,
        course_id: course.id,
        goal: state.profile.goal,
        daily_minutes: state.profile.dailyMinutes,
        days_per_week: state.profile.daysPerWeek,
        current_level: state.profile.level,
        prior_knowledge: state.profile.priorKnowledge,
        variant_id: state.profile.variantId,
        learning_preferences: state.profile.learningPreferences,
        self_reported_level: state.profile.selfReportedLevel,
        onboarding_step: state.profile.onboardingStep,
        onboarding_completed_at: state.profile.onboarded ? now : null,
        updated_at: now,
      },
    ], "user_id,course_id");
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
          mode: session.mode ?? "guided",
          targetMinutes: session.targetMinutes ?? null,
          activityIds: session.activityIds,
          correct: session.correct,
          wrong: session.wrong,
          wordsReviewed: session.wordsReviewed,
        },
      })),
    );
    // Formal results are written by /api/assessments after canonical server grading.
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
      state.attempts.filter((attempt) => !attempt.interactiveReceipt).map((attempt) => ({
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
          course_id: course.id,
          language_code: course.languageCode,
          topic_id: mistake.topicId ?? null,
          activity_id: mistake.activityId,
          category: mistake.category,
          original_answer: mistake.originalAnswer,
          correct_answer: mistake.correctAnswer,
          explanation: mistake.explanation,
          times_missed: mistake.timesMissed,
          times_correct: mistake.timesCorrect,
          last_missed_at: mistake.lastMissedAt,
          last_reviewed_at: mistake.lastReviewedAt,
          last_correct_at: mistake.lastCorrectAt ?? null,
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
    await this.upsert("user_review_targets", [
      ...Object.entries(state.structureReviews ?? {}).map(([targetId, item]) => ({
        user_id: uid, course_id: course.id, target_kind: "structure", target_id: targetId,
        payload: {}, schedule: item.schedule, updated_at: now,
      })),
      ...Object.entries(state.pronunciationReviews ?? {}).map(([targetId, item]) => ({
        user_id: uid, course_id: course.id, target_kind: "pronunciation", target_id: targetId,
        payload: { activityId: item.activityId, term: item.term, referenceText: item.referenceText,
          lastAccuracy: item.lastAccuracy }, schedule: item.schedule, updated_at: now,
      })),
    ], "user_id,course_id,target_kind,target_id");
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
      state.writing.filter((item) => !item.interactiveReceipt).map((item) => ({
        id: item.id,
        user_id: uid,
        activity_id: item.activityId,
        text: item.text,
        created_at: item.createdAt,
      })),
    );
    await this.upsert(
      "speaking_submissions",
      state.speaking.filter((item) => !item.interactiveReceipt).map((item) => ({
        id: item.id,
        user_id: uid,
        activity_id: item.activityId,
        audio_path: item.audioPath ?? null,
        transcription: item.transcription,
        created_at: item.createdAt,
      })),
    );
    await this.upsert("ai_feedback", [
      ...state.writing
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
      ...state.speaking
        .filter((item) => item.feedback)
        .map((item) => ({
          id: item.id,
          user_id: uid,
          writing_submission_id: null,
          speaking_submission_id: item.id,
          feature: "pronunciation",
          payload: item.feedback,
          created_at: item.createdAt,
        })),
    ]);
    await this.upsert(
      "study_events",
      projectStudyEvents(state.events, uid, course.id, new Set(activityToUnit.keys())),
    );
    await this.upsert(
      "lesson_progress",
      units.flatMap((unit) =>
        unit.lessons.map((lesson) => {
          const completed = lesson.activities.filter((activity) =>
            state.completedActivityIds.includes(activity.id),
          ).length;
          const percent = lesson.activities.length ? Math.round((100 * completed) / lesson.activities.length) : 0;
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
      units.map((unit) => projectUnitProgress(uid,course,unit,state,vocabularyItems,now)),
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
