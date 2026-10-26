"use client";
import { courseWithLearningAccess, type LearningAccessSnapshot } from "@/domain/study/learning-access";

import {
  interactiveLessonProgressReceiptSchema,
  type InteractiveLessonProgressReceipt,
} from "@/domain/interactive-lesson/progress-receipt";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  recordInteractiveLessonReceipt,
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
import { checkpointSession } from "@/domain/study/session-lifecycle";
import type { AdaptiveProgress } from "@/domain/assessments/adaptive-progress";
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
  learningAccess: LearningAccessSnapshot | null;
  learningAccessError: string;
  refreshLearningAccess: () => Promise<LearningAccessSnapshot | null>;
  runtime?: InstalledRuntimeContext;
  captureInteractiveLessonOwner: () => { generation: number; userId: string };
  applyInteractiveLessonReceipt: (
    receipt: InteractiveLessonProgressReceipt,
    owner: { generation: number; userId: string },
  ) => void;
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
  ) => Promise<string>;
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
  checkpointStudySession: (
    sessionId: string,
    input: { seconds?: number; cursor?: number; paused?: boolean },
  ) => Promise<void>;
  confirmAdaptiveProgress: (input: AdaptiveProgress) => Promise<AdaptiveProgress>;
  finishSession: (seconds?: number) => Promise<void>;
  correctSessionDuration: (sessionId: string, minutes: number) => void;
};

const StudyContext = createContext<StudyContextValue | null>(null);

