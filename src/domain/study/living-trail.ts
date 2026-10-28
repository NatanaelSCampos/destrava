import type { PublicCourse } from "@/content/public";
import { assessmentActivityIds, assessmentLink } from "@/content/assessment-references";
import {
  parseJourneyPresentation,
  type JourneyIcon,
  type JourneyTone,
  type JourneyMoment,
} from "@/content/journey-presentation";
import { resolveLessonStages } from "@/engine/presentation/lesson-stages";
import { assessmentsForLesson } from "@/lib/assessment-lesson";
import { courseLessonPath } from "@/lib/course-lesson-navigation";
import { courseStudySummary, unitProgress } from "./progress";
import { currentAssessmentResult } from "./learning-policy-engine";
import {
  learningActionAvailability,
  type LearningActionContext,
} from "./learning-action-availability";
import type { AccessDecision, LearningAccessSnapshot } from "./learning-access";
import { initialStudyState, type StudyState } from "./study-state";

export type LivingTrailOptions = {
  presentation?: unknown;
  learningAccess?: LearningAccessSnapshot | null;
  actionContext?: LearningActionContext;
  vocabularyItems?: ReadonlyArray<{ id: string; lessonId: string }>;
};
export type LivingTrailMoment = {
  id: string;
  title: string;
  description: string;
  objective?: string;
  character?: string;
  setting?: string;
  illustration?: JourneyMoment["illustration"];
  audioActivityIds?: string[];
  icon: JourneyIcon;
  tone: JourneyTone;
  kind: "lesson" | "guided" | "assessment";
  lessonId?: string;
  assessmentId?: string;
  isExam: boolean;
  assessmentPurpose?: PublicCourse["assessments"][number]["purpose"];
  stageIds: string[];
  activityIds: string[];
  /** Current executable activities; full activityIds still define coverage. */
  availableActivityIds: string[];
  completed: number;
  total: number;
  percentage: number;
  status: "available" | "in_progress" | "completed" | "locked" | "unavailable";
  label: string;
  blockedReason: string | null;
  href: string;
  entryActivityId?: string;
  access: AccessDecision;
  reasons: string[];
  result: ReturnType<typeof currentAssessmentResult> | null;
  historyCount: number;
};
export type LivingTrailChapter = {
  id: string;
  unitId: string;
  number: number;
  title: string;
  description: string;
  objective?: string;
  character?: string;
  setting?: string;
  icon: JourneyIcon;
  tone: JourneyTone;
  illustration?: JourneyMoment["illustration"];
  moments: LivingTrailMoment[];
  progress: ReturnType<typeof unitProgress>;
  access: AccessDecision;
};
export type LivingTrail = {
  chapters: LivingTrailChapter[];
  currentMomentId: string | null;
  currentChapterId: string | null;
  summary: ReturnType<typeof courseStudySummary>;
  presentationVersion: string | null;
  presentationIssues: string[];
};
const available: AccessDecision = { allowed: true, message: "Conteúdo disponível." };
const checking: AccessDecision = {
  allowed: false,
  message: "Conferindo os requisitos de acesso. Aguarde a atualização do seu percurso.",
};
const labels = {
  available: "Disponível",
  in_progress: "Em andamento",
  completed: "Estudado",
  locked: "Bloqueado",
  unavailable: "Indisponível",
};

/**
 * Read-only presentation of official course and evidence projections.
 * The provider must supply state already scoped to the user and immutable installed version.
 * URLs and visual state never grant authorization; server guards remain authoritative.
 */
