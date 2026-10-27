import type { ClientEvent, ServerEvent } from "openai/resources/live/live";

export type LiveLevel = "beginner" | "intermediate" | "advanced";
export type LiveCorrection = "immediate" | "end";
export type LiveTurn = {
  id: string;
  role: "student" | "partner";
  text: string;
  startMs?: number;
  endMs?: number;
  interrupted?: boolean;
};
export type LiveReport = {
  summary: string;
  strengths: string[];
  improvements: Array<{ heard: string; suggestion: string; explanation: string }>;
  nextPractice: string[];
  limits: string;
};
export type LiveTopic = {
  id: string;
  title: string;
  description: string;
  unitId: string;
  unitTitle: string;
  unitNumber: number;
  studiedActivities: number;
  lessonOrder?: number;
};
export type LiveTopics = { topics: LiveTopic[]; languageLabel: string; sourceLanguage: string };
export type LiveSession = {
  id: string;
  answerSdp: string;
  expiresAt: string;
  maxSeconds: number;
  model: "gpt-live-1";
  topic: { id: string; title: string };
  languageLabel: string;
};
export type LiveFinished = {
  id: string;
  status: "completed" | "expired" | "failed";
  report: LiveReport | null;
  transcript: LiveTurn[];
  reportError?: string;
};
export type LiveHistory = {
  id: string;
  title: string;
  level: LiveLevel;
  correction: LiveCorrection;
  startedAt: string;
  endedAt: string | null;
  status: string;
  report: LiveReport | null;
  transcript: LiveTurn[];
};
export type LiveSettings = {
  courseId: string;
  mode?: "studied" | "free";
  openingTopic?: string;
  topicId?: string;
  topicIds?: string[];
  level: LiveLevel;
  correction: LiveCorrection;
  voice: "female" | "male";
};
export type LivePhase =
  "idle" | "connecting" | "listening" | "speaking" | "paused" | "ending" | "completed" | "error";
export type LiveSnapshot = {
  phase: LivePhase;
  session: LiveSession | null;
  turns: LiveTurn[];
  remaining: number;
  usageSeconds: number;
  pending: boolean;
  message: string;
  report: LiveReport | null;
  reportError: string;
  resultStatus: LiveFinished["status"] | null;
};
export const initialLiveSnapshot: LiveSnapshot = {
  phase: "idle",
  session: null,
  turns: [],
  remaining: 480,
  usageSeconds: 0,
  pending: false,
  message: "",
  report: null,
  reportError: "",
  resultStatus: null,
};
const base = "/api/ai/live-conversation";
class LiveClientError extends Error {}
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const isReport = (value: unknown): value is LiveReport =>
  record(value) &&
  typeof value.summary === "string" &&
  strings(value.strengths) &&
  strings(value.nextPractice) &&
  typeof value.limits === "string" &&
  Array.isArray(value.improvements) &&
  value.improvements.every(
    (item) =>
      record(item) &&
      ["heard", "suggestion", "explanation"].every((key) => typeof item[key] === "string"),
  );
const isTurn = (value: unknown): value is LiveTurn =>
  record(value) &&
  typeof value.id === "string" &&
  ["student", "partner"].includes(String(value.role)) &&
  typeof value.text === "string";

