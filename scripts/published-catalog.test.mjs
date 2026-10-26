import test from "node:test";
import assert from "node:assert/strict";
import { selectPublishedCourses } from "../src/content/catalog-selection.ts";
import {
  allCourseBundles,
  findCourseBundle,
  defaultCourseId,
} from "../src/content/course-registry.ts";
import { loadContent } from "./content-loader.ts";
import { activitySeedPayload } from "../src/repositories/activity-content-projection.ts";
import { publicActivity } from "../src/content/public.ts";
test("published catalog contains only the two selected courses and default", () => {
  assert.deepEqual(
    allCourseBundles()
      .map((b) => b.course.id)
      .sort(),
    ["espanol-a-tu-paso-a1", "ingles-a1-pessoal"].sort(),
  );
  assert.equal(defaultCourseId, "espanol-a-tu-paso-a1");
  assert.equal(findCourseBundle("frecuencias-a1"), undefined);
  assert.equal(findCourseBundle("pt-BR.xx-Test.a1.general"), undefined);
  assert.equal(findCourseBundle("espanol-a-tu-paso-a1").course.contentVersion, "1.7.0");
  assert.equal(findCourseBundle("ingles-a1-pessoal").course.contentVersion, "0.1.0");
});
test("fixtures stay validated outside published catalog", () => {
  const all = loadContent();
  assert.equal(all.length, 5);
  assert(all.some((b) => b.course.id === "frecuencias-a1"));
  assert(all.some((b) => b.course.id === "pt-BR.xx-Test.a1.general"));
});
test("catalog rejects missing, duplicate, unknown, extra fields and unpublished default", () => {
  const b = [{ course: { id: "x" } }];
  for (const c of [
    { schemaVersion: 1, defaultCourseId: "x", courseIds: [] },
    { schemaVersion: 1, defaultCourseId: "x", courseIds: ["x", "x"] },
    { schemaVersion: 1, defaultCourseId: "y", courseIds: ["x"] },
    { schemaVersion: 1, defaultCourseId: "y", courseIds: ["y"] },
    { schemaVersion: 1, defaultCourseId: "x", courseIds: ["x"], html: "unsafe" },
  ])
    assert.throws(() => selectPublishedCourses(b, c));
});
test("all public SQL activity payloads use public projection including private feedback/transcripts", () => {
  let examined = 0,
    examItems = 0;
  for (const b of allCourseBundles()) {
    const finals = new Set(
      b.course.assessments.flatMap((a) => (a.method === "fixed" && a.exam ? a.activityIds : [])),
    );
    for (const u of b.course.units)
      for (const l of u.lessons)
        for (const a of [
          ...l.activities,
          ...(l.deferredRecovery?.rules.map((r) => r.activity) ?? []),
        ]) {
          const p = activitySeedPayload(a),
            safe = publicActivity(a);
          for (const key of [
            "answer",
            "answerOrder",
            "accepted",
            "fullAnswers",
            "explanation",
            "answerPolicy",
            "feedback",
          ])
            assert.equal(key in p, false, a.id + ":" + key);
          assert.deepEqual(p.presentation, safe.presentation, a.id);
          if (
            a.type === "listening" &&
            a.media?.kind === "audio" &&
            a.media.transcriptAvailableAfterAttempt !== false
          )
            assert.equal(p.transcript, "", a.id);
          if (finals.has(a.id)) examItems++;
          examined++;
        }
  }
  assert.equal(examItems, 36);
  assert(examined >= 347);
});
