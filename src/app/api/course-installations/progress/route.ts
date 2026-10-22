import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { installedStudyRuntime } from "@/lib/installed-study-runtime";
import { InstalledStudyError } from "@/domain/installed-study/contracts";
import { InstallationError } from "@/domain/course-installations/contracts";
import type { StudyState } from "@/domain/study/study-state";

const input = z
  .object({
    versionSessionId: z.uuid(),
    expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    operationId: z.uuid(),
    state: z.record(z.string(), z.unknown()),
  })
  .strict();
function failure(error: unknown) {
  const code =
    error instanceof InstalledStudyError || error instanceof InstallationError
      ? error.code
      : "READ_FAILED";
  return Response.json(
    {
      code,
      error: "Não foi possível sincronizar o progresso desta versão.",
      ...(error instanceof InstalledStudyError ? { diagnostics: error.diagnostics } : {}),
    },
    {
      status:
        code === "PROGRESS_CONFLICT" || code === "OPERATION_CONFLICT"
          ? 409
          : code === "SESSION_NOT_FOUND"
            ? 404
            : code === "INVALID_INPUT"
              ? 400
              : code === "NOT_AUTHORIZED" || code === "SESSION_CONFLICT"
                ? 403
                : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const sessionId = z.uuid().safeParse(new URL(request.url).searchParams.get("versionSessionId"));
  if (!sessionId.success) return Response.json({ code: "INVALID_INPUT" }, { status: 400 });
  try {
    return Response.json(await installedStudyRuntime().load(user.id, sessionId.data), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: "INVALID_INPUT" }, { status: 400 });
  try {
    return Response.json(
      await installedStudyRuntime().save(user.id, {
        ...parsed.data,
        state: parsed.data.state as StudyState,
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
