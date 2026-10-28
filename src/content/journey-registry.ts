import editorial from "../../content/journeys/espanol-a-tu-paso-a1.json";
import { parseJourneyPresentation, type JourneyCourseStructure } from "./journey-presentation";

/** Compiled sidecars are opt-in. Installed runtimes never inherit metadata from a compiled course. */
export function findJourneyPresentation(
  course: JourneyCourseStructure,
  source: "compiled" | "installed" = "compiled",
) {
  if (source !== "compiled") return null;
  return parseJourneyPresentation(editorial, course).presentation;
}
