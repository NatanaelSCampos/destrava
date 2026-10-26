import { createHash } from "node:crypto";
import { z } from "zod";
import {
  externalPackageManifestSchema,
  externalCourseDocumentSchema,
  packageLimits,
  packagePathSchema,
  type ExternalPackageManifest,
  type PackageFile,
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
import { runtimeBundle } from "@/content/runtime-package";
import { packageReferenceIssues } from "@/content/package-references";
import {
  packageCapabilityRequests,
  validatePackageCapabilities,
} from "@/engine/capabilities/package-compatibility";
import {
  negotiateCapabilities,
  CapabilityCompatibilityError,
  type CapabilityEnvironment,
} from "@/engine/capabilities/compatibility";
import { requireLearningVariant } from "@/engine/variants/resolution";
import { publicCourse } from "@/content/public";
import { parsePackageJson, strippedFields } from "./json-data";
import { diagnostic, fieldPointer, type ImportDiagnostic } from "./diagnostics";
import { packageValidationReportSchema } from "@/content/package-contract";

export type PackageValidationReport = z.infer<typeof packageValidationReportSchema>;
export type PreparedExternalPackage = {
  manifest: ExternalPackageManifest;
  bundle: ReturnType<typeof runtimeBundle>;
  publicCourse: ReturnType<typeof publicCourse>;
  assets: Map<string, Uint8Array>;
};
export type PackageValidationResult = {
  report: PackageValidationReport;
  prepared?: PreparedExternalPackage;
};
type FileSet = ReadonlyMap<string, Uint8Array>;
/** Consumer port: immutable byte snapshot in, private prepared runtime out. No writes or provider calls. */
export function validateExternalPackageFiles(
  files: FileSet,
  options: { diagnostics?: ImportDiagnostic[]; environment?: CapabilityEnvironment } = {},
): PackageValidationResult {
  const diagnostics = [...(options.diagnostics ?? [])];
  const error = (
    code: string,
    category: ImportDiagnostic["category"],
    document: string,
    field: string,
    message: string,
    resolution: string,
  ) => diagnostics.push(diagnostic(code, category, document, field, message, resolution));
  const base: PackageValidationReport = {
    reportVersion: "1.0.0",
    technicallyValid: false,
    compatible: false,
    preparation: "rejected",
    readiness: "unknown",
    activation: "not_performed",
    editorial: {
      declaredApproval: "unknown",
      material: "unknown",
      producerTrust: "unverified",
      administrativeApproval: "not_reviewed",
      published: false,
      eligibleForPublication: false,
    },
    diagnostics,
  };
  const reject = (): PackageValidationResult => ({
    report: packageValidationReportSchema.parse(base),
  });
  const inventory = new Set<string>();
  let total = 0;
  for (const [path, bytes] of files) {
    if (!packagePathSchema.safeParse(path).success)
      error(
        "PACKAGE_PATH_INVALID",
        "security",
        "[path]",
        "/",
        "File path is not portable/relative",
        "Use safe relative paths without traversal, URLs or platform-special names.",
      );
    const name = path.normalize("NFC").toLowerCase();
    if (inventory.has(name))
      error(
        "PACKAGE_NAME_COLLISION",
        "security",
        path,
        "/",
        "File names collide",
        "Use unique names across case-insensitive filesystems.",
      );
    inventory.add(name);
    total += bytes.byteLength;
    if (
      bytes.byteLength >
      (path.endsWith(".json") ? packageLimits.jsonBytes : packageLimits.assetBytes)
    )
      error(
        "PACKAGE_SIZE_LIMIT",
        "security",
        path,
        "/",
        "File exceeds published limit",
        "Split content into bounded JSON documents.",
      );
  }
  if (files.size > packageLimits.files || total > packageLimits.totalBytes)
    error(
      "PACKAGE_SIZE_LIMIT",
      "security",
      "manifest.json",
      "/",
      "Package exceeds total file/byte limit",
      "Reduce package resources.",
    );
  function json(path: string): unknown {
    const bytes = files.get(path);
    if (!bytes) {
      error(
        "DOCUMENT_MISSING",
        "structure",
        path,
        "/",
        "Required document was not supplied",
        "Include the declared file with matching integrity metadata.",
      );
      return undefined;
    }
    try {
      return parsePackageJson(bytes);
    } catch (e) {
      const codes = [
        "JSON_SIZE_LIMIT",
        "JSON_DUPLICATE_KEY",
        "JSON_COMPLEXITY_LIMIT",
        "JSON_UNSAFE_KEY",
        "JSON_UNICODE_INVALID",
      ];
      error(
        e instanceof Error && codes.includes(e.message) ? e.message : "JSON_INVALID",
        "structure",
        path,
        "/",
        "JSON is invalid, ambiguous or exceeds the data limits",
        "Supply UTF-8 JSON with unique keys, no unsafe prototype keys and bounded depth.",
      );
      return undefined;
    }
  }
  function parse<T>(
    schema: z.ZodType<T>,
    value: unknown,
    document: string,
    locate?: (path: PropertyKey[]) => { document: string; field: string },
  ): T | undefined {
    if (value === undefined) return undefined;
    const result = schema.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const location = locate?.(issue.path) ?? { document, field: fieldPointer(issue.path) };
        const version =
          document === "manifest.json" &&
          (issue.path[0] === "contracts" || issue.path[0] === "envelopeVersion");
        error(
          version
            ? "CONTRACT_VERSION_UNSUPPORTED"
            : issue.code === "custom"
              ? "SEMANTIC_INVALID"
              : "DOCUMENT_SCHEMA_INVALID",
          version ? "compatibility" : issue.code === "custom" ? "semantic" : "structure",
          location.document,
          location.field,
          issue.code === "custom" ? issue.message : "Field violates the published document schema",
          "Use the generated schema and the documented semantic rules.",
        );
      }
      return undefined;
    }
    for (const path of strippedFields(value, result.data)) {
      const location = locate?.(path) ?? { document, field: fieldPointer(path) };
      error(
        "UNSUPPORTED_FIELD",
        "semantic",
        location.document,
        location.field,
        "Field would be silently discarded by the engine contract",
        "Remove unsupported fields; do not assume undeclared behavior is executed.",
      );
    }
    return result.data;
  }
  const manifest = parse(externalPackageManifestSchema, json("manifest.json"), "manifest.json");
  if (!manifest) return reject();
  base.identity = {
    id: manifest.id,
    contentVersion: manifest.contentVersion,
    envelopeVersion: manifest.envelopeVersion,
    languageSchema: manifest.contracts.language,
    courseSchema: manifest.contracts.course,
  };
  base.editorial = {
    ...base.editorial,
    declaredApproval: manifest.provenance.review.status,
    material: manifest.provenance.material,
  };
  diagnostics.push(
    diagnostic(
      "EDITORIAL_UNVERIFIED",
      "editorial",
      "manifest.json",
      "/provenance/review",
      "Technical validation does not authenticate a producer or authorize publication",
      "Obtain trusted provenance and administrator approval in the future installation workflow.",
      "warning",
    ),
  );
  if (manifest.provenance.material === "test")
    diagnostics.push(
      diagnostic(
        "TEST_MATERIAL",
        "editorial",
        "manifest.json",
        "/provenance/material",
        "Synthetic material is not eligible for learner publication",
        "Keep this material in validation/testing environments.",
        "info",
      ),
    );
  const references: Array<{ file: PackageFile; role: string }> = [];
  for (const [role, value] of Object.entries(manifest.documents)) {
    if (role === "modules") {
      for (const [id, file] of Object.entries(value ?? {}))
        references.push({ file: file as PackageFile, role: `module:${id}` });
    } else if (Array.isArray(value)) value.forEach((file) => references.push({ file, role }));
    else if (value) references.push({ file: value as PackageFile, role });
  }
  for (const file of manifest.assets) references.push({ file, role: "asset" });
  const declared = new Map<string, string>([["manifest.json", "manifest"]]);
  for (const { file, role } of references) {
    const key = file.path.toLowerCase();
    if (declared.has(key))
      error(
        "FILE_ROLE_CONFLICT",
        "structure",
        file.path,
        "/",
        "A document/resource is declared more than once",
        "Each file must have one unambiguous role.",
      );
    declared.set(key, role);
    const bytes = files.get(file.path);
    if (!bytes) {
      error(
        "DOCUMENT_MISSING",
        role === "asset" ? "integrity" : "structure",
        file.path,
        "/",
        "Declared file is missing",
        "Provide the resource/document; no remote download will be attempted.",
      );
      continue;
    }
    if (
      bytes.byteLength !== file.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== file.sha256
    )
      error(
        "INTEGRITY_MISMATCH",
        "integrity",
        file.path,
        "/",
        "Declared hash or size does not match the resource",
        "Re-export integrity metadata from the exact file bytes.",
      );
  }
  for (const path of files.keys())
    if (!declared.has(path.toLowerCase()))
      error(
        "FILE_UNDECLARED",
        "security",
        path,
        "/",
        "File is not declared by the package manifest",
        "Remove unreferenced files, scripts or resources from this package.",
      );
  const docs = manifest.documents;
  const lang = parse(languagePackageSchema, json(docs.language.path), docs.language.path);
  const metadata = parse(externalCourseDocumentSchema, json(docs.course.path), docs.course.path);
  const source = (path: PropertyKey[]) => {
    if (path[0] === "units" && typeof path[1] === "number" && docs.units[path[1]])
      return { document: docs.units[path[1]].path, field: fieldPointer(path.slice(2)) };
    if (
      path[0] === "interactiveLessons" &&
      typeof path[1] === "number" &&
      docs.interactiveLessons?.[path[1]]
    )
      return {
        document: docs.interactiveLessons[path[1]].path,
        field: fieldPointer(path.slice(2)),
      };
    const ref = docs[path[0] as keyof typeof docs];
    if (ref && typeof ref === "object" && "path" in ref)
      return { document: String(ref.path), field: fieldPointer(path.slice(1)) };
    return { document: docs.course.path, field: fieldPointer(path) };
  };
  const arrayDocument = <T>(ref: PackageFile | undefined, schema: z.ZodType<T>) =>
    ref ? parse(schema, json(ref.path), ref.path) : [];
  const pieces = {
    units: docs.units.map((ref) => parse(unitSchema, json(ref.path), ref.path)),
    concepts: arrayDocument(docs.concepts, z.array(conceptSchema)),
    lexicon: arrayDocument(docs.lexicon, z.array(lexiconEntrySchema)),
    assessments: arrayDocument(docs.assessments, z.array(assessmentSchema)),
    missions: arrayDocument(docs.missions, z.array(missionSchema)),
    roleplays: arrayDocument(docs.roleplays, z.array(roleplaySchema)),
    media: arrayDocument(docs.media, z.array(mediaSchema)),
    interactiveLessons: (docs.interactiveLessons ?? []).map((ref) =>
      parse(interactiveLessonSchema, json(ref.path), ref.path),
    ),
  };
  const count = pieces.units.reduce(
    (sum, unit) =>
      sum +
      (unit?.lessons.reduce(
        (n, lesson) => n + lesson.activities.length + (lesson.deferredRecovery?.rules.length ?? 0),
        0,
      ) ?? 0),
    0,
  );
  if (
    count > packageLimits.activities ||
    (pieces.concepts?.length ?? 0) > packageLimits.concepts ||
    (pieces.lexicon?.length ?? 0) > packageLimits.lexicon
  ) {
    error(
      "ENTITY_COUNT_LIMIT",
      "security",
      docs.course.path,
      "/",
      "Course exceeds bounded semantic validation limits",
      "Reduce activities/concepts/lexicon to the published limits.",
    );
    return reject();
  }
  const rawCourse = metadata ? { ...metadata, ...pieces } : undefined;
  const course = parse(coursePackageSchema, rawCourse, docs.course.path, source);
  if (!lang || !course) return reject();
  if (
    lang.schemaVersion !== manifest.contracts.language ||
    course.schemaVersion !== manifest.contracts.course
  )
    error(
      "CONTRACT_VERSION_MISMATCH",
      "structure",
      "manifest.json",
      "/contracts",
      "Documents and envelope select different contract versions",
      "Declare the exact versions found in the language/course documents.",
    );
  if (course.id !== manifest.id || course.contentVersion !== manifest.contentVersion)
    error(
      "PACKAGE_IDENTITY_MISMATCH",
      "semantic",
      docs.course.path,
      "/id",
      "Course identity/content version differ from the envelope",
      "Export one consistent course identity and content version.",
    );
  if (course.concepts.length > 2000)
    error(
      "ENTITY_COUNT_LIMIT",
      "security",
      docs.concepts.path,
      "/",
      "Too many concepts for bounded validation",
      "Reduce the graph size or split the course.",
    );
  else
    for (const issue of packageReferenceIssues(course, lang)) {
      const location = source(issue.path);
      error(
        issue.code,
        "semantic",
        location.document,
        location.field,
        issue.message,
        "Repair the referenced entity or its ownership; no ID/position convention is inferred.",
      );
    }
  // Instructions are accepted metadata by the old schema but not executed by the runtime.
  for (const [u, unit] of course.units.entries())
    for (const [l, lesson] of unit.lessons.entries())
      for (const [a, activity] of lesson.activities.entries()) {
        if (activity.instructions && Object.keys(activity.instructions).length)
          error(
            "UNSUPPORTED_SEMANTIC_FIELD",
            "semantic",
            docs.units[u].path,
            fieldPointer(["lessons", l, "activities", a, "instructions"]),
            "Localized instructions have no runtime binding in this engine version",
            "Use prompt and presentation metadata; request a supported capability before relying on localized instructions.",
          );
        if (activity.difficulty !== undefined)
          diagnostics.push(
            diagnostic(
              "METADATA_ONLY_DIFFICULTY",
              "semantic",
              docs.units[u].path,
              fieldPointer(["lessons", l, "activities", a, "difficulty"]),
              "Activity difficulty is preserved descriptive metadata; adaptive execution uses assessment bank difficulty",
              "Declare executable adaptive difficulty in the assessment bank.",
              "warning",
            ),
          );
        try {
          requireLearningVariant(
            lang,
            course,
            activity.variant?.requiredVariant ?? activity.variant?.acceptedVariants?.[0],
            activity.variant,
          );
        } catch {
          error(
            "VARIANT_INVALID",
            "semantic",
            docs.units[u].path,
            fieldPointer(["lessons", l, "activities", a, "variant"]),
            "Variant configuration cannot be resolved",
            "Use profile variants, an accepted course default and consistent mandatory restrictions.",
          );
        }
      }
  const moduleData: Record<string, unknown> = {};
  for (const [id, module] of Object.entries(lang.modules))
    if (module.source && !packagePathSchema.safeParse(module.source).success)
      error(
        "MODULE_SOURCE_INVALID",
        "security",
        docs.language.path,
        `/modules/${id}/source`,
        "Module source must be package-relative",
        "Use a declared JSON document, never an application path or URL.",
      );
  for (const [id, module] of Object.entries(lang.modules))
    if (module.enabled) {
      const ref = docs.modules?.[id];
      if (!ref) {
        error(
          "MODULE_DOCUMENT_MISSING",
          "structure",
          docs.language.path,
          `/modules/${id}`,
          "Enabled language module has no document",
          "Declare the module document in the envelope.",
        );
        continue;
      }
      if (module.source !== ref.path)
        error(
          "MODULE_SOURCE_MISMATCH",
          "semantic",
          docs.language.path,
          `/modules/${id}/source`,
          "Module source must match its envelope document",
          "Use the same package-relative path in both declarations.",
        );
      const data = json(ref.path);
      const schema: z.ZodType | undefined = {
        alphabet: alphabetModuleSchema,
        numbers: numbersModuleSchema,
        regionalVariants: regionalVariantsModuleSchema,
      }[id];
      moduleData[id] = schema ? parse(schema, data, ref.path) : data;
      if (id === "regionalVariants" && Array.isArray(moduleData[id]))
        for (const [index, topic] of (
          moduleData[id] as z.infer<typeof regionalVariantsModuleSchema>
        ).entries()) {
          for (const [v, variant] of topic.variants.entries())
            if (!lang.variants.some((x) => x.id === variant.region))
              error(
                "VARIANT_INVALID",
                "semantic",
                ref.path,
                fieldPointer([index, "variants", v, "region"]),
                "Regional variant is not defined by the profile",
                "Use a known profile variant.",
              );
          for (const [s, reference] of topic.sources.entries()) {
            let safe = false;
            try {
              const url = new URL(reference.url);
              safe = url.protocol === "https:" && !url.username && !url.password;
            } catch {
              /* schema/URL diagnostics below */
            }
            if (!safe)
              error(
                "SOURCE_URL_UNSAFE",
                "security",
                ref.path,
                fieldPointer([index, "sources", s, "url"]),
                "Source link must be a credential-free HTTPS URL",
                "Documentary source links are never fetched by the importer.",
              );
          }
        }
    }
  for (const id of Object.keys(docs.modules ?? {}))
    if (!lang.modules[id]?.enabled)
      error(
        "MODULE_DOCUMENT_UNUSED",
        "semantic",
        "manifest.json",
        `/documents/modules/${id}`,
        "Module document is not enabled by the language profile",
        "Remove it or enable a supported module.",
      );
  if (course.concepts.some((c) => c.prerequisites?.length))
    diagnostics.push(
      diagnostic(
        "METADATA_ONLY_PREREQUISITES",
        "semantic",
        docs.concepts.path,
        "/",
        "Prerequisites are validated/preserved curriculum metadata; runtime does not enforce them as learner gates",
        "Use implemented learning policies for mandatory evidence gating.",
        "warning",
      ),
    );
  const assets = new Map<string, Uint8Array>();
  for (const ref of manifest.assets) {
    const bytes = files.get(ref.path);
    if (!bytes) continue;
    const matches = assetMatches(ref.mediaType, ref.path, bytes);
    if (!matches)
      error(
        "RESOURCE_TYPE_MISMATCH",
        "integrity",
        ref.path,
        "/",
        "Resource extension/signature does not match its declared media type",
        "Supply an allowed binary asset with correct type, hash and size.",
      );
    else assets.set(ref.path, bytes);
  }
  const paths = new Set(manifest.assets.map((ref) => ref.path));
  const mediaPath = (src: unknown, document: string, field: string) => {
    if (typeof src !== "string" || !packagePathSchema.safeParse(src).success || !paths.has(src))
      error(
        "RESOURCE_PATH_INVALID",
        "security",
        document,
        field,
        "Media must reference a declared package-relative binary resource",
        "Do not use absolute app paths, file/data URLs, traversal or remote downloads.",
      );
  };
  course.media.forEach((m, i) => {
    mediaPath(m.src, docs.media?.path ?? docs.course.path, fieldPointer([i, "src"]));
    const ref = manifest.assets.find((ref) => ref.path === m.src);
    if (ref && !ref.mediaType.startsWith(m.type + "/"))
      error(
        "RESOURCE_TYPE_MISMATCH",
        "semantic",
        docs.media?.path ?? docs.course.path,
        fieldPointer([i, "type"]),
        "Media kind differs from its asset type",
        "Match the image/audio/video kind to the asset.",
      );
  });
  for (const [u, unit] of course.units.entries())
    for (const [l, lesson] of unit.lessons.entries())
      for (const [a, activity] of lesson.activities.entries()) {
        const inline = activity.payload.media as { kind?: string; url?: unknown } | undefined;
        if (inline?.kind === "audio")
          mediaPath(
            inline.url,
            docs.units[u].path,
            fieldPointer(["lessons", l, "activities", a, "payload", "media", "url"]),
          );
      }
  const requests = [
    ...packageCapabilityRequests(course, lang, moduleData),
    ...(manifest.capabilityRequirements ?? []).map((requirement, index) => ({
      requirement,
      location: `envelope.capabilityRequirements[${index}]`,
    })),
  ];
  for (const item of requests)
    for (const data of [item.requirement.data, item.requirement.fallback?.data])
      if (data && "src" in data) mediaPath(data.src, "manifest.json", item.location);
  const environment = options.environment ?? {};
  let report;
  try {
    report = validatePackageCapabilities(course, lang, moduleData, environment).report;
  } catch (e) {
    if (e instanceof CapabilityCompatibilityError) report = e.report;
    else
      error(
        "RUNTIME_VALIDATION_FAILED",
        "semantic",
        docs.course.path,
        "/",
        "Native content validation failed",
        "Use a supported native activity/module with valid semantic data.",
      );
  }
  const all = negotiateCapabilities(requests, environment);
  const capabilitySource = (location: string) => {
    const path = location
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
    if (path[0] === "language")
      return { document: docs.language.path, field: fieldPointer(path.slice(1)) };
    if (path[0] === "envelope")
      return { document: "manifest.json", field: fieldPointer(path.slice(1)) };
    if (path[0] === "course") return source(path.slice(1));
    return { document: docs.course.path, field: location };
  };
  if (report)
    for (const item of [...report.diagnostics, ...all.diagnostics]) {
      const category = item.code.includes("DATA_INVALID") ? "semantic" : "compatibility";
      const location = capabilitySource(item.location);
      const entry = diagnostic(
        item.code,
        category,
        location.document,
        location.field,
        item.message,
        item.resolution,
        item.severity,
      );
      if (item.supportedVersions.length) entry.expected = item.supportedVersions.join(" | ");
      if (/^\d+\.\d+(?:\.\d+)?$/.test(item.requiredVersion)) entry.received = item.requiredVersion;
      if (
        !diagnostics.some(
          (old) =>
            old.code === entry.code && old.field === entry.field && old.message === entry.message,
        )
      )
        diagnostics.push(entry);
    }
  base.compatible = Boolean(report?.compatible && all.compatible);
  base.readiness = all.readiness;
  base.technicallyValid = !diagnostics.some(
    (d) => d.severity === "error" && d.category !== "compatibility" && d.category !== "editorial",
  );
  if (!base.technicallyValid || !base.compatible) return reject();
  try {
    const effectiveCourse = {
      ...course,
      capabilityRequirements: [
        ...(course.capabilityRequirements ?? []),
        ...(manifest.capabilityRequirements ?? []),
      ],
    };
    const compiled = { course: effectiveCourse, language: lang, moduleData };
    const bundle = runtimeBundle(compiled);
    base.preparation = "prepared";
    const result: PackageValidationResult = { report: packageValidationReportSchema.parse(base) };
    // Accidental JSON serialization must not export private answers or resource bytes.
    Object.defineProperty(result, "prepared", {
      enumerable: false,
      value: {
        manifest,
        bundle,
        publicCourse: publicCourse(bundle.course, lang, environment),
        assets,
      },
    });
    return result;
  } catch {
    error(
      "RUNTIME_PREPARATION_FAILED",
      "semantic",
      docs.course.path,
      "/",
      "Validated documents cannot be represented by this runtime",
      "Check interactive references, private answer policies and native activity semantics.",
    );
    base.technicallyValid = false;
    return reject();
  }
}
function assetMatches(type: string, path: string, bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (type === "image/png")
    return (
      path.endsWith(".png") &&
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  if (type === "image/jpeg")
    return /\.jpe?g$/.test(path) && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (type === "audio/wav")
    return (
      path.endsWith(".wav") &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WAVE"
    );
  if (type === "audio/mpeg")
    return (
      path.endsWith(".mp3") &&
      (b.toString("ascii", 0, 3) === "ID3" || (b[0] === 255 && (b[1] & 224) === 224))
    );
  if (type === "video/mp4") return path.endsWith(".mp4") && b.toString("ascii", 4, 8) === "ftyp";
  return (
    type === "video/webm" &&
    path.endsWith(".webm") &&
    b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
  );
}
