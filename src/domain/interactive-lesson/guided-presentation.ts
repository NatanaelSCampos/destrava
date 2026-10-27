import type { NarrationLine } from "./narration-controller";

export type GuidedLine = NarrationLine & { endMs: number };
export type GuidedHandle = {
  cancel(): void;
  pause?(): void;
  resume?(): void;
  seek?(positionMs: number): void;
  getPositionMs?(): number;
};
export type GuidedSnapshot = {
  status: "idle" | "playing" | "gap" | "paused" | "completed" | "error";
  line: GuidedLine | null;
  lineIndex: number;
  lineCount: number;
  positionMs: number;
  audioPositionMs: number;
  audioDurationMs: number;
  message: string;
};
export const idleGuidedSnapshot: GuidedSnapshot = {
  status: "idle", line: null, lineIndex: 0, lineCount: 0,
  positionMs: 0, audioPositionMs: 0, audioDurationMs: 0, message: "",
};
type Callbacks = { end(): void; error(): void; cancel(): void; progress(positionMs: number, durationMs: number): void };
export type GuidedSpeaker = (line: GuidedLine, callbacks: Callbacks) => GuidedHandle | null;
type Scheduler = { now(): number; set(callback: () => void, ms: number): unknown; clear(id: unknown): void };
const scheduler: Scheduler = {
  now: () => Date.now(), set: (callback, ms) => setTimeout(callback, ms),
  clear: id => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Clip endings and real audio progress drive the storyboard. This controller never records learning evidence. */
export class GuidedPresentationController {
  private lines: GuidedLine[] = [];
  private duration = 0;
  private snapshot: GuidedSnapshot = { ...idleGuidedSnapshot };
  private handle: GuidedHandle | null = null;
  private generation = 0;
  private active = false;
  private disposed = false;
  private timer: unknown = null;
  private gapRemaining: number | null = null;
  private gapStarted = 0;
  private seekFraction: number | null = null;
  constructor(private readonly speak: GuidedSpeaker,
    private readonly change: (snapshot: GuidedSnapshot) => void,
    private readonly clock: Scheduler = scheduler) {}
  get current() { return this.snapshot; }
  private publish(patch: Partial<GuidedSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    if (!this.disposed) this.change(this.snapshot);
  }
  play(lines: GuidedLine[], durationMs: number, positionMs: number) {
    if (this.disposed || !lines.length) return;
    if (this.lines !== lines || positionMs !== this.snapshot.positionMs) {
      this.stop(); this.lines = lines; this.duration = durationMs;
      const index = Math.max(0, lines.findLastIndex(line => line.anchorMs <= positionMs));
      const line = lines[index];
      this.seekFraction = Math.max(0, Math.min(1, (positionMs - line.anchorMs) / Math.max(1, line.endMs - line.anchorMs)));
      this.snapshot = { ...idleGuidedSnapshot, line, lineIndex: index, lineCount: lines.length,
        positionMs: Math.max(line.anchorMs, Math.min(positionMs, line.endMs)) };
    }
    this.active = true;
    if (this.gapRemaining !== null) { this.wait(); return; }
    if (this.handle?.resume) {
      this.publish({ status: "playing", message: "" }); this.handle.resume(); return;
    }
    this.say();
  }
  private say() {
    const line = this.lines[this.snapshot.lineIndex];
    if (!line || this.disposed || !this.active) return;
    if (!line.locale || !line.language || !line.role) { this.fail(); return; }
    const own = ++this.generation;
    const current = () => own === this.generation && !this.disposed;
    this.publish({ status: "playing", line, audioPositionMs: 0, audioDurationMs: 0, message: "" });
    const handle = this.speak(line, {
      progress: (position, duration) => {
        if (!current() || !this.active || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
        const audioPositionMs = Math.max(0, Math.min(position, duration));
        this.publish({ audioPositionMs, audioDurationMs: duration,
          positionMs: line.anchorMs + Math.round((line.endMs - line.anchorMs) * audioPositionMs / duration) });
        this.applySeek();
      },
      end: () => {
        if (!current()) return;
        if (!this.active) {
          this.handle = null; ++this.generation; this.seekFraction = 0;
          this.publish({ status: "paused", positionMs: line.anchorMs, audioPositionMs: 0,
            message: "Retome para ouvir esta frase do início." }); return;
        }
        ++this.generation;
        this.handle = null;
        this.seekFraction = null;
        this.publish({ positionMs: line.endMs, audioPositionMs: this.snapshot.audioDurationMs });
        const next = this.lines[this.snapshot.lineIndex + 1];
        this.gapRemaining = Math.max(0, (next?.anchorMs ?? this.duration) - line.endMs);
        this.wait();
      },
      error: () => { if (current()) this.fail(); },
      cancel: () => {
        if (!current()) return;
        this.handle = null; this.active = false; ++this.generation;
        this.publish({ status: "paused", message: "A fala foi interrompida. Retome para ouvir esta frase." });
      },
    });
    if (!current() || !this.active) { handle?.cancel(); return; }
    this.handle = handle;
    if (!handle) { this.fail(); return; }
    this.applySeek();
  }
  private applySeek() {
    if (this.seekFraction === null || !this.handle || !this.snapshot.audioDurationMs) return;
    const fraction = this.seekFraction; this.seekFraction = null;
    if (fraction && this.handle.seek) this.handle.seek(fraction * this.snapshot.audioDurationMs);
    else if (fraction) this.publish({ positionMs: this.snapshot.line!.anchorMs,
      message: "Esta reprodução retoma do início da frase." });
  }
  private wait() {
    if (!this.active || this.gapRemaining === null) return;
    this.publish({ status: "gap", message: "Uma pausa para acompanhar o exemplo." });
    this.gapStarted = this.clock.now(); const own = this.generation;
    this.timer = this.clock.set(() => {
      this.timer = null;
      if (!this.active || this.disposed || own !== this.generation) return;
      this.gapRemaining = null;
      const index = this.snapshot.lineIndex + 1, line = this.lines[index];
      if (!line) {
        this.active = false;
        this.publish({ status: "completed", positionMs: this.duration, message: "" }); return;
      }
      this.publish({ lineIndex: index, line, positionMs: line.anchorMs }); this.say();
    }, this.gapRemaining);
  }
  pause() {
    if (this.disposed || !this.active) return;
    if (this.timer !== null) {
      this.clock.clear(this.timer); this.timer = null;
      this.gapRemaining = Math.max(0, (this.gapRemaining ?? 0) - (this.clock.now() - this.gapStarted));
    }
    const actual = this.handle?.getPositionMs?.();
    if (actual !== undefined && Number.isFinite(actual) && this.snapshot.audioDurationMs > 0 && this.snapshot.line) {
      const elapsed = Math.max(0, Math.min(actual, this.snapshot.audioDurationMs));
      const line = this.snapshot.line;
      this.publish({ audioPositionMs: elapsed, positionMs: line.anchorMs +
        Math.round((line.endMs - line.anchorMs) * elapsed / this.snapshot.audioDurationMs) });
    }
    this.active = false;
    if (this.handle?.pause && this.handle.resume) this.handle.pause();
    else if (this.handle) {
      const previous = this.handle; this.handle = null; ++this.generation; previous.cancel();
      this.seekFraction = null;
      this.publish({ positionMs: this.snapshot.line?.anchorMs ?? this.snapshot.positionMs,
        message: "Esta reprodução retoma do início da frase." });
    }
    this.publish({ status: "paused" });
  }
  seek(positionMs: number) {
    this.stop();
    const index = Math.max(0, this.lines.findLastIndex(line => line.anchorMs <= positionMs)),line = this.lines[index];
    if (!line) return;
    const position = Math.max(line.anchorMs, Math.min(positionMs, line.endMs));
    this.seekFraction = (position - line.anchorMs) / Math.max(1, line.endMs - line.anchorMs);
    this.publish({ status: "paused", lineIndex: index, line, positionMs: position,
      audioPositionMs: 0, audioDurationMs: 0, message: "" });
  }
  private fail() {
    this.active = false; ++this.generation;
    const previous = this.handle; this.handle = null; previous?.cancel();
    this.publish({ status: "error", message: "Não foi possível tocar esta fala. Tente reproduzir de novo ou abra o texto da explicação." });
  }
  private stop() {
    this.active = false; ++this.generation;
    if (this.timer !== null) this.clock.clear(this.timer);
    this.timer = null; this.gapRemaining = null;
    const previous = this.handle; this.handle = null; previous?.cancel();
  }
  dispose() { this.stop(); this.disposed = true; }
}
