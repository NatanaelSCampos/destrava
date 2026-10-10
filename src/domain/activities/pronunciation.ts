export type PronunciationFeedback = {
  speechContext?: {
    requestedVariant: string;
    operationalLocale: string;
    compatibility: "declared_mapping";
  };
  referenceText: string;
  recognizedText: string;
  accuracy: number;
  fluency: number;
  completeness: number;
  words: Array<{ text: string; accuracy: number | null; errorType: string }>;
};
