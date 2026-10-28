import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireCourseBundle } from "../src/content/course-registry";
import { publicCourse } from "../src/content/public";
import { parseJourneyPresentation } from "../src/content/journey-presentation";

/** Local CLI: validates the public sidecar against the immutable compiled course, without services. */
function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--course" || args[2] !== "--file")
    throw new Error(
      "Usage: node --import tsx scripts/validate-journey-presentation.ts --course <courseId> --file <sidecar.json>",
    );
  const bundle = requireCourseBundle(args[1]);
  const course = publicCourse(bundle.course, bundle.language);
  const value: unknown = JSON.parse(readFileSync(resolve(args[3]), "utf8").replace(/^\uFEFF/u, ""));
  const result = parseJourneyPresentation(value, course);
  if (!result.presentation)
    throw new Error(result.issues.join("\n") || "No presentation was supplied.");
  console.log(
    JSON.stringify({
      valid: true,
      schemaVersion: result.presentation.schemaVersion,
      presentationVersion: result.presentation.presentationVersion,
      courseId: course.id,
      contentVersion: course.contentVersion,
      chapters: result.presentation.chapters.length,
      moments: result.presentation.chapters.reduce(
        (sum, chapter) => sum + chapter.moments.length,
        0,
      ),
    }),
  );
}
try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
