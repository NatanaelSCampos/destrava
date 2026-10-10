import type {
  CapabilityDiagnostic,
  CapabilityRequirement,
  CapabilityReport,
  CapabilitySelection,
} from "@/content/capability-contracts";
import { capabilityRequirementSchema } from "@/content/capability-contracts";
import { textMeasureAvailability } from "@/engine/text/representation";
import { textMeasureSchema } from "@/content/text-strategies";
import {
  capabilityRegistry,
  type CapabilityRegistry,
  type OperationalDependency,
} from "./registry";

export type AvailabilityState = { state: "available" | "unavailable" | "unknown"; reason?: string };
export type CapabilityEnvironment = {
  resources?: Record<string, AvailabilityState>;
  dependencies?: Partial<Record<OperationalDependency, AvailabilityState>>;
  capabilities?: Record<string, AvailabilityState>;
};
export type LocatedRequirement = { requirement: CapabilityRequirement; location: string };
export function negotiateCapabilities(
  requests: readonly LocatedRequirement[],
  environment: CapabilityEnvironment = {},
  registry: CapabilityRegistry = capabilityRegistry,
  options: { validateData?: boolean } = {},
): CapabilityReport {
  const diagnostics: CapabilityDiagnostic[] = [];
  const selections: CapabilitySelection[] = [];
  const examine = (
    request: CapabilityRequirement,
    location: string,
    chain: string[] = [],
    dataCheck = true,
  ): CapabilityDiagnostic[] => {
    const definition = registry.get(request.id);
    const issue = (
      code: CapabilityDiagnostic["code"],
      message: string,
      resolution: string,
    ): CapabilityDiagnostic => ({
      code,
      severity: code === "CAPABILITY_AVAILABILITY_UNKNOWN" ? "warning" : "error",
      capabilityId: request.id,
      requiredVersion: request.version,
      supportedVersions: [...(definition?.versions ?? [])],
      location,
      message,
      resolution,
    });
    if (!definition)
      return [
        issue(
          "CAPABILITY_UNKNOWN",
          "The engine does not recognize this capability.",
          "Use a cataloged capability or request an engine implementation.",
        ),
      ];
    if (!definition.versions.includes(request.version))
      return [
        issue(
          "CAPABILITY_VERSION_INCOMPATIBLE",
          "The requested contract version is not explicitly supported.",
          "Request a version in supportedVersions; higher versions are not assumed compatible.",
        ),
      ];
    if (definition.support !== "implemented" || !definition.executor)
      return [
        issue(
          "CAPABILITY_NOT_IMPLEMENTED",
          `Implementation support is ${definition.support}.`,
          "Use a fully implemented capability; partial support does not meet a mandatory requirement.",
        ),
      ];
    const issues: CapabilityDiagnostic[] = [];
    if (dataCheck) {
      const result = (definition.versionSchemas?.[request.version] ?? definition.schema).safeParse(request.data ?? {});
      if (!result.success)
        issues.push(
          issue(
            "CAPABILITY_DATA_INVALID",
            "Data does not satisfy the catalog schema.",
            "Validate the supplied data against dataSchema. Payload values are not included in diagnostics.",
          ),
        );
      else {
        let semanticErrors: string[];
        try { semanticErrors = definition.semantic?.(result.data) ?? []; }
        catch { semanticErrors = ["The declared text representation is invalid."]; }
        if (semanticErrors.length) issues.push(issue("CAPABILITY_DATA_INVALID", semanticErrors.join(" "), "Correct the semantic constraints in the catalog and package references."));
      }
    }
    if (chain.includes(request.id))
      return [
        ...issues,
        issue(
          "CAPABILITY_DEPENDENCY_MISSING",
          "Capability dependency cycle detected.",
          "Correct the engine registry dependencies.",
        ),
      ];
    for (const id of definition.dependencies ?? []) {
      const dependencyIssues = examine(
        { id, version: "1.0.0", required: true },
        `${location}.dependencies.${id}`,
        [...chain, request.id],
        false,
      );
      for (const dependencyIssue of dependencyIssues)
        issues.push({
          ...dependencyIssue,
          code:
            dependencyIssue.code.startsWith("CAPABILITY_AVAILABILITY") ||
            dependencyIssue.code === "CAPABILITY_UNAVAILABLE"
              ? dependencyIssue.code
              : "CAPABILITY_DEPENDENCY_MISSING",
        });
    }
    let textSupport: ReturnType<typeof textMeasureAvailability> | undefined;
    if (dataCheck && request.id === "text.measurement") {
      const measure = textMeasureSchema.safeParse(request.data);
      if (measure.success) { try { textSupport = textMeasureAvailability(measure.data); } catch { /* semantic diagnostics already describe invalid locale */ } }
    }
    const conditions = [
      ...(textSupport && !textSupport.available ? [["runtime.text_measurement", { state: "unavailable" as const, reason: textSupport.reason }] as const] : []),
      ...(environment.capabilities?.[request.id]
        ? [[request.id, environment.capabilities[request.id]] as const]
        : []),
      ...(definition.operational ?? []).map(
        (id) => [id, environment.dependencies?.[id] ?? { state: "unknown" as const }] as const,
      ),
      ...(dataCheck && ["media.audio", "media.presentation"].includes(request.id) && typeof request.data?.src === "string"
        ? [["media.resource", environment.resources?.[request.data.src] ?? { state: "unknown" as const, reason: "A disponibilidade do recurso de mídia ainda não foi verificada." }] as const] : []),
    ];
    for (const [id, condition] of conditions) {
      if (condition.state === "available") continue;
      issues.push({
        ...issue(
          condition.state === "unavailable"
            ? "CAPABILITY_UNAVAILABLE"
            : "CAPABILITY_AVAILABILITY_UNKNOWN",
          condition.reason ?? `Operational dependency ${id} is ${condition.state}.`,
          `Provide or probe ${id} before execution.`,
        ),
        condition: id,
      });
    }
    return issues;
  };
  for (const { requirement: raw, location } of requests) {
    const parsed = capabilityRequirementSchema.safeParse(raw);
    if (!parsed.success) {
      diagnostics.push({
        code: "CAPABILITY_DATA_INVALID",
        severity: "error",
        capabilityId: typeof raw?.id === "string" ? raw.id : "<invalid>",
        requiredVersion: typeof raw?.version === "string" ? raw.version : "<invalid>",
        supportedVersions: [],
        location,
        message: "Invalid capability declaration.",
        resolution: "Use capabilityRequirementSchema, without code or provider configuration.",
      });
      continue;
    }
    const requirement = parsed.data;
    const primary = examine(requirement, location, [], options.validateData !== false);
    const hasError = primary.some((item) => item.severity === "error");
    // Optional means a usable alternative is declared, even when the primary currently works.
    const fallback = requirement.fallback;
    const fallbackIssues =
      !requirement.required && fallback
        ? examine(
            { ...fallback, required: true },
            `${location}.fallback`,
            [],
            options.validateData !== false,
          )
        : [];
    if (
      !requirement.required &&
      (!fallback || fallbackIssues.some((item) => item.severity === "error" && item.code !== "CAPABILITY_UNAVAILABLE"))
    ) {
      diagnostics.push(...fallbackIssues, {
        code: "CAPABILITY_FALLBACK_INVALID",
        severity: "error",
        capabilityId: requirement.id,
        requiredVersion: requirement.version,
        supportedVersions: [...(registry.get(requirement.id)?.versions ?? [])],
        location,
        message: "An optional requirement needs a supported, valid and usable alternative.",
        resolution:
          "Declare an implemented fallback with compatible version, data and dependencies.",
      });
      continue;
    }
    if (hasError && !requirement.required && fallback) {
      diagnostics.push(
        ...primary.map((item) => ({ ...item, severity: "warning" as const })),
        ...fallbackIssues,
      );
      selections.push({
        location,
        requestedId: requirement.id,
        selectedId: fallback.id,
        selectedVersion: fallback.version,
        usedFallback: true,
      });
    } else {
      diagnostics.push(...primary);
      if (!hasError)
        selections.push({
          location,
          requestedId: requirement.id,
          selectedId: requirement.id,
          selectedVersion: requirement.version,
          usedFallback: false,
        });
    }
  }
  return {
    compatible: !diagnostics.some(
      (item) =>
        item.severity === "error" &&
        !["CAPABILITY_UNAVAILABLE", "CAPABILITY_AVAILABILITY_UNKNOWN"].includes(item.code),
    ),
    readiness: diagnostics.some(
      (item) => item.code === "CAPABILITY_UNAVAILABLE" && item.severity === "error",
    )
      ? "unavailable"
      : diagnostics.some((item) => item.code === "CAPABILITY_AVAILABILITY_UNKNOWN")
        ? "unknown"
        : "ready",
    diagnostics,
    selections,
  };
}
export class CapabilityCompatibilityError extends Error {
  constructor(public report: CapabilityReport) {
    super(
      `Course capabilities are incompatible: ${report.diagnostics
        .filter((item) => item.severity === "error")
        .map((item) => `${item.code} at ${item.location}`)
        .join("; ")}`,
    );
  }
}
