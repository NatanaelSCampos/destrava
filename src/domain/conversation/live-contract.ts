import { z } from "zod";
import { verbalTranscriptText } from "./transcript-text";
import { LIVE_MAX_TOPICS } from "./live-topic-selection";
export const LIVE_MAX_SECONDS = 480;
export const LIVE_MODEL = "gpt-live-1";
export const LIVE_REVIEW_MODEL = "gpt-6.1-sol";
export const LIVE_CLIENT_EVENTS = [
  "session.input_audio.mute",
  "session.input_audio.unmute",
  "session.close",
] as const;
export const liveSettingsSchema = z
  .object({
    level: z.enum(["beginner", "intermediate", "advanced"]),
    correction: z.enum(["immediate", "end"]),
    voice: z.enum(["female", "male"]),
  })
  .strict();
export const liveStartSchema = liveSettingsSchema
  .extend({
    courseId: z.string().min(1).max(100),
    mode: z.enum(["studied", "free"]).default("studied"),
    openingTopic: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[^\u0000-\u001f\u007f]*$/u)
      .optional(),
    topicId: z.string().min(1).max(140).optional(),
    topicIds: z
      .array(z.string().min(1).max(140))
      .min(1)
      .max(LIVE_MAX_TOPICS)
      .refine((ids) => new Set(ids).size === ids.length)
      .optional(),
    recordAudio: z.boolean().default(false),
    operationId: z.uuid(),
    sdp: z
      .string()
      .min(20)
      .max(60_000)
      .refine((value) => value.startsWith("v=0") && value.includes("m=audio"), "Invalid offer"),
  })
  .strict()
  .refine(
    (value) =>
      value.mode === "free"
        ? value.topicId === undefined && value.topicIds === undefined
        : value.openingTopic === undefined &&
          (value.topicId !== undefined) !== (value.topicIds !== undefined),
    "Choose a topic selection",
  );
export const liveIdSchema = z.object({ id: z.uuid() }).strict();
export const liveControlSchema = liveIdSchema
  .extend({
    action: z.enum(["pause", "resume", "message", "heartbeat"]),
    text: z.string().trim().min(1).max(800).optional(),
  })
  .strict()
  .refine((v) => (v.action === "message" ? !!v.text : v.text === undefined));
const shortText = z.string().trim().min(1).max(500);
export const liveReportSchema = z
  .object({
    summary: z.string().trim().min(1).max(1400),
    strengths: z.array(shortText).max(5),
    improvements: z
      .array(z.object({ heard: shortText, suggestion: shortText, explanation: shortText }).strict())
      .max(5),
    nextPractice: z.array(shortText).max(5),
    limits: z.string().max(600),
  })
  .strict();
export type LiveSettings = z.infer<typeof liveSettingsSchema>;
export type LiveReport = z.infer<typeof liveReportSchema>;
export type LiveTurn = {
  id: string;
  role: "student" | "partner";
  text: string;
  startMs?: number;
  endMs?: number;
  interrupted?: boolean;
  inputMode?: "speech" | "text";
};
export type LiveTopic = {
  id: string;
  title: string;
  description: string;
  unitId: string;
  unitTitle: string;
  unitNumber: number;
  lessonOrder?: number;
  studiedActivities: number;
};
export type LiveTopicContext = LiveTopic & {
  mode?: "free";
  openingTopic?: string;
  courseTitle?: string;
  examples: Array<{ text: string; translation: string }>;
  objectives: string[];
  selectedTopics?: Array<Pick<LiveTopic, "id" | "title" | "unitId" | "unitTitle" | "unitNumber">>;
};
export const REVIEW_LIMITS =
  "Este retorno considera as falas registradas nesta conversa. Não é uma certificação de nível nem uma nota de pronúncia; uma transcrição pode interpretar sua fala de outra forma.";
export function groundedReport(report: LiveReport, turns: LiveTurn[]): LiveReport {
  const evidence = turns
    .filter((t) => t.role === "student")
    .map((t) => verbalTranscriptText(t.text).toLocaleLowerCase().replace(/\s+/g, " ").trim());
  return {
    ...report,
    improvements: report.improvements
      .map((item) => ({ ...item, heard: verbalTranscriptText(item.heard) }))
      .filter((item) => {
        const quoted = item.heard.toLocaleLowerCase().replace(/\s+/g, " ").trim();
        return quoted.length >= 3 && evidence.some((text) => text.includes(quoted));
      }),
    limits: REVIEW_LIMITS,
  };
}
/** Delta stream, not a list of complete turns. Bounded, deduplicated by provider event id. */
export function appendLiveTranscript(
  turns: LiveTurn[],
  seen: Set<string>,
  event: {
    type: string;
    event_id?: string;
    delta?: string;
    start_ms?: number;
    end_ms?: number;
  },
): LiveTurn[] {
  if (
    !["session.input_transcript.delta", "session.output_transcript.delta"].includes(event.type) ||
    !event.event_id ||
    seen.has(event.event_id) ||
    typeof event.delta !== "string" ||
    !event.delta
  )
    return turns;
  if (seen.size > 12000) return turns;
  seen.add(event.event_id);
  const role: LiveTurn["role"] =
    event.type === "session.input_transcript.delta" ? "student" : "partner";
  const delta = event.delta.slice(0, 2000);
  const start = Number.isFinite(event.start_ms) ? Math.max(0, event.start_ms!) : undefined;
  const end = Number.isFinite(event.end_ms) ? Math.max(start ?? 0, event.end_ms!) : undefined;
  const last = turns.at(-1);
  if (
    last?.role === role &&
    last.inputMode !== "text" &&
    last.text.length < 3500 &&
    (start === undefined || last.endMs === undefined || start - last.endMs < 1800)
  ) {
    return [
      ...turns.slice(0, -1),
      { ...last, text: (last.text + delta).slice(0, 4000), endMs: end ?? last.endMs },
    ];
  }
  const next: LiveTurn = {
    id: event.event_id,
    role,
    text: delta,
    startMs: start,
    endMs: end,
    inputMode: "speech",
  };
  return [...turns, next].slice(-120);
}
