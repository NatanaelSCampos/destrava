/** Server-owned engineering estimate. USD provider costs are not a retail price. */
export const ORAL_PRICING = Object.freeze({
  version: "oral-2026-10-28-v1",
  model: "gpt-audio",
  checkedAt: "2026-10-28",
  audioInputUsdPerMillion: 32,
  textInputUsdPerMillion: 2.5,
  textOutputUsdPerMillion: 10,
  // Conservative planning assumption; replace with measured input usage before enabling paid execution.
  estimatedAudioTokensPerSecond: 12.5,
  textInputTokensPerSession: 1200,
  maxOutputTokensPerSession: 1800,
  contingency: 1.35,
  providerBudgetUsdPerCredit: 0.01,
  source: "https://developers.openai.com/api/docs/models/gpt-audio",
});
export function estimateOralCredits(seconds: number, sessions = 1) {
  if (
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > 4800 ||
    !Number.isInteger(sessions) ||
    sessions < 1 ||
    sessions > 10
  )
    throw new Error("Invalid audio selection");
  const audioTokens = Math.ceil(seconds * ORAL_PRICING.estimatedAudioTokensPerSecond);
  const estimatedProviderUsd =
    (audioTokens * ORAL_PRICING.audioInputUsdPerMillion +
      sessions * ORAL_PRICING.textInputTokensPerSession * ORAL_PRICING.textInputUsdPerMillion +
      sessions * ORAL_PRICING.maxOutputTokensPerSession * ORAL_PRICING.textOutputUsdPerMillion) /
    1_000_000;
  return {
    seconds: Math.ceil(seconds),
    sessions,
    pricingVersion: ORAL_PRICING.version,
    model: ORAL_PRICING.model,
    estimatedProviderUsd: Math.round(estimatedProviderUsd * 1e6) / 1e6,
    credits: Math.max(
      1,
      Math.ceil(
        (estimatedProviderUsd * ORAL_PRICING.contingency) / ORAL_PRICING.providerBudgetUsdPerCredit,
      ),
    ),
    estimateOnly: true as const,
  };
}
export function oralCreditAccess(balance: number, required: number, audioReady: boolean) {
  if (
    !Number.isSafeInteger(balance) ||
    balance < 0 ||
    !Number.isSafeInteger(required) ||
    required < 1
  )
    throw new Error("Invalid credits");
  return {
    balance,
    required,
    missing: Math.max(0, required - balance),
    allowed: false as const,
    reason:
      balance < required
        ? "insufficient_credits"
        : !audioReady
          ? "audio_unavailable"
          : "not_enabled",
    purchaseAvailable: false as const,
  };
}
