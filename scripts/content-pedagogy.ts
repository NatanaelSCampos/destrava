import { loadContent } from "./content-loader";
import { normalizeAnswer } from "../src/domain/activities/grader";

const warnings: string[] = [];
const errors: string[] = [];
for (const { course, language } of loadContent()) {
  const introducedConcepts = new Set<string>();
  const introducedWords = new Set<string>();
  for (const unit of [...course.units].sort((a, b) => a.order - b.order)) {
    for (const concept of unit.introduces?.concepts ?? []) introducedConcepts.add(concept);
    for (const word of unit.introduces?.vocabulary ?? []) introducedWords.add(word);
    for (const lesson of [...unit.lessons].sort((a, b) => a.order - b.order)) {
      for (const activity of lesson.activities) {
        const label = `${course.id}/${activity.id}`;
        for (const concept of activity.concepts)
          if (!introducedConcepts.has(concept)) warnings.push(`${label}: concept ${concept} appears before introduction`);
        if (activity.type === "listening" && !activity.skills.includes("listening"))
          errors.push(`${label}: listening activity lacks listening skill`);
        if (activity.type === "listening" && !language.capabilities.textToSpeech &&
            !(activity.media ?? []).some((id) => course.media.some((item) => item.id === id && item.type === "audio")))
          errors.push(`${label}: listening activity has no audio source`);
        if (activity.type === "speaking" && !activity.skills.includes("speaking"))
          errors.push(`${label}: speaking activity lacks speaking skill`);
        if (activity.type === "speaking" && !language.capabilities.speechRecognition)
          errors.push(`${label}: speaking activity requires speech recognition`);
        if (activity.type === "writing" && !activity.skills.includes("writing"))
          errors.push(`${label}: writing activity lacks writing skill`);
        const payload = activity.payload;
        const answer = typeof payload.answer === "string" ? payload.answer : null;
        if (answer !== null && !answer.trim()) errors.push(`${label}: empty answer`);
        if (Array.isArray(payload.options)) {
          const options = payload.options.filter((value): value is string => typeof value === "string");
          const normalized = options.map((option) => normalizeAnswer(option, language.normalization));
          if (new Set(normalized).size !== options.length)
            errors.push(`${label}: two options become identical after normalization`);
          if (options.length < 2) errors.push(`${label}: too few options`);
        }
        const accepted = Array.isArray(payload.accepted) ? payload.accepted.filter((value): value is string => typeof value === "string") : [];
        if (answer !== null && accepted.some((value) => normalizeAnswer(value, language.normalization) === normalizeAnswer(answer, language.normalization)))
          warnings.push(`${label}: accepted answer duplicates the primary answer`);
        const longText = typeof payload.body === "string" ? payload.body : "";
        if (longText.split(/\s+/).length > 350 && course.framework.exitLevel === "A1")
          warnings.push(`${label}: long reading text for A1; review pedagogically`);
      }
    }
  }
  for (const word of course.lexicon.filter((item) => item.lessonId))
    if (!introducedWords.has(word.id)) warnings.push(`${course.id}/${word.id}: vocabulary has no unit introduction`);
}
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
console.log(`Pedagogy review: ${errors.length} error(s), ${warnings.length} warning(s).`);
if (errors.length) process.exitCode = 1;
