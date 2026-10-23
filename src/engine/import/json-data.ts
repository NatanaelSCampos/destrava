import { packageLimits } from "@/content/package-contract";
import { assertWellFormedText } from "@/engine/text/representation";

/** Native JSON only. Reject duplicate keys, prototype-shaped data and excessive nesting before schema execution. */
export function parsePackageJson(bytes: Uint8Array): unknown {
  if (bytes.byteLength > packageLimits.jsonBytes) throw new Error("JSON_SIZE_LIMIT");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value: unknown = JSON.parse(text);
  const stack: Array<{ object: boolean; keys: Set<string> }> = [];
  let previous = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (/\s/.test(char)) continue;
    if (char === '"') {
      const start = i;
      for (i++; i < text.length; i++) {
        if (text[i] === "\\") {
          i++;
          continue;
        }
        if (text[i] === '"') break;
      }
      const frame = stack.at(-1);
      if (frame?.object && (previous === "{" || previous === ",")) {
        const name = JSON.parse(text.slice(start, i + 1));
        if (frame.keys.has(name)) throw new Error("JSON_DUPLICATE_KEY");
        frame.keys.add(name);
      }
      previous = "string";
    } else if (char === "{" || char === "[") {
      stack.push({ object: char === "{", keys: new Set() });
      previous = char;
    } else if (char === "}" || char === "]") {
      stack.pop();
      previous = char;
    } else previous = char;
  }
  let count = 0;
  const queue: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  while (queue.length) {
    const item = queue.pop()!;
    if (++count > packageLimits.jsonNodes || item.depth > packageLimits.jsonDepth)
      throw new Error("JSON_COMPLEXITY_LIMIT");
    if (typeof item.value === "string") {
      try {
        assertWellFormedText(item.value);
      } catch {
        throw new Error("JSON_UNICODE_INVALID");
      }
    }
    if (item.value && typeof item.value === "object")
      for (const [name, child] of Object.entries(item.value)) {
        try {
          assertWellFormedText(name);
        } catch {
          throw new Error("JSON_UNICODE_INVALID");
        }
        if (["__proto__", "constructor", "prototype"].includes(name))
          throw new Error("JSON_UNSAFE_KEY");
        queue.push({ value: child, depth: item.depth + 1 });
      }
  }
  return value;
}
export function strippedFields(
  raw: unknown,
  parsed: unknown,
  path: (string | number)[] = [],
): Array<(string | number)[]> {
  if (!raw || typeof raw !== "object" || !parsed || typeof parsed !== "object") return [];
  const result: Array<(string | number)[]> = [];
  for (const [name, value] of Object.entries(raw)) {
    const part = Array.isArray(raw) ? Number(name) : name;
    if (!Object.hasOwn(parsed, name)) result.push([...path, part]);
    else
      result.push(
        ...strippedFields(value, (parsed as Record<string, unknown>)[name], [...path, part]),
      );
  }
  return result;
}
