import { NextResponse } from "next/server";
import { z } from "zod";
import { findCourseBundle } from "@/content/course-registry";
import { getAuthenticatedUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { publicCourse } from "@/content/public";
import { randomUUID } from "node:crypto";
import { applicationCatalogue } from "@/lib/application-course-runtime";
import { installedRuntimeConfigured } from "@/lib/installed-runtime-scope";
import { installedStudyRuntime } from "@/lib/installed-study-runtime";
import { InstalledStudyError } from "@/domain/installed-study/contracts";

const inputSchema = z
  .object({
    courseId: z.string().min(1).max(128),
    source: z.enum(["compiled", "installed"]).optional(),
    expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    operationId: z.uuid().optional(),
  })
  .strict();
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const code = error instanceof InstalledStudyError ? error.code : "READ_FAILED";
  return NextResponse.json(
    { error: "Não foi possível selecionar o curso. Recarregue a página e tente novamente.", code },
    { status: code.endsWith("CONFLICT") ? 409 : code === "INVALID_INPUT" ? 400 : 503, headers },
  );
}
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401, headers });
  if (!installedRuntimeConfigured())
    return NextResponse.json(
      { error: "Catálogo instalado indisponível." },
      { status: 503, headers },
    );
  try {
    const available = await applicationCatalogue(user.id);
    return NextResponse.json(
      {
        selection: available.selection,
        courses: available.options,
        active: [...available.verified.values()].map((content) => ({
          reference: content.installation.reference,
          revision: available.active.find(
            (row) => row.courseId === content.installation.reference.courseId,
          )!.revision,
        })),
        diagnostics: available.diagnostics,
      },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (isSupabaseConfigured() && !user)
    return NextResponse.json({ error: "Entre na sua conta para mudar de curso." }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Seleção inválida." }, { status: 400, headers });
  try {
    let selection;
    if (user && installedRuntimeConfigured()) {
      const available = await applicationCatalogue(user.id);
      const source =
        parsed.data.source ??
        (available.active.some((row) => row.courseId === parsed.data.courseId)
          ? "installed"
          : "compiled");
      if (
        !available.options.some(
          (option) => option.id === parsed.data.courseId && option.source === source,
        )
      )
        return NextResponse.json({ error: "Curso indisponível." }, { status: 503, headers });
      if (source === "compiled") {
        const bundle = findCourseBundle(parsed.data.courseId)!;
        const report = publicCourse(bundle.course, bundle.language).capabilityReport;
        if (
          report?.diagnostics.some(
            (item) =>
              item.severity === "error" &&
              (item.location.startsWith("course.capabilityRequirements") ||
                item.location.startsWith("language.capabilityRequirements")),
          )
        )
          return NextResponse.json(
            {
              error: "Uma capacidade obrigatória está indisponível.",
              diagnostics: report.diagnostics,
            },
            { status: 503, headers },
          );
      }
      selection = await installedStudyRuntime().select(user.id, {
        courseId: parsed.data.courseId,
        source,
        expectedRevision: parsed.data.expectedRevision ?? available.selection.revision,
        operationId: parsed.data.operationId ?? randomUUID(),
      });
    } else {
      if (parsed.data.source === "installed")
        return NextResponse.json(
          { error: "Runtime instalado indisponível." },
          { status: 503, headers },
        );
      const bundle = findCourseBundle(parsed.data.courseId);
      if (!bundle)
        return NextResponse.json({ error: "Curso não encontrado." }, { status: 404, headers });
      const report = publicCourse(bundle.course, bundle.language).capabilityReport;
      if (
        report?.diagnostics.some(
          (item) =>
            item.severity === "error" &&
            (item.location.startsWith("course.capabilityRequirements") ||
              item.location.startsWith("language.capabilityRequirements")),
        )
      )
        return NextResponse.json(
          {
            error: "Uma capacidade obrigatória está indisponível.",
            diagnostics: report.diagnostics,
          },
          { status: 503, headers },
        );
    }
    const response = NextResponse.json({ courseId: parsed.data.courseId, selection }, { headers });
    response.cookies.set("destrava-active-course", parsed.data.courseId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    return failure(error);
  }
}
