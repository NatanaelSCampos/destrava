import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { courseInstallationRuntime, publicVersionSession } from "@/lib/course-installation-runtime";
import { InstallationError } from "@/domain/course-installations/contracts";

export const runtime = "nodejs";
const input = z
  .object({ courseId: z.string().min(1).max(128), sessionId: z.uuid().optional() })
  .strict();
function failure(error: unknown) {
  const code = error instanceof InstallationError ? error.code : "CATALOG_FAILED";
  return Response.json(
    { error: code },
    {
      status:
        code === "SESSION_NOT_FOUND"
          ? 404
          : code === "SESSION_CONFLICT"
            ? 409
            : code === "INVALID_INPUT"
              ? 400
              : code === "NOT_AUTHORIZED"
                ? 403
                : 503,
    },
  );
}
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const service = courseInstallationRuntime();
    const session = await service.createSession(
      user.id,
      parsed.data.courseId,
      parsed.data.sessionId,
    );
    return Response.json(publicVersionSession(await service.resolveSession(user.id, session.id)), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!z.uuid().safeParse(sessionId).success)
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    return Response.json(
      publicVersionSession(await courseInstallationRuntime().resolveSession(user.id, sessionId!)),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
