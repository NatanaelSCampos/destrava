export type PronunciationFeedback = {
  referenceText: string;
  recognizedText: string;
  accuracy: number;
  fluency: number;
  completeness: number;
  words: Array<{ text: string; accuracy: number | null; errorType: string }>;
};
