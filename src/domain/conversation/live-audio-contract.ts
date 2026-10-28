/** Fixed PCM contract; verifies duration from bytes, never from a browser claim. */
export function inspectConversationWav(bytes: Uint8Array) {
  if (bytes.byteLength < 46 || bytes.byteLength > 16000044) throw Error("Invalid WAV size");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    text = (at: number, len: number) => new TextDecoder().decode(bytes.slice(at, at + len));
  if (
    text(0, 4) !== "RIFF" ||
    text(8, 4) !== "WAVE" ||
    text(12, 4) !== "fmt " ||
    text(36, 4) !== "data" ||
    v.getUint32(4, true) !== bytes.byteLength - 8 ||
    v.getUint32(16, true) !== 16 ||
    v.getUint16(20, true) !== 1 ||
    v.getUint16(22, true) !== 1 ||
    v.getUint32(24, true) !== 16000 ||
    v.getUint32(28, true) !== 32000 ||
    v.getUint16(32, true) !== 2 ||
    v.getUint16(34, true) !== 16 ||
    v.getUint32(40, true) !== bytes.byteLength - 44 ||
    (bytes.byteLength - 44) % 2
  )
    throw Error("Invalid PCM WAV");
  const seconds = (bytes.byteLength - 44) / 32000;
  if (seconds > 490) throw Error("Audio too long");
  return { seconds, bytes: bytes.byteLength };
}
