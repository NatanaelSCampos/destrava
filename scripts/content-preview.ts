import { loadContent } from "./content-loader";

const requested = process.argv.find((arg, index) => process.argv[index - 1] === "--course");
const bundles = loadContent().filter((bundle) => !requested || bundle.course.id === requested);
if (!bundles.length) throw new Error(`Course not found: ${requested ?? "none"}`);
for (const { course, language, moduleData } of bundles) {
  console.log(`${course.title} (${course.id}) · ${language.identity.nativeName} · ${course.framework.exitLevel}`);
  console.log(`Language traits: ${Object.entries(language.linguisticFeatures).filter(([, enabled]) => enabled).map(([name]) => name).join(", ") || "none"}`);
  console.log(`Speech coverage (not engine support): ${Object.entries(language.speech.support).filter(([, enabled]) => enabled).map(([name]) => name).join(", ") || "none"}`);
  console.log(`Modules: ${Object.keys(moduleData).join(", ") || "none"}`);
  for (const unit of [...course.units].sort((a, b) => a.order - b.order)) {
    console.log(`  ${unit.order}. ${unit.title} · ${unit.lessons.length} lessons`);
    for (const lesson of [...unit.lessons].sort((a, b) => a.order - b.order))
      console.log(`    ${lesson.order}. ${lesson.title}: ${lesson.activities.map((item) => `${item.type}(${item.id})`).join(", ")}`);
  }
  console.log(`Assessment: ${course.assessments.map((item) => `${item.id} · ${item.purpose}/${item.method} (${item.method === "adaptive" ? item.skillPlan.length : item.activityIds.length} items)`).join(", ") || "none"}`);
}
