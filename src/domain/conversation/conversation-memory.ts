import {
  conversationSessionAnalysisSchema,
  conversationDimensionNames,
  CONVERSATION_RUBRIC_VERSION,
  type ConversationDimensionName,
  type ConversationEvidenceRef,
  type ConversationObservation,
} from "@/content/conversation-assessment-contract";
import type { LiveTurn } from "./live-contract";
import { verbalTranscriptText } from "./transcript-text";

export type ConversationMemorySession = {
  id: string;
  userId: string;
  languageCode: string;
  topic: string;
  startedAt: string;
  endedAt: string;
  turns: readonly LiveTurn[];
  analysis: unknown;
  /** Provider/operator evidence, never inferred from a model's desired score. */
  uncertainTurnIds?: readonly string[];
  modelPhrases?: readonly string[];
};
export type BoundConversationEvidence = ConversationEvidenceRef & { inputMode: "speech" | "text" };
export type BoundConversationObservation = ConversationObservation & {
  inputMode: "speech" | "text";
};
export type ConversationEvidenceStats = {
  targetSpeechWords: number;
  targetSpeechTurns: number;
  independentSpeechWords: number;
};
export type ValidatedConversationAnalysis = {
  rubricVersion: typeof CONVERSATION_RUBRIC_VERSION;
  sessionId: string;
  userId: string;
  languageCode: string;
  topic: string;
  endedAt: string;
  dimensions: Record<
    ConversationDimensionName,
    { score: number | null; evidence: BoundConversationEvidence[]; note: string }
  >;
  observations: BoundConversationObservation[];
  evidenceStats: ConversationEvidenceStats;
  score: number | null;
  summary: string;
  strengths: string[];
  nextPractice: string[];
};
export type ConversationMemoryItem = {
  key: string;
  kind: ConversationObservation["kind"];
  label: string;
  state: "observed" | "practising" | "improving" | "consolidated";
  firstSeenAt: string;
  lastSeenAt: string;
  difficultyCount: number;
  independentSuccessCount: number;
  supportedSuccessCount: number;
  lastOutcome: ConversationObservation["outcome"];
  reactivations: number;
  examples: Array<{
    sessionId: string;
    turnId: string;
    quote: string;
    note: string;
    outcome: ConversationObservation["outcome"];
    inputMode: "speech" | "text";
  }>;
};
export type ConversationMemoryProfile = {
  userId: string;
  languageCode: string;
  rubricVersion: typeof CONVERSATION_RUBRIC_VERSION;
  index: {
    score: number | null;
    experimental: true;
    observedDimensions: ConversationDimensionName[];
  };
  confidence: { score: number; label: "initial" | "forming" | "consistent"; displayLabel: string };
  evidenceStats: ConversationEvidenceStats & { sessions: number; days: number; topics: number };
  items: ConversationMemoryItem[];
  priorities: ConversationMemoryItem[];
  progress: ConversationMemoryItem[];
  trajectory: Array<{
    sessionId: string;
    endedAt: string;
    topic: string;
    score: number | null;
    targetSpeechWords: number;
    summary: string;
    strengths: string[];
    nextPractice: string[];
  }>;
  preferences: Readonly<Record<string, unknown>>;
  issues: string[];
};
const DAY = 86400000;
const normal = (text: string) =>
  verbalTranscriptText(text).normalize("NFC").toLowerCase().replace(/\s+/gu, " ").trim();