function confirmedFinish(value: unknown, id: string): value is LiveFinished {
  return (
    record(value) &&
    value.id === id &&
    ["completed", "expired", "failed"].includes(String(value.status)) &&
    Array.isArray(value.transcript) &&
    value.transcript.every(isTurn) &&
    (value.report === null || isReport(value.report)) &&
    (value.reportError === undefined || typeof value.reportError === "string")
  );
}
/** Finishes a stored conversation without opening any audio resources. */
export async function prepareLiveReport(id: string, signal?: AbortSignal): Promise<LiveFinished> {
  if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
  const abort = new AbortController(),
    cancel = () => abort.abort();
  const timer = setTimeout(cancel, 60_000);
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const result = await requestJson<unknown>(base + "/finish", { id }, abort.signal);
    if (abort.signal.aborted) throw new DOMException("Request cancelled", "AbortError");
    if (!confirmedFinish(result, id))
      throw new LiveClientError(
        "Não foi possível confirmar o resumo desta conversa. Tente novamente.",
      );
    return result;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

/** No provider errors, credentials or transport details are displayed to the learner. */
async function requestJson<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  try {
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    if (!response.ok)
      throw new LiveClientError(
        response.status === 401 || response.status === 403
          ? "Sua sessão não permite abrir esta conversa. Entre novamente e confira o curso selecionado."
          : "Não foi possível confirmar esta ação. Tente novamente.",
      );
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof LiveClientError || (error instanceof Error && error.name === "AbortError"))
      throw error;
    throw new LiveClientError("Não foi possível conectar. Confira sua conexão e tente novamente.");
  }
}
export async function loadLiveTopics(courseId: string, signal?: AbortSignal) {
  const result = await requestJson<LiveTopics>(
    base + "/topics?courseId=" + encodeURIComponent(courseId),
    undefined,
    signal,
  );
  if (
    !record(result) ||
    typeof result.languageLabel !== "string" ||
    typeof result.sourceLanguage !== "string" ||
    !Array.isArray(result.topics) ||
    !result.topics.every(
      (item) =>
        record(item) &&
        (["id", "title", "description", "unitId", "unitTitle"] as const).every(
          (key) => typeof item[key] === "string",
        ) &&
        Number.isFinite(item.unitNumber) &&
        Number.isFinite(item.studiedActivities),
    )
  )
    throw new LiveClientError("Não foi possível carregar os assuntos deste curso.");
  return result;
}
export async function loadLiveHistory(courseId: string, signal?: AbortSignal) {
  const result = await requestJson<{ sessions: LiveHistory[] }>(
    base + "/history?courseId=" + encodeURIComponent(courseId),
    undefined,
    signal,
  );
  if (
    !record(result) ||
    !Array.isArray(result.sessions) ||
    !result.sessions.every(
      (item) =>
        record(item) &&
        (["id", "title", "startedAt", "status"] as const).every(
          (key) => typeof item[key] === "string",
        ) &&
        (item.report === null || isReport(item.report)) &&
        Array.isArray(item.transcript) &&
        item.transcript.every(isTurn),
    )
  )
    throw new LiveClientError("Não foi possível confirmar o histórico de conversas.");
  return result;
}
export const liveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof LiveClientError ? error.message : fallback;

/** Live deltas are fragments, not complete turns. Keep delivery order, including repeated words. */
export class LiveEventAccumulator {
  readonly seen = new Set<string>();
  turns: LiveTurn[] = [];
  usageSeconds = 0;
  accept(value: unknown): "started" | "transcript" | "usage" | "closed" | "error" | null {
    if (!record(value) || typeof value.event_id !== "string" || this.seen.has(value.event_id))
      return null;
    const event = value as unknown as ServerEvent;
    if (
      event.type === "session.input_transcript.delta" ||
      event.type === "session.output_transcript.delta"
    ) {
      if (
        typeof event.delta !== "string" ||
        !Number.isFinite(event.start_ms) ||
        !Number.isFinite(event.end_ms) ||
        event.start_ms < 0 ||
        event.end_ms < event.start_ms
      )
        return null;
      this.seen.add(event.event_id);
      if (!event.delta) return null;
      const role = event.type === "session.input_transcript.delta" ? "student" : "partner";
      const last = this.turns.at(-1);
      if (last?.role === role)
        this.turns = [
          ...this.turns.slice(0, -1),
          {
            ...last,
            text: last.text + event.delta,
            startMs: Math.min(last.startMs ?? event.start_ms, event.start_ms),
            endMs: Math.max(last.endMs ?? event.end_ms, event.end_ms),
          },
        ];
      else
        this.turns = [
          ...this.turns,
          {
            id: event.event_id,
            role,
            text: event.delta,
            startMs: event.start_ms,
            endMs: event.end_ms,
          },
        ];
      return "transcript";
    }
    if (event.type === "session.usage.updated") {
      if (!record(event.usage) || !Number.isFinite(event.usage.seconds) || event.usage.seconds < 0)
        return null;
      this.seen.add(event.event_id);
      this.usageSeconds = Math.max(this.usageSeconds, event.usage.seconds);
      return "usage";
    }
    const kind =
      event.type === "session.started"
        ? "started"
        : event.type === "session.closed"
          ? "closed"
          : event.type === "error"
            ? "error"
            : null;
    if (kind) this.seen.add(value.event_id);
    return kind;
  }
}

