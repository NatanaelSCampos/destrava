import type { InteractiveLessonDefinition } from "@/content/contracts";

export type NarrationContext = {
  sourceLanguage: string;
  targetLanguage: string;
  targetLocale: string | null;
  targetFallbackAllowed: boolean;
};
export type NarrationLine = {
  id: string;
  text: string;
  language: string | null;
  locale: string | null;
  role: "source" | "target" | null;
  anchorMs: number;
  fallbackAllowed: boolean;
};
const key = (value: string) => value.replaceAll("_", "-").toLowerCase();
/** Metadata only: text, titles and IDs never determine a language. */
export function narrationLine(
  id: string, text: string, language: string | undefined,
  context: NarrationContext, anchorMs = 0, explicitRole?: "source" | "target",
): NarrationLine {
  const same = (a: string, b: string) => key(a) === key(b);
  const target = Boolean(language && (same(language, context.targetLanguage) ||
    (context.targetLocale && same(language, context.targetLocale))));
  const source = Boolean(language && same(language, context.sourceLanguage));
  const role = explicitRole
    ? ((explicitRole === "source" ? source : target) ? explicitRole : null)
    : source && target ? null : source ? "source" : target ? "target" : null;
  return { id, text, language: language ?? null, role, anchorMs,
    locale: role === "source" ? context.sourceLanguage : role === "target" ? context.targetLocale : null,
    fallbackAllowed: role === "source" || (role === "target" && context.targetFallbackAllowed) };
}
export function transcriptNarration(
  transcript: NonNullable<InteractiveLessonDefinition["segments"][number]["presentation"]>["transcript"],
  context: NarrationContext,
) {
  return transcript.map((line, index) => narrationLine(
    `transcript:${index}`, line.text, line.textPresentation?.language, context, line.startMs,
  ));
}
export type TeachingNarration = {
  message: string; example: string; translation: string; followUp: string;
  unannotatedMessage?: boolean;
  messageParts?: Array<{ text: string; role: "source" | "target" | "unknown" }>;
  followUpSpeech?: { role: "source" | "target"; language: string } | null;
};
export function teachingNarration(reply: TeachingNarration, context: NarrationContext) {
  const followUp = reply.followUpSpeech;
  const role = followUp?.role === "source" || followUp?.role === "target" ? followUp.role : undefined;
  return [
    ...(reply.messageParts ? reply.messageParts.map((part, index) => narrationLine(
      `message:${index}`, part.text, part.role === "source" ? context.sourceLanguage
        : part.role === "target" ? context.targetLanguage : undefined, context, 0,
      part.role === "source" || part.role === "target" ? part.role : undefined,
    )) : [narrationLine("message", reply.message, reply.unannotatedMessage ? undefined : context.sourceLanguage, context, 0, "source")]),
    narrationLine("example", reply.example, context.targetLanguage, context, 0, "target"),
    narrationLine("translation", reply.translation, context.sourceLanguage, context, 0, "source"),
    narrationLine("followUp", reply.followUp, role ? followUp?.language : undefined, context, 0, role),
  ].filter((line) => line.text.trim());
}

export type NarrationStatus = "idle" | "speaking" | "paused" | "text" | "completed";
export type NarrationSnapshot = { status: NarrationStatus; line: NarrationLine | null; message: string };
type Handle = { cancel: () => void };
export type NarrationSpeaker = (line: NarrationLine, callbacks: {
  end: () => void; error: () => void; cancel: () => void;
}) => Handle | null;
const textNotice = "Narração indisponível: leia o texto. É necessário idioma declarado e voz compatível.";
/** No learning-runtime events: completion of speech cannot approve or advance a lesson. */
export class NarrationController {
  private generation = 0;
  private handle: Handle | null = null;
  private lines: NarrationLine[] = [];
  private index = 0;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private gapRemainingMs: number | null = null;
  private gapStartedAt: number | null = null;
  constructor(private readonly speak: NarrationSpeaker,
    private readonly change: (snapshot: NarrationSnapshot) => void) {}
  start(lines: NarrationLine[]) {
    if (this.disposed) return;
    this.cancel();
    this.lines = lines.filter((line) => line.text.trim());
    this.index = 0;
    this.play();
  }
  private play() {
    const line = this.lines[this.index];
    if (!line || this.disposed) return;
    const own = ++this.generation;
    const current = () => !this.disposed && own === this.generation;
    if (!line.locale || !line.language || !line.role) {
      this.change({ status: "text", line, message: textNotice });
      return;
    }
    this.change({ status: "speaking", line, message: "Narração em andamento." });
    const handle = this.speak(line, {
      end: () => {
        if (!current()) return;
        ++this.generation;
        this.handle = null;
        if (this.index + 1 < this.lines.length) {
          this.gapRemainingMs = 650;
          this.wait();
        } else {
          ++this.index;
          this.change({ status: "completed", line, message: "Narração concluída. A aula continua pausada." });
        }
      },
      error: () => {
        if (!current()) return;
        this.handle = null;
        ++this.generation;
        this.change({ status: "text", line, message: textNotice });
      },
      cancel: () => { if (current()) this.pause(); },
    });
    if (!current()) { handle?.cancel(); return; }
    this.handle = handle;
    if (!handle) {
      ++this.generation;
      this.change({ status: "text", line, message: textNotice });
    }
  }
  private wait() {
    if (this.disposed || this.gapRemainingMs === null || this.timer !== null) return;
    const own = ++this.generation;
    this.gapStartedAt = Date.now();
    this.change({ status: "speaking", line: this.lines[this.index], message: "Uma pausa para acompanhar o exemplo." });
    if (this.disposed || own !== this.generation) return;
    this.timer = setTimeout(() => {
      if (this.disposed || own !== this.generation) return;
      this.timer = null;
      this.gapRemainingMs = null;
      this.gapStartedAt = null;
      ++this.index;
      this.play();
    }, this.gapRemainingMs);
  }
  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  pause() {
    ++this.generation;
    if (this.gapRemainingMs !== null && this.gapStartedAt !== null)
      this.gapRemainingMs = Math.max(0, this.gapRemainingMs - (Date.now() - this.gapStartedAt));
    this.clearTimer();
    this.gapStartedAt = null;
    const previous = this.handle;
    this.handle = null;
    previous?.cancel();
    if (this.lines[this.index] && !this.disposed)
      this.change({ status: "paused", line: this.lines[this.index], message: this.gapRemainingMs !== null ? "Narração pausada. Retome para continuar." : "Narração pausada. Retome do início desta frase." });
  }
  resume() {
    if (this.disposed || this.handle || this.timer !== null) return;
    if (this.gapRemainingMs !== null) this.wait();
    else this.play();
  }
  cancel() {
    ++this.generation;
    this.clearTimer();
    this.gapRemainingMs = null;
    this.gapStartedAt = null;
    const previous = this.handle;
    this.handle = null;
    this.lines = [];
    this.index = 0;
    previous?.cancel();
    if (!this.disposed) this.change({ status: "idle", line: null, message: "" });
  }
  dispose() { this.disposed = true; this.cancel(); }
}
