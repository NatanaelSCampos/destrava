import profiles from "../../src/content/azure-voice-profiles.json" with { type: "json" };
const azureVoice = (locale, gender) => profiles[locale]?.[gender];
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const digest = (b) => crypto.createHash("sha256").update(b).digest("hex");
const aliases = JSON.parse(fs.readFileSync("src/content/azure-recordings.json", "utf8")).aliases;
let files = 0,
  bytes = 0,
  active = 0;
const voices = new Set();
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) walk(p);
    else if (p.endsWith(".mp3")) {
      const audio = fs.readFileSync(p),
        r = JSON.parse(fs.readFileSync(p + ".json", "utf8"));
      assert.equal(digest(audio), r.sha256, p);
      assert.equal(audio.length, r.bytes);
      assert(r.durationSeconds > 0 && r.durationSeconds < 600);
      assert.equal(r.provider, "Microsoft Azure Speech");
      assert.equal(r.modelCategory, "Neural");
      assert(!r.voice.includes("HD"));
      assert.equal(path.basename(p, ".mp3"), r.textSha256);
      assert(p.split(path.sep).includes(r.gender));
      assert.equal(r.voice, azureVoice(r.locale, r.gender));
      voices.add(r.voice);
      files++;
      bytes += audio.length;
    }
  }
}
walk("public/media/azure/v1");
for (const id of ["ingles-a1-pessoal", "espanol-a-tu-paso-a1"]) {
  const media = JSON.parse(fs.readFileSync("content/courses/" + id + "/media.json", "utf8"));
  for (const asset of media.filter((a) => a.type === "audio")) {
    assert.equal(asset.metadata.speechOrigin, "synthetic_azure");
    assert.equal(asset.metadata.audioAlternatives.length, 2);
    const src = aliases[asset.src];
    assert(src, "No canonical alias " + asset.id);
    assert.equal(
      digest(fs.readFileSync("public" + asset.src)),
      digest(fs.readFileSync("public" + src)),
    );
    for (const alternative of asset.metadata.audioAlternatives) {
      assert.equal(digest(fs.readFileSync("public" + alternative.src)), alternative.sha256);
    }
    active++;
  }
}
const canonical = (t) =>
  t
    .trim()
    .replace(/\s*\/\s*/g, ", ")
    .replace(/\s+/g, " ")
    .normalize("NFC");
let narration = 0;
const lessons = [];
for (const id of ["ingles-a1-pessoal", "espanol-a-tu-paso-a1"])
  for (const file of fs.readdirSync("content/courses/" + id + "/interactive-lessons")) {
    const d = JSON.parse(
      fs.readFileSync("content/courses/" + id + "/interactive-lessons/" + file, "utf8"),
    );
    let seconds = 0;
    for (const segment of d.segments)
      for (const line of segment.presentation?.transcript ?? []) {
        const language = line.textPresentation.language,
          locale =
            language === "pt-BR"
              ? "pt-BR"
              : language.startsWith("es")
                ? "es-ES"
                : language.startsWith("en")
                  ? "en-US"
                  : null;
        assert(locale);
        for (const gender of ["female", "male"]) {
          const src =
            "public/media/azure/v1/" +
            locale +
            "/" +
            gender +
            "/" +
            digest(canonical(line.text)) +
            ".mp3";
          assert(fs.existsSync(src), "Narration missing " + d.id);
          if (gender === "female")
            seconds += JSON.parse(fs.readFileSync(src + ".json", "utf8")).durationSeconds + 0.65;
        }
        narration++;
      }
    lessons.push({ id: d.id, recordedPresentationSeconds: Math.round(seconds) });
  }
assert(voices.size >= 6);
console.log(
  JSON.stringify(
    {
      status: "PASS",
      files,
      bytes,
      activeCourseMedia: active,
      voices: [...voices],
      recordedNarrationLines: narration,
      lessons,
      claims: { humanAudition: false, actualAzureSkuVerified: false },
    },
    null,
    2,
  ),
);
