import { assertInstalledLocalProfile } from "@/lib/installed-local-profile";

export function installedRuntimeConfigured(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV !== "production" && env.DESTRAVA_LOCAL_ONLY === "1";
}
export function assertInstalledRuntimeScope(env: Record<string, string | undefined> = process.env) {
  assertInstalledLocalProfile(env);
}
