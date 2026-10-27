import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dns from "node:dns";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { canonicalSpeechText, azureVoices, azureAudioPath } from "../../src/lib/azure-voices.ts";
dns.setDefaultResultOrder("ipv4first");
const sdk = createRequire(import.meta.url)("microsoft-cognitiveservices-speech-sdk");
const argument = (name) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null;
const root = path.resolve(argument("--run-dir") ?? ".tmp/azure-course-audio-20261026");
fs.mkdirSync(root, { recursive: true });
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const voiceFile = argument("--guide-manifest");
assert(voiceFile, "Pass an explicit --guide-manifest JSON authored for this candidate");
const guide = JSON.parse(fs.readFileSync(voiceFile, "utf8").replace(/^\uFEFF/, ""));
const guideRows = Array.isArray(guide)
  ? guide
  : (guide.audio ?? guide.entries ?? guide.texts ?? guide.requiredAudio ?? guide.items);
assert(Array.isArray(guideRows), "Expected stable guided audio manifest array");
const entries = new Map(),
  assets = [];
function add(text, locale, use) {
  text = canonicalSpeechText(text);
  if (!text || !azureVoices[locale]) return;
  const key = locale + ":" + hash(text);
  const old = entries.get(key);
  if (old) old.uses.push(use);
  else entries.set(key, { key, text, locale, hash: hash(text), uses: [use] });
}
for (const id of ["ingles-a1-pessoal", "espanol-a-tu-paso-a1"]) {
  const locale = id.startsWith("ingles") ? "en-US" : "es-ES",
    media = JSON.parse(fs.readFileSync("content/courses/" + id + "/media.json", "utf8"));
  for (const item of media.filter((item) => item.type === "audio")) {
    if (item.metadata?.voice === "coral") continue; // Superseded mixed-language demo: separately authored clips replace it.
    assert(item.metadata?.transcript, "Missing canonical transcript: " + item.id);
    add(item.metadata.transcript, locale, { courseId: id, mediaId: item.id });
    assets.push({
      courseId: id,
      id: item.id,
      originalSrc: item.src,
      locale,
      text: canonicalSpeechText(item.metadata.transcript),
    });
  }
}
for (const row of guideRows) add(row.text, row.locale, { guided: true, uses: row.uses });
for (const id of ["ingles-a1-pessoal", "espanol-a-tu-paso-a1"]) {
  const b = JSON.parse(fs.readFileSync("src/content/generated/packs/" + id + ".json", "utf8"));
  const locale = id.startsWith("ingles") ? "en-US" : "es-ES";
  for (const a of b.moduleData.alphabet ?? [])
    for (const text of [a.name, a.word, a.example])
      if (text) add(text, locale, { module: "alphabet" });
  for (const n of b.moduleData.numbers?.prompts ?? [])
    for (const text of [n.spoken, n.example]) if (text) add(text, locale, { module: "numbers" });
  for (const r of b.moduleData.regionalVariants ?? [])
    for (const v of r.variants)
      for (const text of [v.term, v.example]) if (text) add(text, v.region, { module: "regional" });
  for (const c of b.course.concepts)
    for (const ex of c.examples ?? []) add(ex.target, locale, { concept: c.id });
  for (const w of b.course.lexicon) {
    for (const text of [w.lemma, w.surface]) if (text) add(text, locale, { lexicon: w.id });
    for (const ex of w.examples ?? []) add(ex.target, locale, { lexicon: w.id });
  }
}

for (const text of [
  "Vamos ouvir com calma. Veja este exemplo e observe como a conversa continua.",
  "Onde você está?",
  "Estou na praça.",
])
  add(text, "pt-BR", { preview: true });
for (const item of [...entries.values()])
  if (item.locale !== "pt-BR" && item.text.length < 300)
    for (const word of item.text.split(/\s+/))
      if (/[\p{L}\p{N}]/u.test(word)) add(word, item.locale, { word: true });
