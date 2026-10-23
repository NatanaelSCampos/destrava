import { LessonIntegrityError } from "./integrity";
/** Bound streamed bytes as well as declared length before JSON/multipart decoding. */
export async function readBoundedLessonBody(request: Request, maximum: number) {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maximum)
    throw new LessonIntegrityError("LESSON_BODY_TOO_LARGE", 413);
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximum) {
        await reader.cancel().catch(() => undefined);
        throw new LessonIntegrityError("LESSON_BODY_TOO_LARGE", 413);
      }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
