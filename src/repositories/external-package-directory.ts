import { constants, type Stats } from "node:fs";
import { lstat, opendir, realpath, open } from "node:fs/promises";
import { resolve, relative, sep, join } from "node:path";
import { packageLimits, packagePathSchema } from "@/content/package-contract";
import { diagnostic, type ImportDiagnostic } from "@/engine/import/diagnostics";

export type ExternalPackageFiles = {
  files: Map<string, Uint8Array>;
  diagnostics: ImportDiagnostic[];
};
const key = (path: string) => path.normalize("NFC").toLowerCase();
const extensions = /\.(json|png|jpg|jpeg|wav|mp3|mp4|webm)$/i;
function within(root: string, target: string) {
  const path = relative(root, target);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !path.includes(":") && !path.startsWith(sep))
  );
}
/** Read-only adapter. Never imports code, fetches assets, writes files or touches a catalog. */
export async function readExternalPackageDirectory(
  directory: string,
): Promise<ExternalPackageFiles> {
  const files = new Map<string, Uint8Array>(),
    diagnostics: ImportDiagnostic[] = [];
  const fail = (code: string, path: string, message: string) =>
    diagnostics.push(
      diagnostic(
        code,
        "security",
        path,
        "/",
        message,
        "Supply a regular file within a portable package directory and the published limits.",
      ),
    );
  const root = resolve(directory);
  try {
    // Check every ancestor as well as the root; Windows junctions are symbolic links to lstat.
    let ancestor = root;
    while (true) {
      const stat = await lstat(ancestor);
      if (stat.isSymbolicLink()) {
        fail(
          "PACKAGE_LINK_FORBIDDEN",
          ".",
          "Package root/ancestor cannot be a symbolic link or junction",
        );
        return { files, diagnostics };
      }
      const parent = resolve(ancestor, "..");
      if (parent === ancestor) break;
      ancestor = parent;
    }
    if (!(await lstat(root)).isDirectory()) {
      fail("PACKAGE_ROOT_INVALID", ".", "Package root must be a directory");
      return { files, diagnostics };
    }
    const canonicalRoot = await realpath(root);
    const seen = new Set<string>();
    let count = 0,
      total = 0;
    async function read(path: string, stat: Stats) {
      const absolute = resolve(root, path);
      if (!within(canonicalRoot, await realpath(absolute))) {
        fail("PACKAGE_PATH_ESCAPE", path, "Resolved file leaves the package root");
        return;
      }
      const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const actual = await handle.stat();
        if (
          !actual.isFile() ||
          actual.nlink !== 1 ||
          actual.ino !== stat.ino ||
          actual.dev !== stat.dev ||
          actual.size !== stat.size
        ) {
          fail(
            "PACKAGE_FILE_CHANGED",
            path,
            "File identity changed or a hard link was encountered",
          );
          return;
        }
        const max = path.endsWith(".json") ? packageLimits.jsonBytes : packageLimits.assetBytes;
        if (actual.size > max || total + actual.size > packageLimits.totalBytes) {
          fail("PACKAGE_SIZE_LIMIT", path, "File/package exceeds the byte limit");
          return;
        }
        const bytes = new Uint8Array(actual.size + 1);
        let offset = 0;
        while (offset < bytes.length) {
          const result = await handle.read(bytes, offset, bytes.length - offset, offset);
          if (!result.bytesRead) break;
          offset += result.bytesRead;
        }
        const after = await lstat(absolute),
          handleAfter = await handle.stat();
        if (
          offset !== actual.size ||
          handleAfter.size !== actual.size ||
          handleAfter.mtimeMs !== actual.mtimeMs ||
          after.isSymbolicLink() ||
          after.ino !== actual.ino ||
          after.dev !== actual.dev ||
          !within(canonicalRoot, await realpath(absolute))
        ) {
          fail(
            "PACKAGE_FILE_CHANGED",
            path,
            "Package changed during the snapshot; no content was prepared",
          );
          return;
        }
        total += offset;
        files.set(path, bytes.slice(0, offset));
      } finally {
        await handle.close();
      }
    }
    async function scan(path: string, depth: number) {
      if (depth > packageLimits.depth) {
        fail("PACKAGE_DEPTH_LIMIT", path, "Directory nesting exceeds the limit");
        return;
      }
      for await (const entry of await opendir(join(root, path))) {
        const name = path ? `${path}/${entry.name}` : entry.name;
        if (++count > packageLimits.files) {
          fail("PACKAGE_FILE_COUNT_LIMIT", ".", "Package entry count exceeds the limit");
          return;
        }
        if (!packagePathSchema.safeParse(name).success) {
          fail("PACKAGE_PATH_INVALID", "[path]", "Nonportable, absolute or traversal-like path");
          continue;
        }
        if (seen.has(key(name))) {
          fail("PACKAGE_NAME_COLLISION", name, "Case-insensitive names collide");
          continue;
        }
        seen.add(key(name));
        const stat = await lstat(join(root, name));
        if (stat.isSymbolicLink() || (stat.nlink > 1 && !stat.isDirectory())) {
          fail(
            "PACKAGE_LINK_FORBIDDEN",
            name,
            "Symbolic links, junctions and hard links are forbidden",
          );
          continue;
        }
        if (stat.isDirectory()) await scan(name, depth + 1);
        else if (!stat.isFile())
          fail(
            "PACKAGE_FILE_TYPE_INVALID",
            name,
            "Only regular files and directories are accepted",
          );
        else if (!extensions.test(name))
          fail("PACKAGE_FILE_TYPE_INVALID", name, "Executable/unsupported file extension");
        else await read(name, stat);
      }
    }
    await scan("", 0);
    if ((await realpath(root)) !== canonicalRoot)
      fail("PACKAGE_FILE_CHANGED", ".", "Package root changed during validation");
  } catch {
    fail(
      "PACKAGE_READ_FAILED",
      ".",
      "Could not read a stable package snapshot; filesystem details are suppressed",
    );
  }
  return { files, diagnostics };
}
