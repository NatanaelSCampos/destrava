import { findCourseBundle } from "@/content/course-registry";
import { resolveRuntimeCourse, courseInstallationRuntime } from "@/lib/course-installation-runtime";
import { serverAssessmentResultSchema } from "@/content/assessment-results";
import type { JsonValue } from "@/domain/course-installations/contracts";
import { createAssessmentApi } from "@/lib/assessment-api";
import { sameAssessmentRequest } from "@/content/assessment-results";
import { userCourseVariant } from "@/lib/user-course-variant";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
const api = createAssessmentApi({
  async resolveCourse(courseId, sessionId, userId) {
    const bundle = await resolveRuntimeCourse(courseId, userId, sessionId);
    return (
      bundle && {
        ...bundle,
        ...("versionSession" in bundle
          ? { versionReference: bundle.versionSession.reference }
          : {}),
      }
    );
  },
  authenticatedUser: getAuthenticatedUser,
  requiresAuth: isSupabaseConfigured,
  async variantPreference(userId, courseId, resolved) {
    const bundle = resolved ?? findCourseBundle(courseId)!;
    return userCourseVariant(userId, courseId, bundle.language, bundle.course);
  },
  async save(userId, input, result) {
    if (input.versionSessionId) {
      const service = courseInstallationRuntime();
      const existing = (await service.listEvidence(userId, input.versionSessionId)).find(
        (item) => item.id === result.id,
      );
      if (existing) {
        const saved = serverAssessmentResultSchema.parse(existing.result);
        if (
          existing.kind !== "assessment" ||
          existing.definitionId !== result.assessmentId ||
          !sameAssessmentRequest(existing.input, input) ||
          saved.variantId !== result.variantId
        )
          throw new Error("Assessment evidence conflict");
        return saved.finishedAt;
      }
      await service.recordEvidence(userId, input.versionSessionId, {
        id: result.id,
        kind: "assessment",
        definitionId: result.assessmentId,
        input: JSON.parse(JSON.stringify(input)) as JsonValue,
        result: JSON.parse(JSON.stringify(result)) as JsonValue,
      });
      return result.finishedAt;
    }
    const db = await createSupabaseServerClient();
    if (!db) throw new Error("Assessment database unavailable");
    const { data: existing, error: readError } = await db
      .from("assessment_attempts")
      .select("result,finished_at")
      .eq("user_id", userId)
      .eq("id", result.id)
      .maybeSingle();
    if (readError) throw readError;
    if (existing) {
      if (
        existing.result?.contentVersion !== result.contentVersion ||
        !sameAssessmentRequest(existing.result?.input, input) ||
        (existing.result?.variantId && existing.result.variantId !== result.variantId)
      )
        throw new Error("Assessment attempt conflict");
      return existing.finished_at as string;
    }
    const { error } = await db.from("assessment_attempts").insert({
      id: result.id,
      user_id: userId,
      assessment_id: result.assessmentId,
      started_at: result.startedAt,
      finished_at: result.finishedAt,
      objective_score: result.objectiveScore,
      result: {
        courseId: result.courseId,
        unitId: result.unitId,
        contentVersion: result.contentVersion,
        variantId: result.variantId,
        purpose: result.purpose,
        method: result.method,
        passed: result.passed,
        input,
      },
    });
    if (error) throw error;
    return result.finishedAt;
  },
  async read(userId, assessmentIds, scope) {
    if (scope?.versionSessionId) {
      const evidence = await courseInstallationRuntime().listEvidence(
        userId,
        scope.versionSessionId,
      );
      return evidence
        .filter((item) => item.kind === "assessment" && assessmentIds.includes(item.definitionId))
        .map((item) => {
          const saved = serverAssessmentResultSchema.parse(item.result);
          return {
            id: item.id,
            assessment_id: item.definitionId,
            started_at: saved.startedAt,
            finished_at: saved.finishedAt,
            objective_score: saved.objectiveScore,
            result: {
              courseId: saved.courseId,
              contentVersion: saved.contentVersion,
              unitId: saved.unitId,
              variantId: saved.variantId,
              input: item.input,
            },
          };
        });
    }
    const db = await createSupabaseServerClient();
    if (!db) throw new Error("Assessment database unavailable");
    const { data, error } = await db
      .from("assessment_attempts")
      .select("id,assessment_id,started_at,finished_at,objective_score,result")
      .eq("user_id", userId)
      .in("assessment_id", assessmentIds)
      .order("finished_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});
export const POST = api.POST;
export const GET = api.GET;