type Timer = ReturnType<typeof setTimeout>;
export type LiveEnvironment = {
  now(): number;
  uuid(): string;
  post<T>(path: string, body: unknown): Promise<T>;
  getMicrophone(): Promise<MediaStream>;
  createPeer(): RTCPeerConnection;
  audio: Pick<HTMLAudioElement, "srcObject" | "muted" | "play" | "pause">;
  unlockAudio(): Promise<void>;
  meter(stream: MediaStream, sample: (energy: number) => void): () => void;
  closeAudio(): void;
  abandon(id: string): void;
  set(callback: () => void, ms: number): Timer;
  clear(timer: Timer): void;
};
export function browserLiveEnvironment(audio: HTMLAudioElement): LiveEnvironment {
  let context: AudioContext | null = null;
  return {
    now: () => Date.now(),
    uuid: () => crypto.randomUUID(),
    post: (path, body) =>
      requestJson(base + path, body, AbortSignal.timeout(path === "/finish" ? 60_000 : 45_000)),
    getMicrophone: () =>
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      }),
    createPeer: () => new RTCPeerConnection(),
    audio,
    unlockAudio: async () => {
      context = new AudioContext();
      await context.resume();
    },
    meter: (stream, sample) => {
      if (!context) throw new Error("Audio unavailable");
      const input = context.createMediaStreamSource(stream),
        analyser = context.createAnalyser();
      analyser.fftSize = 256;
      input.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let frame = 0,
        active = true;
      const tick = () => {
        if (!active) return;
        analyser.getByteTimeDomainData(data);
        const rms = Math.sqrt(
          data.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / data.length,
        );
        sample(Math.min(1, rms * 6));
        frame = requestAnimationFrame(tick);
      };
      tick();
      return () => {
        active = false;
        cancelAnimationFrame(frame);
        input.disconnect();
        analyser.disconnect();
        sample(0);
      };
    },
    closeAudio: () => {
      const previous = context;
      context = null;
      if (previous && previous.state !== "closed") void previous.close().catch(() => {});
    },
    abandon: (id) => {
      const body = JSON.stringify({ id });
      try {
        if (navigator.sendBeacon(base + "/finish", new Blob([body], { type: "application/json" })))
          return;
      } catch {
        /* Best effort on page exit; the server expiry remains authoritative. */
      }
      void fetch(base + "/finish", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    },
    set: (callback, ms) => setTimeout(callback, ms),
    clear: (timer) => clearTimeout(timer),
  };
}

