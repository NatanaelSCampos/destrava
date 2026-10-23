import { readExternalPackageDirectory } from "@/repositories/external-package-directory";
import { validateExternalPackageFiles } from "@/engine/import/validate-package";
import type { CapabilityEnvironment } from "@/engine/capabilities/compatibility";

/** Local application boundary. Preparation never means catalog registration or activation. */
export async function validateExternalPackageDirectory(
  directory: string,
  options: { environment?: CapabilityEnvironment } = {},
) {
  const snapshot = await readExternalPackageDirectory(directory);
  return validateExternalPackageFiles(snapshot.files, {
    ...options,
    diagnostics: snapshot.diagnostics,
  });
}