const rows = [...entries.values()].sort((a, b) => a.key.localeCompare(b.key));
const jobs = [];
for (const locale of Object.keys(azureVoices))
  for (const gender of ["female", "male"]) {
    const list = rows.filter(
      (item) =>
        item.locale === locale &&
        (!fs.existsSync("public" + azureAudioPath(locale, gender, item.hash)) ||
          !fs.existsSync("public" + azureAudioPath(locale, gender, item.hash) + ".json")),
    );
    let part = [],
      characters = 0;
    const emit = () => {
      if (part.length) {
        const voice = azureVoices[locale][gender];
        const id = hash(JSON.stringify([voice, part.map((r) => r.key), "prosody-8-v1"]));
        jobs.push({ id, locale, gender, voice, entries: part, characters });
        part = [];
        characters = 0;
      }
    };
    for (const item of list) {
      if (characters + item.text.length > 2800 || part.length >= 90) emit();
      part.push(item);
      characters += item.text.length;
    }
    emit();
  }
const characterBudget = jobs.reduce((n, j) => n + j.characters, 0);
const priorFile = argument("--previous-journal");
const previousCharacters = priorFile
  ? JSON.parse(fs.readFileSync(priorFile, "utf8")).requests.reduce((n, r) => n + r.characters, 0)
  : 0;
assert(previousCharacters + characterBudget <= 200_000, "Combined authoring cap exceeded");
assert(characterBudget <= 200_000, "Authoring budget exceeded; no synthesis started");
const plan = {
  at: new Date().toISOString(),
  provider: "Microsoft Azure Speech",
  voiceCategory: "Neural (non-HD)",
  skuVerified: false,
  remainingAzureMonthlyAllowanceVerified: false,
  officialNominalF0Characters: 500000,
  sourceGuideManifestSha256: hash(fs.readFileSync(voiceFile)),
  characterBudget,
  utteranceCount: rows.length,
  audioFileCount: 2 * rows.length,
  jobs: jobs.map(({ entries, ...j }) => ({ ...j, utterances: entries.length })),
  entries: rows,
  assets,
};
fs.writeFileSync(path.join(root, "audio-plan.private.json"), JSON.stringify(plan, null, 2));
if (!process.argv.includes("--generate")) {
  console.log(
    JSON.stringify({
      status: "PLANNED",
      characters: characterBudget,
      jobs: jobs.length,
      utterances: rows.length,
      audioFiles: 2 * rows.length,
      skuVerified: false,
    }),
  );
  process.exit(0);
}
const envFile = process.argv[process.argv.indexOf("--env-file") + 1];
assert(envFile && process.argv.includes("--env-file"));
const values = {};
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) values[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}
assert(values.AZURE_SPEECH_KEY);
assert.equal(new URL(values.AZURE_SPEECH_ENDPOINT).hostname, "eastus.api.cognitive.microsoft.com");
const ffmpeg = path.resolve(argument("--ffmpeg") ?? ".tmp/english-u12-20261026/ffmpeg/ffmpeg.exe");
const ffprobe = path.resolve(
  argument("--ffprobe") ?? ".tmp/english-u12-20261026/ffmpeg/ffprobe.exe",
);
assert(fs.existsSync(ffmpeg) && fs.existsSync(ffprobe));
const xml = (t) =>
  t
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const journalFile = path.join(root, "synthesis-journal.json");
const journal = fs.existsSync(journalFile)
  ? JSON.parse(fs.readFileSync(journalFile, "utf8"))
  : { at: new Date().toISOString(), requests: [], results: [] };
