import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { courseInstallationRuntime } from "@/lib/course-installation-runtime";
import { installedStudyRuntime } from "@/lib/installed-study-runtime";
import { publicCourse } from "@/content/public";
import { readCourseState } from "@/domain/study/course-state-storage";
import { evaluateUnitPolicies } from "@/domain/study/learning-policy-engine";
import { InstallationError, type JsonValue } from "@/domain/course-installations/contracts";

export const runtime = "nodejs";
const input = z
  .object({
    versionSessionId: z.uuid(),
    unitId: z.string().min(1),
    evidenceId: z.uuid().optional(),
  })
  .strict();
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const service = courseInstallationRuntime();
    const { session, content } = await service.resolveSession(
      user.id,
      parsed.data.versionSessionId,
    );
    const course = publicCourse(content.prepared.bundle.course, content.prepared.bundle.language);
    const unit = course.units.find((item) => item.id === parsed.data.unitId);
    if (!unit) return Response.json({ error: "DEFINITION_NOT_FOUND" }, { status: 404 });
    const projection = await installedStudyRuntime().loadProjection(user.id, session.id);
    const state =
      projection.progress.state ?? readCourseState(null, course.id, course.languageCode);
    const evidence = projection.evidence;
    const result = evaluateUnitPolicies(unit, state, course);
    await service.recordEvidence(user.id, session.id, {
      id: parsed.data.evidenceId ?? randomUUID(),
      kind: "learning_policy",
      definitionId: unit.id,
      input: {
        evidenceIds: evidence
          .filter((item) => item.kind !== "learning_policy")
          .map((item) => item.id),
      },
      result: JSON.parse(JSON.stringify(result)) as JsonValue,
    });
    return Response.json({ reference: session.reference, versionSessionId: session.id, result });
  } catch (error) {
    return Response.json(
      { error: "POLICY_EVIDENCE_UNAVAILABLE" },
      {
        status:
          error instanceof InstallationError && error.code === "SESSION_NOT_FOUND" ? 404 : 503,
      },
    );
  }
}
