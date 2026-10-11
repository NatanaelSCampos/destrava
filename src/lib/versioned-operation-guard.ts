/** Unadapted consumers must reject a pinned-session request rather than read a compiled/current course. */
export function unsupportedVersionScope(input: unknown, request?: Request): Response | null {
  const supplied =
    input instanceof FormData
      ? input.has("versionSessionId")
      : Boolean(input && typeof input === "object" && "versionSessionId" in input);
  const query = request ? new URL(request.url).searchParams.has("versionSessionId") : false;
  const header = request?.headers.has("x-destrava-version-session") ?? false;
  return supplied || query || header
    ? Response.json(
        {
          error: "VERSIONED_OPERATION_UNAVAILABLE",
          message:
            "Este recurso ainda não aceita sessões de conteúdo instalado. Nenhuma versão diferente foi executada.",
        },
        { status: 422 },
      )
    : null;
}

export type VersionPayloadParser = "json" | "form";

export async function unsupportedVersionRequest(
  request: Request,
  parser: VersionPayloadParser = "json",
): Promise<Response | null> {
  const metadata = unsupportedVersionScope(null, request);
  if (metadata) return metadata;
  // Mirror the consuming route's parser. request.json() does not require a JSON Content-Type;
  // formData() also accepts urlencoded bodies. Headers must not choose a weaker admission check.
  const clone = request.clone();
  const payload = await (parser === "form" ? clone.formData() : clone.json()).catch(() => null);
  return unsupportedVersionScope(payload);
}
