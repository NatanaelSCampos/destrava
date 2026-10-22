"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import type { PublicActivity, PublicCourse } from "@/content/public";
import type { GradeResult } from "@/domain/activities/grader";
import type { PronunciationFeedback } from "@/domain/activities/pronunciation";
import {
  markActivityComplete,
  recordAttempt,
  recordEvaluatedSpeaking,
  recordEvaluatedWriting,
  recordMicroLessonAttempt,
  recordNumberAttempt,
  recordRegionalAttempt,
  recordServerAssessment,
  recordVocabularySignal,
  reviewMistake,
  reviewStructure,
  reviewVocabulary,
  type StudentProfile,
  type StudyState,
  type SessionMode,
  type PlannedItem,
  type SpeakingSubmission,
  type NumberAttempt,
  type RegionalAttempt,
  type MicroLessonAttempt,
  type ImageDescriptionAttempt,
} from "@/domain/study/study-state";
import { ReviewScheduler } from "@/domain/review/review-scheduler";
import { boundedStudySeconds } from "@/domain/study/session-time";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { canAccessWithMfa } from "@/lib/auth/mfa-access";
import { SupabaseStudyRepository } from "@/repositories/supabase-study-repository";
import { InstalledStudyHttpRepository } from "@/repositories/installed-study-http-repository";
import {
  matchingInstalledReference,
  type InstalledRuntimeContext,
} from "@/lib/installed-runtime-types";
import {
  appendConversationReply,
  finishConversation,
  type ConversationCorrectionCategory,
  type ConversationSession,
} from "@/domain/conversation/conversation-session";
import { readCourseState } from "@/domain/study/course-state-storage";
import { StudyProgressSync, type ProgressLoadStatus } from "@/domain/study/study-progress-sync";
import { browserStudySyncCache } from "@/lib/study-sync-cache";
import {
  deviceCapabilitySnapshot,
  serverDeviceSnapshot,
  subscribeDeviceCapabilities,
  courseWithDeviceAvailability,
} from "@/lib/client-capabilities";
import type { LanguageResources, VocabularyItem } from "@/content/language-resources";
import type { LanguagePackage, PublicAssessment } from "@/content/contracts";
import {
  serverAssessmentResultSchema,
  type AssessmentRequest,
  type ServerAssessmentResult,
} from "@/content/assessment-results";

export type { VocabularyItem } from "@/content/language-resources";

type StudyContextValue = {
  runtime?: InstalledRuntimeContext;
  assessActivity: (
    activity: PublicActivity,
    answer: string,
    onAssessed?: (answer: string, result: GradeResult) => void,
  ) => Promise<GradeResult>;
  course: PublicCourse;
  resources: LanguageResources;
  language: LanguagePackage;
  assessments: PublicAssessment[];
  vocabularyItems: VocabularyItem[];
  state: StudyState;
  ready: boolean;
  authUserId: string | null;
  syncError: string;
  progressLoadStatus: ProgressLoadStatus;
  pendingProgress: StudyState[];
  hasRecoveredProgress: boolean;
  retryProgressSync: () => Promise<void>;
  flushStudyState: () => Promise<void>;
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
  ) => string;
  recordVocabularySearch: (id: string) => void;
  recordVocabularyAudio: (id: string) => void;
  recordNumberPractice: (
    input: Pick<NumberAttempt, "promptId" | "mode" | "answer" | "correct" | "score">,
  ) => void;
  recordRegionalCheck: (
    input: Pick<RegionalAttempt, "topicId" | "selectedAnswer" | "correct">,
  ) => void;
  recordMicroLesson: (
    input: Pick<MicroLessonAttempt, "activityId" | "question" | "selectedOption" | "correct">,
  ) => void;
  saveConversation: (session: ConversationSession) => void;
  saveImageDescription: (attempt: Omit<ImageDescriptionAttempt, "id" | "createdAt">) => void;
  submitAssessment: (input: Omit<AssessmentRequest, "courseId">) => Promise<ServerAssessmentResult>;
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
  ) => Promise<void>;
  updateActiveSessionDuration: (sessionId: string, seconds: number) => void;
  finishSession: (seconds?: number) => void;
  correctSessionDuration: (sessionId: string, minutes: number) => void;
};

