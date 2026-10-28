import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationSessionAnalysisSchema,
  conversationDimensionNames,
  type ConversationSessionAnalysis,
  type ConversationObservation,
} from "../src/content/conversation-assessment-contract";
import {
  validateConversationAnalysis,
  buildConversationMemoryProfile,
  conversationMemoryPrompt,
  type ConversationMemorySession,
} from "../src/domain/conversation/conversation-memory";

const NOW = "2026-10-28T15:00:00.000Z";
function session(
  id = "one",
  day = 28,
  score = 3,
  languageCode = "en-US",
): ConversationMemorySession {
  const turns = [
    {
      id: "teacher",
      role: "partner" as const,
      text: "What would you like to discuss?",
      inputMode: "speech" as const,
    },
    {
      id: "s1",
      role: "student" as const,
      text: "I would like to explain the plan and ask a question about tomorrow.",
      inputMode: "speech" as const,
    },
    {
      id: "s2",
      role: "student" as const,
      text: "We can meet near the library because it is easy to find from here.",
      inputMode: "speech" as const,
    },
  ];
  const evidence = turns.slice(1).map((turn) => ({
    turnId: turn.id,
    quote: turn.text,
    language: "target" as const,
    support: "independent" as const,
  }));
  const raw: ConversationSessionAnalysis = {
    schemaVersion: "1.0.0",
    rubricVersion: "1.0.0",
    sessionId: id,
    languageCode,
    dimensions: Object.fromEntries(
      conversationDimensionNames.map((name) => [
        name,
        { score, evidence: structuredClone(evidence), note: "Evidence in the actual transcript." },
      ]),
    ) as ConversationSessionAnalysis["dimensions"],
    observations: [
      {
        ...evidence[0],
        key: "explain-a-plan",
        kind: "phrase",
        label: "Explain a plan",
        outcome: "independent_success",
        note: "Used independently in context.",
      },
    ],
    summary: "A plan and a question were communicated.",
    strengths: ["Connected ideas."],
    nextPractice: ["Try a different situation."],
  };
  return {
    id,
    userId: "learner",
    languageCode,
    topic: day % 2 ? "planning" : "meeting",
    startedAt: `2026-10-${day}T12:00:00.000Z`,
    endedAt: `2026-10-${day}T12:05:00.000Z`,
    turns,
    analysis: raw,
  };
}
const raw = (value: ConversationMemorySession) => value.analysis as ConversationSessionAnalysis;
const profile = (
  sessions: ConversationMemorySession[],
  extra: Partial<Parameters<typeof buildConversationMemoryProfile>[0]> = {},
) =>
  buildConversationMemoryProfile({
    userId: "learner",
    languageCode: "en",
    sessions,
    now: NOW,
    ...extra,
  });
const setOutcome = (s: ConversationMemorySession, outcome: ConversationObservation["outcome"]) => {
  raw(s).observations[0].outcome = outcome;
  return s;
};

