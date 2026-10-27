/** Nonverbal transcript annotations are not words spoken by the learner. Keep raw events separately. */
export function verbalTranscriptText(text: string): string {
  return text.replace(/\[\s*(?:lip smack(?:ing)?|laugh(?:ter|ing)?|cough(?:ing)?|sigh(?:ing)?|breath(?:ing)?|background noise)\s*\]/gi, " ").replace(/\s+/g, " ").trim();
}
