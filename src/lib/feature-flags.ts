export const featureFlags = {
  AI_TUTOR: process.env.NEXT_PUBLIC_FEATURE_AI_TUTOR !== "false",
  AI_WRITING: process.env.NEXT_PUBLIC_FEATURE_AI_WRITING !== "false",
  SPEAKING: process.env.NEXT_PUBLIC_FEATURE_SPEAKING !== "false",
  LISTENING: process.env.NEXT_PUBLIC_FEATURE_LISTENING !== "false",
  SPACED_REPETITION: process.env.NEXT_PUBLIC_FEATURE_SPACED_REPETITION !== "false",
} as const;

export function isActivityEnabled(type: string) {
  if (type === "speaking") return featureFlags.SPEAKING;
  if (type === "listening") return featureFlags.LISTENING;
  return true;
}
