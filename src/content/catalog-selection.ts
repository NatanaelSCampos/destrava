import { z } from "zod";
export const publishedCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    defaultCourseId: z.string().min(1),
    courseIds: z
      .array(z.string().min(1))
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate published course"),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (!c.courseIds.includes(c.defaultCourseId))
      ctx.addIssue({
        code: "custom",
        path: ["defaultCourseId"],
        message: "Default must be published",
      });
  });
export function selectPublishedCourses<T extends { course: { id: string } }>(
  bundles: T[],
  input: unknown,
) {
  const catalog = publishedCatalogSchema.parse(input);
  const byId = new Map(bundles.map((b) => [b.course.id, b]));
  const selected = catalog.courseIds.map((id) => {
    const bundle = byId.get(id);
    if (!bundle) throw new Error("Published course missing: " + id);
    return bundle;
  });
  return { bundles: selected, defaultCourseId: catalog.defaultCourseId };
}