/** Finish audio preparation before the submission enters the durable sync intent. */
export async function prepareAndRecordSpeaking(
  sync: StudyProgressSync,
  submission: Omit<SpeakingSubmission, "sessionId">,
  prepare?: (submission: SpeakingSubmission) => Promise<SpeakingSubmission>,
): Promise<string> {
  const owner = sync.getSnapshot();
  if (!["loaded", "absent"].includes(owner.loadStatus))
    throw new Error("Carregue seu progresso antes de salvar a prática oral.");
  const original = { ...submission, sessionId: owner.state.activeSessionId };
  const prepared = prepare ? await prepare(original) : original;
  const current = sync.getSnapshot();
  if (!sync.isCurrent(owner.generation) || current.userId !== owner.userId ||
    !["loaded", "absent"].includes(current.loadStatus))
    throw new Error("Sua conta ou contexto mudou durante o envio da gravação.");
  sync.update((state) => {
    const completed = markActivityComplete(state, prepared.activityId);
    return recordEvaluatedSpeaking({
      ...completed,
      speaking: [prepared, ...state.speaking],
      events: [{ id: crypto.randomUUID(), type: "speaking_submitted",
        activityId: prepared.activityId, createdAt: new Date().toISOString() }, ...completed.events],
    }, prepared.activityId, prepared.feedback);
  });
  return prepared.id;
}

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
        browserStudySyncCache(
          course.id,
          course.languageCode,
          runtime,
          runtime ? undefined : course.contentVersion,
        ),
        runtime ? undefined : { courseId: course.id, contentVersion: course.contentVersion },
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
          const repository = new SupabaseStudyRepository(
            client,
            accountId,
            {
              course,
              load: async () => {
                const response = await fetch(
                  `/api/assessments?courseId=${encodeURIComponent(course.id)}`,
                  { cache: "no-store" },
                );
                if (!response.ok)
                  throw new Error("Não foi possível carregar os resultados das avaliações.");
                const body = await response.json();
                if (!Array.isArray(body.results))
                  throw new Error("Formato dos resultados inválido.");
                return body.results.map((result: unknown) =>
                  serverAssessmentResultSchema.parse(result),
                );
              },
            },
            {
              course,
              load: async () => {
                const response = await fetch(
                  "/api/interactive-lessons/session?courseId=" +
                    encodeURIComponent(course.id) +
                    "&receipts=1",
                  { cache: "no-store" },
                );
                if (!response.ok)
                  throw new Error("Não foi possível recuperar as tentativas da aula.");
                const body = await response.json();
                if (!Array.isArray(body.receipts)) throw new Error("Recibos da aula inválidos.");
                return body.receipts.map((value: unknown) => {
                  const receipt = interactiveLessonProgressReceiptSchema.parse(value);
                  if (
                    receipt.evidence.userId !== accountId ||
                    receipt.evidence.courseId !== course.id ||
                    receipt.evidence.contentVersion !== course.contentVersion
                  )
                    throw new Error("A tentativa da aula pertence a outro contexto.");
                  return receipt;
                });
              },
            },
          );
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

  const captureInteractiveLessonOwner = useCallback(() => {
    const current = sync.getSnapshot();
    if (runtime || !current.userId || !["loaded", "absent"].includes(current.loadStatus))
      throw new Error("A aula requer uma conta autenticada no curso embutido.");
    return { generation: current.generation, userId: current.userId };
  }, [sync, runtime]);
  const applyInteractiveLessonReceipt = useCallback(
    (value: InteractiveLessonProgressReceipt, owner: { generation: number; userId: string }) => {
      if (
        runtime ||
        !sync.isCurrent(owner.generation) ||
        sync.getSnapshot().userId !== owner.userId
      )
        throw new Error("Sua conta ou contexto mudou durante a tentativa da aula.");
      const receipt = interactiveLessonProgressReceiptSchema.parse(value);
      if (
        receipt.evidence.userId !== owner.userId ||
        receipt.evidence.courseId !== course.id ||
        receipt.evidence.contentVersion !== course.contentVersion
      )
        throw new Error("A tentativa não corresponde ao curso e à conta atuais.");
      setState((current) => recordInteractiveLessonReceipt(current, course, receipt));
    },
    [runtime, sync, course, setState],
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
      const owner = sync.getSnapshot();
      return prepareAndRecordSpeaking(sync, {
        id: crypto.randomUUID(), activityId, transcription, audioUrl, feedback,
        practiceMode, createdAt: new Date().toISOString(),
      }, !runtime && owner.userId ? async (submission) => {
        if (!sync.canSaveRemote())
          throw new Error("Confirme seu progresso antes de enviar a gravação.");
        const client = createSupabaseBrowserClient();
        if (!client) throw new Error("Não foi possível enviar a gravação. Tente novamente.");
        return new SupabaseStudyRepository(client, owner.userId!).prepareSpeakingSubmission(submission);
      } : undefined);
    },
    [runtime, sync],
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
  const startSessionOperation = useCallback(
    async (unitId: string, plan: PlannedItem[], mode: SessionMode, targetMinutes: number) => {
      const generation = sync.getSnapshot().generation;
      if (!["loaded", "absent"].includes(sync.getSnapshot().loadStatus))
        throw new Error("Confirme a leitura do progresso antes de iniciar.");
      if (sync.getSnapshot().state.activeSessionId) {
        await sync.flush(generation);
        return;
      }
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
          if (!sync.isCurrent(generation)) throw new Error("Sua conta mudou durante a seleção.");
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
              cursor: 0,
              paused: false,
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
      await sync.flush(generation);
    },
    [setState, course.id, runtime, sync],
  );
  const starting = useRef<Promise<void> | null>(null);
  const startSession = useCallback(
    (unitId: string, plan: PlannedItem[], mode: SessionMode, targetMinutes: number) => {
      if (starting.current) return starting.current;
      const operation = startSessionOperation(unitId, plan, mode, targetMinutes);
      starting.current = operation;
      void operation
        .finally(() => {
          if (starting.current === operation) starting.current = null;
        })
        .catch(() => undefined);
      return operation;
    },
    [startSessionOperation],
  );
  const checkpointStudySession = useCallback(
    async (sessionId: string, input: { seconds?: number; cursor?: number; paused?: boolean }) => {
      const generation = sync.getSnapshot().generation;
      setState((current) => checkpointSession(current, sessionId, input));
      await sync.flush(generation);
    },
    [sync, setState],
  );
  const confirmAdaptiveProgress = useCallback(
    async (input: AdaptiveProgress): Promise<AdaptiveProgress> => {
      const owner = sync.getSnapshot();
      if (!runtime)
        throw new Error("Retomada de respostas confirmadas disponível no curso instalado.");
      const { answers: ignored, ...submitted } = input;
      void ignored;
      setState((current) => ({
        ...current,
        adaptiveProgress: [
          submitted,
          ...(current.adaptiveProgress ?? []).filter(
            (value) => value.assessmentId !== input.assessmentId,
          ),
        ],
      }));
      await sync.flush(owner.generation);
      const response = await fetch(
        "/api/course-installations/progress?versionSessionId=" +
          encodeURIComponent(runtime.versionSessionId),
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("Não foi possível confirmar as respostas submetidas. Tente novamente.");
      const body = await response.json();
      if (!sync.isCurrent(owner.generation) || sync.getSnapshot().userId !== owner.userId)
        throw new Error("Sua conta ou contexto mudou durante a avaliação.");
      if (
        body.versionSessionId !== runtime.versionSessionId ||
        !matchingInstalledReference(body.reference, runtime.reference)
      )
        throw new Error("As respostas pertencem a outra instalação.");
      const confirmed = body.state?.adaptiveProgress?.find(
        (value: AdaptiveProgress) => value.attemptId === input.attemptId,
      ) as AdaptiveProgress | undefined;
      if (
        !confirmed ||
        confirmed.assessmentId !== input.assessmentId ||
        confirmed.startedAt !== input.startedAt ||
        JSON.stringify(confirmed.responses) !== JSON.stringify(input.responses) ||
        !Array.isArray(confirmed.answers) ||
        confirmed.answers.length !== input.responses.length
      )
        throw new Error("As respostas ainda não foram confirmadas.");
      setState((current) => ({
        ...current,
        adaptiveProgress: [
          confirmed,
          ...(current.adaptiveProgress ?? []).filter(
            (value) => value.assessmentId !== input.assessmentId,
          ),
        ],
      }));
      return confirmed;
    },
    [runtime, sync, setState],
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
    async (seconds = 0) => {
      const generation = sync.getSnapshot().generation;
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
      });
      await sync.flush(generation);
    },
    [setState, course.id, sync],
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

  const accessRequest = useRef(0);
  const hasLearningAccess =
    course.units.some((u) => u.access) ||
    course.assessments.some((a) => a.method === "fixed" && a.exam);
  const [accessState, setAccessState] = useState<{
    owner: string;
    snapshot: LearningAccessSnapshot;
  } | null>(null);
  const [learningAccessError, setLearningAccessError] = useState("");
  const learningAccess =
    accessState?.owner === authUserId &&
    accessState.snapshot.courseId === course.id &&
    accessState.snapshot.contentVersion === course.contentVersion
      ? accessState.snapshot
      : null;
  const refreshLearningAccess = useCallback(async () => {
    if (!hasLearningAccess || !sync.getSnapshot().userId) return null;
    const generation = sync.getSnapshot().generation,
      owner = sync.getSnapshot().userId!,
      requestId = ++accessRequest.current;
    try {
      await sync.flush(generation);
      const response = await fetch(
        "/api/learning-access?courseId=" + encodeURIComponent(course.id),
        { cache: "no-store" },
      );
      const result = await response.json();
      if (
        !sync.isCurrent(generation) ||
        sync.getSnapshot().userId !== owner ||
        requestId !== accessRequest.current
      )
        return null;
      if (
        !response.ok ||
        result.courseId !== course.id ||
        result.contentVersion !== course.contentVersion
      )
        throw new Error(result.error ?? "Não foi possível conferir seu percurso.");
      setAccessState({ owner, snapshot: result });
      setLearningAccessError("");
      return result as LearningAccessSnapshot;
    } catch (error) {
      if (
        sync.isCurrent(generation) &&
        sync.getSnapshot().userId === owner &&
        requestId === accessRequest.current
      ) {
        setAccessState(null);
        setLearningAccessError(
          error instanceof Error ? error.message : "Não foi possível conferir seu percurso.",
        );
      }
      return null;
    }
  }, [course.id, course.contentVersion, hasLearningAccess, sync]);
  useEffect(() => {
    if (!ready || !authUserId || !["loaded", "absent"].includes(progressLoadStatus)) return;
    const timer = window.setTimeout(() => void refreshLearningAccess(), 250);
    return () => window.clearTimeout(timer);
  }, [
    ready,
    authUserId,
    progressLoadStatus,
    state.attempts.length,
    state.assessmentAttempts.length,
    refreshLearningAccess,
  ]);

  const accessibleCourse = useMemo(
    () => hasLearningAccess ? courseWithLearningAccess(visibleCourse, learningAccess) : visibleCourse,
    [visibleCourse, hasLearningAccess, learningAccess],
  );
  const value = useMemo(
    () => ({
      learningAccess,
      learningAccessError,
      refreshLearningAccess,
      runtime,
      assessActivity,
      captureInteractiveLessonOwner,
      applyInteractiveLessonReceipt,
      course: accessibleCourse,
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
      checkpointStudySession,
      confirmAdaptiveProgress,
      finishSession,
      correctSessionDuration,
    }),
    [
      learningAccess,
      learningAccessError,
      refreshLearningAccess,
      accessibleCourse,
      runtime,
      assessActivity,
      captureInteractiveLessonOwner,
      applyInteractiveLessonReceipt,
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
      checkpointStudySession,
      confirmAdaptiveProgress,
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
