import { z } from "zod";
import { packagePathSchema } from "@/content/package-contract";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { courseInstallationRuntime } from "@/lib/course-installation-runtime";
import { InstallationError } from "@/domain/course-installations/contracts";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const sessionId = z.uuid().safeParse(query.get("sessionId"));
  const path = packagePathSchema.safeParse(query.get("path"));
  if (!sessionId.success || !path.success)
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const resolved = await courseInstallationRuntime().resolveSession(user.id, sessionId.data);
    const asset = resolved.content.prepared.manifest.assets.find((item) => item.path === path.data);
    const bytes = resolved.content.prepared.assets.get(path.data);
    if (!asset || !bytes) return Response.json({ error: "RESOURCE_NOT_FOUND" }, { status: 404 });
    return new Response(bytes.slice().buffer as ArrayBuffer, {
      headers: {
        "Content-Type": asset.mediaType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "RESOURCE_UNAVAILABLE" },
      {
        status:
          error instanceof InstallationError && error.code === "SESSION_NOT_FOUND" ? 404 : 503,
      },
    );
  }
}
