import { z } from "zod";

const variantId = z.string().trim().min(1);
export const variantIdsSchema = z
  .array(variantId)
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate variant");
/** Public pedagogical constraints; never an operational locale. */
export const activityVariantSchema = z
  .object({
    requiredVariant: variantId.optional(),
    acceptedVariants: variantIdsSchema.optional(),
    speechFallback: z.enum(["exact", "same_language"]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.requiredVariant &&
      value.acceptedVariants &&
      !value.acceptedVariants.includes(value.requiredVariant)
    )
      ctx.addIssue({ code: "custom", message: "Required variant must be accepted" });
    if (value.requiredVariant && value.speechFallback === "same_language")
      ctx.addIssue({
        code: "custom",
        message: "Mandatory variant prohibits cross-variant speech fallback",
      });
  });
/** Private, author-declared equivalences and forms. No executable rules. */
export const answerPolicySchema = z
  .object({
    alternatives: z
      .array(
        z
          .object({
            text: z.string().min(1),
            variants: variantIdsSchema.optional(),
          })
          .strict(),
      )
      .optional(),
    requiredForms: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();
export type ActivityVariant = z.infer<typeof activityVariantSchema>;
export type AnswerPolicy = z.infer<typeof answerPolicySchema>;
