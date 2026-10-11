import { NextResponse } from "next/server";
import { z } from "zod";
import { courseInstallationRuntime, resolveRuntimeCourse } from "@/lib/course-installation-runtime";
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
    bundle = await resolveRuntimeCourse(input.data.courseId, user?.id, input.data.versionSessionId);
  } catch (error) {
    return NextResponse.json(
      { error: "Não foi possível resolver a versão da sessão." },
      {
        status:
          error instanceof InstallationError && error.code === "SESSION_NOT_FOUND" ? 404 : 503,
      },
    );
  }
  if (!bundle) return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
  const activity = findActivity(bundle.course, input.data.activityId);
  if (!activity) return NextResponse.json({ error: "Atividade não encontrada." }, { status: 404 });
  let result;
  try {
    const preference = await userCourseVariant(
      user?.id ?? null,
      bundle.course.id,
      bundle.language,
      bundle.course,
      activity.variant,
    );
    const exposed = publicCourse(bundle.course, bundle.language, undefined, preference);
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
      await courseInstallationRuntime().recordEvidence(user.id, input.data.versionSessionId, {
        id: input.data.evidenceId ?? randomUUID(),
        kind: "activity",
        definitionId: activity.id,
        input: { answer: input.data.answer },
        result: JSON.parse(JSON.stringify(result)) as JsonValue,
      });
    } catch {
      return NextResponse.json(
        { error: "Não foi possível preservar a evidência desta versão." },
        { status: 503 },
      );
    }
  }
  return NextResponse.json(result);
}
