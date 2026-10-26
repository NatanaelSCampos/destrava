export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Process liveness only. Course and database journeys have separate functional checks. */
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}