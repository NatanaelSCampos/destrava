import { writeFileSync } from "node:fs";
import { capabilityCatalog } from "../src/engine/capabilities/registry";
import { installedCapabilitySupport } from "../src/domain/installed-study/compatibility";

const catalog = capabilityCatalog();
const profile = {
  profileVersion: "1.0.0",
  catalogVersion: catalog.catalogVersion,
  environment: "isolated-local-homologation",
  productionReady: false,
  rules: [
    "The engine capability catalog describes implementation, not installed runtime readiness.",
    "Required capabilities without installed integration block activation and rollback.",
    "Optional unsupported capabilities produce diagnostics and cannot generate official evidence.",
    "Operational availability must be negotiated in the executing environment; this profile is not a health check.",
    "Test evidence and route-specific limitations are documented in DESTRAVA_RUNTIME_INCREMENTO_8.md.",
  ],
  capabilities: catalog.capabilities.map((entry) => {
    const integration = installedCapabilitySupport.find((item) => item.id === entry.id);
    if (!integration) throw new Error("Installed capability profile does not cover the catalog.");
    return {
      id: entry.id,
      versions: entry.supportedVersions,
      engineImplementation: entry.support,
      installedIntegration: integration.integrated,
      reason: integration.reason,
      operationalDependencies: entry.operationalDependencies,
      operationalAvailability: "evaluate-at-execution",
      homologation: "see-test-matrix",
    };
  }),
};
writeFileSync(
  "contracts/package-v1/installed-runtime.json",
  JSON.stringify(profile, null, 2) + "\n",
);
console.log(
  `Exported installed runtime profile: ${profile.capabilities.length} capabilities; no private payloads.`,
);
