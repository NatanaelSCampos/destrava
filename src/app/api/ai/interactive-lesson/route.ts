import { NextResponse } from "next/server";
import { z } from "zod";
import { lessonActionSchema, type LessonAction } from "@/content/contracts";
import { findCourseBundle } from "@/content/course-registry";
import { featureFlags } from "@/lib/feature-flags";
import { getAIProvider } from "@/domain/ai/ai-provider";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readCourseState } from "@/domain/study/course-state-storage";
import { userCourseVariant } from "@/lib/user-course-variant";
import { buildLinguisticAIContext } from "@/domain/ai/linguistic-context";

const inputSchema = z.object({
  courseId: z.string(),
  lessonId: z.string(),
  segmentId: z.string(),
  question: z.string().trim().min(3).max(400),
  positionMs: z.number().int().nonnegative(),
});

export async function POST(request: Request) {
  if (!featureFlags.AI_TUTOR)
    return NextResponse.json({ error: "Professora indisponível." }, { status: 503 });
  const guard = await guardAIRequest(request, "interactive_lesson");
  if (guard.error) return guard.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pergunta inválida." }, { status: 400 });
  const { courseId, lessonId, segmentId, question, positionMs } = parsed.data;
  const bundle = findCourseBundle(courseId);
  const definition = bundle?.coursePackage.interactiveLessons.find(
    (item) => item.lessonId === lessonId,
  );
  const segment = definition?.segments.find((item) => item.id === segmentId);
  if (!bundle || !definition || !segment)
    return NextResponse.json({ error: "Trecho não encontrado." }, { status: 404 });
  const db = guard.userId ? await createSupabaseServerClient() : null;
  const { data } = db
    ? await db
        .from("user_course_state")
        .select("state")
        .eq("user_id", guard.userId)
        .eq("course_id", courseId)
        .maybeSingle()
    : { data: null };
  const state = data?.state ? readCourseState(data.state, courseId) : null;
  const transcript =
    segment.presentation?.transcript.find(
      (line) => positionMs >= line.startMs && positionMs < line.endMs,
    )?.text ?? "";
  try {
    const variantId = await userCourseVariant(guard.userId ?? null, courseId, bundle.language);
    const result = await getAIProvider().teachInteractiveLesson({
      language: bundle.language,
      sourceLanguage: bundle.coursePackage.sourceLanguage,
      level: bundle.course.level,
      variantId,
      linguisticContext: buildLinguisticAIContext(
        bundle.course,
        bundle.language,
        bundle.coursePackage.sourceLanguage,
        variantId,
      ),
      lessonTitle: definition.title,
      segmentTitle: segment.title,
      explanation: segment.explanation ?? "",
      transcript,
      concepts: segment.concepts,
      question,
      goal: state?.profile.learningPreferences.goal ?? "general",
      mistakes: Object.values(state?.mistakes ?? {})
        .filter((item) => item.topicId && segment.concepts.includes(item.topicId))
        .slice(0, 2)
        .map((item) => item.correctAnswer.slice(0, 100)),
    });
    const actions: LessonAction[] = [];
    if (result.feedback.example) {
      const action = lessonActionSchema.parse({
        type: "board.show",
        element: {
          kind: "example",
          id: "teacher-example",
          text: result.feedback.example,
          translation: result.feedback.translation || "Tradução não disponível",
        },
      });
      actions.push(action);
    }
    await logAIRequest("interactive_lesson", result.usage, guard.reservationId ?? null);
    return NextResponse.json({ ...result.feedback, actions });
  } catch {
    return NextResponse.json(
      { error: "A professora não conseguiu responder agora." },
      { status: 503 },
    );
  }
}
