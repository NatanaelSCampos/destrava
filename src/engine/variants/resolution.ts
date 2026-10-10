import { activityVariantSchema, type ActivityVariant } from "@/content/variant-contracts";

export type VariantLanguage = {
  id: string;
  variants: Array<{ id: string }>;
  speech: { defaultVariant: string };
};
export type VariantCourse = { defaultVariant?: string; acceptedVariants?: string[] };
export type VariantDiagnostic = {
  code:
    | "INVALID_PREFERENCE"
    | "UNSUPPORTED_PREFERENCE"
    | "PREFERENCE_CONFLICT"
    | "INVALID_CONFIGURATION";
  message: string;
};
export type VariantResolution = {
  status: "resolved" | "invalid";
  variantId: string | null;
  selectedBy: "activity" | "preference" | "course" | "language" | null;
  preference: unknown;
  diagnostics: VariantDiagnostic[];
  speechFallback: "exact" | "same_language";
};

/** Availability never changes the pedagogical variant. Invalid saved preferences are reported,
 * but the declared course default still permits practice; invalid author configuration blocks it. */
export function resolveLearningVariant(
  language: VariantLanguage,
  course: VariantCourse = {},
  preference?: unknown,
  activity?: ActivityVariant,
): VariantResolution {
  const diagnostics: VariantDiagnostic[] = [];
  const known = new Set(language.variants.map((item) => item.id));
  const accepted = course.acceptedVariants ?? [...known];
  const fallback = course.defaultVariant ?? language.speech.defaultVariant;
  const parsed = activityVariantSchema.safeParse(activity ?? {});
  const invalid = (message: string): VariantResolution => ({
    status: "invalid",
    variantId: null,
    selectedBy: null,
    preference,
    diagnostics: [...diagnostics, { code: "INVALID_CONFIGURATION", message }],
    speechFallback: "exact",
  });
  if (
    !known.has(fallback) ||
    !accepted.includes(fallback) ||
    accepted.some((id) => !known.has(id)) ||
    new Set(accepted).size !== accepted.length ||
    !accepted.length
  )
    return invalid("Course default/accepted variants are inconsistent with the language.");
  if (!parsed.success) return invalid("Invalid activity variant constraints.");
  const constraints = parsed.data;
  const activityAccepted = constraints.acceptedVariants ?? accepted;
  if (
    activityAccepted.some((id) => !accepted.includes(id)) ||
    (constraints.requiredVariant && !activityAccepted.includes(constraints.requiredVariant))
  )
    return invalid("Activity variants must belong to the course accepted variants.");
  const present = preference !== undefined && preference !== null && preference !== "";
  const validPreference = typeof preference === "string" && known.has(preference);
  if (present && !validPreference)
    diagnostics.push({
      code: "INVALID_PREFERENCE",
      message: "Saved preference does not identify a language variant.",
    });
  else if (present && !accepted.includes(preference as string))
    diagnostics.push({
      code: "UNSUPPORTED_PREFERENCE",
      message: "Saved preference is not accepted by this course.",
    });
  const selected =
    validPreference && accepted.includes(preference as string) ? (preference as string) : fallback;
  if (constraints.requiredVariant) {
    if (validPreference && selected !== constraints.requiredVariant)
      diagnostics.push({
        code: "PREFERENCE_CONFLICT",
        message: "This activity requires another variant; your saved preference is preserved.",
      });
    return {
      status: "resolved",
      variantId: constraints.requiredVariant,
      selectedBy: "activity",
      preference,
      diagnostics,
      speechFallback: "exact",
    };
  }
  if (!activityAccepted.includes(selected))
    return invalid(
      "Selected variant is not accepted by this activity; choose an accepted preference.",
    );
  return {
    status: "resolved",
    variantId: selected,
    selectedBy:
      selected === preference && present
        ? "preference"
        : course.defaultVariant
          ? "course"
          : "language",
    preference,
    diagnostics,
    speechFallback: constraints.speechFallback ?? "same_language",
  };
}

export class VariantContextError extends Error {
  constructor(public resolution: VariantResolution) {
    super(resolution.diagnostics.map((item) => item.message).join(" "));
  }
}
export function requireLearningVariant(
  language: VariantLanguage,
  course: VariantCourse = {},
  preference?: unknown,
  activity?: ActivityVariant,
) {
  const result = resolveLearningVariant(language, course, preference, activity);
  if (result.status !== "resolved" || !result.variantId) throw new VariantContextError(result);
  return result;
}
