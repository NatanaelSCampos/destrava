import type { NextRequest } from "next/server";

export function appRedirectUrl(request: NextRequest, path: string) {
  const configuredOrigin = process.env.APP_ORIGIN?.trim();
  const origin = configuredOrigin ? new URL(configuredOrigin).origin : request.nextUrl.origin;
  return new URL(path, origin);
}
