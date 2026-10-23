const fail = () => { throw new Error("Invalid or ambiguous JSON configuration; values suppressed."); };

// JSON.parse alone silently accepts duplicate keys. Configuration must be unambiguous.
export function parseReleaseJson(text) {
  if (typeof text !== "string" || text.length > 65536) fail("invalid profile document");
  let pos = 0;
  const space = () => { while (/\s/.test(text[pos] ?? "") && pos < text.length) pos++; };
  const string = () => {
    const start = pos++;
    while (pos < text.length) {
      if (text[pos] === "\\") { pos += 2; continue; }
      if (text[pos++] === '"') return JSON.parse(text.slice(start, pos));
    }
    fail("invalid JSON string");
  };
  const value = () => {
    space();
    if (text[pos] === "{") {
      pos++; space(); const keys = new Set();
      if (text[pos] === "}") { pos++; return; }
      while (pos < text.length) {
        space(); if (text[pos] !== '"') fail("invalid JSON object");
        const key = string();
        if (keys.has(key) || ["__proto__", "prototype", "constructor"].includes(key)) fail("duplicate or unsafe JSON key");
        keys.add(key); space(); if (text[pos++] !== ":") fail("invalid JSON object");
        value(); space(); const next = text[pos++];
        if (next === "}") return;
        if (next !== ",") fail("invalid JSON object");
      }
      fail("incomplete JSON object");
    }
    if (text[pos] === "[") {
      pos++; space(); if (text[pos] === "]") { pos++; return; }
      while (pos < text.length) {
        value(); space(); const next = text[pos++];
        if (next === "]") return;
        if (next !== ",") fail("invalid JSON array");
      }
      fail("incomplete JSON array");
    }
    if (text[pos] === '"') { string(); return; }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(pos));
    if (!match) fail("invalid JSON value");
    pos += match[0].length;
  };
  try { value(); space(); if (pos !== text.length) fail("trailing JSON input"); return JSON.parse(text); }
  catch { fail("invalid or ambiguous JSON profile"); }
}
