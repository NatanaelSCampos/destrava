import { NextResponse } from "next/server";
import { featureFlags } from "@/lib/feature-flags";
import { getAIProvider } from "@/domain/ai/ai-provider";
import { guardAIRequest, logAIRequest } from "@/domain/ai/ai-request-guard";
import { userCourseVariant } from "@/lib/user-course-variant";
import { buildLinguisticAIContext } from "@/domain/ai/linguistic-context";
import { interactiveTeachingSchema } from "@/domain/ai/schemas";
import {
  interactiveTeachingInputSchema, resolveTeachingMoment, teachingBoardActions, TeachingContextError,
} from "@/domain/ai/interactive-teaching-context";
import {
  resolveLessonContext, assertCompiledLessonSelected, assertLessonAvailable,
  readLessonSession, sessionScope, trustedSessionRuntime, authenticatedLessonDb,
} from "@/domain/interactive-lesson/server";
import { readBoundedLessonBody } from "@/domain/interactive-lesson/request-body";
import { LessonIntegrityError } from "@/domain/interactive-lesson/integrity";
import { presentationLanguage } from "@/engine/presentation/language";

export async function POST(request: Request) {
  if (!featureFlags.AI_TUTOR)
    return NextResponse.json({ error: "A professora está indisponível agora." }, { status: 503 });
  try {
    // Consume and bound bytes before reconstructing a request for existing guards.
    const bytes = await readBoundedLessonBody(request, 12_000);
    const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const input = interactiveTeachingInputSchema.safeParse(raw);
    if (!input.success) return NextResponse.json({ error: "Confira sua pergunta e tente novamente." }, { status: 400 });
    const data = input.data;
    const context = resolveLessonContext(data.courseId, data.lessonId);
    if (data.contentVersion !== context.bundle.coursePackage.contentVersion ||
        data.definitionHash !== context.definitionHash)
      return NextResponse.json({ error: "A aula mudou. Recarregue para continuar." }, { status: 409 });
    let moment: ReturnType<typeof resolveTeachingMoment> | undefined;
    let linguisticContext: ReturnType<typeof buildLinguisticAIContext> | undefined;
    let variantId: string | undefined;
    const boundedRequest = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(data) });
    const guard = await guardAIRequest(boundedRequest, "interactive_lesson", "json", async userId => {
      try {
      await assertCompiledLessonSelected(userId);
      assertLessonAvailable(context);
      const db = await authenticatedLessonDb();
      const row = await readLessonSession(db, userId, data.courseId, data.lessonId);
      if (!row) return NextResponse.json({ error: "Inicie e salve o momento da aula antes de perguntar." }, { status: 409 });
      const scope = sessionScope(context, userId, row.id);
      const runtime = trustedSessionRuntime(context, row, scope);
      moment = resolveTeachingMoment(data, context.definition, runtime, scope, row.revision);
      variantId = await userCourseVariant(userId, data.courseId, context.bundle.language);
      linguisticContext = buildLinguisticAIContext(context.bundle.course, context.bundle.language, context.bundle.coursePackage.sourceLanguage, variantId, moment.segment.activityRef);
      variantId = linguisticContext.variantId;
      }
      catch (error) {
        if (error instanceof TeachingContextError)
          return NextResponse.json({ error: "O momento da aula mudou. Retome a explicação e pergunte novamente." }, { status: error.status });
        if (error instanceof LessonIntegrityError)
          return NextResponse.json({ error: "Recarregue a aula para conferir o ponto atual." }, { status: error.status });
        throw error;
      }
      return null;
    });
    if (guard.error) return guard.error;
    if (!guard.userId || !moment || !variantId || !linguisticContext)
      return NextResponse.json({ error: "Entre na sua conta para continuar a aula." }, { status: 401 });
    const { bundle, definition } = context;
    const result = await getAIProvider().teachInteractiveLesson({
      language: bundle.language, sourceLanguage: bundle.coursePackage.sourceLanguage,
      level: bundle.course.level, variantId,
      linguisticContext,
      lessonTitle: definition.title, segmentTitle: moment.segment.title,
      explanation: moment.segment.explanation?.slice(0, 1000) ?? "",
      transcript: moment.transcript, teachingContext: moment.teachingContext,
      concepts: moment.segment.concepts, question: data.question,
      goal: "understand_current_lesson", mistakes: [],
    });
    const feedback = interactiveTeachingSchema.parse(result.feedback);
    await logAIRequest("interactive_lesson", result.usage, guard.reservationId ?? null);
    return NextResponse.json({
      ...feedback,
      ...(feedback.followUpRole === "source" || feedback.followUpRole === "target" ? {
        followUpSpeech: { role: feedback.followUpRole, language: feedback.followUpRole === "target"
          ? presentationLanguage(bundle.language) : bundle.coursePackage.sourceLanguage },
      } : {}),
      actions: teachingBoardActions(feedback, bundle.coursePackage.sourceLanguage, presentationLanguage(bundle.language), moment.illustration),
      context: {
        courseId: data.courseId, lessonId: data.lessonId, segmentId: moment.segment.id,
        positionMs: moment.positionMs, contentVersion: data.contentVersion,
        sessionId: data.sessionId, revision: data.revision,
        definitionHash: context.definitionHash, requestId: data.requestId,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError)
      return NextResponse.json({ error: "Não foi possível ler a pergunta." }, { status: 400 });
    if (error instanceof LessonIntegrityError)
      return NextResponse.json({ error: "Não foi possível conferir esta aula." }, { status: error.status });
    return NextResponse.json({ error: "A professora não conseguiu responder agora. Sua aula continua pausada." }, { status: 503 });
  }
}
