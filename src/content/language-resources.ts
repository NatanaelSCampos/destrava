import type { ReviewStructure } from "./review-structures";
import type { ConversationScenario } from "./conversation-scenarios";
import type { NumberPrompt } from "@/domain/numbers/number-practice";
import type { VisualCue } from "./visual-vocabulary";
import type { ImageDescriptionScene } from "./image-description-scenes";
import type { AlphabetLetter, RegionalTopic } from "./fundamentals-types";

export type VocabularyItem = {
  id: string;
  term: string;
  translation: string;
  example: string;
  lessonId: string;
};

export type DictionaryEntry = {
  className?: string;
  senses: Array<{ meaning: string; example: string }>;
  aliases?: string[];
  regionalNote?: string | Record<string, string | undefined>;
};

export type LanguageResources = {
  courseId: string;
  languageCode: string;
  languageLabel: string;
  regionalContentHref?: string;
  vocabulary: VocabularyItem[];
  dictionary: Record<string, DictionaryEntry>;
  structures: ReviewStructure[];
  numbers: NumberPrompt[];
  numberCategoryLabels: Record<string, string>;
  conversationScenarios: ConversationScenario[];
  imageScenes: ImageDescriptionScene[];
  visualVocabulary: Record<string, VisualCue>;
  reviewClozeForms: Record<string, string[]>;
  alphabet: ReadonlyArray<AlphabetLetter>;
  regionalTopics: RegionalTopic[];
};
