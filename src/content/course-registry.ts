import { frecuenciasA1 } from "./frecuencias-a1";
import { spanishResources } from "./spanish-resources";

// Server-side registration point. A new language supplies content and a resource pack;
// the study, review and dictionary engines consume the same interfaces.
const bundles = [{ course: frecuenciasA1, resources: spanishResources }];

export function findCourseBundle(courseId: string) {
  return bundles.find((bundle) => bundle.course.id === courseId);
}
