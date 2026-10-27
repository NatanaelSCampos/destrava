import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAuthenticatedUser, createSupabaseServerClient } from "@/lib/supabase/server";
import { reportAdmin } from "@/lib/support-report-server";
import {
  reportInput,
  reportLimit,
  sanitizeReportText,
  sanitizeReportContext,
  validateReportImages,
} from "@/lib/support-report";
import { readBoundedLessonBody } from "@/domain/interactive-lesson/request-body";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (
    !process.env.APP_ORIGIN ||
    request.headers.get("origin") !== new URL(process.env.APP_ORIGIN).origin
  )
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const user = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json(
      { error: "Entre na sua conta para enviar. Você também pode baixar o reporte." },
      { status: 401 },
    );
  const admin = reportAdmin();
  if (!admin)
    return NextResponse.json(
      { error: "Envio indisponível. Baixe o reporte para guardar." },
      { status: 503 },
    );
  let data;
  try {
    data = reportInput.parse(
      JSON.parse(new TextDecoder().decode(await readBoundedLessonBody(request, reportLimit))),
    );
    validateReportImages(data.images);
  } catch {
    return NextResponse.json(
      { error: "Revise os campos e as imagens do reporte." },
      { status: 400 },
    );
  }
  const payload = {
    ...data,
    context: sanitizeReportContext(data.context),
    images: data.images.map((image, index) => ({ ...image, name: "Imagem " + (index + 1) })),
    title: sanitizeReportText(data.title),
    description: sanitizeReportText(data.description),
  };
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const result = await admin.rpc("submit_support_report", {
    p_id: data.id,
    p_owner: user.id,
    p_payload: payload,
    p_hash: hash,
    p_release: process.env.FLY_IMAGE_REF ?? "local",
  });
  if (result.error) {
    const code = result.error.message.includes("REPORT_CONFLICT")
      ? 409
      : result.error.message.includes("REPORT_LIMIT")
        ? 429
        : 503;
    return NextResponse.json(
      {
        error:
          code === 409
            ? "Este envio já existe com outro conteúdo. Abra um novo reporte."
            : code === 429
              ? "Limite de reportes atingido. Baixe sua cópia e tente mais tarde."
              : "Não foi possível guardar agora. Baixe sua cópia e tente novamente.",
      },
      { status: code },
    );
  }
  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9-]{36}$/i.test(id))
    return NextResponse.json({ error: "Reporte inválido." }, { status: 400 });
  const client = await createSupabaseServerClient();
  const result = await client!
    .from("support_reports")
    .select("id,status,issue_url,created_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (result.error || !result.data)
    return NextResponse.json({ error: "Reporte não encontrado." }, { status: 404 });
  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
