import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const client = await createSupabaseServerClient();
  if (tokenHash && client) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (!error) return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.redirect(new URL("/login?authError=1", request.url));
}