const save = () => fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2));
function command(args) {
  return new Promise((resolve, reject) => {
    const cp = spawn(ffmpeg, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let errors = "";
    cp.stderr.on("data", (b) => (errors += b));
    cp.once("error", reject);
    cp.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error("Audio encoding failed, exit " + code + ": " + errors.slice(-150))),
    );
  });
}
function wav(data) {
  const b = Buffer.alloc(44);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + data.length, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(data.length, 40);
  return Buffer.concat([b, data]);
}
for (const job of jobs) {
  const pcmFile = path.join(root, job.id + ".pcm"),
    marksFile = path.join(root, job.id + ".bookmarks.json");
  let marks;
  if (fs.existsSync(pcmFile) && fs.existsSync(marksFile)) {
    marks = JSON.parse(fs.readFileSync(marksFile, "utf8"));
  } else {
    assert(
      !journal.requests.some((r) => r.job === job.id && r.status === "STARTED"),
      "Prior request has unknown result; reconcile before retry",
    );
    const recent = journal.requests.filter((r) => Date.now() - Date.parse(r.at) < 61000);
    if (recent.length >= 18) {
      const delay = 62000 - (Date.now() - Math.min(...recent.map((r) => Date.parse(r.at))));
      console.log("Respecting Azure F0 request window");
      await new Promise((r) => setTimeout(r, Math.max(0, delay)));
    }
    assert(
      previousCharacters +
        journal.requests.reduce((n, r) => n + r.characters, 0) +
        job.characters <=
        200_000,
      "Cumulative authoring cap",
    );
    const request = {
      job: job.id,
      voice: job.voice,
      characters: job.characters,
      status: "STARTED",
      at: new Date().toISOString(),
    };
    journal.requests.push(request);
    save();
    const config = sdk.SpeechConfig.fromSubscription(values.AZURE_SPEECH_KEY, "eastus");
    config.speechSynthesisVoiceName = job.voice;
    config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm;
    const synth = new sdk.SpeechSynthesizer(config, null);
    marks = {};
    synth.bookmarkReached = (_, e) => {
      marks[e.text] = Number(e.audioOffset);
    };
    const body =
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' +
      job.locale +
      '"><voice name="' +
      job.voice +
      '"><prosody rate="-8%">' +
      job.entries
        .map(
          (r, i) =>
            '<bookmark mark="s' +
            i +
            '"/>' +
            xml(r.text) +
            '<bookmark mark="e' +
            i +
            '"/><break time="300ms"/>',
        )
        .join("") +
      "</prosody></voice></speak>";
    assert(Buffer.byteLength(body) < 62000);
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        synth.close();
        reject(Error("Synthesis deadline"));
      }, 180000);
      synth.speakSsmlAsync(
        body,
        (r) => {
          clearTimeout(timer);
          synth.close();
          resolve(r);
        },
        () => {
          clearTimeout(timer);
          synth.close();
          reject(Error("Azure synthesis transport error"));
        },
      );
    });
    if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
      request.status = "FAILED";
      request.reason = result.reason;
      save();
      throw Error("Azure synthesis failed; no automatic retry or provider switch");
    }
    const pcm = Buffer.from(result.audioData);
    assert(pcm.length > 1000);
    fs.writeFileSync(pcmFile, pcm, { flag: "wx" });
    fs.writeFileSync(marksFile, JSON.stringify(marks));
    request.status = "COMPLETED";
    request.pcmBytes = pcm.length;
    request.bookmarks = Object.keys(marks).length;
    save();
    if (!Number.isFinite(marks["e" + (job.entries.length - 1)])) {
      marks["e" + (job.entries.length - 1)] = (pcm.length / 48000) * 1e7;
      marks._lastEndSource = "physical PCM end; final service bookmark absent";
      fs.writeFileSync(marksFile, JSON.stringify(marks));
    }
    const invalid = job.entries
      .map((r, i) => ({ index: i, start: marks["s" + i], end: marks["e" + i], hash: r.hash }))
      .filter((r) => !Number.isFinite(r.start) || !Number.isFinite(r.end) || r.end <= r.start);
    if (invalid.length)
      throw Error(
        "Incomplete synthesis bookmark proof: " +
          JSON.stringify({
            job: job.id,
            marks: Object.keys(marks).length,
            expected: job.entries.length * 2,
            invalid,
          }),
      );
  }
  const pcm = fs.readFileSync(pcmFile),
    clips = [];
  const last = job.entries.length - 1;
  if (!Number.isFinite(marks["e" + last])) {
    assert(Number.isFinite(marks["s" + last]) && marks["s" + last] < (pcm.length / 48000) * 1e7);
    marks["e" + last] = (pcm.length / 48000) * 1e7;
    marks._lastEndSource = "physical PCM end; final service bookmark absent";
    fs.writeFileSync(marksFile, JSON.stringify(marks));
  }
  for (let i = 0; i < job.entries.length; i++)
    assert(
      Number.isFinite(marks["s" + i]) &&
        Number.isFinite(marks["e" + i]) &&
        marks["e" + i] > marks["s" + i],
      "Verified clip boundaries required",
    );
  for (let i = 0; i < job.entries.length; i++) {
    const entry = job.entries[i],
      src = azureAudioPath(job.locale, job.gender, entry.hash),
      output = path.resolve("public" + src),
      receipt = output + ".json";
    if (fs.existsSync(output) && fs.existsSync(receipt)) {
      const proof = JSON.parse(fs.readFileSync(receipt, "utf8"));
      assert.equal(hash(fs.readFileSync(output)), proof.sha256);
      continue;
    }
    const start = Math.max(0, Math.floor((marks["s" + i] / 1e7) * 24000) * 2 - 480),
      end = Math.min(pcm.length, Math.ceil((marks["e" + i] / 1e7) * 24000) * 2 + 960);
    assert(end > start);
    const tmp = path.join(root, job.id + "-" + i + ".wav");
    fs.writeFileSync(tmp, wav(pcm.subarray(start, end)));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    clips.push({ entry, src, output, receipt, tmp, seconds: (end - start) / 48000 });
  }
  for (let i = 0; i < clips.length; i += 4)
    await Promise.all(
      clips.slice(i, i + 4).map(async (c) => {
        await command([
          "-hide_banner",
          "-loglevel",
          "error",
          "-nostdin",
          "-n",
          "-i",
          c.tmp,
          "-ac",
          "1",
          "-ar",
          "24000",
          "-codec:a",
          "libmp3lame",
          "-b:a",
          "96k",
          c.output,
        ]);
        const bytes = fs.readFileSync(c.output);
        assert(bytes.length > 1000);
        const proof = {
          provider: "Microsoft Azure Speech",
          voice: job.voice,
          locale: job.locale,
          gender: job.gender,
          textSha256: c.entry.hash,
          durationSeconds: c.seconds,
          sha256: hash(bytes),
          bytes: bytes.length,
          bookmarkSource: job.id,
          clipEndSource:
            c.entry === job.entries.at(-1) && marks._lastEndSource
              ? "physical_pcm_end"
              : "service_bookmark",
          modelCategory: "Neural",
          humanListeningReviewed: false,
        };
        fs.writeFileSync(c.receipt, JSON.stringify(proof));
        journal.results.push({ src: c.src, ...proof });
      }),
    );
  save();
  console.log(
    JSON.stringify({
      completedJobs: jobs.indexOf(job) + 1,
      totalJobs: jobs.length,
      audioFiles: journal.results.length,
      voice: job.voice,
    }),
  );
}
const aliases = {};
for (const a of assets) aliases[a.originalSrc] = azureAudioPath(a.locale, "female", hash(a.text));
const textHashes = {};
for (const row of rows) (textHashes[row.locale] ??= []).push(row.hash);
fs.writeFileSync(
  "src/content/azure-recordings.json",
  JSON.stringify(
    { revision: "v1", provider: "Microsoft Azure Speech", aliases, textHashes },
    null,
    2,
  ) + "\n",
);
const final = {
  at: new Date().toISOString(),
  status: "GENERATED",
  characters: characterBudget,
  plannedClips: 2 * rows.length,
  files: journal.results,
  requests: journal.requests.map(({ status, job, characters, voice, at }) => ({
    status,
    job,
    characters,
    voice,
    at,
  })),
  skuVerified: false,
  freeAllowanceRemainingVerified: false,
};
fs.writeFileSync(path.join(root, "generation-result.json"), JSON.stringify(final, null, 2));
console.log(
  JSON.stringify({ status: final.status, files: final.files.length, characters: characterBudget }),
);
