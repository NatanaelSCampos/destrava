import { z } from "zod";

// Portable declarations only. No executor, provider, credentials or host flags.
export const capabilityVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const request = {
  id: z.string().trim().min(1),
  version: capabilityVersionSchema,
  data: z.record(z.string(), z.unknown()).optional(),
};
export const capabilityAlternativeSchema = z.object(request).strict();
export const capabilityRequirementSchema = z
  .object({
    ...request,
    required: z.boolean().default(true),
    fallback: capabilityAlternativeSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.required && value.fallback)
      context.addIssue({
        code: "custom",
        path: ["fallback"],
        message: "Only optional requirements may declare a fallback",
      });
  });
export const capabilityRequirementsSchema = z
  .array(capabilityRequirementSchema)
  .max(100)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "Duplicate capability requirement",
  );
export type CapabilityRequirement = z.infer<typeof capabilityRequirementSchema>;
export type CapabilityAlternative = z.infer<typeof capabilityAlternativeSchema>;
export type CapabilityDiagnostic = {
  code:
    | "CAPABILITY_UNKNOWN"
    | "CAPABILITY_VERSION_INCOMPATIBLE"
    | "CAPABILITY_NOT_IMPLEMENTED"
    | "CAPABILITY_UNAVAILABLE"
    | "CAPABILITY_AVAILABILITY_UNKNOWN"
    | "CAPABILITY_DATA_INVALID"
    | "CAPABILITY_DEPENDENCY_MISSING"
    | "CAPABILITY_FALLBACK_INVALID";
  severity: "error" | "warning";
  capabilityId: string;
  requiredVersion: string;
  supportedVersions: string[];
  location: string;
  condition?: string;
  message: string;
  resolution: string;
};
export type CapabilitySelection = {
  location: string;
  requestedId: string;
  selectedId: string;
  selectedVersion: string;
  usedFallback: boolean;
};
export type CapabilityReport = {
  compatible: boolean;
  readiness: "ready" | "unavailable" | "unknown";
  diagnostics: CapabilityDiagnostic[];
  selections: CapabilitySelection[];
};
/** Requirement identity is public; canonical input/fallback payloads stay with the server package. */
export function publicRequirements(items: CapabilityRequirement[] | undefined) {
  return items?.map(({ id, version, required, fallback }) => ({ id, version, required,
    ...(fallback ? { fallback: { id: fallback.id, version: fallback.version } } : {}),
  }));
}
