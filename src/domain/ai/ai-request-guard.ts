import { hasDuplicateLearningScope } from "@/domain/study/learning-access";
import { findCourseBundle } from "@/content/course-registry";
import { authorizeLearningTarget } from "@/lib/learning-access-server";
import { serverServiceAvailability } from "@/lib/capability-environment";
import { projectActionAvailability } from "@/engine/capabilities/availability-projection";
import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { AIUsage } from "./ai-provider";
import {
  unsupportedVersionRequest,
  type VersionPayloadParser,
} from "@/lib/versioned-operation-guard";

/** Known missing configuration is rejected before quota; configured is not a health check. */
function unavailableService(feature: string) {
  const capabilities: Record<string, string> = {
    tutor: "ai.tutor",
    writing: "ai.writing_feedback",
    conversation: "ai.conversation",
    micro_lesson: "ai.micro_lesson",
    image_description: "ai.image_description",
    interactive_lesson: "ai.interactive_support",
    pronunciation: "speech.pronunciation",
    conversation_transcription: "speech.recognition",
  };
  const capability = capabilities[feature];
  if (!capability) return;
  const state = projectActionAvailability({ dependencies: serverServiceAvailability() })[
    capability
  ];
  if (!state || state.state === "unavailable")
    return {
      error: NextResponse.json(
        { error: state?.reasons.join(" ") ?? "Leitura de disponibilidade indisponível." },
        { status: 503 },
      ),
    };
}

const windows = new Map<string, { count: number; resetAt: number }>();

export async function guardAIRequest(
  request: Request,
  feature: string,
  parser: VersionPayloadParser = "json",
  preflight?: (userId: string) => Promise<NextResponse | null>,
) {
  if (isSupabaseConfigured()) {
    const user = await getAuthenticatedUser();
    if (!user)
      return {
        error: NextResponse.json(
          { error: "Entre na sua conta para usar o professor IA." },
          { status: 401 },
        ),
      };
    const versionScope = await unsupportedVersionRequest(request, parser);
    if (versionScope) return { error: versionScope };
    if (process.env.DESTRAVA_LOCAL_ONLY === "1" && process.env.NODE_ENV !== "production") {
      try {
        const { isSelectedInstalled } = await import("@/lib/application-course-runtime");
        if (await isSelectedInstalled(user.id))
          return {
            error: NextResponse.json(
              {
                error: "Este recurso ainda não está integrado a cursos instalados.",
                capability: feature,
                layer: "installed.integration",
              },
              { status: 422 },
            ),
          };
      } catch {
        return {
          error: NextResponse.json(
            { error: "Não foi possível verificar o contexto de estudo." },
            { status: 503 },
          ),
        };
      }
    }
    // Check curricular access before reserving quota or sending content to any provider.
    const payload = await (
      parser === "form" ? request.clone().formData() : request.clone().json()
    ).catch(() => null);
    if (payload instanceof FormData && hasDuplicateLearningScope(payload))
      return {
        error: NextResponse.json(
          { error: "Envie uma única identificação para esta atividade." },
          { status: 400 },
        ),
      };
    const fields = payload instanceof FormData ? Object.fromEntries(payload.entries()) : payload;
    if (fields && typeof fields.courseId === "string") {
      const bundle = findCourseBundle(fields.courseId);
      if (bundle) {
        try {
          const decision = await authorizeLearningTarget(user.id, bundle.course, bundle.language, {
            ...(typeof fields.activityId === "string" ? { activityId: fields.activityId } : {}),
            ...(typeof fields.lessonId === "string" ? { lessonId: fields.lessonId } : {}),
            ...(typeof fields.unitId === "string" ? { unitId: fields.unitId } : {}),
            ...(typeof fields.assessmentId === "string"
              ? { assessmentId: fields.assessmentId }
              : {}),
          });
          if (!decision.allowed)
            return { error: NextResponse.json({ error: decision.message }, { status: 403 }) };
        } catch {
          return {
            error: NextResponse.json(
              { error: "Não foi possível conferir seu percurso." },
              { status: 503 },
            ),
          };
        }
      }
    }
    // Feature-specific session checks run after authentication/access, before quota.
    if (preflight) {
      try { const rejection = await preflight(user.id); if (rejection) return { error: rejection }; }
      catch { return { error: NextResponse.json({ error: "Não foi possível conferir o momento da aula." }, { status: 503 }) }; }
    }
    const missingService = unavailableService(feature);
    if (missingService) return missingService;
    const client = await createSupabaseServerClient();
    if (!client)
      return {
        error: NextResponse.json({ error: "Limite de IA indisponível." }, { status: 503 }),
      };
    const { data: reservationId, error } = await client.rpc("reserve_ai_request", {
      p_feature: feature,
    });
    if (error)
      return {
        error: NextResponse.json(
          { error: "Não foi possível verificar o limite de IA. Tente novamente." },
          { status: 503 },
        ),
      };
    if (!reservationId)
      return {
        error: NextResponse.json(
          { error: "Limite de IA por hora atingido. Tente mais tarde." },
          { status: 429 },
        ),
      };
    return { userId: user.id, reservationId: reservationId as string };
  }
  if (process.env.NODE_ENV !== "development")
    return {
      error: NextResponse.json(
        { error: "Configure a autenticação antes de publicar a IA." },
        { status: 503 },
      ),
    };
  const versionScope = await unsupportedVersionRequest(request, parser);
  if (versionScope) return { error: versionScope };
  const missingService = unavailableService(feature);
  if (missingService) return missingService;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const current = windows.get(ip);
  const now = Date.now();
  const next =
    !current || current.resetAt < now
      ? { count: 1, resetAt: now + 60 * 60 * 1000 }
      : { ...current, count: current.count + 1 };
  windows.set(ip, next);
  if (next.count > 20)
    return {
      error: NextResponse.json(
        { error: "Limite temporário de IA atingido. Tente mais tarde." },
        { status: 429 },
      ),
    };
  return { userId: null, reservationId: null };
}

export async function logAIRequest(feature: string, usage: AIUsage, reservationId: string | null) {
  if (reservationId) {
    const client = await createSupabaseServerClient();
    if (!client) throw new Error("Supabase indisponível ao registrar uso de IA");
    const { error } = await client.rpc("complete_ai_request", {
      p_request_id: reservationId,
      p_model: usage.model,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
      p_estimated_cost_usd: usage.estimatedCostUsd,
    });
    if (error) throw error;
  } else {
    console.info("ai_request", {
      feature,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: usage.estimatedCostUsd,
    });
  }
}
