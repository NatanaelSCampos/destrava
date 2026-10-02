import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const cookieName = "destrava_trusted_device";
const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remember"), factorId: z.uuid() }),
  z.object({ action: z.literal("resume") }),
]);

export async function POST(request: NextRequest) {
  const expectedOrigin = process.env.APP_ORIGIN
    ? new URL(process.env.APP_ORIGIN).origin
    : `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  if (request.headers.get("origin") !== expectedOrigin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Autenticação indisponível." }, { status: 503 });
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError || !userResult.user) {
    return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  }

  if (input.data.action === "resume") {
    const token = request.cookies.get(cookieName)?.value;
    if (!token) return NextResponse.json({ trusted: false });
    const { data, error } = await client.rpc("resume_trusted_device", { p_token: token });
    if (error) return NextResponse.json({ error: "Não foi possível verificar este dispositivo." }, { status: 503 });
    return NextResponse.json({ trusted: data === true });
  }

  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Confirme o código antes de confiar neste dispositivo." }, { status: 403 });
  }
  const token = randomBytes(32).toString("hex");
  const { error } = await client.rpc("register_trusted_device", {
    p_token: token,
    p_factor_id: input.data.factorId,
  });
  if (error) {
    return NextResponse.json({ error: "Não foi possível confiar neste dispositivo." }, { status: 503 });
  }
  const response = NextResponse.json({ trusted: true });
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: thirtyDaysInSeconds,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
