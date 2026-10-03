import { compiledPackages } from "./generated/registry";
import { runtimeBundle } from "./runtime-package";

const bundles = compiledPackages.map(runtimeBundle);

const defaultBundle = bundles.find((bundle) => bundle.coursePackage.isDefault);
if (!defaultBundle) throw new Error("No default course is available.");
export const defaultCourseId = defaultBundle.course.id;

export function allCourseBundles() {
  return bundles;
}

export function findCourseBundle(courseId: string) {
  return bundles.find((bundle) => bundle.course.id === courseId);
}

export function requireCourseBundle(courseId: string) {
  const bundle = findCourseBundle(courseId);
  if (!bundle) throw new Error(`Course not found: ${courseId}`);
  return bundle;
}