const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({
  course,
  resources,
  language,
  children,
  runtime,
  mountedUserId,
}: {
  course: PublicCourse;
  resources: LanguageResources;
  language: LanguagePackage;
  children: ReactNode;
  runtime?: InstalledRuntimeContext;
  mountedUserId?: string | null;
}) {
  const deviceCapabilities = useSyncExternalStore(
    subscribeDeviceCapabilities,
    deviceCapabilitySnapshot,
    serverDeviceSnapshot,
  );
  const vocabularyItems = resources.vocabulary;
  const assessments = course.assessments;
  const [sync] = useState(
    () =>
      new StudyProgressSync(
        () => readCourseState(null, course.id, course.languageCode),
        browserStudySyncCache(course.id, course.languageCode, runtime),
      ),
  );
  const snapshot = useSyncExternalStore(sync.subscribe, sync.getSnapshot, sync.getServerSnapshot);
  const { state, userId: authUserId, loadStatus: progressLoadStatus } = snapshot;
  const visibleCourse = useMemo(
    () =>
      courseWithDeviceAvailability(
        course,
        deviceCapabilities,
        language,
        state.profile.variantId,
        typeof window !== "undefined" ? (window.speechSynthesis?.getVoices() ?? []) : [],
      ),
    [course, deviceCapabilities, language, state.profile.variantId],
  );
  const ready = progressLoadStatus !== "loading";
  const syncError = [snapshot.loadError, snapshot.saveError, snapshot.cacheError]
    .filter(Boolean)
    .join(" ");
  const pendingProgress = useMemo(
    () => (snapshot.dirty ? [...snapshot.recovery, state] : snapshot.recovery),
    [snapshot.dirty, snapshot.recovery, state],
  );
  const hasRecoveredProgress = snapshot.recovery.length > 0;
  const [loadAttempt, setLoadAttempt] = useState(0);
  const setState = useCallback(
    (updater: StudyState | ((current: StudyState) => StudyState)) => {
      sync.update(updater);
    },
    [sync],
  );

  useEffect(() => {
    const generation = sync.beginLoading();
    const client = createSupabaseBrowserClient();
    let sessionUserId: string | null | undefined = mountedUserId ?? runtime?.userId;
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (!sync.isCurrent(generation) || event === "INITIAL_SESSION") return;
      if (
        event === "SIGNED_OUT" ||
        (event === "SIGNED_IN" && sessionUserId !== undefined && nextUserId !== sessionUserId)
      ) {
        // Revoke writes immediately, before React starts the next effect.
        sync.invalidate(generation);
        setLoadAttempt((attempt) => attempt + 1);
        window.location.assign(
          new URL(nextUserId ? "/dashboard" : "/login", window.location.origin).href,
        );
      }
    });
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          if (!client) {
            await sync.load(generation, null, null);
            return;
          }
          const { data, error } = await client.auth.getUser();
          if (!sync.isCurrent(generation)) return;
          sessionUserId = data.user?.id ?? null;
          if (error || !data.user) {
            sync.block(generation, error ? "Não foi possível verificar sua conta." : "");
            return;
          }
          const accountId = data.user.id;
          const access = await canAccessWithMfa(client);
          if (!sync.isCurrent(generation)) return;
          if (!access.allowed) {
            sync.block(
              generation,
              access.error ? "Não foi possível verificar a segurança da sessão." : "",
              accountId,
            );
            return;
          }
          if (
            (mountedUserId !== undefined && mountedUserId !== accountId) ||
            (runtime && runtime.userId !== accountId)
          ) {
            sync.block(generation, "Sua conta mudou. O contexto será recarregado.", accountId);
            window.location.assign(new URL("/dashboard", window.location.origin).href);
            return;
          }
          if (runtime) {
            const repository = new InstalledStudyHttpRepository(runtime, course);
            await sync.load(generation, accountId, repository);
            return;
          }
          const repository = new SupabaseStudyRepository(client, accountId, {
            course,
            load: async () => {
              const response = await fetch(
                `/api/assessments?courseId=${encodeURIComponent(course.id)}`,
                { cache: "no-store" },
              );
              if (!response.ok)
                throw new Error("Não foi possível carregar os resultados das avaliações.");
              const body = await response.json();
              if (!Array.isArray(body.results)) throw new Error("Formato dos resultados inválido.");
              return body.results.map((result: unknown) =>
                serverAssessmentResultSchema.parse(result),
              );
            },
          });
          await sync.load(generation, accountId, {
            load: () => repository.load(course.id, course.languageCode),
            save: (nextState) => repository.save(nextState, course, vocabularyItems),
          });
        } catch (error) {
          sync.block(
            generation,
            error instanceof Error ? error.message : "Não foi possível carregar seu progresso.",
          );
        }
      })();
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      subscription?.data.subscription.unsubscribe();
      sync.invalidate(generation);
    };
  }, [course, vocabularyItems, loadAttempt, sync, runtime, mountedUserId]);

  useEffect(() => {
    if (!snapshot.dirty || !sync.canSaveRemote()) return;
    const timeout = window.setTimeout(() => {
      // The controller keeps failures pending and also checks the generation inside the queue.
      void sync.flush(snapshot.generation).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [snapshot.dirty, snapshot.generation, progressLoadStatus, state, sync]);

  const flushStudyState = useCallback(() => sync.flush(), [sync]);
  const retryProgressSync = useCallback(async () => {
    if (
      sync.getSnapshot().loadStatus === "failed" ||
      (runtime && sync.getSnapshot().saveError.includes("PROGRESS_CONFLICT"))
    ) {
      setLoadAttempt((attempt) => attempt + 1);
    } else {
      await sync.flush().catch(() => undefined);
    }
  }, [sync, runtime]);

  const assessActivity = useCallback(
    async (
      activity: PublicActivity,
      answer: string,
      onAssessed?: (answer: string, result: GradeResult) => void,
    ) => {
      const generation = sync.getSnapshot().generation;
      const userId = sync.getSnapshot().userId;
      const studySessionId = sync.getSnapshot().state.activeSessionId;
      if (runtime) await sync.flush(generation);
      if (!sync.isCurrent(generation) || sync.getSnapshot().userId !== userId)
        throw new Error("Sua sessão mudou antes da correção.");
      const evidenceId = runtime ? crypto.randomUUID() : undefined;
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          activityId: activity.id,
          answer,
          ...(runtime
            ? {
                versionSessionId: runtime.versionSessionId,
                evidenceId,
                ...(studySessionId ? { studySessionId } : {}),
              }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível corrigir agora.");
      if (!sync.isCurrent(generation) || sync.getSnapshot().userId !== userId)
        throw new Error("Sua conta ou contexto mudou durante a correção.");
      if (
        runtime &&
        (!data.metadata ||
          data.metadata.versionSessionId !== runtime.versionSessionId ||
          data.metadata.evidenceId !== evidenceId ||
          !data.metadata.reference ||
          !matchingInstalledReference(data.metadata.reference, runtime.reference))
      )
        throw new Error("A correção não corresponde à versão desta sessão.");
      if (typeof data.correct !== "boolean") throw new Error("Resposta de correção inválida.");
      const feedback = data as GradeResult;
      if (onAssessed) onAssessed(answer, feedback);
      else setState((current) => recordAttempt(current, activity, answer, feedback));
      return feedback;
    },
    [course, runtime, setState, sync],
  );

  const updateProfile = useCallback(
    (profile: Partial<StudentProfile>) =>
      setState((current) => ({ ...current, profile: { ...current.profile, ...profile } })),
    [setState],
  );
  const completeActivity = useCallback(
    (id: string) => setState((current) => markActivityComplete(current, id)),
    [setState],
  );
  const submitAttempt = useCallback(
    (activity: PublicActivity, answer: string, result: GradeResult) =>
      setState((current) => recordAttempt(current, activity, answer, result)),
    [setState],
  );
  const saveWriting = useCallback(
    (activityId: string, text: string, feedback?: unknown) =>
      setState((current) => {
        const completed = markActivityComplete(current, activityId);
        return recordEvaluatedWriting(
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
        );
      }),
    [setState],
  );
  const saveSpeaking = useCallback(
    (
      activityId: string,
      transcription: string,
      audioUrl: string | null,
      feedback?: PronunciationFeedback,
      practiceMode: SpeakingSubmission["practiceMode"] = "lesson",
    ) => {
      const submissionId = crypto.randomUUID();
      setState((current) => {
        const completed = markActivityComplete(current, activityId);
        return recordEvaluatedSpeaking(
          {
            ...completed,
            speaking: [
              {
                id: submissionId,
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
      });
      return submissionId;
    },
    [setState],
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
    [setState],
  );
  const reviewWord = useCallback(
    (id: string, rating: boolean | "difficult") =>
      setState((current) => reviewVocabulary(current, id, rating)),
    [setState],
  );
  const reviewError = useCallback(
    (id: string, correct: boolean) => setState((current) => reviewMistake(current, id, correct)),
    [setState],
  );
  const reviewStructureCard = useCallback(
    (id: string, correct: boolean) =>
      setState((current) => reviewStructure(current, id, correct, resources.structures)),
    [setState, resources.structures],
  );
  const recordVocabularySearch = useCallback(
    (id: string) => setState((current) => recordVocabularySignal(current, id, "vocabulary_search")),
    [setState],
  );
  const recordVocabularyAudio = useCallback(
    (id: string) => setState((current) => recordVocabularySignal(current, id, "vocabulary_audio")),
    [setState],
  );
  const recordNumberPractice = useCallback(
    (input: Pick<NumberAttempt, "promptId" | "mode" | "answer" | "correct" | "score">) =>
      setState((current) => recordNumberAttempt(current, input)),
    [setState],
  );
  const recordRegionalCheck = useCallback(
    (input: Pick<RegionalAttempt, "topicId" | "selectedAnswer" | "correct">) =>
      setState((current) => recordRegionalAttempt(current, input)),
    [setState],
  );
  const recordMicroLesson = useCallback(
    (input: Pick<MicroLessonAttempt, "activityId" | "question" | "selectedOption" | "correct">) =>
      setState((current) => recordMicroLessonAttempt(current, input)),
    [setState],
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
    [setState],
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
    [setState],
  );
  const submitAssessment = useCallback(
    async (input: Omit<AssessmentRequest, "courseId">) => {
      const generation = sync.getSnapshot().generation;
      const userId = sync.getSnapshot().userId;
      if (runtime) await sync.flush(generation);
      if (!sync.isCurrent(generation) || sync.getSnapshot().userId !== userId)
        throw new Error("Sua sessão mudou antes da avaliação.");
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          courseId: course.id,
          ...(runtime ? { versionSessionId: runtime.versionSessionId } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível executar a avaliação.");
      if (!sync.isCurrent(generation) || sync.getSnapshot().userId !== userId)
        throw new Error("Sua sessão mudou durante a avaliação.");
      const result = serverAssessmentResultSchema.parse(body);
      if (result.courseId !== course.id || result.contentVersion !== course.contentVersion)
        throw new Error("O conteúdo da avaliação mudou. Recarregue a página.");
      if (
        runtime &&
        (result.installationId !== runtime.reference.installationId ||
          result.artifactHash !== runtime.reference.artifactHash ||
          result.versionSessionId !== runtime.versionSessionId)
      )
        throw new Error("A avaliação não corresponde à instalação desta sessão.");
      setState((current) => recordServerAssessment(current, course, result));
      return result;
    },
    [course, setState, sync, runtime],
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
          resources.conversationScenarios
            .find((item) => item.id === session.scenarioId)
            ?.objectives.map((item) => item.id) ?? [],
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
    [setState, resources.conversationScenarios],
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
    [setState],
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
    [setState],
  );
  const startSession = useCallback(
    async (unitId: string, plan: PlannedItem[], mode: SessionMode, targetMinutes: number) => {
      const generation = sync.getSnapshot().generation;
      if (sync.getSnapshot().state.activeSessionId) return;
      if (runtime) {
        const response = await fetch("/api/course/active", { cache: "no-store" });
        if (!response.ok)
          throw new Error("Não foi possível verificar a versão ativa. Tente novamente.");
        const catalog = await response.json();
        const current = catalog.active?.find(
          (entry: { reference: { courseId: string } }) => entry.reference.courseId === course.id,
        );
        if (!current || !sync.isCurrent(generation))
          throw new Error("O contexto do curso mudou. Recarregue a página.");
        if (!matchingInstalledReference(current.reference, runtime.reference)) {
          await sync.flush(generation);
          if (!sync.isCurrent(generation)) throw new Error("A conta mudou. Recarregue a página.");
          const selected = await fetch("/api/course/active", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseId: course.id,
              source: "installed",
              expectedRevision: runtime.selectionRevision,
              operationId: crypto.randomUUID(),
            }),
          });
          if (!selected.ok)
            throw new Error(
              "Não foi possível iniciar a versão ativa. Seu progresso foi preservado.",
            );
          window.location.assign(new URL("/study", window.location.origin).href);
          return;
        }
      }
      if (!sync.isCurrent(generation)) throw new Error("A conta mudou. Recarregue a página.");
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
      });
    },
    [setState, course.id, runtime, sync],
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
    [setState],
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
                  durationSeconds: boundedStudySeconds(Math.max(session.durationSeconds, seconds)),
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
    [setState, course.id],
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
    [setState],
  );

  const value = useMemo(
    () => ({
      runtime,
      assessActivity,
      course: visibleCourse,
      resources,
      language,
      assessments,
      vocabularyItems,
      state,
      ready,
      authUserId,
      syncError,
      progressLoadStatus,
      pendingProgress,
      hasRecoveredProgress,
      retryProgressSync,
      flushStudyState,
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
      recordRegionalCheck,
      recordMicroLesson,
      saveConversation,
      saveImageDescription,
      submitAssessment,
      addConversationReply,
      completeConversation,
      recordStudyEvent,
      startSession,
      updateActiveSessionDuration,
      finishSession,
      correctSessionDuration,
    }),
    [
      visibleCourse,
      runtime,
      assessActivity,
      resources,
      language,
      assessments,
      vocabularyItems,
      state,
      ready,
      authUserId,
      syncError,
      progressLoadStatus,
      pendingProgress,
      hasRecoveredProgress,
      retryProgressSync,
      flushStudyState,
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
      recordRegionalCheck,
      recordMicroLesson,
      saveConversation,
      saveImageDescription,
      submitAssessment,
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
