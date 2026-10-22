import { InstallationError } from "@/domain/course-installations/contracts";

export function installedRuntimeConfigured(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV !== "production" && env.DESTRAVA_LOCAL_ONLY === "1";
}
export function assertInstalledRuntimeScope(env: Record<string, string | undefined> = process.env) {
  if (
    !installedRuntimeConfigured(env) ||
    !env.DESTRAVA_LOCAL_PROJECT?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321" ||
    env.APP_ORIGIN !== "http://127.0.0.1:3000" ||
    !env.SUPABASE_SECRET_KEY
  )
    throw new InstallationError("NOT_AUTHORIZED", "resolution");
}
