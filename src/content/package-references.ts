import type { CoursePackage, LanguagePackage } from "./contracts";

export type PackageReferenceIssue = { code: string; path: (string | number)[]; message: string };
/** Shared semantic validation; no repository, process directory, media downloads or filesystem. */
export function packageReferenceIssues(course: CoursePackage, language: LanguagePackage) {
  const issues: PackageReferenceIssue[] = [];
  const issue = (code: string, path: (string | number)[], message: string) =>
    issues.push({ code, path, message });
  const unique = (values: Array<{ id: string }>, path: (string | number)[]) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (Object.getOwnPropertyNames(Object.prototype).includes(value.id))
        issue("ID_RESERVED", [...path, index, "id"], "ID conflicts with a reserved object member");
      if (seen.has(value.id))
        issue("DUPLICATE_ID", [...path, index, "id"], "Entity ID is duplicated in this package");
      seen.add(value.id);
    });
  };
  unique(course.units, ["units"]);
  unique(course.concepts, ["concepts"]);
  unique(course.lexicon, ["lexicon"]);
  unique(course.missions, ["missions"]);
  unique(course.roleplays, ["roleplays"]);
  unique(course.media, ["media"]);
  unique(course.assessments, ["assessments"]);
  const lessons = new Set<string>(),
    activities = new Set<string>();
  for (const [u, unit] of course.units.entries())
    for (const [l, lesson] of unit.lessons.entries()) {
      if (Object.getOwnPropertyNames(Object.prototype).includes(lesson.id))
        issue(
          "ID_RESERVED",
          ["units", u, "lessons", l, "id"],
          "Lesson ID conflicts with a reserved object member",
        );
      if (lessons.has(lesson.id))
        issue("DUPLICATE_ID", ["units", u, "lessons", l, "id"], "Lesson ID is duplicated");
      lessons.add(lesson.id);
      for (const [a, activity] of [...lesson.activities, ...(lesson.deferredRecovery?.rules.map(rule => rule.activity) ?? [])].entries()) {
        if (Object.getOwnPropertyNames(Object.prototype).includes(activity.id))
          issue(
            "ID_RESERVED",
            ["units", u, "lessons", l, "activities", a, "id"],
            "Activity ID conflicts with a reserved object member",
          );
        if (activities.has(activity.id))
          issue(
            "DUPLICATE_ID",
            ["units", u, "lessons", l, "activities", a, "id"],
            "Activity ID is duplicated",
          );
        activities.add(activity.id);
      }
    }
  const concepts = new Set(course.concepts.map((x) => x.id)),
    words = new Set(course.lexicon.map((x) => x.id)),
    media = new Set(course.media.map((x) => x.id));
  if (course.targetLanguage !== language.id)
    issue(
      "LANGUAGE_MISMATCH",
      ["targetLanguage"],
      "Course must target the supplied language profile",
    );
  if (course.defaultVariant && !language.variants.some((v) => v.id === course.defaultVariant))
    issue(
      "VARIANT_INVALID",
      ["defaultVariant"],
      "Course default variant is not defined by the language",
    );
  course.concepts.forEach((concept, index) => {
    if (concept.language !== language.id)
      issue(
        "LANGUAGE_MISMATCH",
        ["concepts", index, "language"],
        "Concept must belong to the course language",
      );
    for (const [p, id] of (concept.prerequisites ?? []).entries())
      if (!concepts.has(id))
        issue(
          "REFERENCE_MISSING",
          ["concepts", index, "prerequisites", p],
          "Prerequisite concept is not defined",
        );
  });
  const graph = new Map(course.concepts.map((c) => [c.id, c.prerequisites ?? []]));
  const active = new Set<string>(),
    finished = new Set<string>();
  const visit = (id: string) => {
    if (active.has(id)) return true;
    if (finished.has(id)) return false;
    active.add(id);
    for (const next of graph.get(id) ?? []) if (graph.has(next) && visit(next)) return true;
    active.delete(id);
    finished.add(id);
    return false;
  };
  for (const [index, concept] of course.concepts.entries())
    if (visit(concept.id)) {
      issue(
        "PREREQUISITE_CYCLE",
        ["concepts", index, "prerequisites"],
        "Concept prerequisite graph contains a cycle",
      );
      break;
    }
  course.lexicon.forEach((entry, index) => {
    if (entry.language !== language.id)
      issue(
        "LANGUAGE_MISMATCH",
        ["lexicon", index, "language"],
        "Lexicon language must match the profile",
      );
    if (entry.lessonId && !lessons.has(entry.lessonId))
      issue("REFERENCE_MISSING", ["lexicon", index, "lessonId"], "Lexicon lesson does not exist");
    if (!entry.meanings.some((m) => m.translations[course.sourceLanguage]?.length))
      issue(
        "TRANSLATION_MISSING",
        ["lexicon", index, "meanings"],
        "A translation in the course source language is required",
      );
  });
  course.units.forEach((unit, u) => {
    for (const [index, id] of (unit.introduces?.concepts ?? []).entries())
      if (!concepts.has(id))
        issue(
          "REFERENCE_MISSING",
          ["units", u, "introduces", "concepts", index],
          "Introduced concept does not exist",
        );
    for (const [index, id] of (unit.introduces?.vocabulary ?? []).entries())
      if (!words.has(id))
        issue(
          "REFERENCE_MISSING",
          ["units", u, "introduces", "vocabulary", index],
          "Introduced vocabulary does not exist",
        );
    unit.lessons.forEach((lesson, l) =>
      [...lesson.activities, ...(lesson.deferredRecovery?.rules.map(rule => rule.activity) ?? [])].forEach((activity, a) => {
        const path = ["units", u, "lessons", l, "activities", a];
        for (const [index, id] of activity.concepts.entries())
          if (!concepts.has(id))
            issue(
              "REFERENCE_MISSING",
              [...path, "concepts", index],
              "Activity concept does not exist",
            );
        for (const [index, id] of (activity.media ?? []).entries())
          if (!media.has(id))
            issue(
              "RESOURCE_REFERENCE_MISSING",
              [...path, "media", index],
              "Activity media is not declared",
            );
        if (
          Array.isArray(activity.payload.options) &&
          typeof activity.payload.answer === "string" &&
          !activity.payload.options.includes(activity.payload.answer)
        )
          issue(
            "ANSWER_OPTIONS_INCONSISTENT",
            [...path, "payload", "options"],
            "Declared canonical answer must be a listed option",
          );
      }),
    );
  });
  course.missions.forEach((mission, index) => {
    for (const [i, id] of (mission.recommendedConcepts ?? []).entries())
      if (!concepts.has(id))
        issue(
          "REFERENCE_MISSING",
          ["missions", index, "recommendedConcepts", i],
          "Mission concept is not defined",
        );
    const ids = new Set(mission.objectives),
      details = (mission.objectiveDetails ?? []).map((x) => x.id);
    if (
      ids.size !== mission.objectives.length ||
      new Set(details).size !== details.length ||
      details.length !== ids.size ||
      details.some((id) => !ids.has(id))
    )
      issue(
        "MISSION_OBJECTIVES_INVALID",
        ["missions", index, "objectiveDetails"],
        "Mission objectives need one unique description each",
      );
    if (!mission.setting?.trim() || !mission.opening?.trim() || !mission.character?.trim())
      issue(
        "MISSION_SETTING_INCOMPLETE",
        ["missions", index],
        "Mission needs setting, opening and character",
      );
  });
  course.roleplays.forEach((roleplay, index) => {
    const mission = course.missions.find((m) => m.scenario === roleplay.scenario);
    if (!mission)
      issue(
        "REFERENCE_MISSING",
        ["roleplays", index, "scenario"],
        "Roleplay has no matching mission",
      );
    else
      for (const [i, id] of roleplay.objectives.entries())
        if (!mission.objectives.includes(id))
          issue(
            "REFERENCE_MISSING",
            ["roleplays", index, "objectives", i],
            "Roleplay objective does not belong to its mission",
          );
  });
  unique(course.practice?.reviewStructures ?? [], ["practice", "reviewStructures"]);
  (course.practice?.reviewStructures ?? []).forEach((card, index) => {
    if (!lessons.has(card.lessonId))
      issue(
        "REFERENCE_MISSING",
        ["practice", "reviewStructures", index, "lessonId"],
        "Review structure lesson does not exist",
      );
    if (!concepts.has(card.conceptId))
      issue(
        "REFERENCE_MISSING",
        ["practice", "reviewStructures", index, "conceptId"],
        "Review structure concept does not exist",
      );
  });
  return issues;
}
