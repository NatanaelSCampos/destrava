import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { reportAdmin } from "@/lib/support-report-server";
import { readBoundedLessonBody } from "@/domain/interactive-lesson/request-body";
export const runtime = "nodejs";
const ack = z
  .object({
    id: z.string().uuid(),
    claim: z.string().uuid(),
    issue: z
      .string()
      .regex(/^https:\/\/github\.com\/NatanaelSCampos\/destrava\/issues\/[1-9][0-9]*$/),
  })
  .strict();
export async function POST(request: Request) {
  const configured = process.env.REPORT_BRIDGE_KEY ?? "";
  const supplied = request.headers.get("x-report-bridge-key") ?? "";
  if (
    configured.length < 40 ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(configured) ||
    !timingSafeEqual(Buffer.from(configured), Buffer.from(supplied))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = reportAdmin();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(await readBoundedLessonBody(request, 1000)));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (JSON.stringify(body) === '{"action":"claim"}') {
    const result = await admin.rpc("claim_support_reports");
    return NextResponse.json(result.error ? { error: "Claim failed" } : { reports: result.data }, {
      status: result.error ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const parsed = ack.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid acknowledgement" }, { status: 400 });
  const result = await admin.rpc("ack_support_report", {
    p_id: parsed.data.id,
    p_claim: parsed.data.claim,
    p_issue: parsed.data.issue,
  });
  return NextResponse.json(
    result.error ? { error: "Acknowledgement failed" } : { acknowledged: result.data },
    { status: result.error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