/** Owns the microphone, peer, playback and all timers. It never awards learning evidence. */
export class LiveConversationClient {
  private snapshot: LiveSnapshot = { ...initialLiveSnapshot };
  private generation = 0;
  private disposed = false;
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private microphone: MediaStream | null = null;
  private remote: MediaStream | null = null;
  private stopMeter: (() => void) | null = null;
  private connectionTimer: Timer | null = null;
  private heartbeatTimer: Timer | null = null;
  private tickTimer: Timer | null = null;
  private cutoffTimer: Timer | null = null;
  private events = new LiveEventAccumulator();
  private started = false;
  private sdpReady = false;
  private deadline = 0;
  private speakingUntil = 0;
  private finishing: Promise<void> | null = null;
  constructor(
    private readonly env: LiveEnvironment,
    private readonly change: (snapshot: LiveSnapshot) => void,
    private readonly energy: (energy: number) => void = () => {},
  ) {}
  get current() {
    return this.snapshot;
  }
  private publish(patch: Partial<LiveSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    if (!this.disposed) this.change(this.snapshot);
  }
  private live() {
    return ["listening", "speaking", "paused"].includes(this.snapshot.phase);
  }
  private send(
    type: Extract<
      ClientEvent,
      { type: "session.input_audio.mute" | "session.input_audio.unmute" | "session.close" }
    >["type"],
  ) {
    if (this.channel?.readyState !== "open") return false;
    try {
      this.channel.send(JSON.stringify({ type }));
      return true;
    } catch {
      return false;
    }
  }
  async start(settings: LiveSettings) {
    if (
      this.disposed ||
      !["idle", "completed", "error"].includes(this.snapshot.phase) ||
      this.finishing ||
      (this.snapshot.session && this.snapshot.phase === "error")
    )
      return;
    this.cleanup();
    const own = ++this.generation,
      began = this.env.now();
    const current = () => !this.disposed && own === this.generation;
    this.events = new LiveEventAccumulator();
    this.started = false;
    this.sdpReady = false;
    this.snapshot = { ...initialLiveSnapshot };
    this.publish({ phase: "connecting", message: "Preparando sua conversa…" });
    this.connectionTimer = this.env.set(() => {
      if (current()) void this.fail("A conexão demorou demais. Tente abrir a conversa novamente.");
    }, 30_000);
    try {
      await this.env.unlockAudio();
      if (!current()) return;
      const media = await this.env.getMicrophone();
      if (!current()) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      this.microphone = media;
      media.getAudioTracks().forEach((track) => {
        track.enabled = false;
        track.onended = () => {
          if (current())
            void this.fail("O microfone foi desconectado. A conversa foi interrompida.");
        };
      });
      const peer = this.env.createPeer();
      this.peer = peer;
      const channel = peer.createDataChannel("oai-events", { ordered: true });
      this.channel = channel;
      channel.onmessage = (event) => {
        if (!current() || this.snapshot.phase === "ending") return;
        try {
          this.receive(JSON.parse(String(event.data)));
        } catch {
          void this.fail("A conversa recebeu uma resposta incompleta e foi interrompida.");
        }
      };
      channel.onclose = () => {
        if (current() && this.snapshot.phase !== "ending")
          void this.fail("A conexão da conversa foi interrompida.");
      };
      channel.onerror = () => {
        if (current()) void this.fail("A conexão da conversa foi interrompida.");
      };
      peer.onconnectionstatechange = () => {
        if (current() && ["failed", "closed", "disconnected"].includes(peer.connectionState))
          void this.fail("A conexão da conversa foi interrompida.");
      };
      peer.ontrack = (event) => {
        if (!current()) {
          event.track.stop();
          return;
        }
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        this.remote = stream;
        event.track.onended = () => {
          if (current())
            void this.fail("O áudio da conversa foi interrompido. O microfone foi desligado.");
        };
        this.env.audio.srcObject = stream;
        this.env.audio.muted = !this.live() || this.snapshot.phase === "paused";
        try {
          this.stopMeter?.();
          this.stopMeter = this.env.meter(stream, (level) => {
            if (!current()) return;
            const audible =
              this.live() && this.snapshot.phase !== "paused" && !this.env.audio.muted;
            this.energy(audible ? level : 0);
            if (audible) {
              if (level > 0.035) this.speakingUntil = this.env.now() + 250;
              const phase = this.env.now() < this.speakingUntil ? "speaking" : "listening";
              if (this.snapshot.phase !== phase) this.publish({ phase });
            }
          });
          void this.env.audio.play().catch(() => {
            if (current())
              void this.fail(
                "Não foi possível ouvir a conversa. Confira a saída de áudio e tente novamente.",
              );
          });
        } catch {
          if (current())
            void this.fail("Não foi possível preparar a reprodução de áudio neste navegador.");
        }
      };
      media.getTracks().forEach((track) => peer.addTrack(track, media));
      const offer = await peer.createOffer();
      if (!current()) return;
      await peer.setLocalDescription(offer);
      if (!current()) return;
      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new LiveClientError("Não foi possível preparar o áudio neste navegador.");
      const session = await this.env.post<LiveSession>("/session", {
        ...settings,
        sdp,
        operationId: this.env.uuid(),
      });
      if (!current()) {
        if (typeof session?.id === "string") this.env.abandon(session.id);
        return;
      }
      if (
        !session?.id ||
        typeof session.answerSdp !== "string" ||
        session.model !== "gpt-live-1" ||
        !Number.isFinite(Date.parse(session.expiresAt)) ||
        !(session.maxSeconds > 0)
      ) {
        if (typeof session?.id === "string") this.env.abandon(session.id);
        throw new LiveClientError("A conversa não pôde ser confirmada. Tente novamente.");
      }
      this.publish({ session });
      this.deadline = Math.min(
        began + Math.min(480, session.maxSeconds) * 1000,
        Date.parse(session.expiresAt),
      );
      this.cutoffTimer = this.env.set(
        () => {
          if (!current()) return;
          void this.finish("O tempo desta conversa terminou. Seu microfone foi desligado.");
        },
        Math.max(0, this.deadline - this.env.now()),
      );
      await peer.setRemoteDescription({ type: "answer", sdp: session.answerSdp });
      if (!current()) return;
      this.sdpReady = true;
      this.activate();
    } catch (error) {
      if (!current()) return;
      const denied =
        error instanceof Error && ["NotAllowedError", "PermissionDeniedError"].includes(error.name);
      void this.fail(
        denied
          ? "O microfone não foi autorizado. Permita o acesso nas configurações do navegador e tente novamente."
          : liveErrorMessage(
              error,
              "Não foi possível abrir a conversa. Confira seu microfone e sua conexão.",
            ),
      );
    }
  }
  private activate() {
    if (!this.started || !this.sdpReady || this.snapshot.phase !== "connecting") return;
    if (this.env.now() >= this.deadline) {
      void this.finish("O tempo desta conversa terminou.");
      return;
    }
    if (this.connectionTimer !== null) this.env.clear(this.connectionTimer);
    this.connectionTimer = null;
    this.microphone?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    this.env.audio.muted = false;
    this.publish({ phase: "listening", message: "" });
    this.tick();
    this.heartbeat();
  }
  private receive(event: unknown) {
    const kind = this.events.accept(event);
    if (kind === "started") {
      this.started = true;
      this.activate();
    }
    if (kind === "transcript") this.publish({ turns: this.events.turns });
    if (kind === "usage") this.publish({ usageSeconds: this.events.usageSeconds });
    if (kind === "closed")
      void this.finish(
        record(event) && event.reason === "expired"
          ? "O tempo desta conversa terminou."
          : "A conversa foi encerrada. Se isso aconteceu antes do esperado, confira a conexão.",
      );
    if (kind === "error")
      void this.fail(
        "A conversa foi interrompida. Você pode consultar o histórico ou tentar novamente.",
      );
  }
  private tick() {
    if (!this.live()) return;
    this.publish({ remaining: Math.max(0, Math.ceil((this.deadline - this.env.now()) / 1000)) });
    if (this.env.now() >= this.deadline) {
      void this.finish("O tempo desta conversa terminou.");
      return;
    }
    const own = this.generation;
    this.tickTimer = this.env.set(() => {
      if (own === this.generation && !this.disposed) this.tick();
    }, 1000);
  }
  private heartbeat() {
    if (!this.live()) return;
    const own = this.generation,
      id = this.snapshot.session!.id;
    const current = () => !this.disposed && own === this.generation && this.live();
    this.heartbeatTimer = this.env.set(() => {
      if (!current()) return;
      void this.env
        .post<{ ok: true }>("/control", { id, action: "heartbeat" })
        .then((result) => {
          if (!current()) return;
          if (!result?.ok) throw new Error();
          this.heartbeat();
        })
        .catch(() => {
          if (current())
            void this.fail(
              "Não foi possível manter a conversa conectada. O microfone foi desligado.",
            );
        });
    }, 15_000);
  }
  async pause(paused: boolean) {
    if (!this.live() || this.snapshot.pending || (this.snapshot.phase === "paused") === paused)
      return;
    const own = this.generation,
      id = this.snapshot.session!.id;
    if (paused) {
      this.mute(true);
      this.send("session.input_audio.mute");
      this.publish({ phase: "paused" });
    }
    this.publish({ pending: true });
    try {
      const result = await this.env.post<{ ok: boolean; status: string }>("/control", {
        id,
        action: paused ? "pause" : "resume",
      });
      if (own !== this.generation || this.disposed) return;
      if (!result.ok || result.status !== (paused ? "paused" : "active")) throw new Error();
      if (!paused) {
        if (!this.send("session.input_audio.unmute")) throw new Error();
        this.mute(false);
      }
      this.publish({ phase: paused ? "paused" : "listening", pending: false });
    } catch {
      if (own === this.generation && !this.disposed)
        void this.fail(
          "Não foi possível confirmar a pausa. A conversa foi encerrada por segurança.",
        );
    }
  }
  async message(text: string) {
    if (!this.live() || this.snapshot.phase === "paused" || this.snapshot.pending || !text.trim())
      return false;
    const own = this.generation;
    this.publish({ pending: true });
    try {
      const result = await this.env.post<{ ok: boolean }>("/control", {
        id: this.snapshot.session!.id,
        action: "message",
        text: text.trim(),
      });
      if (own !== this.generation || this.disposed) return false;
      if (!result.ok) throw new Error();
      this.publish({ pending: false });
      return true;
    } catch {
      if (own === this.generation && !this.disposed)
        void this.fail("Não foi possível enviar seu pedido. A conversa foi interrompida.");
      return false;
    }
  }
  private mute(muted: boolean) {
    this.microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.env.audio.muted = muted;
    if (muted) this.energy(0);
  }
  private fail(message: string) {
    return this.finish(message, true);
  }
  finish(message = "", interrupted = false): Promise<void> {
    if (this.disposed || this.snapshot.phase === "completed") return Promise.resolve();
    if (this.finishing) return this.finishing;
    const id = this.snapshot.session?.id;
    ++this.generation;
    this.send("session.close");
    this.cleanup();
    if (!id) {
      this.publish({ phase: interrupted ? "error" : "idle", pending: false, message });
      return Promise.resolve();
    }
    const own = this.generation;
    this.publish({ phase: "ending", pending: false, message });
    this.finishing = this.env
      .post<LiveFinished>("/finish", { id })
      .then((result) => {
        if (this.disposed || own !== this.generation) return;
        if (!confirmedFinish(result, id)) throw new Error();
        this.publish({
          phase: "completed",
          resultStatus: result.status,
          turns: result.transcript,
          report: result.report,
          reportError: result.reportError ?? "",
          message,
        });
      })
      .catch(() => {
        if (!this.disposed && own === this.generation)
          this.publish({
            phase: "error",
            message:
              "O áudio foi encerrado, mas o resumo ainda não foi confirmado. Tente concluir novamente ou consulte o histórico.",
          });
      })
      .finally(() => {
        this.finishing = null;
      });
    return this.finishing;
  }
  private cleanup() {
    for (const timer of [
      this.connectionTimer,
      this.heartbeatTimer,
      this.tickTimer,
      this.cutoffTimer,
    ])
      if (timer !== null) this.env.clear(timer);
    this.connectionTimer = this.heartbeatTimer = this.tickTimer = this.cutoffTimer = null;
    this.mute(true);
    this.stopMeter?.();
    this.stopMeter = null;
    if (this.channel) {
      this.channel.onmessage = this.channel.onclose = this.channel.onerror = null;
      this.channel.close();
    }
    this.channel = null;
    if (this.peer) {
      this.peer.ontrack = this.peer.onconnectionstatechange = null;
      this.peer.close();
    }
    this.peer = null;
    this.microphone?.getTracks().forEach((track) => track.stop());
    this.microphone = null;
    this.remote?.getTracks().forEach((track) => track.stop());
    this.remote = null;
    this.env.audio.pause();
    this.env.audio.srcObject = null;
    this.env.closeAudio();
    this.energy(0);
  }
  dispose() {
    if (this.disposed) return;
    const id = this.snapshot.session?.id;
    ++this.generation;
    this.send("session.close");
    this.disposed = true;
    this.cleanup();
    if (id && this.snapshot.phase !== "completed") this.env.abandon(id);
  }
}
