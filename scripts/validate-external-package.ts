import { validateExternalPackageDirectory } from "../src/lib/external-package-validation";

async function main() {
  const args = process.argv.slice(2),
    directory = args.find((arg) => !arg.startsWith("--"));
  if (!directory || args.some((arg) => arg !== directory && arg !== "--dry-run"))
    throw new Error("Usage: npm run package:validate -- <external-directory> [--dry-run]");
  const result = await validateExternalPackageDirectory(directory);
  // JSON escaping keeps bidi controls from misleading terminal/log presentation.
  console.log(
    JSON.stringify(result.report, null, 2).replace(
      /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    ),
  );
  if (result.report.preparation !== "prepared") process.exitCode = 1;
}
void main().catch((error) => {
  console.error(
    error instanceof Error && error.message.startsWith("Usage:")
      ? error.message
      : "Package validation failed; host filesystem details are suppressed.",
  );
  process.exitCode = 1;
});
