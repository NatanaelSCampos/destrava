/* Records only the local microphone. PCM16 mono at 16kHz; no output audio. */
class ConversationCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Int16Array(4096);
    this.at = 0;
    this.elapsed = 0;
    this.active = true;
    this.port.onmessage = ({ data }) => {
      if (data === "finish") {
        this.flush();
        this.active = false;
        this.port.postMessage({ done: true });
      } else if (data === "pause") this.active = false;
      else if (data === "resume") this.active = true;
    };
  }
  flush() {
    if (this.at) {
      const bytes = this.chunk.slice(0, this.at);
      this.port.postMessage({ samples: bytes }, [bytes.buffer]);
      this.at = 0;
    }
  }
  process(inputs) {
    if (!this.active) return true;
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.elapsed += 16000;
      if (this.elapsed >= sampleRate) {
        this.elapsed -= sampleRate;
        const v = Math.max(-1, Math.min(1, channel[i]));
        this.chunk[this.at++] = Math.round(v * (v < 0 ? 32768 : 32767));
        if (this.at === this.chunk.length) this.flush();
      }
    }
    return true;
  }
}
registerProcessor("conversation-capture", ConversationCapture);
