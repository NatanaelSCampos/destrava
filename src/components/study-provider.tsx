"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { PublicActivity, PublicCourse } from "@/content/public";
import type { GradeResult } from "@/domain/activities/grader";
import type { PronunciationFeedback } from "@/domain/activities/pronunciation";
import {
  initialStudyState,
  markActivityComplete,
  recordAttempt,
  recordEvaluatedSpeaking,
  recordEvaluatedWriting,
  recordMicroLessonAttempt,
  recordNumberAttempt,
  recordAdaptiveAssessment,
  recordVocabularySignal,
  reconcileAssessments,
  reviewMistake,
  reviewStructure,
  reviewVocabulary,
  type StudentProfile,
  type StudyState,
  type SessionMode,
  type PlannedItem,
  type SpeakingSubmission,
  type NumberAttempt,
  type MicroLessonAttempt,
  type ImageDescriptionAttempt,
  type AdaptiveAssessmentAttempt,
} from "@/domain/study/study-state";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import { boundedStudySeconds } from "@/domain/study/session-time";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { canAccessWithMfa } from "@/lib/auth/mfa-access";
import { SupabaseStudyRepository } from "@/repositories/supabase-study-repository";
import {
  appendConversationReply,
  finishConversation,
  type ConversationCorrectionCategory,
  type ConversationSession,
} from "@/domain/conversation/conversation-session";
import { findConversationScenario } from "@/content/conversation-scenarios";

export type VocabularyItem = {
  id: string;
  spanish: string;
  translation: string;
  example: string;
  lessonId: string;
};

type StudyContextValue = {
  course: PublicCourse;
  vocabularyItems: VocabularyItem[];
  state: StudyState;
  ready: boolean;
  authUserId: string | null;
  syncError: string;
  updateProfile: (profile: Partial<StudentProfile>) => void;
  completeActivity: (id: string) => void;
  submitAttempt: (activity: PublicActivity, answer: string, result: GradeResult) => void;
  saveWriting: (activityId: string, text: string, feedback?: unknown) => void;
  saveSpeaking: (
    activityId: string,
    transcription: string,
    audioUrl: string | null,
    feedback?: PronunciationFeedback,
    practiceMode?: SpeakingSubmission["practiceMode"],
  ) => void;
  recordVocabularySearch: (id: string) => void;
  recordVocabularyAudio: (id: string) => void;
  recordNumberPractice: (
    input: Pick<NumberAttempt, "promptId" | "mode" | "answer" | "correct" | "score">,
  ) => void;
  recordMicroLesson: (
    input: Pick<MicroLessonAttempt, "activityId" | "question" | "selectedOption" | "correct">,
  ) => void;
  saveConversation: (session: ConversationSession) => void;
  saveImageDescription: (attempt: Omit<ImageDescriptionAttempt, "id" | "createdAt">) => void;
  saveAdaptiveAssessment: (attempt: Omit<AdaptiveAssessmentAttempt, "id" | "finishedAt">) => void;
  addConversationReply: (
    sessionId: string,
    studentText: string,
    reply: {
      text: string;
      correction: string;
      correctionCategory: ConversationCorrectionCategory;
      completedObjectiveIds: string[];
    },
    inputMode?: "text" | "speech",
  ) => void;
  completeConversation: (sessionId: string) => void;
  recordStudyEvent: (
    type: string,
    itemId?: string,
    metadata?: Record<string, string | number | boolean>,
  ) => void;
  markVocabulary: (id: string, status: "new" | "learning" | "known" | "difficult") => void;
  reviewWord: (id: string, rating: boolean | "difficult") => void;
  reviewError: (id: string, correct: boolean) => void;
  reviewStructureCard: (id: string, correct: boolean) => void;
  startSession: (
    unitId: string,
    plan: PlannedItem[],
    mode: SessionMode,
    targetMinutes: number,
  ) => void;
  updateActiveSessionDuration: (sessionId: string, seconds: number) => void;
  finishSession: (seconds?: number) => void;
  correctSessionDuration: (sessionId: string, minutes: number) => void;
};

const StudyContext = createContext<StudyContextValue | null>(null);
const storageKey = "frecuencias-study:v1:demo";

