// One-time preservation of the original Spanish lesson while changing its authoring format.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { frecuenciasA1 } from "../src/content/frecuencias-a1";
import { spanishResources } from "../src/content/spanish-resources";
import { spanishAlphabet } from "../src/content/spanish-alphabet";
import { regionalTopics } from "../src/content/spanish-regions";
import { adaptiveAssessmentBank } from "../src/content/adaptive-assessment-bank";
import { adaptiveSkillPlan } from "../src/domain/study/adaptive-assessment";
import { coursePackageSchema, languagePackageSchema } from "../src/content/contracts";

const languageRoot = join(process.cwd(), "content/languages/es");
const courseRoot = join(process.cwd(), "content/courses/frecuencias-a1");
function save(root: string, name: string, value: unknown) {
  const path = join(root, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const language = languagePackageSchema.parse({
  schemaVersion: "1.0", contentVersion: "1.0.0", id: "es",
  identity: { name: "Spanish", nativeName: "Español", iso639_1: "es" },
  writingSystem: { direction: "ltr", scripts: ["Latin"], caseSensitive: false },
  variants: [
    { id: "general", name: "Espanhol geral", default: true },
    { id: "spain", name: "Espanha" },
    { id: "mexico", name: "México" },
    { id: "argentina", name: "Argentina" },
  ],
  capabilities: {
    speechRecognition: true, textToSpeech: true, pronunciationAssessment: true,
    regionalVariants: true, romanization: false, tones: false, grammaticalGender: true,
  },
  speech: { defaultVariant: "general", providers: { azure: {
    general: { recognitionLocale: "es-ES", assessmentLocale: "es-ES", ttsLocale: "es-ES" },
    spain: { recognitionLocale: "es-ES", assessmentLocale: "es-ES", ttsLocale: "es-ES" },
    mexico: { recognitionLocale: "es-MX", assessmentLocale: "es-MX", ttsLocale: "es-MX" },
    argentina: { recognitionLocale: "es-AR", assessmentLocale: null, ttsLocale: "es-AR" },
  } } },
  normalization: {
    trimWhitespace: true, collapseWhitespace: true, caseInsensitive: true,
    ignoreTerminalPunctuation: true, ignoreDiacritics: false,
  },
  modules: {
    alphabet: { enabled: true, source: "fundamentals/alphabet.json" },
    numbers: { enabled: true, source: "fundamentals/numbers.json" },
    regionalVariants: { enabled: true, source: "fundamentals/regional-variants.json" },
  },
  strategies: { textTokenizer: "latin-word-v1", answerNormalizer: "default-latin-v1", numberParser: "spanish-numbers-v1" },
});
save(languageRoot, "manifest.json", language);
save(languageRoot, "fundamentals/alphabet.json", spanishAlphabet);
save(languageRoot, "fundamentals/numbers.json", {
  prompts: spanishResources.numbers, categoryLabels: spanishResources.numberCategoryLabels,
});
save(languageRoot, "fundamentals/regional-variants.json", regionalTopics);

const baseVocabulary = new Map(spanishResources.vocabulary.map((item) => [item.id, item]));
const lexicon = Object.entries(spanishResources.dictionary).map(([wordId, entry]) => {
  const base = baseVocabulary.get(wordId);
  return {
    id: wordId, language: "es", lemma: base?.term.split("/")[0].trim() ?? wordId,
    surface: base?.term ?? wordId, lessonId: base?.lessonId,
    meanings: entry.senses.map((sense, index) => ({
      id: `${wordId}.meaning.${index + 1}`, translations: { "pt-BR": [sense.meaning] },
    })),
    examples: entry.senses.map((sense) => ({ target: sense.example, translations: { "pt-BR": "Exemplo em espanhol" } })),
    className: entry.className, aliases: entry.aliases,
    regionalNote: entry.regionalNote,
    visualCue: spanishResources.visualVocabulary[wordId],
    clozeForms: spanishResources.reviewClozeForms[wordId],
  };
});
const concepts = frecuenciasA1.learningConcepts.map((concept) => ({
  id: concept.id, language: "es", type: "course_concept", name: concept.label,
}));
const units = frecuenciasA1.units.map((unit) => ({
  id: unit.id, slug: unit.slug, order: unit.number, title: unit.title,
  description: unit.description, active: unit.active, objectives: unit.objectives,
  skills: [...new Set(unit.lessons.flatMap((lesson) => lesson.activities.map((activity) => activity.skill)))],
  introduces: {
    concepts: [...new Set(unit.lessons.flatMap((lesson) => lesson.activities.flatMap((activity) => activity.conceptIds)))],
    vocabulary: spanishResources.vocabulary.filter((word) => unit.lessons.some((lesson) => lesson.id === word.lessonId)).map((word) => word.id),
  },
  assessmentId: `${frecuenciasA1.id}.${unit.id}.diagnostic`,
  lessons: unit.lessons.map((lesson) => ({
    id: lesson.id, slug: lesson.slug, title: lesson.title, order: lesson.order,
    objectives: [lesson.description], eyebrow: lesson.eyebrow,
    description: lesson.description, minutes: lesson.minutes, active: lesson.active,
    activities: lesson.activities.map((activity) => {
      const { id, type, title, prompt, skill, conceptIds, minutes, normalization, ...payload } = activity;
      return {
        id, type, title, prompt, minutes, skills: [skill], concepts: conceptIds,
        payload,
        evaluation: "answer" in activity ? { strategy: "exact-normalized", ...(normalization ? { normalization } : {}) } : undefined,
        provenance: activity.source ? {
          origin: "adapted", sources: [{ type: "book", reference: `${activity.source.book}:${activity.source.pages}` }],
          review: { status: "approved" },
        } : { origin: "human", review: { status: "approved" } },
      };
    }),
  })),
}));
const missions = spanishResources.conversationScenarios.map((scenario) => ({
  id: scenario.id, scenario: scenario.id, level: frecuenciasA1.level,
  objectives: scenario.objectives.map((item) => item.id),
  recommendedConcepts: scenario.focusConceptIds ?? [], title: scenario.title,
  setting: scenario.setting, character: scenario.character,
  opening: scenario.opening, objectiveDetails: scenario.objectives,
}));
const roleplays = missions.map((mission) => ({
  id: `roleplay.${mission.id}`, scenario: mission.scenario,
  level: mission.level, character: { role: mission.character },
  objectives: mission.objectives, constraints: { maxVocabularyLevel: mission.level, allowHints: true },
}));
const assessments = [{
  id: units[0].assessmentId, type: "adaptive_diagnostic", unitId: units[0].id,
  skillWeights: Object.fromEntries([...new Set(adaptiveSkillPlan)].map((skill) => [skill, adaptiveSkillPlan.filter((item) => item === skill).length / adaptiveSkillPlan.length])),
  passingPolicy: { overall: 0.75, minimumBySkill: Object.fromEntries([...new Set(adaptiveSkillPlan)].map((skill) => [skill, 0.6])) },
  skillPlan: adaptiveSkillPlan, bank: adaptiveAssessmentBank, activities: [],
}];
const media = spanishResources.imageScenes.map((scene) => ({
  id: scene.id, type: "image", src: scene.image,
  metadata: { title: scene.title, alt: scene.alt, prompt: scene.prompt, facts: scene.facts },
}));
const course = coursePackageSchema.parse({
  schemaVersion: "1.0", contentVersion: "1.0.0", id: frecuenciasA1.id,
  slug: frecuenciasA1.slug, sourceLanguage: "pt-BR", targetLanguage: "es", defaultVariant: "general",
  framework: { name: "CEFR", entryLevel: "A0", exitLevel: frecuenciasA1.level },
  track: "general", title: frecuenciasA1.title, description: frecuenciasA1.description,
  learningGoals: ["basic_communication", "daily_life"], units, concepts, lexicon,
  missions, roleplays, assessments, media,
  practice: { reviewStructures: spanishResources.structures },
  provenance: { origin: "adapted", review: { status: "approved" } },
});
const { units: courseUnits, concepts: courseConcepts, lexicon: courseLexicon,
  missions: courseMissions, roleplays: courseRoleplays, assessments: courseAssessments,
  media: courseMedia, ...manifest } = course;
save(courseRoot, "course.json", manifest);
for (const [index, unit] of courseUnits.entries())
  save(courseRoot, `units/u${String(index + 1).padStart(2, "0")}.json`, unit);
save(courseRoot, "concepts.json", courseConcepts);
save(courseRoot, "lexicon.json", courseLexicon);
save(courseRoot, "missions.json", courseMissions);
save(courseRoot, "roleplays.json", courseRoleplays);
save(courseRoot, "assessments.json", courseAssessments);
save(courseRoot, "media.json", courseMedia);
console.log(`Preserved ${courseUnits.length} unit, ${courseUnits[0].lessons.length} lessons, ${courseLexicon.length} lexicon entries.`);
