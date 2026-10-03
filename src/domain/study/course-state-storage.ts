import { initialStudyState, type StudyState } from "./study-state";
import { readLearningPreferences } from "./learning-preferences";

export const LEGACY_COURSE_ID = "frecuencias-a1";

export type CourseStateStorage = {
  schemaVersion: 2;
  courses: Record<string, StudyState>;
};

function isCourseStorage(value: unknown): value is CourseStateStorage {
  return Boolean(
    value &&
      typeof value === "object" &&
      "schemaVersion" in value &&
      value.schemaVersion === 2 &&
      "courses" in value &&
      value.courses &&
      typeof value.courses === "object",
  );
}

function normalize(
  state: Partial<StudyState> | null | undefined,
  courseId: string,
  languageCode = "",
): StudyState {
  const source = state ?? {};
  return {
    ...initialStudyState,
    ...source,
    courseId,
    languageCode: languageCode || source.languageCode || (courseId === LEGACY_COURSE_ID ? "es" : ""),
    profile: {
      ...initialStudyState.profile,
      ...source.profile,
      learningPreferences: readLearningPreferences(source.profile?.learningPreferences),
      selfReportedLevel: source.profile?.selfReportedLevel ?? null,
      onboardingStep: source.profile?.onboardingStep ?? 0,
      // A course profile saved before this flow is an existing enrollment.
      onboarded: source.profile && !("learningPreferences" in source.profile)
        ? true : source.profile?.onboarded ?? false,
      variantId: source.profile?.variantId ??
        ((source.profile as unknown as { spanishRegion?: string } | undefined)?.spanishRegion ?? "general"),
    },
    completedActivityIds: source.completedActivityIds ?? [],
    attempts: source.attempts ?? [],
    vocabulary: source.vocabulary ?? {},
    structureReviews: source.structureReviews ?? {},
    pronunciationReviews: source.pronunciationReviews ?? {},
    structureAttempts: source.structureAttempts ?? [],
    mistakes: source.mistakes ?? {},
    sessions: source.sessions ?? [],
    events: source.events ?? [],
    reviews: source.reviews ?? [],
    assessmentAttempts: source.assessmentAttempts ?? [],
    writing: source.writing ?? [],
    speaking: source.speaking ?? [],
    numberAttempts: source.numberAttempts ?? [],
    microLessonAttempts: source.microLessonAttempts ?? [],
    conversations: source.conversations ?? [],
    imageDescriptions: source.imageDescriptions ?? [],
    adaptiveAssessments: source.adaptiveAssessments ?? [],
  };
}

export function readCourseState(raw: unknown, courseId: string, languageCode = ""): StudyState {
  if (isCourseStorage(raw)) return normalize(raw.courses[courseId], courseId, languageCode);
  if (raw && typeof raw === "object" && "courseId" in raw)
    return raw.courseId === courseId
      ? normalize(raw as Partial<StudyState>, courseId, languageCode)
      : normalize(null, courseId, languageCode);
  if (courseId === LEGACY_COURSE_ID && raw && typeof raw === "object")
    return normalize(raw as Partial<StudyState>, courseId, languageCode);
  return normalize(null, courseId, languageCode);
}

export function writeCourseState(
  raw: unknown,
  courseId: string,
  state: StudyState,
): CourseStateStorage {
  const courses: Record<string, StudyState> = isCourseStorage(raw)
    ? { ...raw.courses }
    : raw && typeof raw === "object"
      ? { [("courseId" in raw && typeof raw.courseId === "string") ? raw.courseId : LEGACY_COURSE_ID]:
          normalize(raw as Partial<StudyState>,
            ("courseId" in raw && typeof raw.courseId === "string") ? raw.courseId : LEGACY_COURSE_ID) }
      : {};
  courses[courseId] = normalize(state, courseId, state.languageCode);
  return { schemaVersion: 2, courses };
}
