import { createHash } from "node:crypto";
import { z } from "zod";
import {
  packageLimits,
  packagePathSchema,
  type ExternalPackageManifest,
} from "@/content/package-contract";
import {
  InstallationError,
  type ArtifactFile,
  type ArtifactIdentity,
  type InstalledContentReference,
} from "./contracts";

/** Own the snapshot before an authorization/storage await can let its caller change buffers. */
export function clonePackageFiles(files: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  const snapshot = new Map<string, Uint8Array>();
  let total = 0;
  for (const [path, bytes] of files) {
    if (
      typeof path !== "string" ||
      !(bytes instanceof Uint8Array) ||
      !packagePathSchema.safeParse(path).success
    )
      throw new InstallationError("INVALID_PACKAGE", "validation");
    total += bytes.byteLength;
    if (
      snapshot.size >= packageLimits.files ||
      total > packageLimits.totalBytes ||
      bytes.byteLength >
        (path.endsWith(".json") ? packageLimits.jsonBytes : packageLimits.assetBytes)
    )
      throw new InstallationError("INVALID_PACKAGE", "validation");
    snapshot.set(path, new Uint8Array(bytes));
  }
  return snapshot;
}
export function artifactInventory(files: ReadonlyMap<string, Uint8Array>): ArtifactFile[] {
  return [...files]
    .map(([path, bytes]) => ({
      path,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }))
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}
/** Hash exact bytes, names and sizes, including manifest.json; never hash a parsed projection. */
export function hashArtifact(files: ReadonlyMap<string, Uint8Array>): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        format: "destrava.immutable-artifact/1",
        files: artifactInventory(files),
      }),
    )
    .digest("hex");
}
export function identifyArtifact(
  files: ReadonlyMap<string, Uint8Array>,
  manifest: ExternalPackageManifest,
): ArtifactIdentity {
  return {
    courseId: manifest.id,
    contentVersion: manifest.contentVersion,
    contractVersion: manifest.contracts.course,
    envelopeVersion: manifest.envelopeVersion,
    languageContractVersion: manifest.contracts.language,
    artifactHash: hashArtifact(files),
  };
}
export function artifactObjectPath(reference: InstalledContentReference, path: string): string {
  if (
    !z.uuid().safeParse(reference.installationId).success ||
    !/^[a-f0-9]{64}$/.test(reference.artifactHash) ||
    !packagePathSchema.safeParse(path).success
  )
    throw new InstallationError("INVALID_INPUT", "storage");
  return `${reference.installationId}/${reference.artifactHash}/${path}`;
}
export function sameContentReference(
  left: InstalledContentReference,
  right: InstalledContentReference,
): boolean {
  return (
    [
      "courseId",
      "contentVersion",
      "contractVersion",
      "envelopeVersion",
      "languageContractVersion",
      "artifactHash",
      "installationId",
    ] as const
  ).every((key) => left[key] === right[key]);
}
