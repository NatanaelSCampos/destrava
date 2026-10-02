import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { appRedirectUrl } from "@/lib/app-redirect-url";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const client = await createSupabaseServerClient();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(appRedirectUrl(request, "/dashboard"));
  }
  return NextResponse.redirect(appRedirectUrl(request, "/login?authError=1"));
}
