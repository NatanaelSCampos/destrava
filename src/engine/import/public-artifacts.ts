import { z } from "zod";
import {
  externalPackageManifestSchema,
  externalCourseDocumentSchema,
  supportedPackageVersions,
  packageLimits,
  packageValidationReportSchema,
} from "@/content/package-contract";
import {
  languagePackageSchema,
  coursePackageSchema,
  unitSchema,
  conceptSchema,
  lexiconEntrySchema,
  assessmentSchema,
  missionSchema,
  roleplaySchema,
  mediaSchema,
  interactiveLessonSchema,
  alphabetModuleSchema,
  numbersModuleSchema,
  regionalVariantsModuleSchema,
} from "@/content/contracts";
import { capabilityCatalog } from "@/engine/capabilities/registry";

/** Pure portable artifacts from canonical schemas. No external producer imports this implementation. */
export function publicPackageArtifacts() {
  const schemas = {
    manifest: externalPackageManifestSchema,
    report: packageValidationReportSchema,
    language: languagePackageSchema,
    "course-metadata": externalCourseDocumentSchema,
    "course-assembled": coursePackageSchema,
    unit: unitSchema,
    concepts: z.array(conceptSchema),
    lexicon: z.array(lexiconEntrySchema),
    assessments: z.array(assessmentSchema),
    missions: z.array(missionSchema),
    roleplays: z.array(roleplaySchema),
    media: z.array(mediaSchema),
    "interactive-lesson": interactiveLessonSchema,
    "module-alphabet": alphabetModuleSchema,
    "module-numbers": numbersModuleSchema,
    "module-regionalVariants": regionalVariantsModuleSchema,
  };
  const artifacts: Record<string, unknown> = Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      `${name}.schema.json`,
      z.toJSONSchema(schema, { io: "input" }),
    ]),
  );
  artifacts["compatibility.json"] = {
    format: "destrava.course-package",
    versions: supportedPackageVersions,
    limits: packageLimits,
    semanticValidationRequired: true,
    unknownFields: "rejected",
    localizedInstructions: "not_supported_use_prompt",
    prerequisites: "validated_acyclic_metadata_not_execution_gates",
    mediaHealth: "signature_integrity_do_not_prove_decoding",
    editorialTrust: "unverified_no_publication",
    activation: "not_supported",
  };
  artifacts["capabilities.json"] = capabilityCatalog();
  return artifacts;
}
