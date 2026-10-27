import { z } from "zod";
export const reportLimit = 2_400_000;
export function sanitizeReportText(value: string) {
  return value
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,
      "[credencial removida]",
    )
    .replace(/(authorization|api[_-]?key|password|senha|token)\s*[:=][^\r\n]*/gi, "$1: [removido]");
}
export const reportInput = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(4).max(140),
    description: z.string().trim().min(4).max(5000),
    consent: z.literal(true),
    context: z
      .object({
        path: z
          .string()
          .max(500)
          .regex(/^\/(?!\/)[^?#]*$/),
        courseId: z.string().max(120).nullable(),
        contentVersion: z.string().max(100).nullable(),
        activityId: z
          .string()
          .max(160)
          .regex(/^[A-Za-z0-9][A-Za-z0-9:_-]*$/)
          .nullable()
          .optional(),
        part: z
          .object({
            index: z.number().int().min(1).max(1000),
            count: z.number().int().min(1).max(1000),
          })
          .strict()
          .refine((p) => p.index <= p.count)
          .nullable()
          .optional(),
        viewport: z
          .object({
            width: z.number().int().min(1).max(10000),
            height: z.number().int().min(1).max(10000),
          })
          .strict(),
        occurredAt: z.string().datetime(),
      })
      .strict(),
    images: z
      .array(z.object({ name: z.string().max(80), data: z.string().max(850000) }).strict())
      .max(3),
  })
  .strict();
export function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.length < 4 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes.at(-2) !== 255 ||
    bytes.at(-1) !== 217
  )
    return null;
  let offset = 2;
  let dimensions: { width: number; height: number } | null = null;
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 255) return null;
    const marker = bytes[offset++];
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length - 2) return null;
    if ([192, 193, 194].includes(marker)) {
      if (length < 11 || bytes[offset + 2] !== 8) return null;
      const components = bytes[offset + 7];
      if (![1, 3, 4].includes(components) || length !== 8 + components * 3) return null;
      dimensions = {
        height: bytes[offset + 3] * 256 + bytes[offset + 4],
        width: bytes[offset + 5] * 256 + bytes[offset + 6],
      };
      if (!dimensions.width || !dimensions.height) return null;
    }
    if (marker === 218)
      return dimensions && length >= 6 && offset + length < bytes.length - 2 ? dimensions : null;
    if (marker === 217) return null;
    offset += length;
  }
  return null;
}
export function validateReportImages(images: z.infer<typeof reportInput>["images"]) {
  let total = 0;
  for (const image of images) {
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image.data))
      throw new Error("INVALID_IMAGE");
    const bytes = Buffer.from(image.data.slice(23), "base64");
    const size = jpegDimensions(bytes);
    if (
      !size ||
      size.width > 1600 ||
      size.height > 2200 ||
      size.width * size.height > 3_000_000 ||
      bytes.length > 600_000
    )
      throw new Error("INVALID_IMAGE");
    total += bytes.length;
  }
  if (total > 1_700_000) throw new Error("IMAGES_TOO_LARGE");
}

export function sanitizeReportContext(context: {
  path: string;
  activityId?: string | null;
  part?: { index: number; count: number } | null;
  courseId: string | null;
  contentVersion: string | null;
  viewport: { width: number; height: number };
  occurredAt: string;
}) {
  let path = context.path;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* Keep malformed paths as text only. */
  }
  return {
    ...context,
    path: sanitizeReportText(path),
    ...(context.activityId !== undefined
      ? { activityId: context.activityId === null ? null : sanitizeReportText(context.activityId) }
      : {}),
    courseId: context.courseId === null ? null : sanitizeReportText(context.courseId),
    contentVersion:
      context.contentVersion === null ? null : sanitizeReportText(context.contentVersion),
  };
}
