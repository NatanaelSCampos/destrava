import { NextResponse } from "next/server";
import { z } from "zod";
import { featureFlags } from "@/lib/feature-flags";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { getAIProvider } from "@/domain/ai/ai-provider";
import { findCourseBundle } from "@/content/course-registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { variantLabel } from "@/content/language-variant";
import { readCourseState } from "@/domain/study/course-state-storage";
import { buildLearningMemory } from "@/domain/study/learning-memory";
import { validatedObjectiveIds } from "@/domain/conversation/objective-evidence";

const inputSchema = z.object({
  courseId: z.string().min(1).max(80),
  mode: z.enum(["free", "mission"]),
  scenarioId: z.string().max(50).nullable(),
  topic: z.string().trim().max(80),
  pace: z.enum(["beginner", "intermediate", "natural"]),
  correction: z.enum(["instant", "important_only", "end_of_conversation", "off"]),
  history: z
    .array(
      z.object({ role: z.enum(["student", "partner"]), text: z.string().trim().min(1).max(500) }),
    )
    .max(16),
  message: z.string().trim().min(1).max(400),
});

export async function POST(request: Request) {
  if (!featureFlags.AI_TUTOR)
    return NextResponse.json({ error: "Conversas indisponíveis." }, { status: 503 });
  const guard = await guardAIRequest(request, "conversation");
  if (guard.error) return guard.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Mensagem ou configuração inválida." }, { status: 400 });
  const input = parsed.data;
  const bundle = findCourseBundle(input.courseId);
  if (!bundle) return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
  const { course, resources, language, coursePackage } = bundle;
  const scenario =
    input.mode === "mission" ? resources.conversationScenarios.find((item) => item.id === input.scenarioId) : undefined;
  if ((input.mode === "mission" && !scenario) || (input.mode === "free" && input.topic.length < 3))
    return NextResponse.json({ error: "Escolha uma missão ou um assunto." }, { status: 400 });

  try {
    const client = guard.userId ? await createSupabaseServerClient() : null;
    const { data } = client
      ? await client
          .from("user_course_state")
          .select("state")
          .eq("user_id", guard.userId)
          .eq("course_id", course.id)
          .maybeSingle()
      : { data: null };
    const state = data?.state ? readCourseState(data.state, course.id, course.languageCode) : null;
    const region = variantLabel(language, state?.profile?.variantId);
    const currentUnit = course.units.find((unit) =>
      unit.lessons.some((lesson) =>
        lesson.activities.some((activity) => !state?.completedActivityIds?.includes(activity.id)),
      ),
    );
    const result = await getAIProvider().conversationTurn({
      ...input,
      scenario,
      context: {
        course: course.title,
        language: resources.languageLabel,
        sourceLanguage: coursePackage.sourceLanguage,
        level: course.level,
        unit: currentUnit?.title ?? course.units.at(-1)?.title ?? "Curso",
        goal: state?.profile?.learningPreferences?.goal ?? "general",
        contexts: coursePackage.contexts?.filter((item) =>
          state?.profile?.learningPreferences?.contexts?.includes(item.id)).map((item) => item.label).slice(0, 3) ?? [],
        knownWords: Object.values(state?.vocabulary ?? {}).filter((item) => item.status === "known")
          .length,
        difficulty: Object.values(state?.mistakes ?? {})
          .sort((a, b) => b.timesMissed - a.timesMissed)
          .slice(0, 3)
          .map((item) => item.correctAnswer.slice(0, 100)),
        region,
        memory: state ? buildLearningMemory(state, course.id) : undefined,
        referenceVocabulary: coursePackage.lexicon.slice(0, 15).map((entry) => ({
          term: entry.surface ?? entry.lemma,
          meaning: entry.meanings[0].translations[coursePackage.sourceLanguage]?.[0] ?? "",
        })),
      },
    });
    const completedObjectiveIds = validatedObjectiveIds(
      scenario?.objectives.map((item) => item.id) ?? [],
      input.message,
      result.feedback.objectiveEvidence,
    );
    await logAIRequest("conversation", result.usage, guard.reservationId ?? null);
    return NextResponse.json({
      reply: result.feedback.reply.trim().slice(0, 800),
      correction: input.correction === "off" ? "" : result.feedback.correction.trim().slice(0, 400),
      correctionCategory:
        input.correction === "off" || !result.feedback.correction.trim()
          ? "none"
          : result.feedback.correctionCategory,
      completedObjectiveIds,
    });
  } catch {
    return NextResponse.json(
      { error: "A conversa está indisponível agora. Tente novamente." },
      { status: 503 },
    );
  }
}
