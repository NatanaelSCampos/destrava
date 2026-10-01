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
  reconcileAssessments,
  reviewMistake,
  reviewVocabulary,
  type StudentProfile,
  type StudyState,
} from "@/domain/study/study-state";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SupabaseStudyRepository } from "@/repositories/supabase-study-repository";

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
  ) => void;
  markVocabulary: (id: string, status: "new" | "learning" | "known" | "difficult") => void;
  reviewWord: (id: string, correct: boolean) => void;
  reviewError: (id: string, correct: boolean) => void;
  startSession: (
    unitId: string,
    plan: Array<{ kind: "activity" | "review"; id: string; title: string; minutes: number }>,
  ) => void;
  finishSession: () => void;
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
              });
          } catch (caught) {
            const cached = window.localStorage.getItem(`${storageKey}:${accountId}`);
            if (cached) {
              try {
                setState({ ...initialStudyState, ...(JSON.parse(cached) as StudyState) });
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
          {
            ...completed,
            writing: [
              {
                id: crypto.randomUUID(),
                activityId,
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
    ) =>
      setState((current) => {
        const completed = markActivityComplete(current, activityId);
        return {
          ...completed,
          speaking: [
            {
              id: crypto.randomUUID(),
              activityId,
              transcription,
              audioUrl,
              feedback,
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
        };
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
    (id: string, correct: boolean) => setState((current) => reviewVocabulary(current, id, correct)),
    [],
  );
  const reviewError = useCallback(
    (id: string, correct: boolean) => setState((current) => reviewMistake(current, id, correct)),
    [],
  );
  const startSession = useCallback(
    (
      unitId: string,
      plan: Array<{ kind: "activity" | "review"; id: string; title: string; minutes: number }>,
    ) =>
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
            { id: crypto.randomUUID(), type: "lesson_started", createdAt: startedAt },
            ...current.events,
          ],
        };
      }),
    [],
  );
  const finishSession = useCallback(
    () =>
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
                  durationSeconds: Math.max(
                    1,
                    Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 1000),
                  ),
                }
              : session,
          ),
        };
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
      startSession,
      finishSession,
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
      startSession,
      finishSession,
    ],
  );
  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error("useStudy must be used inside StudyProvider");
  return context;
}
