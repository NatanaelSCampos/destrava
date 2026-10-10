import { z } from "zod";

export const reconstructionSchema = z
  .object({
    strategy: z.literal("separator"),
    separator: z.string().max(32),
  })
  .strict();
export const textMeasureSchema = z.discriminatedUnion("strategy", [
  z.object({ strategy: z.literal("whitespace_units") }).strict(),
  z.object({ strategy: z.literal("code_points") }).strict(),
  z.object({ strategy: z.literal("graphemes") }).strict(),
  z.object({ strategy: z.literal("intl_words"), locale: z.string().min(1).max(100) }).strict(),
]);
export const textRequirementSchema = z
  .object({
    measure: textMeasureSchema,
    minimum: z.number().int().nonnegative(),
    maximum: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (value) => value.maximum === undefined || value.maximum >= value.minimum,
    "Maximum must not be below minimum",
  );
export type Reconstruction = z.infer<typeof reconstructionSchema>;
export type TextMeasure = z.infer<typeof textMeasureSchema>;
export type TextRequirement = z.infer<typeof textRequirementSchema>;
export const legacyReconstruction: Reconstruction = { strategy: "separator", separator: " " };
export const legacyMinWordsSchema = z.number().nonnegative();
