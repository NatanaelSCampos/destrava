import { compiledPackages } from "./generated/registry";
import { runtimeBundle } from "./runtime-package";

const bundles = compiledPackages.map(runtimeBundle);

export const defaultCourseId = bundles[0]?.course.id;
if (!defaultCourseId) throw new Error("No compiled courses are available.");

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