export function buildLivingTrail(
  course: PublicCourse,
  suppliedState: StudyState,
  options: LivingTrailOptions = {},
): LivingTrail {
  const stateMatches = !suppliedState.courseId || suppliedState.courseId === course.id;
  const state = stateMatches ? suppliedState : { ...initialStudyState, courseId: course.id };
  const completed = new Set(state.completedActivityIds);
  const context = options.actionContext ?? { source: "compiled", permitted: true };
  const parsed = parseJourneyPresentation(options.presentation, course);
  const presentation = parsed.presentation;
  const snapshot =
    options.learningAccess?.courseId === course.id &&
    options.learningAccess.contentVersion === course.contentVersion
      ? options.learningAccess
      : null;
  const chapters = course.units
    .filter((unit) => unit.active && unit.lessons.some((l) => l.active))
    .map<LivingTrailChapter>((unit) => {
      const editorial = presentation?.chapters.find((c) => c.unitId === unit.id);
      const access = unit.access ? (snapshot?.units[unit.id] ?? checking) : available;
      const fallback = unit.lessons
        .filter((l) => l.active)
        .flatMap<JourneyMoment>((lesson) => {
          const assessments = assessmentsForLesson(course, unit, lesson);
          return assessments.length
            ? assessments.map((assessment) => ({
                id: "assessment-" + assessment.id,
                title: assessment.title,
                target: { kind: "assessment" as const, assessmentId: assessment.id },
              }))
            : [
                {
                  id: "lesson-" + lesson.id,
                  title: lesson.title,
                  description: lesson.description,
                  target: { kind: "lesson" as const, lessonId: lesson.id },
                },
              ];
        });
      const moments = (editorial?.moments ?? fallback).map<LivingTrailMoment>((moment) => {
        const target = moment.target;
        const assessment =
          target.kind === "assessment"
            ? course.assessments.find((a) => a.id === target.assessmentId)
            : undefined;
        const lesson = unit.lessons.find(
          (l) => l.id === (target.kind === "lesson" ? target.lessonId : assessment?.lessonId),
        );
        // Semantic validation and generated fallback guarantee an owner for every moment.
        if (!lesson) throw new Error("A trail moment has no curricular lesson owner: " + moment.id);
        const isExam = assessment?.method === "fixed" && Boolean(assessment.exam);
        const guided = !assessment && Boolean(lesson.interactiveLessonRef);
        const kind = assessment ? "assessment" : guided ? "guided" : "lesson";
        const stages = resolveLessonStages(lesson);
        const stageIds =
          target.kind === "lesson" ? (target.stageIds ?? stages.map((s) => s.id)) : [];
        const activityIds = assessment
          ? assessmentActivityIds(assessment)
          : stages.filter((s) => stageIds.includes(s.id)).flatMap((s) => s.activityIds);
        const count = activityIds.filter((id) => completed.has(id)).length;
        const result = assessment
          ? (currentAssessmentResult(course, state, assessment.id) ?? null)
          : null;
        const candidates =
          assessment?.method === "adaptive" ? state.adaptiveAssessments : state.assessmentAttempts;
        const historyCount = assessment
          ? candidates.filter(
              (item) =>
                item.assessmentId === assessment.id &&
                item.courseId === course.id &&
                item.contentVersion === course.contentVersion &&
                item.source === "server" &&
                item.method === assessment.method &&
                item.purpose === assessment.purpose,
            ).length
          : 0;
        const gate = !access.allowed
          ? access
          : assessment?.method === "fixed" && assessment.exam
            ? (snapshot?.assessments[assessment.id] ?? checking)
            : available;
        const activityActions = activityIds.map((activityId) => ({
          activityId,
          availability: learningActionAvailability(
            course,
            { kind: "activity", activityId },
            context,
          ),
        }));
        const action = assessment
          ? learningActionAvailability(course, { kind: "assessment", id: assessment.id }, context)
          : guided
            ? learningActionAvailability(
                course,
                { kind: "interactive", id: lesson.interactiveLessonRef },
                context,
              )
            : null;
        const specificGuidedUnavailable =
          guided &&
          course.availability?.unavailableInteractiveLessonIds?.includes(
            lesson.interactiveLessonRef!,
          );
        const eligible =
          !specificGuidedUnavailable &&
          (action ? action.eligible : activityActions.some((item) => item.availability.eligible));
        const pending = activityActions.find(
          (item) => !completed.has(item.activityId) && item.availability.eligible,
        );
        const entryActivityId =
          assessment || guided
            ? undefined
            : (pending?.activityId ??
              activityActions.find((item) => item.availability.eligible)?.activityId ??
              activityIds[0]);
        const done = assessment
          ? result?.status === "completed"
          : activityIds.length > 0 && count === activityIds.length;
        const blockedActions = action
          ? action.reasons
          : activityActions
              .filter((item) => !item.availability.eligible)
              .flatMap((item) => item.availability.reasons);
        const reasons = [
          ...new Set([
            ...(!gate.allowed ? [gate.message] : []),
            ...(specificGuidedUnavailable
              ? ["Esta aula guiada está indisponível no curso atual."]
              : []),
            ...blockedActions,
          ]),
        ];
        // An unfinished unavailable part remains unfinished; completed parts never grant a new evidence result.
        const cannotContinue = !assessment && !guided && !done && !pending;
        const status: LivingTrailMoment["status"] = !gate.allowed
          ? "locked"
          : !eligible || cannotContinue
            ? "unavailable"
            : done
              ? "completed"
              : count > 0 || result
                ? "in_progress"
                : "available";
        const query = new URLSearchParams({ moment: moment.id });
        if (entryActivityId) query.set("activity", entryActivityId);
        const href = assessment
          ? assessmentLink(assessment.id) + "&moment=" + encodeURIComponent(moment.id)
          : courseLessonPath(course, unit, lesson) +
            (guided ? "/guided" : "") +
            "?" +
            query.toString();
        const label =
          result?.status === "completed" && isExam
            ? result.passed === true
              ? "Prova aprovada"
              : result.passed === false
                ? "Tente a prova novamente"
                : "Resultado disponível"
            : labels[status];
        return {
          id: moment.id,
          title: moment.title,
          description: moment.description ?? lesson.description,
          objective: moment.objective,
          character: moment.character,
          setting: moment.setting,
          illustration: moment.illustration,
          audioActivityIds: moment.audioActivityIds,
          icon:
            moment.icon ??
            (assessment
              ? isExam
                ? "trophy"
                : assessment.purpose === "diagnostic"
                  ? "compass"
                  : "brain"
              : guided
                ? "headphones"
                : "book-open"),
          tone: moment.tone ?? (isExam ? "amber" : guided ? "sky" : "forest"),
          kind,
          lessonId: lesson.id,
          assessmentId: assessment?.id,
          isExam,
          assessmentPurpose: assessment?.purpose,
          stageIds,
          activityIds,
          availableActivityIds: activityActions
            .filter((item) => item.availability.eligible)
            .map((item) => item.activityId),
          completed: count,
          total: activityIds.length,
          percentage: activityIds.length ? Math.floor((1000 * count) / activityIds.length) / 10 : 0,
          status,
          label,
          blockedReason:
            status === "locked" || status === "unavailable"
              ? (reasons[0] ?? "Este momento não está disponível agora.")
              : null,
          href,
          entryActivityId,
          access: gate,
          reasons,
          result,
          historyCount,
        };
      });
      return {
        id: editorial?.id ?? "chapter-" + unit.id,
        unitId: unit.id,
        number: unit.number,
        title: editorial?.title ?? unit.title,
        description: editorial?.description ?? unit.description,
        objective: editorial?.objective,
        character: editorial?.character,
        setting: editorial?.setting,
        icon: editorial?.icon ?? "flag",
        tone: editorial?.tone ?? "forest",
        illustration: editorial?.illustration,
        moments,
        progress: unitProgress(unit, state, options.vocabularyItems ?? [], course),
        access,
      };
    });
  const currentChapter = chapters.find((chapter) =>
    chapter.moments.some(
      (moment) =>
        moment.status === "available" ||
        moment.status === "in_progress" ||
        (moment.status === "completed" &&
          moment.isExam &&
          moment.result?.passed === false &&
          moment.access.allowed),
    ),
  );
  const current = currentChapter?.moments.find(
    (moment) =>
      moment.status === "available" ||
      moment.status === "in_progress" ||
      (moment.status === "completed" &&
        moment.isExam &&
        moment.result?.passed === false &&
        moment.access.allowed),
  );
  return {
    chapters,
    currentMomentId: current?.id ?? null,
    currentChapterId: currentChapter?.id ?? null,
    summary: courseStudySummary(course, state),
    presentationVersion: presentation?.presentationVersion ?? null,
    presentationIssues: [
      ...parsed.issues,
      ...(!stateMatches
        ? ["Study state belongs to a different course; its evidence was not projected."]
        : []),
    ],
  };
}