export function StudyProvider({
  course,
  vocabularyItems,
  children,
}: {
  course: PublicCourse;
  vocabularyItems: VocabularyItem[];
  children: ReactNode;
}) {
  const [state, setState] = useState<StudyState>(initialStudyState);
  const [ready, setReady] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState("");
  const repository = useRef<SupabaseStudyRepository | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        const client = createSupabaseBrowserClient();
        if (client) {
          const { data, error } = await client.auth.getUser();
          if (cancelled) return;
          if (error || !data.user) {
            setReady(true);
            return;
          }
          const accountId = data.user.id;
          setAuthUserId(accountId);
          const access = await canAccessWithMfa(client);
          if (cancelled) return;
          if (!access.allowed) {
            if (access.error) setSyncError("Não foi possível verificar a segurança da sessão.");
            setReady(true);
            return;
          }
          const nextRepository = new SupabaseStudyRepository(client, accountId);
          repository.current = nextRepository;
          try {
            const remote = await nextRepository.load();
            if (cancelled) return;
            const cached = window.localStorage.getItem(`${storageKey}:${accountId}`);
            const source = remote ?? (cached ? (JSON.parse(cached) as StudyState) : null);
            if (source)
              setState({
                ...initialStudyState,
                ...source,
                profile: { ...initialStudyState.profile, ...source.profile },
                numberAttempts: source.numberAttempts ?? [],
                microLessonAttempts: source.microLessonAttempts ?? [],
                conversations: source.conversations ?? [],
                imageDescriptions: source.imageDescriptions ?? [],
                adaptiveAssessments: source.adaptiveAssessments ?? [],
                structureReviews: source.structureReviews ?? {},
                structureAttempts: source.structureAttempts ?? [],
              });
          } catch (caught) {
            const cached = window.localStorage.getItem(`${storageKey}:${accountId}`);
            if (cached) {
              try {
                const source = JSON.parse(cached) as StudyState;
                setState({
                  ...initialStudyState,
                  ...source,
                  numberAttempts: source.numberAttempts ?? [],
                  microLessonAttempts: source.microLessonAttempts ?? [],
                  conversations: source.conversations ?? [],
                  imageDescriptions: source.imageDescriptions ?? [],
                  adaptiveAssessments: source.adaptiveAssessments ?? [],
                  structureReviews: source.structureReviews ?? {},
                  structureAttempts: source.structureAttempts ?? [],
                });
              } catch {
                /* Keep fresh state. */
              }
            }
            setSyncError(
              caught instanceof Error
                ? caught.message
                : "Não foi possível carregar a sincronização.",
            );
          }
          setReady(true);
          return;
        }
        try {
          const saved = window.localStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved) as Partial<StudyState>;
            setState({
              ...initialStudyState,
              ...parsed,
              profile: { ...initialStudyState.profile, ...parsed.profile },
              numberAttempts: parsed.numberAttempts ?? [],
              microLessonAttempts: parsed.microLessonAttempts ?? [],
              conversations: parsed.conversations ?? [],
              imageDescriptions: parsed.imageDescriptions ?? [],
              adaptiveAssessments: parsed.adaptiveAssessments ?? [],
              structureReviews: parsed.structureReviews ?? {},
              structureAttempts: parsed.structureAttempts ?? [],
            });
          }
        } catch {
          /* An invalid local draft should not prevent studying. */
        }
        setReady(true);
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const key = authUserId ? `${storageKey}:${authUserId}` : storageKey;
    window.localStorage.setItem(key, JSON.stringify(state));
    if (!repository.current) return;
    const timeout = window.setTimeout(() => {
      const currentRepository = repository.current;
      if (!currentRepository) return;
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          await currentRepository.save(state, course, vocabularyItems);
          setSyncError("");
        })
        .catch((caught) =>
          setSyncError(caught instanceof Error ? caught.message : "Não foi possível sincronizar."),
        );
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [ready, state, authUserId, course, vocabularyItems]);

  const updateProfile = useCallback(
    (profile: Partial<StudentProfile>) =>
      setState((current) => ({ ...current, profile: { ...current.profile, ...profile } })),
    [],
  );
  const completeActivity = useCallback(
    (id: string) => setState((current) => markActivityComplete(current, id)),
    [],
  );
  const submitAttempt = useCallback(
    (activity: PublicActivity, answer: string, result: GradeResult) =>
      setState((current) =>
        reconcileAssessments(recordAttempt(current, activity, answer, result), course),
      ),
    [course],
  );
  const saveWriting = useCallback(
    (activityId: string, text: string, feedback?: unknown) =>
      setState((current) => {
        const completed = markActivityComplete(current, activityId);
        return reconcileAssessments(
          recordEvaluatedWriting(
            {
              ...completed,
              writing: [
                {
                  id: crypto.randomUUID(),
                  activityId,
                  sessionId: current.activeSessionId,
                  text,
                  createdAt: new Date().toISOString(),
                  feedback,
                },
                ...current.writing,
              ],
              events: [
                {
                  id: crypto.randomUUID(),
                  type: "writing_submitted",
                  activityId,
                  createdAt: new Date().toISOString(),
                },
                ...completed.events,
              ],
            },
            activityId,
            text,
            feedback,
          ),
          course,
        );
      }),
    [course],
  );
  const saveSpeaking = useCallback(
    (
      activityId: string,
      transcription: string,
      audioUrl: string | null,
      feedback?: PronunciationFeedback,
      practiceMode: SpeakingSubmission["practiceMode"] = "lesson",
    ) =>
      setState((current) => {
        const completed = markActivityComplete(current, activityId);
        return recordEvaluatedSpeaking(
          {
            ...completed,
            speaking: [
              {
                id: crypto.randomUUID(),
                activityId,
                sessionId: current.activeSessionId,
                transcription,
                audioUrl,
                feedback,
                practiceMode,
                createdAt: new Date().toISOString(),
              },
              ...current.speaking,
            ],
            events: [
              {
                id: crypto.randomUUID(),
                type: "speaking_submitted",
                activityId,
                createdAt: new Date().toISOString(),
              },
              ...completed.events,
            ],
          },
          activityId,
          feedback,
        );
      }),
    [],
  );
  const markVocabulary = useCallback(
    (id: string, status: "new" | "learning" | "known" | "difficult") =>
      setState((current) => ({
        ...current,
        vocabulary: {
          ...current.vocabulary,
          [id]: {
            id: current.vocabulary[id]?.id ?? crypto.randomUUID(),
            status,
            schedule: current.vocabulary[id]?.schedule ?? ReviewScheduler.initial(),
          },
        },
      })),
    [],
  );
  const reviewWord = useCallback(
    (id: string, rating: boolean | "difficult") =>
      setState((current) => reviewVocabulary(current, id, rating)),
    [],
  );
  const reviewError = useCallback(
    (id: string, correct: boolean) => setState((current) => reviewMistake(current, id, correct)),
    [],
  );
  const reviewStructureCard = useCallback(
    (id: string, correct: boolean) => setState((current) => reviewStructure(current, id, correct)),
    [],
  );
  const recordVocabularySearch = useCallback(
    (id: string) => setState((current) => recordVocabularySignal(current, id, "vocabulary_search")),
    [],
  );
  const recordVocabularyAudio = useCallback(
    (id: string) => setState((current) => recordVocabularySignal(current, id, "vocabulary_audio")),
    [],
  );
  const recordNumberPractice = useCallback(
    (input: Pick<NumberAttempt, "promptId" | "mode" | "answer" | "correct" | "score">) =>
      setState((current) => recordNumberAttempt(current, input)),
    [],
  );
  const recordMicroLesson = useCallback(
    (input: Pick<MicroLessonAttempt, "activityId" | "question" | "selectedOption" | "correct">) =>
      setState((current) => recordMicroLessonAttempt(current, input)),
    [],
  );
  const saveConversation = useCallback(
    (session: ConversationSession) =>
      setState((current) => {
        const abandoned = (current.conversations ?? []).filter(
          (item) =>
            item.courseId === session.courseId &&
            !item.finishedAt &&
            item.turns.some((turn) => turn.role === "student"),
        );
        return {
          ...current,
          conversations: [session, ...(current.conversations ?? [])].slice(0, 24),
          events: [
            {
              id: crypto.randomUUID(),
              type: "conversation_started",
              itemId: session.id,
              metadata: {
                courseId: session.courseId,
                mode: session.mode,
                scenarioId: session.scenarioId ?? "",
              },
              createdAt: session.startedAt,
            },
            ...abandoned.map((item) => ({
              id: crypto.randomUUID(),
              type: "conversation_left_unfinished",
              itemId: item.id,
              metadata: { courseId: item.courseId, scenarioId: item.scenarioId ?? "" },
              createdAt: session.startedAt,
            })),
            ...current.events,
          ],
        };
      }),
    [],
  );
  const saveImageDescription = useCallback(
    (input: Omit<ImageDescriptionAttempt, "id" | "createdAt">) =>
      setState((current) => {
        const createdAt = new Date().toISOString();
        return {
          ...current,
          imageDescriptions: [
            { ...input, id: crypto.randomUUID(), createdAt },
            ...(current.imageDescriptions ?? []),
          ].slice(0, 40),
          events: [
            {
              id: crypto.randomUUID(),
              type: "image_description_completed",
              itemId: input.sceneId,
              metadata: {
                courseId: input.courseId,
                inputMode: input.inputMode,
                hasCorrection: Boolean(input.feedback.correction.trim()),
              },
              createdAt,
            },
            ...current.events,
          ],
        };
      }),
    [],
  );
  const saveAdaptiveAssessment = useCallback(
    (input: Omit<AdaptiveAssessmentAttempt, "id" | "finishedAt">) =>
      setState((current) => recordAdaptiveAssessment(current, course, input)),
    [course],
  );
  const addConversationReply = useCallback(
    (
      sessionId: string,
      studentText: string,
      reply: {
        text: string;
        correction: string;
        correctionCategory: ConversationCorrectionCategory;
        completedObjectiveIds: string[];
      },
      inputMode: "text" | "speech" = "text",
    ) =>
      setState((current) => {
        const session = (current.conversations ?? []).find((item) => item.id === sessionId);
        if (!session || session.finishedAt) return current;
        const updated = appendConversationReply(
          session,
          studentText,
          reply,
          findConversationScenario(session.scenarioId)?.objectives.map((item) => item.id) ?? [],
          inputMode,
        );
        if (updated === session) return current;
        const newObjectives = updated.completedObjectiveIds.filter(
          (id) => !session.completedObjectiveIds.includes(id),
        );
        const createdAt = new Date().toISOString();
        return {
          ...current,
          conversations: (current.conversations ?? []).map((item) =>
            item.id === sessionId ? updated : item,
          ),
          events: [
            {
              id: crypto.randomUUID(),
              type: "conversation_turn",
              itemId: sessionId,
              createdAt,
              metadata: {
                courseId: session.courseId,
                scenarioId: session.scenarioId ?? "",
                inputMode,
                correctionCategory: reply.correction.trim() ? reply.correctionCategory : "none",
                objectiveCount: newObjectives.length,
              },
            },
            ...newObjectives.map((id) => ({
              id: crypto.randomUUID(),
              type: "conversation_objective_completed",
              itemId: id,
              createdAt,
              metadata: { courseId: session.courseId, scenarioId: session.scenarioId ?? "" },
            })),
            ...current.events,
          ],
        };
      }),
    [],
  );
  const completeConversation = useCallback(
    (sessionId: string) =>
      setState((current) => ({
        ...current,
        conversations: (current.conversations ?? []).map((session) =>
          session.id === sessionId ? finishConversation(session) : session,
        ),
        events: [
          {
            id: crypto.randomUUID(),
            type: "conversation_finished",
            itemId: sessionId,
            createdAt: new Date().toISOString(),
          },
          ...current.events,
        ],
      })),
    [],
  );
  const recordStudyEvent = useCallback(
    (type: string, itemId?: string, metadata?: Record<string, string | number | boolean>) =>
      setState((current) => ({
        ...current,
        events: [
          { id: crypto.randomUUID(), type, itemId, metadata, createdAt: new Date().toISOString() },
          ...current.events,
        ],
      })),
    [],
  );
  const startSession = useCallback(
    (unitId: string, plan: PlannedItem[], mode: SessionMode, targetMinutes: number) =>
      setState((current) => {
        if (current.activeSessionId) return current;
        const id = crypto.randomUUID();
        const startedAt = new Date().toISOString();
        return {
          ...current,
          activeSessionId: id,
          sessions: [
            {
              id,
              unitId,
              mode,
              targetMinutes,
              startedAt,
              finishedAt: null,
              durationSeconds: 0,
              activityIds: [],
              correct: 0,
              wrong: 0,
              wordsReviewed: 0,
              plan,
            },
            ...current.sessions,
          ],
          events: [
            {
              id: crypto.randomUUID(),
              type: "lesson_started",
              itemId: id,
              metadata: { courseId: course.id, unitId, mode, targetMinutes },
              createdAt: startedAt,
            },
            ...current.events,
          ],
        };
      }),
    [course.id],
  );
  const updateActiveSessionDuration = useCallback(
    (sessionId: string, seconds: number) =>
      setState((current) => {
        if (current.activeSessionId !== sessionId) return current;
        const measured = boundedStudySeconds(seconds);
        const sessions = current.sessions.map((session) =>
          session.id === sessionId && !session.finishedAt && measured > session.durationSeconds
            ? { ...session, durationSeconds: measured }
            : session,
        );
        return sessions.every((session, index) => session === current.sessions[index])
          ? current
          : { ...current, sessions };
      }),
    [],
  );
  const finishSession = useCallback(
    (seconds = 0) =>
      setState((current) => {
        if (!current.activeSessionId) return current;
        const now = new Date();
        return {
          ...current,
          activeSessionId: null,
          sessions: current.sessions.map((session) =>
            session.id === current.activeSessionId
              ? {
                  ...session,
                  finishedAt: now.toISOString(),
                  durationSeconds: boundedStudySeconds(
                    Math.max(session.durationSeconds, seconds),
                  ),
                }
              : session,
          ),
          events: [
            {
              id: crypto.randomUUID(),
              type: "lesson_finished",
              itemId: current.activeSessionId,
              metadata: { courseId: course.id },
              createdAt: now.toISOString(),
            },
            ...current.events,
          ],
        };
      }),
    [course.id],
  );
  const correctSessionDuration = useCallback(
    (sessionId: string, minutes: number) =>
      setState((current) => {
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240) return current;
        const sessions = current.sessions.map((session) =>
          session.id === sessionId && session.finishedAt
            ? { ...session, durationSeconds: minutes * 60 }
            : session,
        );
        return sessions.every((session, index) => session === current.sessions[index])
          ? current
          : { ...current, sessions };
      }),
    [],
  );

  const value = useMemo(
    () => ({
      course,
      vocabularyItems,
      state,
      ready,
      authUserId,
      syncError,
      updateProfile,
      completeActivity,
      submitAttempt,
      saveWriting,
      saveSpeaking,
      markVocabulary,
      reviewWord,
      reviewError,
      reviewStructureCard,
      recordVocabularySearch,
      recordVocabularyAudio,
      recordNumberPractice,
      recordMicroLesson,
      saveConversation,
      saveImageDescription,
      saveAdaptiveAssessment,
      addConversationReply,
      completeConversation,
      recordStudyEvent,
      startSession,
      updateActiveSessionDuration,
      finishSession,
      correctSessionDuration,
    }),
    [
      course,
      vocabularyItems,
      state,
      ready,
      authUserId,
      syncError,
      updateProfile,
      completeActivity,
      submitAttempt,
      saveWriting,
      saveSpeaking,
      markVocabulary,
      reviewWord,
      reviewError,
      reviewStructureCard,
      recordVocabularySearch,
      recordVocabularyAudio,
      recordNumberPractice,
      recordMicroLesson,
      saveConversation,
      saveImageDescription,
      saveAdaptiveAssessment,
      addConversationReply,
      completeConversation,
      recordStudyEvent,
      startSession,
      updateActiveSessionDuration,
      finishSession,
      correctSessionDuration,
    ],
  );
  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error("useStudy must be used inside StudyProvider");
  return context;
}
