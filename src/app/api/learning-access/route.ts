import { resolveApplicationOperation } from "@/lib/application-course-runtime";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { loadLearningAccess } from "@/lib/learning-access-server";
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const courseId = new URL(request.url).searchParams.get("courseId");
  try {
    const bundle = courseId ? await resolveApplicationOperation(courseId, user.id) : undefined;
    if (!bundle) return Response.json({ error: "Curso não encontrado." }, { status: 404 });
    if (bundle.versionSession)
      return Response.json(
        { error: "Este percurso ainda não está disponível nesta forma de curso." },
        { status: 422 },
      );
    return Response.json(await loadLearningAccess(user.id, bundle.course, bundle.language), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "Não foi possível conferir seu percurso. Tente novamente." },
      { status: 503 },
    );
  }
}
