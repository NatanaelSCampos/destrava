import { authorizeLearningTarget, completionReceipt } from "@/lib/learning-access-server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { courseInstallationRuntime } from "@/lib/course-installation-runtime";
import { resolveApplicationOperation, installedPublicView } from "@/lib/application-course-runtime";
import { installedStudyRuntime } from "@/lib/installed-study-runtime";
import { InstalledStudyError } from "@/domain/installed-study/contracts";
import { randomUUID } from "node:crypto";
import { InstallationError, type JsonValue } from "@/domain/course-installations/contracts";
import { findActivity } from "@/content/schema";
import { gradeActivity } from "@/domain/activities/grader";
import { getAuthenticatedUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { publicCourse } from "@/content/public";
import { userCourseVariant } from "@/lib/user-course-variant";

const requestSchema = z.object({
  courseId: z.string().min(1),
  activityId: z.string().min(1),
  answer: z.string().max(1000),
  versionSessionId: z.uuid().optional(),
  evidenceId: z.uuid().optional(),
  studySessionId: z.uuid().optional(),
});

export async function POST(request: Request) {
  const user = isSupabaseConfigured() ? await getAuthenticatedUser() : null;
  if (isSupabaseConfigured() && !user) {
    return NextResponse.json({ error: "Entre na sua conta para responder." }, { status: 401 });
  }
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Resposta inválida." }, { status: 400 });
  let bundle;
  try {
    bundle = await resolveApplicationOperation(
      input.data.courseId,
      user?.id,
      input.data.versionSessionId,
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Não foi possível resolver a versão da sessão." },
      {
        status:
          error instanceof InstallationError && error.code === "SESSION_NOT_FOUND"
            ? 404
            : error instanceof InstalledStudyError &&
                ["SESSION_CONFLICT", "NOT_AUTHORIZED"].includes(error.code)
              ? 403
              : error instanceof InstalledStudyError && error.code === "INVALID_INPUT"
                ? 400
                : 503,
      },
    );
  }
  if (!bundle) return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
  if (
    input.data.versionSessionId &&
    (bundle.course.units.some((u) => u.access) ||
      bundle.course.assessments.some((a) => a.method === "fixed" && a.exam))
  )
    return NextResponse.json(
      { error: "Este percurso ainda não está disponível nesta forma de curso." },
      { status: 422 },
    );
  const activity = findActivity(bundle.course, input.data.activityId);
  if (!activity) return NextResponse.json({ error: "Atividade não encontrada." }, { status: 404 });
  try {
    const permission = await authorizeLearningTarget(
      user?.id ?? null,
      bundle.course,
      bundle.language,
      { activityId: activity.id },
    );
    if (!permission.allowed)
      return NextResponse.json({ error: permission.message }, { status: 403 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível conferir seu percurso. Tente novamente." },
      { status: 503 },
    );
  }
  let result;
  try {
    const installed =
      input.data.versionSessionId && user
        ? await installedStudyRuntime().load(user.id, input.data.versionSessionId)
        : null;
    if (
      input.data.studySessionId &&
      !installed?.state?.sessions.some((session) => session.id === input.data.studySessionId)
    )
      return NextResponse.json({ error: "Sessão de estudo inválida." }, { status: 400 });
    const preference = installed
      ? installed.state?.profile.variantId
      : await userCourseVariant(
          user?.id ?? null,
          bundle.course.id,
          bundle.language,
          bundle.course,
          activity.variant,
        );
    const exposed =
      installed && user
        ? installedPublicView(
            (await installedStudyRuntime().resolveContext(user.id, input.data.versionSessionId!))
              .content,
            input.data.versionSessionId!,
            preference,
          ).course
        : publicCourse(bundle.course, bundle.language, undefined, preference);
    if (exposed.availability?.unavailableActivityIds.includes(activity.id))
      return NextResponse.json(
        {
          error: "A atividade está temporariamente indisponível. Esta resposta não foi avaliada.",
          diagnostics: exposed.capabilityReport?.diagnostics,
        },
        { status: 503 },
      );
    result = gradeActivity(activity, input.data.answer, bundle.language.normalization, {
      language: bundle.language,
      course: bundle.course,
      preference,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível resolver o contexto linguístico. Nenhuma resposta foi avaliada." },
      { status: 503 },
    );
  }
  if (!result)
    return NextResponse.json(
      { error: "Esta atividade não usa correção automática." },
      { status: 422 },
    );
  if (input.data.versionSessionId && user) {
    try {
      const evidence = await courseInstallationRuntime().recordEvidence(
        user.id,
        input.data.versionSessionId,
        {
          id: input.data.evidenceId ?? randomUUID(),
          kind: "activity",
          definitionId: activity.id,
          input: {
            answer: input.data.answer,
            ...(input.data.studySessionId ? { studySessionId: input.data.studySessionId } : {}),
          },
          result: JSON.parse(JSON.stringify(result)) as JsonValue,
        },
      );
      return NextResponse.json(
        {
          ...result,
          metadata: {
            reference: evidence.reference,
            versionSessionId: evidence.sessionId,
            evidenceId: evidence.id,
            createdAt: evidence.createdAt,
          },
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch {
      return NextResponse.json(
        { error: "Não foi possível preservar a evidência desta versão." },
        { status: 503 },
      );
    }
  }
  const eligible = bundle.course.assessments.some(
    (a) => a.method === "fixed" && a.exam?.entry.activityIds.includes(activity.id),
  );
  if (eligible) {
    if (!user)
      return NextResponse.json(
        { error: "Entre na sua conta para registrar sua prática." },
        { status: 401 },
      );
    try {
      return NextResponse.json(
        { ...result, completionReceipt: completionReceipt(bundle.course, user.id, activity.id) },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch {
      return NextResponse.json(
        { error: "Não foi possível registrar sua prática. Tente novamente." },
        { status: 503 },
      );
    }
  }
  return NextResponse.json(result);
}
