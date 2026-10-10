import { findCourseBundle } from "@/content/course-registry";
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
  resolveCourse: findCourseBundle,
  authenticatedUser: getAuthenticatedUser,
  requiresAuth: isSupabaseConfigured,
  async variantPreference(userId, courseId) {
    const bundle = findCourseBundle(courseId)!;
    return userCourseVariant(userId, courseId, bundle.language, bundle.course);
  },
  async save(userId, input, result) {
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
  async read(userId, assessmentIds) {
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
