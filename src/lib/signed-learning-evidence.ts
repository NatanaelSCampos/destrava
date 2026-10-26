import { z } from "zod";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
/** Only signatures leave the server; a dedicated purpose separates them from credentials. */
export function stableEvidence(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableEvidence).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + stableEvidence(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export function evidenceHash(value: unknown) {
  return createHash("sha256").update(stableEvidence(value)).digest("hex");
}
export function signLearningEvidence(value: unknown, key: string): string {
  if (!key) throw new Error("Learning evidence authority unavailable");
  const data = Buffer.from(stableEvidence(value)).toString("base64url");
  return (
    data +
    "." +
    createHmac("sha256", key)
      .update("destrava.learning-evidence.v1." + data)
      .digest("base64url")
  );
}
export function verifyLearningEvidence(token: unknown, value: unknown, key: string): boolean {
  if (!key || typeof token !== "string" || token.length > 16384) return false;
  const expected = signLearningEvidence(value, key);
  const a = Buffer.from(token),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const learningTimestampSchema = z.iso.datetime({ offset: true });
/** PostgreSQL may return +00:00 and six fractional digits for a millisecond ISO instant. */
export function canonicalLearningTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/.exec(
    value,
  );
  if (
    !match ||
    /[1-9]/.test((match[1] ?? "").slice(3)) ||
    !learningTimestampSchema.safeParse(value).success
  )
    return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}
