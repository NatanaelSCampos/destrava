import { NextResponse } from "next/server";
import { z } from "zod";
import { frecuenciasA1 } from "@/content/frecuencias-a1";
import { findActivity } from "@/content/schema";
import { gradeActivity } from "@/domain/activities/grader";
import { getAuthenticatedUser, isSupabaseConfigured } from "@/lib/supabase/server";

const requestSchema = z.object({ activityId: z.string().min(1), answer: z.string().max(1000) });

export async function POST(request: Request) {
  if (isSupabaseConfigured() && !(await getAuthenticatedUser())) {
    return NextResponse.json({ error: "Entre na sua conta para responder." }, { status: 401 });
  }
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Resposta inválida." }, { status: 400 });
  const activity = findActivity(frecuenciasA1, input.data.activityId);
  if (!activity) return NextResponse.json({ error: "Atividade não encontrada." }, { status: 404 });
  const result = gradeActivity(activity, input.data.answer);
  if (!result)
    return NextResponse.json(
      { error: "Esta atividade não usa correção automática." },
      { status: 422 },
    );
  return NextResponse.json(result);
}
