import type { LanguageResources } from "./language-resources";
import { vocabularySeed } from "./frecuencias-a1";
import { reviewStructures } from "./review-structures";
import { conversationScenarios } from "./conversation-scenarios";
import { spanishNumberPrompts, spanishNumberCategoryLabels } from "./spanish-numbers";
import { reviewClozeForms, visualVocabulary } from "./visual-vocabulary";
import { regionalTopics, regionalVocabularyNote } from "./spanish-regions";
import { spanishDictionary } from "./spanish-dictionary";
import { imageDescriptionScenes } from "./image-description-scenes";
import { spanishAlphabet } from "./spanish-alphabet";

export const spanishResources: LanguageResources = {
  learningOptions: { supportedGoals: ["general"], contexts: [], skillFloors: {} },
  courseId: "frecuencias-a1",
  languageCode: "es",
  languageLabel: "Espanhol",
  regionalContentHref: "/basics?topic=regions",
  vocabulary: vocabularySeed.map(({ spanish, ...item }) => ({ ...item, term: spanish })),
  dictionary: {
    ...Object.fromEntries(vocabularySeed.map((item) => [item.id, {
      senses: [{ meaning: item.translation, example: item.example }],
      aliases: item.spanish.split("/").map((form) => form.trim()),
      regionalNote: {
        general: regionalVocabularyNote(item.id, "general"),
        spain: regionalVocabularyNote(item.id, "spain"),
        mexico: regionalVocabularyNote(item.id, "mexico"),
        argentina: regionalVocabularyNote(item.id, "argentina"),
      },
    }])),
    ...spanishDictionary,
    llamarse: {
      ...spanishDictionary.llamarse,
      regionalNote: { argentina: "Na Argentina, a pergunta informal costuma ser ‘¿Cómo te llamás vos?’." },
    },
    ...Object.fromEntries(regionalTopics.flatMap((topic) =>
      topic.variants.map((variant) => [variant.term.toLowerCase(), {
        senses: [{ meaning: topic.meaning, example: variant.example }],
        aliases: topic.variants.map((entry) => entry.term),
        regionalNote: topic.note,
      }]),
    )),
  },
  structures: reviewStructures,
  numbers: spanishNumberPrompts,
  numberCategoryLabels: spanishNumberCategoryLabels,
  conversationScenarios,
  imageScenes: imageDescriptionScenes,
  visualVocabulary,
  reviewClozeForms,
  alphabet: spanishAlphabet,
  regionalTopics,
};
