import { NextResponse } from "next/server";
import { z } from "zod";
import { findCourseBundle } from "@/content/course-registry";
import { findActivity } from "@/content/schema";
import { gradeActivity } from "@/domain/activities/grader";
import { getAuthenticatedUser, isSupabaseConfigured } from "@/lib/supabase/server";

const requestSchema = z.object({ courseId: z.string().min(1), activityId: z.string().min(1), answer: z.string().max(1000) });

export async function POST(request: Request) {
  if (isSupabaseConfigured() && !(await getAuthenticatedUser())) {
    return NextResponse.json({ error: "Entre na sua conta para responder." }, { status: 401 });
  }
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Resposta inválida." }, { status: 400 });
  const bundle = findCourseBundle(input.data.courseId);
  if (!bundle) return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
  const activity = findActivity(bundle.course, input.data.activityId);
  if (!activity) return NextResponse.json({ error: "Atividade não encontrada." }, { status: 404 });
  const result = gradeActivity(activity, input.data.answer, bundle.language.normalization);
  if (!result)
    return NextResponse.json(
      { error: "Esta atividade não usa correção automática." },
      { status: 422 },
    );
  return NextResponse.json(result);
}
