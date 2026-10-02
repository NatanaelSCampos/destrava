import type { SupabaseClient } from "@supabase/supabase-js";

export async function canAccessWithMfa(client: SupabaseClient) {
  const { data: allowed, error: accessError } = await client.rpc("mfa_access_allowed");
  if (accessError) return { allowed: false, error: true };
  if (allowed === true) return { allowed: true, error: false };

  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || !assurance) return { allowed: false, error: true };
  if (assurance.nextLevel !== "aal2") return { allowed: false, error: true };

  try {
    const response = await fetch("/api/auth/trusted-device", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    });
    if (!response.ok) return { allowed: false, error: response.status >= 500 };
    const result = (await response.json()) as { trusted?: boolean };
    return { allowed: result.trusted === true, error: false };
  } catch {
    return { allowed: false, error: true };
  }
}
