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
  followUpSpeech?: { role: "source" | "target"; language: string } | null;
};
export function teachingNarration(reply: TeachingNarration, context: NarrationContext) {
  const followUp = reply.followUpSpeech;
  const role = followUp?.role === "source" || followUp?.role === "target" ? followUp.role : undefined;
  return [
    narrationLine("message", reply.message, reply.unannotatedMessage ? undefined : context.sourceLanguage, context, 0, "source"),
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
        this.handle = null;
        if (++this.index < this.lines.length) this.play();
        else {
          ++this.generation;
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
    if (!handle) this.change({ status: "text", line, message: textNotice });
  }
  pause() {
    ++this.generation;
    const previous = this.handle;
    this.handle = null;
    previous?.cancel();
    if (this.lines[this.index] && !this.disposed)
      this.change({ status: "paused", line: this.lines[this.index], message: "Narração pausada. Retome do início desta frase." });
  }
  resume() { if (!this.disposed && !this.handle) this.play(); }
  cancel() {
    ++this.generation;
    const previous = this.handle;
    this.handle = null;
    this.lines = [];
    this.index = 0;
    previous?.cancel();
    if (!this.disposed) this.change({ status: "idle", line: null, message: "" });
  }
  dispose() { this.disposed = true; this.cancel(); }
}