test("public rubric schema is strict, versioned, bounded and rejects invented dimensions", () => {
  const s = session();
  assert(conversationSessionAnalysisSchema.safeParse(s.analysis).success);
  for (const value of [
    { ...raw(s), rubricVersion: "future" },
    { ...raw(s), hiddenInstructions: "run()" },
    { ...raw(s), dimensions: { ...raw(s).dimensions, pronunciation: raw(s).dimensions.accuracy } },
  ])
    assert.equal(conversationSessionAnalysisSchema.safeParse(value).success, false);
  raw(s).dimensions.range.score = 5;
  assert.equal(validateConversationAnalysis(s.analysis, s).analysis, null);
});
test("actual quoted target speech produces an experimental index with independently low initial confidence", () => {
  const s = session(),
    result = profile([s]);
  assert.equal(result.index.score, 75);
  assert.equal(result.index.experimental, true);
  assert.equal(result.confidence.label, "initial");
  assert(result.confidence.score <= 29);
  assert.equal(result.evidenceStats.targetSpeechTurns, 2);
  assert.equal(result.evidenceStats.targetSpeechWords, 27);
  assert.equal(result.items[0].state, "improving");
});
test("teacher words, nonexistent quotes and foreign analysis scope are rejected", () => {
  for (const mode of ["teacher", "missing", "session", "language"]) {
    const s = session();
    if (mode === "session") raw(s).sessionId = "another";
    if (mode === "language") raw(s).languageCode = "fr";
    if (mode === "teacher" || mode === "missing") {
      for (const d of Object.values(raw(s).dimensions))
        d.evidence = [
          {
            turnId: mode === "teacher" ? "teacher" : "s1",
            quote: mode === "teacher" ? s.turns[0].text : "words never actually uttered",
            language: "target",
            support: "independent",
          },
        ];
      raw(s).observations = [{ ...raw(s).observations[0], ...raw(s).dimensions.range.evidence[0] }];
    }
    const p = profile([s]);
    assert.equal(p.index.score, null);
    assert.equal(p.items.length, 0);
  }
});
test("text and support-language contributions never inflate the spoken index or sample", () => {
  for (const mode of ["text", "support", "unknown-mode"]) {
    const s = session();
    if (mode === "text")
      s.turns = s.turns.map((t) => (t.role === "student" ? { ...t, inputMode: "text" } : t));
    if (mode === "unknown-mode")
      s.turns = s.turns.map((t) => {
        const next = { ...t };
        delete next.inputMode;
        return next;
      });
    if (mode === "support") {
      for (const d of Object.values(raw(s).dimensions))
        d.evidence.forEach((e) => (e.language = "support"));
      raw(s).observations.forEach((o) => (o.language = "support"));
    }
    const p = profile([s]);
    assert.equal(p.index.score, null);
    assert.equal(p.evidenceStats.targetSpeechWords, 0);
    assert.equal(p.confidence.score, 0);
  }
});
test("uncertain transcription creates no false error, autonomous success or zero score", () => {
  const s = setOutcome(session(), "difficulty");
  s.uncertainTurnIds = ["s1", "s2"];
  const p = profile([s]);
  assert.equal(p.index.score, null);
  assert.equal(p.confidence.score, 0);
  assert.equal(p.items[0].state, "observed");
  assert.equal(p.items[0].difficultyCount, 0);
  assert.equal(p.items[0].independentSuccessCount, 0);
});
test("copying a supplied model cannot become independent or supported success", () => {
  const s = session();
  s.modelPhrases = s.turns.slice(1).map((t) => t.text);
  const p = profile([s]);
  assert.equal(p.index.score, null);
  assert.equal(p.items[0].lastOutcome, "uncertain");
  assert.equal(p.items[0].independentSuccessCount, 0);
  assert.equal(p.items[0].supportedSuccessCount, 0);
  assert.equal(p.evidenceStats.targetSpeechWords, 0);
  const echo = session();
  echo.turns = [{ ...echo.turns[0], text: echo.turns[1].text }, ...echo.turns.slice(1)];
  assert.equal(profile([echo]).items[0].independentSuccessCount, 0);
});
test("assistance is not autonomy and never consolidates through repetition", () => {
  const sessions = [25, 26, 27, 28].map((day) => {
    const s = session("assisted-" + day, day);
    for (const d of Object.values(raw(s).dimensions))
      d.evidence.forEach((ref) => (ref.support = "assisted"));
    raw(s).observations[0].support = "assisted";
    return s;
  });
  const p = profile(sessions);
  assert.equal(p.items[0].state, "practising");
  assert.equal(p.items[0].supportedSuccessCount, 4);
  assert.equal(p.items[0].independentSuccessCount, 0);
  assert.equal(
    validateConversationAnalysis(sessions[0].analysis, sessions[0]).analysis!.dimensions.autonomy
      .score,
    null,
  );
  assert.notEqual(p.confidence.label, "consistent");
});
test("silence, annotations and absent evidence are null; zero requires actual evidence", () => {
  const empty = session();
  empty.turns = [];
  raw(empty).observations = [];
  const p = profile([empty]);
  assert.equal(p.index.score, null);
  assert.equal(p.confidence.score, 0);
  const annotation = session();
  annotation.turns = annotation.turns.map((turn) => ({ ...turn, text: "[laughter]" }));
  for (const d of Object.values(raw(annotation).dimensions))
    d.evidence.forEach((ref) => (ref.quote = "[laughter]"));
  raw(annotation).observations = [];
  assert.equal(profile([annotation]).index.score, null);
  assert.equal(profile([session("zero", 28, 0)]).index.score, 0);
});
test("short insufficient oral evidence cannot produce an index", () => {
  const s = session();
  s.turns = s.turns.map((t) => (t.role === "student" ? { ...t, text: "A short response" } : t));
  for (const d of Object.values(raw(s).dimensions))
    d.evidence.forEach((ref) => (ref.quote = "A short response"));
  raw(s).observations = [];
  assert.equal(profile([s]).index.score, null);
});
test("session order, exact duplicate rows and repeated evidence do not change aggregation", () => {
  const sessions = [session("a", 26), session("b", 27), session("c", 28)],
    before = structuredClone(sessions);
  const a = profile(sessions),
    b = profile([sessions[2], sessions[0], sessions[1], sessions[0], sessions[2]]);
  assert.deepEqual(a, b);
  assert.deepEqual(sessions, before);
  const s = session();
  raw(s).observations.push(structuredClone(raw(s).observations[0]));
  assert.equal(profile([s]).items[0].independentSuccessCount, 1);
  assert.equal(profile([s]).evidenceStats.targetSpeechWords, 27);
});
test("conflicting versions of the same session require reconciliation rather than double credit", () => {
  const a = session(),
    b = session();
  raw(b).dimensions.accuracy.score = 4;
  const p = profile([a, b]);
  assert.equal(p.index.score, null);
  assert.equal(p.evidenceStats.sessions, 0);
  assert(p.issues.some((issue) => issue.includes("Conflicting")));
  assert.deepEqual(p, profile([b, a]));
});
test("language and person scope are independent of any course ID", () => {
  const english = session("en"),
    french = session("fr", 28, 4, "fr-FR"),
    otherUser = session("other");
  otherUser.userId = "someone-else";
  assert.deepEqual(profile([english]), profile([french, english, otherUser]));
  const variant = session("variant", 28, 3, "en-GB");
  assert.equal(profile([english, variant]).evidenceStats.sessions, 2);
  assert.equal(profile([french], { languageCode: "fr" }).languageCode, "fr");
});
test("three independent sessions across days and topics consolidate, a later error reactivates", () => {
  const sessions = [session("a", 25), session("b", 26), session("c", 27)];
  const consolidated = profile(sessions);
  assert.equal(consolidated.items[0].state, "consolidated");
  const difficulty = setOutcome(session("d", 28), "difficulty"),
    reactivated = profile([...sessions, difficulty]);
  assert.equal(reactivated.items[0].state, "practising");
  assert.equal(reactivated.items[0].reactivations, 1);
  assert.equal(reactivated.items[0].independentSuccessCount, 3);
  assert.equal(reactivated.items[0].examples.length, 3);
});
test("no observation preserves earlier items and supported practice does not erase consolidation", () => {
  const sessions = [session("a", 25), session("b", 26), session("c", 27)];
  const later = session("d", 28);
  raw(later).observations = [];
  assert.deepEqual(profile([...sessions, later]).items, profile(sessions).items);
  const supported = session("e", 28);
  raw(supported).observations[0].support = "assisted";
  assert.equal(profile([...sessions, supported]).items[0].state, "consolidated");
});
test("duration alone cannot raise confidence; sufficient varied recent speech can", () => {
  const short = session(),
    long = session();
  long.startedAt = "2026-10-28T00:00:00.000Z";
  assert.equal(profile([short]).confidence.score, profile([long]).confidence.score);
  const sessions = [23, 24, 25, 26, 27, 28].map((day) => session("sample-" + day, day));
  const p = profile(sessions);
  assert.equal(p.confidence.label, "consistent");
  assert(p.confidence.score >= 65);
  assert.equal(p.index.score, 75);
});
test("recency affects index weighting and confidence without fabricating forgetting", () => {
  const old = session("old", 1, 0),
    recent = session("recent", 28, 4);
  assert(profile([old, recent]).index.score! > 50);
  const sessions = [23, 24, 25, 26, 27, 28].map((day) => session("sample-" + day, day));
  const now = profile(sessions),
    stale = profile(sessions, { now: "2027-04-28T15:00:00.000Z" });
  assert(stale.confidence.score < now.confidence.score);
  assert.notEqual(stale.confidence.label, "consistent");
  assert.equal(stale.index.score, now.index.score);
  assert.deepEqual(stale.items, now.items);
});
test("bounded teacher summary includes advances and preferences without stigma", () => {
  const s = session(),
    prefs = { level: "beginner", correction: "end", topics: ["gardens"] },
    p = profile([s], { preferences: prefs });
  const before = structuredClone(p),
    summary = conversationMemoryPrompt(p);
  assert(summary.length <= 3000);
  assert(summary.includes("Avanços"));
  assert(summary.includes("gardens"));
  assert(summary.includes("amostra") || summary.includes("experimental"));
  assert(conversationMemoryPrompt(p, 120).length <= 120);
  assert.deepEqual(p, before);
  assert.deepEqual(p.preferences, prefs);
});
test("history is bounded and retains per-session trajectory rather than only the last score", () => {
  const p = profile([session("low", 26, 1), session("middle", 27, 2), session("high", 28, 4)]);
  assert.deepEqual(
    p.trajectory.map((item) => item.score),
    [25, 50, 100],
  );
  assert(p.trajectory.every((item) => item.strengths.length <= 3 && item.nextPractice.length <= 3));
});
test("ambiguous duplicate turn IDs and future sessions fail closed", () => {
  const ambiguous = session();
  ambiguous.turns = [...ambiguous.turns, { ...ambiguous.turns[1] }];
  assert.equal(validateConversationAnalysis(ambiguous.analysis, ambiguous).analysis, null);
  assert.equal(profile([session()], { now: "2026-10-27T00:00:00.000Z" }).index.score, null);
});
