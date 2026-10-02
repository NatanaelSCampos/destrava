import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { appRedirectUrl } from "@/lib/app-redirect-url";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const client = await createSupabaseServerClient();
  if (tokenHash && client) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (!error) return NextResponse.redirect(appRedirectUrl(request, "/dashboard"));
  }
  return NextResponse.redirect(appRedirectUrl(request, "/login?authError=1"));
}
