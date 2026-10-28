export interface ConversationCapture {
  pause(paused: boolean): void;
  finish(): Promise<Blob>;
  abort(): void;
}
export async function captureConversationMicrophone(
  stream: MediaStream,
): Promise<ConversationCapture> {
  const context = new AudioContext();
  let node: AudioWorkletNode | undefined,
    input: MediaStreamAudioSourceNode | undefined,
    done = false;
  const chunks: Int16Array[] = [];
  let count = 0,
    resolve: (() => void) | undefined;
  const close = () => {
    input?.disconnect();
    node?.disconnect();
    if (context.state !== "closed") void context.close();
  };
  try {
    await context.audioWorklet.addModule("/audio/conversation-capture.js");
    await context.resume();
    node = new AudioWorkletNode(context, "conversation-capture");
    node.port.onmessage = ({ data }) => {
      if (done) return;
      if (data.done) resolve?.();
      else if (data.samples instanceof Int16Array) {
        count += data.samples.length;
        if (count > 16000 * 490) {
          done = true;
          chunks.length = 0;
          close();
          resolve?.();
          return;
        }
        chunks.push(data.samples);
      }
    };
    input = context.createMediaStreamSource(stream);
    input.connect(node);
    node.connect(context.destination);
  } catch (error) {
    close();
    throw error;
  }
  return {
    pause(paused) {
      if (!done) node!.port.postMessage(paused ? "pause" : "resume");
    },
    async finish() {
      if (done) throw Error("Recording unavailable");
      let timer: ReturnType<typeof setTimeout> | undefined;
      await new Promise<void>((r, j) => {
        resolve = r;
        timer = setTimeout(() => j(Error("Recording unavailable")), 3000);
        node!.port.postMessage("finish");
      }).finally(() => {
        if (timer) clearTimeout(timer);
        close();
      });
      done = true;
      if (count <= 0) throw Error("Empty recording");
      const bytes = new ArrayBuffer(44 + count * 2),
        view = new DataView(bytes);
      const text = (at: number, value: string) => {
        for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
      };
      text(0, "RIFF");
      view.setUint32(4, 36 + count * 2, true);
      text(8, "WAVE");
      text(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 16000, true);
      view.setUint32(28, 32000, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      text(36, "data");
      view.setUint32(40, count * 2, true);
      let at = 44;
      for (const chunk of chunks)
        for (const value of chunk) {
          view.setInt16(at, value, true);
          at += 2;
        }
      chunks.length = 0;
      return new Blob([bytes], { type: "audio/wav" });
    },
    abort() {
      done = true;
      chunks.length = 0;
      close();
      resolve?.();
    },
  };
}
