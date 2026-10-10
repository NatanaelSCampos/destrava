import { NextResponse } from "next/server";
import { z } from "zod";
import { findCourseBundle } from "@/content/course-registry";
import { getAuthenticatedUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { publicCourse } from "@/content/public";

const inputSchema = z.object({ courseId: z.string().min(1).max(100) });

export async function POST(request: Request) {
  if (isSupabaseConfigured() && !(await getAuthenticatedUser()))
    return NextResponse.json({ error: "Entre na sua conta para mudar de curso." }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !findCourseBundle(parsed.data.courseId))
    return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
  const bundle = findCourseBundle(parsed.data.courseId)!;
  const report = publicCourse(bundle.course, bundle.language).capabilityReport;
  if (report?.diagnostics.some((item) => item.severity === "error" && (item.location.startsWith("course.capabilityRequirements") || item.location.startsWith("language.capabilityRequirements"))))
    return NextResponse.json({ error: "Não é possível ativar este curso: uma capacidade obrigatória está indisponível.", diagnostics: report.diagnostics }, { status: 503 });
  const response = NextResponse.json({ courseId: parsed.data.courseId });
  response.cookies.set("destrava-active-course", parsed.data.courseId, {
    path: "/", sameSite: "lax", httpOnly: true,
    secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
