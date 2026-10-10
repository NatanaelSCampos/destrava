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
      typeof value.courses === "object" &&
      !Array.isArray(value.courses),
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
    regionalAttempts: source.regionalAttempts ?? [],
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

/** Existing remote rows must be readable; malformed rows are not missing enrollments. */
export function readPersistedCourseState(
  raw: unknown, courseId: string, languageCode = "", legacy = false,
): StudyState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("O progresso salvo está ilegível. A sincronização foi bloqueada para proteger seus dados.");
  if ("schemaVersion" in raw) {
    if (!isCourseStorage(raw)) throw new Error("Formato de progresso salvo não reconhecido.");
    if (!(courseId in raw.courses)) {
      if (legacy) return null;
      throw new Error("O progresso salvo não corresponde ao curso atual.");
    }
    return readPersistedCourseState(raw.courses[courseId], courseId, languageCode);
  }
  if ("courseId" in raw && typeof raw.courseId !== "string")
    throw new Error("O progresso salvo não identifica um curso válido.");
  if ("courseId" in raw && raw.courseId !== courseId) {
    if (legacy) return null;
    throw new Error("O progresso salvo não corresponde ao curso atual.");
  }
  if (legacy && !("courseId" in raw) && courseId !== LEGACY_COURSE_ID) return null;
  for (const key of ["completedActivityIds", "attempts", "sessions", "events", "reviews", "writing", "speaking",
    "structureAttempts", "assessmentAttempts", "numberAttempts", "regionalAttempts", "microLessonAttempts",
    "conversations", "imageDescriptions", "adaptiveAssessments"])
    if (key in raw && !Array.isArray((raw as Record<string, unknown>)[key]))
      throw new Error("O progresso salvo contém dados ilegíveis.");
  for (const key of ["profile", "vocabulary", "mistakes", "structureReviews", "pronunciationReviews"])
    if (key in raw) {
      const value = (raw as Record<string, unknown>)[key];
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("O progresso salvo contém dados ilegíveis.");
    }
  return normalize({ ...raw, courseId } as Partial<StudyState>, courseId, languageCode);
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
