import {
  reconstructionSchema,
  textMeasureSchema,
  textRequirementSchema,
  legacyReconstruction,
  type Reconstruction,
  type TextMeasure,
} from "@/content/text-strategies";

export class TextRepresentationError extends Error {
  constructor(
    message: string,
    public code: "DATA_INVALID" | "UNAVAILABLE" = "DATA_INVALID",
  ) {
    super(message);
  }
}
export type OrderingToken = Readonly<{ id: string; text: string; position: number }>;
export function assertWellFormedText(value: unknown): asserts value is string {
  if (typeof value !== "string") throw new TextRepresentationError("Text must be a string.");
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new TextRepresentationError("Unpaired UTF-16 surrogate.");
    } else if (unit >= 0xdc00 && unit <= 0xdfff)
      throw new TextRepresentationError("Unpaired UTF-16 surrogate.");
  }
}
export function orderingTokens(activityId: string, words: readonly string[]): OrderingToken[] {
  if (!activityId || !Array.isArray(words) || words.some((word) => typeof word !== "string"))
    throw new TextRepresentationError("Invalid ordering tokens.");
  words.forEach(assertWellFormedText);
  return words.map((text, position) => ({
    id: JSON.stringify([activityId, position]),
    text,
    position,
  }));
}
export function selectedTokens(tokens: readonly OrderingToken[], ids: readonly string[]) {
  if (
    !Array.isArray(tokens) ||
    !Array.isArray(ids) ||
    ids.some((id) => typeof id !== "string") ||
    tokens.some(
      (token) =>
        !token ||
        typeof token.id !== "string" ||
        typeof token.text !== "string" ||
        !Number.isInteger(token.position) ||
        token.position < 0,
    )
  )
    throw new TextRepresentationError("Invalid token identities.");
  if (
    new Set(tokens.map((token) => token.id)).size !== tokens.length ||
    new Set(ids).size !== ids.length
  )
    throw new TextRepresentationError("Each occurrence may be selected once.");
  const byId = new Map(tokens.map((token) => [token.id, token]));
  return ids.map((id) => {
    const token = byId.get(id);
    if (!token) throw new TextRepresentationError("Unknown token identity.");
    return token;
  });
}
export function reconstructText(
  parts: readonly string[],
  reconstruction: Reconstruction = legacyReconstruction,
) {
  const parsed = reconstructionSchema.safeParse(reconstruction);
  if (!parsed.success || !Array.isArray(parts) || parts.some((text) => typeof text !== "string"))
    throw new TextRepresentationError("Invalid reconstruction strategy or elements.");
  parts.forEach(assertWellFormedText);
  assertWellFormedText(parsed.data.separator);
  return parts.join(parsed.data.separator);
}
export function orderingAnswer(
  tokens: readonly OrderingToken[],
  ids: readonly string[],
  reconstruction?: Reconstruction,
) {
  return reconstructText(
    selectedTokens(tokens, ids).map((token) => token.text),
    reconstruction,
  );
}
export function textMeasureAvailability(raw: TextMeasure): { available: boolean; reason?: string } {
  const parsed = textMeasureSchema.safeParse(raw);
  if (!parsed.success) throw new TextRepresentationError("Unknown text measure.");
  const measure = parsed.data;
  if (measure.strategy === "code_points" || measure.strategy === "whitespace_units")
    return { available: true };
  let locale: string | undefined;
  if (measure.strategy === "intl_words") {
    try {
      locale = Intl.getCanonicalLocales(measure.locale)[0];
    } catch {
      throw new TextRepresentationError("Invalid BCP 47 locale for word segmentation.");
    }
  }
  if (typeof Intl.Segmenter !== "function")
    return { available: false, reason: "Intl.Segmenter is not available in this runtime." };
  if (locale) {
    if (!Intl.Segmenter.supportedLocalesOf([locale], { localeMatcher: "lookup" }).length)
      return {
        available: false,
        reason: "The requested segmentation locale is not supported by this runtime.",
      };
  }
  return { available: true };
}
export function measureText(text: string, measure: TextMeasure) {
  assertWellFormedText(text);
  const support = textMeasureAvailability(measure);
  if (!support.available) throw new TextRepresentationError(support.reason!, "UNAVAILABLE");
  switch (measure.strategy) {
    case "whitespace_units":
      return text.trim() ? text.trim().split(/\s+/u).length : 0;
    case "code_points":
      return Array.from(text).length;
    case "graphemes":
      return Array.from(new Intl.Segmenter("und", { granularity: "grapheme" }).segment(text))
        .length;
    case "intl_words":
      return Array.from(
        new Intl.Segmenter(measure.locale, { granularity: "word" }).segment(text),
      ).filter((item) => item.isWordLike).length;
  }
}
export function writingRequirement(activity: { minWords?: number; textRequirement?: unknown }) {
  if (activity.textRequirement !== undefined) {
    if (activity.minWords !== undefined)
      throw new TextRepresentationError("Declare textRequirement or minWords, not both.");
    const parsed = textRequirementSchema.safeParse(activity.textRequirement);
    if (!parsed.success) throw new TextRepresentationError("Invalid writing limits.");
    return parsed.data;
  }
  if (
    typeof activity.minWords !== "number" ||
    !Number.isFinite(activity.minWords) ||
    activity.minWords < 0
  )
    throw new TextRepresentationError("Writing requires an explicit minimum.");
  return {
    measure: { strategy: "whitespace_units" } as const,
    minimum: activity.minWords,
    maximum: undefined,
  };
}
export function evaluateWritingText(
  text: string,
  activity: { minWords?: number; textRequirement?: unknown },
) {
  const requirement = writingRequirement(activity),
    count = measureText(text, requirement.measure);
  return {
    count,
    requirement,
    meetsMinimum: count >= requirement.minimum,
    meetsMaximum: requirement.maximum === undefined || count <= requirement.maximum,
    accepted:
      count >= requirement.minimum &&
      (requirement.maximum === undefined || count <= requirement.maximum),
  };
}
export function textMeasureLabel(measure: TextMeasure) {
  return {
    whitespace_units: "unidades por espaços",
    code_points: "pontos de código",
    graphemes: "grafemas",
    intl_words: "palavras segmentadas",
  }[measure.strategy];
}
