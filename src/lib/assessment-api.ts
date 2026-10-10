import {
  assessmentRequestSchema,
  serverAssessmentResultSchema,
  type AssessmentRequest,
  type ServerAssessmentResult,
} from "@/content/assessment-results";
import type { Course } from "@/content/schema";
import type { LanguagePackage } from "@/content/contracts";
import { publicCourse } from "@/content/public";
import type { CapabilityEnvironment } from "@/engine/capabilities/compatibility";
import { requireLearningVariant } from "@/engine/variants/resolution";
import {
  evaluateAssessment,
  AssessmentExecutionError,
  assessmentSummary,
} from "@/domain/assessments/assessment-engine";

export type StoredAssessmentRow = {
  id: string;
  assessment_id: string;
  started_at: string;
  finished_at: string;
  objective_score: number | null;
  result: {
    courseId?: string;
    contentVersion?: string;
    input?: unknown;
    unitId?: string;
    variantId?: string;
  };
};
type AssessmentApiDependencies = {
  resolveCourse: (id: string) => { course: Course; language: LanguagePackage } | undefined;
  authenticatedUser: () => Promise<{ id: string } | null>;
  requiresAuth: () => boolean;
  save: (
    userId: string,
    input: AssessmentRequest,
    result: ServerAssessmentResult,
  ) => Promise<string>;
  read: (userId: string, assessmentIds: string[]) => Promise<StoredAssessmentRow[]>;
  now?: () => Date;
  environment?: CapabilityEnvironment;
  variantPreference?: (userId: string | null, courseId: string) => Promise<unknown>;
};

export function createAssessmentApi(dependencies: AssessmentApiDependencies) {
  const timestamp = (value: string) =>
    serverAssessmentResultSchema.shape.finishedAt.parse(new Date(value).toISOString());
  const createResult = (
    input: AssessmentRequest,
    bundle: { course: Course; language: LanguagePackage },
    finishedAt: string,
    variantId?: string,
  ) => {
    const grade = evaluateAssessment(
      bundle.course,
      input.assessmentId,
      input.responses,
      bundle.language.normalization,
      { language: bundle.language, course: bundle.course, preference: variantId },
    );
    return serverAssessmentResultSchema.parse({
      id: input.attemptId,
      courseId: bundle.course.id,
      assessmentId: grade.definition.id,
      ...assessmentSummary(grade.definition),
      contentVersion: bundle.course.contentVersion,
      ...(variantId ? { variantId } : {}),
      source: "server",
      startedAt: input.startedAt,
      finishedAt: timestamp(finishedAt),
      status: grade.status,
      objectiveScore: grade.objectiveScore,
      passed: grade.passed,
      answers: grade.answers,
      responseKey: grade.responseKey,
    });
  };
  return {
    async POST(request: Request) {
      const user = await dependencies.authenticatedUser();
      if (dependencies.requiresAuth() && !user)
        return Response.json(
          { error: "Entre na sua conta para executar a avaliação." },
          { status: 401 },
        );
      const input = assessmentRequestSchema.safeParse(await request.json().catch(() => null));
      if (!input.success)
        return Response.json(
          { error: "Envie somente a identificação e as respostas da avaliação." },
          { status: 400 },
        );
      const bundle = dependencies.resolveCourse(input.data.courseId);
      if (!bundle || !bundle.course.assessments.some((item) => item.id === input.data.assessmentId))
        return Response.json({ error: "Avaliação não encontrada neste curso." }, { status: 404 });
      try {
        const preference = await dependencies.variantPreference?.(
          user?.id ?? null,
          bundle.course.id,
        );
        const variantId = requireLearningVariant(
          bundle.language,
          bundle.course,
          preference,
        ).variantId!;
        const available = publicCourse(
          bundle.course,
          bundle.language,
          dependencies.environment,
          variantId,
        );
        if (available.availability?.unavailableAssessmentIds?.includes(input.data.assessmentId))
          return Response.json(
            {
              error:
                "Uma capacidade necessária à avaliação está indisponível. Nenhuma nota foi registrada.",
              diagnostics: available.capabilityReport?.diagnostics,
            },
            { status: 503 },
          );
        const result = createResult(
          input.data,
          bundle,
          (dependencies.now?.() ?? new Date()).toISOString(),
          variantId,
        );
        if (user) {
          const finishedAt = await dependencies.save(user.id, input.data, result);
          result.finishedAt = timestamp(finishedAt);
        }
        return Response.json(result);
      } catch (error) {
        return Response.json(
          {
            error:
              error instanceof AssessmentExecutionError
                ? error.message
                : "Não foi possível registrar a avaliação. Verifique se seu conteúdo foi instalado no banco.",
          },
          { status: error instanceof AssessmentExecutionError ? error.status : 503 },
        );
      }
    },
    async GET(request: Request) {
      const user = await dependencies.authenticatedUser();
      if (dependencies.requiresAuth() && !user)
        return Response.json(
          { error: "Entre na sua conta para consultar avaliações." },
          { status: 401 },
        );
      const courseId = new URL(request.url).searchParams.get("courseId");
      const bundle = courseId ? dependencies.resolveCourse(courseId) : undefined;
      if (!bundle) return Response.json({ error: "Curso não encontrado." }, { status: 404 });
      if (!user || !bundle.course.assessments.length) return Response.json({ results: [] });
      try {
        const rows = await dependencies.read(
          user.id,
          bundle.course.assessments.map((item) => item.id),
        );
        const results: ServerAssessmentResult[] = [];
        for (const row of rows) {
          // Old/versioned results remain in history; never regrade them as current results.
          if (row.result?.contentVersion !== bundle.course.contentVersion) continue;
          const input = assessmentRequestSchema.safeParse(row.result.input);
          if (
            !input.success ||
            input.data.courseId !== bundle.course.id ||
            input.data.assessmentId !== row.assessment_id ||
            input.data.attemptId !== row.id
          )
            continue;
          try {
            // Never use today's preference to replay historical evidence.
            if (
              row.result.variantId &&
              requireLearningVariant(bundle.language, bundle.course, row.result.variantId)
                .diagnostics.length
            )
              continue;
            if (
              !row.result.variantId &&
              bundle.course.units.some((unit) =>
                unit.lessons.some((lesson) =>
                  lesson.activities.some((a) => a.variant || a.answerPolicy),
                ),
              )
            )
              continue;
            results.push(createResult(input.data, bundle, row.finished_at, row.result.variantId));
          } catch {
            /* An unreadable/tampered attempt is not an official result. */
          }
        }
        return Response.json({ results });
      } catch {
        return Response.json(
          { error: "Não foi possível consultar seus resultados." },
          { status: 503 },
        );
      }
    },
  };
}
