export type LessonWritingScope = {
  userId: string | null;
  courseId: string;
  contentVersion: string;
  source: "compiled" | "installed";
  installationId?: string;
  artifactHash?: string;
  versionSessionId?: string;
  unitId: string;
  lessonId: string;
};

/** React remount boundary. Drafts never enter persisted learning state. */
export function lessonWritingScopeKey(scope: LessonWritingScope): string {
  return JSON.stringify([
    scope.userId, scope.courseId, scope.contentVersion, scope.source,
    scope.installationId ?? null, scope.artifactHash ?? null,
    scope.versionSessionId ?? null, scope.unitId, scope.lessonId,
  ]);
}
