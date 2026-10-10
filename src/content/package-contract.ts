import { z } from "zod";
import {
  coursePackageSchema,
  supportedLanguageSchemaVersions,
  supportedCourseSchemaVersions,
} from "./contracts";
import { capabilityRequirementsSchema } from "./capability-contracts";

export const supportedPackageVersions = {
  envelope: ["1.0.0"],
  language: supportedLanguageSchemaVersions,
  course: supportedCourseSchemaVersions,
} as const;
export const packageLimits = {
  files: 256,
  totalBytes: 32 * 1024 * 1024,
  jsonBytes: 1024 * 1024,
  assetBytes: 16 * 1024 * 1024,
  depth: 16,
  jsonDepth: 64,
  jsonNodes: 100_000,
  activities: 2000,
  concepts: 2000,
  lexicon: 5000,
} as const;
export const packagePathSchema = z
  .string()
  .min(1)
  .max(240)
  .regex(/^[A-Za-z0-9._/-]+$/)
  .refine(
    (path) =>
      !path.startsWith("/") &&
      !path
        .split("/")
        .some(
          (part) =>
            !part ||
            part === "." ||
            part === ".." ||
            part.endsWith(".") ||
            /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part),
        ),
    "Use a portable relative path without traversal or reserved names",
  );
export const packageFileSchema = z
  .object({
    path: packagePathSchema,
    bytes: z.number().int().positive().max(packageLimits.assetBytes),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const jsonFile = packageFileSchema.refine(
  (ref) => ref.path.endsWith(".json") && ref.bytes <= packageLimits.jsonBytes,
  "JSON documents require a .json path and the JSON size limit",
);
export const packageAssetSchema = packageFileSchema
  .extend({
    mediaType: z.enum([
      "image/png",
      "image/jpeg",
      "audio/wav",
      "audio/mpeg",
      "video/mp4",
      "video/webm",
    ]),
  })
  .strict();
export const externalPackageManifestSchema = z
  .object({
    format: z.literal("destrava.course-package"),
    envelopeVersion: z.enum(supportedPackageVersions.envelope),
    id: z.string().min(1).max(128),
    contentVersion: z.string().regex(/^\d+\.\d+(?:\.\d+)?$/),
    contracts: z
      .object({
        language: z.enum(supportedPackageVersions.language),
        course: z.enum(supportedPackageVersions.course),
      })
      .strict(),
    producer: z
      .object({ id: z.string().min(1).max(128), name: z.string().min(1).max(160) })
      .strict(),
    provenance: z
      .object({
        material: z.enum(["test", "production"]),
        origin: z.enum(["human", "ai_generated", "adapted", "imported"]),
        sources: z
          .array(
            z
              .object({ label: z.string().min(1).max(160), reference: z.string().min(1).max(500) })
              .strict(),
          )
          .max(100),
        review: z
          .object({
            status: z.enum(["draft", "review_pending", "approved"]),
            reviewedBy: z.string().min(1).max(160).optional(),
            reference: z.string().min(1).max(500).optional(),
          })
          .strict(),
      })
      .strict(),
    documents: z
      .object({
        language: jsonFile,
        course: jsonFile,
        units: z.array(jsonFile).min(1).max(100),
        concepts: jsonFile,
        lexicon: jsonFile,
        assessments: jsonFile,
        missions: jsonFile.optional(),
        roleplays: jsonFile.optional(),
        media: jsonFile.optional(),
        interactiveLessons: z.array(jsonFile).max(100).optional(),
        modules: z.record(z.string().min(1).max(80), jsonFile).optional(),
      })
      .strict(),
    assets: z.array(packageAssetSchema).max(100),
    capabilityRequirements: capabilityRequirementsSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.provenance.review.status === "approved" &&
      (!value.provenance.review.reviewedBy || !value.provenance.review.reference)
    )
      ctx.addIssue({
        code: "custom",
        path: ["provenance", "review"],
        message:
          "Declared approval requires reviewer and evidence reference; this does not establish trust",
      });
  });
// Structural document view reuses the exact existing field schemas. Full package refinements run after assembly.
export const externalCourseDocumentSchema = z
  .object(coursePackageSchema.shape)
  .omit({
    units: true,
    concepts: true,
    lexicon: true,
    assessments: true,
    missions: true,
    roleplays: true,
    media: true,
    interactiveLessons: true,
  })
  .strict();
export type ExternalPackageManifest = z.infer<typeof externalPackageManifestSchema>;
export type PackageFile = z.infer<typeof packageFileSchema>;
export const packageDiagnosticSchema = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    severity: z.enum(["error", "warning", "info"]),
    category: z.enum([
      "security",
      "integrity",
      "structure",
      "semantic",
      "compatibility",
      "editorial",
    ]),
    document: z.string(),
    field: z.string(),
    message: z.string(),
    resolution: z.string(),
    expected: z.string().optional(),
    received: z.string().optional(),
  })
  .strict();
export const packageValidationReportSchema = z
  .object({
    reportVersion: z.literal("1.0.0"),
    technicallyValid: z.boolean(),
    compatible: z.boolean(),
    preparation: z.enum(["prepared", "rejected"]),
    readiness: z.enum(["ready", "unknown", "unavailable"]),
    activation: z.literal("not_performed"),
    identity: z
      .object({
        id: z.string(),
        contentVersion: z.string(),
        envelopeVersion: z.string(),
        languageSchema: z.string(),
        courseSchema: z.string(),
      })
      .strict()
      .optional(),
    editorial: z
      .object({
        declaredApproval: z.string(),
        material: z.string(),
        producerTrust: z.literal("unverified"),
        administrativeApproval: z.literal("not_reviewed"),
        published: z.literal(false),
        eligibleForPublication: z.literal(false),
      })
      .strict(),
    diagnostics: z.array(packageDiagnosticSchema),
  })
  .strict();