/** Dialects and catalog-specific suffixes share one language memory; callers must supply the real target-language code. */
export function conversationMemoryLanguage(code: string): string {
  return code.trim().normalize("NFKC").toLowerCase().split(/[-_]/u)[0];
}
function wordCount(text: string, language: string): number {
  try {
    return [...new Intl.Segmenter(language, { granularity: "word" }).segment(text)].filter(
      (segment) => segment.isWordLike,
    ).length;
  } catch {
    return (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  }
}
function boundRef(
  ref: ConversationEvidenceRef,
  session: ConversationMemorySession,
): BoundConversationEvidence | null {
  if (ref.language !== "target") return null;
  const index = session.turns.findIndex((turn) => turn.id === ref.turnId);
  const turn = session.turns[index];
  const quote = normal(ref.quote);
  if (!turn || turn.role !== "student" || !quote || !normal(turn.text).includes(quote)) return null;
  const full = normal(turn.text);
  const preceding = session.turns
    .slice(0, index)
    .filter((item) => item.role === "partner")
    .at(-1);
  const repeated =
    (session.modelPhrases ?? []).some(
      (model) => normal(model) === full || normal(model) === quote,
    ) ||
    Boolean(
      preceding &&
      (normal(preceding.text) === full ||
        (wordCount(full, session.languageCode) >= 2 && normal(preceding.text).includes(full))),
    );
  const support =
    session.uncertainTurnIds?.includes(turn.id) || ref.support === "uncertain"
      ? "uncertain"
      : repeated
        ? "model_repeat"
        : ref.support;
  return {
    ...ref,
    quote: verbalTranscriptText(ref.quote).normalize("NFC"),
    support,
    inputMode: turn.inputMode === "speech" ? "speech" : "text",
  };
}
function evidenceStats(
  refs: readonly BoundConversationEvidence[],
  turns: readonly LiveTurn[],
  language: string,
): ConversationEvidenceStats {
  function count(independent: boolean) {
    const intervals = new Map<string, Array<[number, number]>>();
    for (const ref of refs) {
      if (
        ref.inputMode !== "speech" ||
        ["uncertain", "model_repeat"].includes(ref.support) ||
        (independent && ref.support !== "independent")
      )
        continue;
      const turn = turns.find((item) => item.id === ref.turnId)!;
      const start = normal(turn.text).indexOf(normal(ref.quote));
      if (start < 0) continue;
      const parts = intervals.get(ref.turnId) ?? [];
      parts.push([start, start + normal(ref.quote).length]);
      intervals.set(ref.turnId, parts);
    }
    let words = 0;
    for (const [id, parts] of intervals) {
      parts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const merged: Array<[number, number]> = [];
      for (const part of parts) {
        const last = merged.at(-1);
        if (last && part[0] <= last[1]) last[1] = Math.max(last[1], part[1]);
        else merged.push([...part]);
      }
      const text = normal(turns.find((turn) => turn.id === id)!.text);
      words += merged.reduce(
        (sum, [from, to]) => sum + wordCount(text.slice(from, to), language),
        0,
      );
    }
    return { words, turns: intervals.size };
  }
  const total = count(false),
    independent = count(true);
  return {
    targetSpeechWords: total.words,
    targetSpeechTurns: total.turns,
    independentSpeechWords: independent.words,
  };
}

/** Binds model claims to the actual learner transcript. Semantic language/correctness classification still requires an evaluator. */
export function validateConversationAnalysis(
  raw: unknown,
  session: ConversationMemorySession,
): { analysis: ValidatedConversationAnalysis | null; issues: string[] } {
  const parsed = conversationSessionAnalysisSchema.safeParse(raw);
  const issues: string[] = [];
  if (!parsed.success)
    return {
      analysis: null,
      issues: parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message),
    };
  const value = parsed.data,
    languageCode = conversationMemoryLanguage(session.languageCode);
  if (
    value.sessionId !== session.id ||
    conversationMemoryLanguage(value.languageCode) !== languageCode
  )
    return { analysis: null, issues: ["Analysis/session language or identity mismatch."] };
  if (
    !languageCode ||
    !session.userId ||
    !Number.isFinite(Date.parse(session.startedAt)) ||
    !Number.isFinite(Date.parse(session.endedAt)) ||
    Date.parse(session.endedAt) < Date.parse(session.startedAt)
  )
    return { analysis: null, issues: ["Invalid session scope or chronology."] };
  if (new Set(session.turns.map((turn) => turn.id)).size !== session.turns.length)
    return { analysis: null, issues: ["Ambiguous duplicate transcript turn IDs."] };
  const dimensions = {} as ValidatedConversationAnalysis["dimensions"];
  const refs: BoundConversationEvidence[] = [];
  for (const name of conversationDimensionNames) {
    const source = value.dimensions[name];
    const evidence = source.evidence
      .map((ref) => boundRef(ref, session))
      .filter((ref): ref is BoundConversationEvidence => Boolean(ref));
    const usable = evidence.filter(
      (ref) =>
        ref.inputMode === "speech" &&
        !["model_repeat", "uncertain"].includes(ref.support) &&
        (name !== "autonomy" || ref.support === "independent"),
    );
    dimensions[name] = {
      score: source.score !== null && usable.length ? source.score : null,
      evidence: usable,
      note: source.note,
    };
    if (source.score !== null && !usable.length)
      issues.push("No reliable target-language spoken evidence for " + name + ".");
    refs.push(...usable);
  }
  const observations: BoundConversationObservation[] = [];
  const seen = new Set<string>();
  for (const observation of value.observations) {
    const ref = boundRef(observation, session);
    if (!ref) {
      issues.push("Observation not grounded in target-language learner words: " + observation.key);
      continue;
    }
    let outcome = observation.outcome;
    if (["uncertain", "model_repeat"].includes(ref.support)) outcome = "uncertain";
    else if (outcome === "independent_success" && ref.support !== "independent")
      outcome = "supported_success";
    const item = { ...observation, ...ref, outcome };
    const identity = JSON.stringify([
      item.kind,
      normal(item.key),
      item.turnId,
      normal(item.quote),
      item.outcome,
    ]);
    if (seen.has(identity)) continue;
    seen.add(identity);
    observations.push(item);
    refs.push(ref);
  }
  const stats = evidenceStats(refs, session.turns, languageCode);
  const scored = conversationDimensionNames
    .map((name) => dimensions[name].score)
    .filter((score): score is number => score !== null);
  const score =
    stats.targetSpeechWords >= 12 && stats.targetSpeechTurns >= 2 && scored.length >= 3
      ? Math.round((scored.reduce((sum, item) => sum + item, 0) / scored.length) * 25)
      : null;
  return {
    analysis: {
      rubricVersion: CONVERSATION_RUBRIC_VERSION,
      sessionId: session.id,
      userId: session.userId,
      languageCode,
      topic: session.topic.trim().slice(0, 160),
      endedAt: session.endedAt,
      dimensions,
      observations,
      evidenceStats: stats,
      score,
      summary: value.summary,
      strengths: value.strengths,
      nextPractice: value.nextPractice,
    },
    issues,
  };
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stable((value as Record<string, unknown>)[key]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
const outcomeRank = {
  difficulty: 0,
  independent_success: 1,
  supported_success: 2,
  uncertain: 3,
} as const;

/** Rebuild from persisted sessions; there is no mutable hidden memory, clock, network or course-ID dependency. */
export function buildConversationMemoryProfile(input: {
  userId: string;
  languageCode: string;
  sessions: readonly ConversationMemorySession[];
  now: string;
  preferences?: Readonly<Record<string, unknown>>;
}): ConversationMemoryProfile {
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) throw new Error("A valid explicit now is required.");
  const languageCode = conversationMemoryLanguage(input.languageCode),
    issues: string[] = [];
  const byId = new Map<string, ConversationMemorySession[]>();
  for (const session of input.sessions) {
    if (
      session.userId !== input.userId ||
      conversationMemoryLanguage(session.languageCode) !== languageCode
    )
      continue;
    const group = byId.get(session.id) ?? [];
    group.push(session);
    byId.set(session.id, group);
  }
  const analyses: ValidatedConversationAnalysis[] = [];
  for (const id of [...byId.keys()].sort()) {
    const group = byId.get(id)!;
    const versions = new Set(
      group.map((session) =>
        stable({
          id: session.id,
          userId: session.userId,
          languageCode: conversationMemoryLanguage(session.languageCode),
          topic: session.topic,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          turns: session.turns,
          analysis: session.analysis,
          uncertainTurnIds: session.uncertainTurnIds ?? [],
          modelPhrases: session.modelPhrases ?? [],
        }),
      ),
    );
    if (versions.size !== 1) {
      issues.push(
        "Conflicting persisted versions of session " + id + "; reconcile before aggregation.",
      );
      continue;
    }
    const session = group[0];
    if (Date.parse(session.endedAt) > now + 300000) {
      issues.push("Future session excluded: " + id);
      continue;
    }
    const result = validateConversationAnalysis(session.analysis, session);
    issues.push(...result.issues.map((issue) => id + ": " + issue));
    if (result.analysis) analyses.push(result.analysis);
  }
  analyses.sort(
    (a, b) =>
      Date.parse(a.endedAt) - Date.parse(b.endedAt) || a.sessionId.localeCompare(b.sessionId),
  );
  const items = new Map<string, ConversationMemoryItem>();
  const streak = new Map<string, { count: number; days: Set<string>; topics: Set<string> }>();
  for (const analysis of analyses) {
    const grouped = new Map<string, BoundConversationObservation[]>();
    for (const observation of analysis.observations) {
      const key = observation.kind + ":" + normal(observation.key),
        group = grouped.get(key) ?? [];
      group.push(observation);
      grouped.set(key, group);
    }
    for (const [key, observations] of grouped) {
      const observation = [...observations].sort(
        (a, b) =>
          outcomeRank[a.outcome] - outcomeRank[b.outcome] ||
          (a.inputMode === "speech" ? 0 : 1) - (b.inputMode === "speech" ? 0 : 1) ||
          a.turnId.localeCompare(b.turnId) ||
          a.quote.localeCompare(b.quote),
      )[0];
      const previous = items.get(key);
      const item: ConversationMemoryItem = previous ?? {
        key,
        kind: observation.kind,
        label: observation.label,
        state: "observed",
        firstSeenAt: analysis.endedAt,
        lastSeenAt: analysis.endedAt,
        difficultyCount: 0,
        independentSuccessCount: 0,
        supportedSuccessCount: 0,
        lastOutcome: "uncertain",
        reactivations: 0,
        examples: [],
      };
      item.lastSeenAt = analysis.endedAt;
      item.label = observation.label;
      item.lastOutcome = observation.outcome;
      let run = streak.get(key) ?? { count: 0, days: new Set<string>(), topics: new Set<string>() };
      if (observation.outcome === "difficulty") {
        if (item.state === "consolidated") item.reactivations++;
        item.difficultyCount++;
        item.state = "practising";
        run = { count: 0, days: new Set(), topics: new Set() };
      } else if (observation.outcome === "independent_success") {
        item.independentSuccessCount++;
        if (observation.inputMode === "speech") {
          run.count++;
          run.days.add(new Date(analysis.endedAt).toISOString().slice(0, 10));
          run.topics.add(normal(analysis.topic));
        }
        if (run.count >= 3 && run.days.size >= 2 && run.topics.size >= 2)
          item.state = "consolidated";
        else if (item.state !== "consolidated") item.state = "improving";
      } else if (observation.outcome === "supported_success") {
        item.supportedSuccessCount++;
        if (item.state === "observed") item.state = "practising";
      }
      item.examples = [
        ...item.examples,
        {
          sessionId: analysis.sessionId,
          turnId: observation.turnId,
          quote: observation.quote,
          note: observation.note,
          outcome: observation.outcome,
          inputMode: observation.inputMode,
        },
      ].slice(-3);
      streak.set(key, run);
      items.set(key, item);
    }
  }
  const list = [...items.values()].sort((a, b) => a.key.localeCompare(b.key));
  const scored = analyses.filter((item) => item.score !== null);
  const observedDimensions = conversationDimensionNames.filter((name) =>
    scored.some((analysis) => analysis.dimensions[name].score !== null),
  );
  const weights = scored.map(
    (item) =>
      Math.pow(0.5, Math.max(0, now - Date.parse(item.endedAt)) / (30 * DAY)) *
      Math.sqrt(Math.min(200, item.evidenceStats.targetSpeechWords) / 200),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const score =
    totalWeight > 0
      ? Math.round(scored.reduce((sum, item, i) => sum + item.score! * weights[i], 0) / totalWeight)
      : null;
  const evidence = analyses.filter((item) => item.evidenceStats.targetSpeechWords > 0);
  const stats = {
    targetSpeechWords: evidence.reduce(
      (sum, item) => sum + item.evidenceStats.targetSpeechWords,
      0,
    ),
    targetSpeechTurns: evidence.reduce(
      (sum, item) => sum + item.evidenceStats.targetSpeechTurns,
      0,
    ),
    independentSpeechWords: evidence.reduce(
      (sum, item) => sum + item.evidenceStats.independentSpeechWords,
      0,
    ),
    sessions: evidence.length,
    days: new Set(evidence.map((item) => new Date(item.endedAt).toISOString().slice(0, 10))).size,
    topics: new Set(evidence.map((item) => normal(item.topic)).filter(Boolean)).size,
  };
  const mean = scored.length
    ? scored.reduce((sum, item) => sum + item.score!, 0) / scored.length
    : 0;
  const deviation = scored.length
    ? Math.sqrt(scored.reduce((sum, item) => sum + (item.score! - mean) ** 2, 0) / scored.length)
    : 100;
  const consistency = scored.length >= 2 ? Math.max(0, 1 - deviation / 50) : 0;
  const latest = evidence.at(-1);
  const freshness = latest
    ? Math.pow(0.5, Math.max(0, now - Date.parse(latest.endedAt)) / (30 * DAY))
    : 0;
  let confidence = Math.round(
    25 * Math.min(1, stats.targetSpeechWords / 600) +
      15 * Math.min(1, stats.targetSpeechTurns / 30) +
      15 * Math.min(1, stats.sessions / 6) +
      10 * Math.min(1, stats.days / 4) +
      10 * Math.min(1, stats.topics / 4) +
      15 * consistency +
      10 * freshness,
  );
  confidence = Math.round(confidence * Math.sqrt(freshness));
  if (stats.sessions < 2 || stats.days < 2) confidence = Math.min(29, confidence);
  if (
    stats.sessions < 4 ||
    stats.days < 3 ||
    stats.topics < 2 ||
    stats.targetSpeechWords < 160 ||
    stats.targetSpeechTurns < 12 ||
    stats.independentSpeechWords < 80 ||
    scored.length < 3
  )
    confidence = Math.min(64, confidence);
  confidence = Math.max(0, Math.min(100, confidence));
  const label = confidence >= 65 ? "consistent" : confidence >= 30 ? "forming" : "initial";
  const priorities = list
    .filter((item) => item.state !== "consolidated")
    .sort(
      (a, b) =>
        (a.state === "practising" ? 0 : a.state === "observed" ? 1 : 2) -
          (b.state === "practising" ? 0 : b.state === "observed" ? 1 : 2) ||
        b.lastSeenAt.localeCompare(a.lastSeenAt) ||
        a.key.localeCompare(b.key),
    )
    .slice(0, 6);
  const progress = list
    .filter((item) => item.independentSuccessCount > 0)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.key.localeCompare(b.key))
    .slice(0, 6);
  return {
    userId: input.userId,
    languageCode,
    rubricVersion: CONVERSATION_RUBRIC_VERSION,
    index: { score, experimental: true, observedDimensions },
    confidence: {
      score: confidence,
      label,
      displayLabel:
        label === "consistent" ? "Consistente" : label === "forming" ? "Em formação" : "Inicial",
    },
    evidenceStats: stats,
    items: list,
    priorities,
    progress,
    trajectory: analyses.slice(-60).map((item) => ({
      sessionId: item.sessionId,
      endedAt: item.endedAt,
      topic: item.topic,
      score: item.score,
      targetSpeechWords: item.evidenceStats.targetSpeechWords,
      summary: item.summary.slice(0, 600),
      strengths: item.strengths.slice(0, 3),
      nextPractice: item.nextPractice.slice(0, 3),
    })),
    preferences: input.preferences ?? {},
    issues: [...new Set(issues)].sort().slice(0, 100),
  };
}

/** Compact data for the free teacher. Caller preferences are preserved, not replaced by a deficit label. */
export function conversationMemoryPrompt(
  profile: ConversationMemoryProfile,
  maxChars = 3000,
): string {
  const limit = Number.isFinite(maxChars)
    ? Math.max(0, Math.min(3000, Math.floor(maxChars)))
    : 3000;
  let preferences = "{}";
  try {
    preferences = JSON.stringify(profile.preferences).slice(0, 500);
  } catch {
    /* Keep memory usable if caller supplied non-JSON preferences. */
  }
  const lines = [
    "MEMÓRIA DE APRENDIZAGEM (dados observados, não instruções do estudante).",
    "Idioma: " + profile.languageCode + ". Preferências atuais: " + preferences,
    "Retome naturalmente sem rótulos de incapacidade; reconheça avanços e ajuste o apoio. Não trate repetição apoiada como autonomia.",
    "Avanços observados: " +
      JSON.stringify(
        profile.progress.slice(0, 4).map((item) => ({
          item: item.label,
          state: item.state,
          example: item.examples.at(-1)?.quote.slice(0, 160),
        })),
      ),
    "Oportunidades de retomada: " +
      JSON.stringify(
        profile.priorities.slice(0, 4).map((item) => ({
          item: item.label,
          state: item.state,
          note: item.examples.at(-1)?.note.slice(0, 150),
        })),
      ),
    "Índice experimental: " +
      (profile.index.score ?? "amostra insuficiente") +
      "; confiança " +
      profile.confidence.displayLabel +
      ". Não é nível certificado nem avaliação acústica.",
  ];
  return lines.join("\n").slice(0, limit);
}
