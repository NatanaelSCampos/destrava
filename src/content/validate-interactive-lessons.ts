import type { CoursePackage, LanguagePackage, LessonAction } from "./contracts";

export function validateInteractiveLessons(course: CoursePackage, language: LanguagePackage) {
  if (course.targetLanguage !== language.id)
    throw new Error("Interactive lesson language mismatch");
  if (!["1.3", "1.4", "1.5"].includes(course.schemaVersion))
    throw new Error(`Unsupported course schema: ${course.schemaVersion}`);
  const definitions = new Map(course.interactiveLessons.map((item) => [item.id, item]));
  if (definitions.size !== course.interactiveLessons.length)
    throw new Error("Duplicate interactive lesson ID");
  const media = new Map(course.media.map((item) => [item.id, item]));
  const concepts = new Set(course.concepts.map((item) => item.id));
  const activities = new Map(
    course.units.flatMap((unit) =>
      unit.lessons.flatMap((lesson) =>
        lesson.activities.map((activity) => [activity.id, activity] as const),
      ),
    ),
  );
  for (const unit of course.units)
    for (const lesson of unit.lessons) {
      const ref = lesson.interactiveLessonRef;
      if (!ref) continue;
      const definition = definitions.get(ref);
      if (
        !definition ||
        definition.courseId !== course.id ||
        definition.unitId !== unit.id ||
        definition.lessonId !== lesson.id
      )
        throw new Error(`Invalid interactiveLessonRef: ${ref}`);
    }
  for (const definition of course.interactiveLessons) {
    const owner = course.units
      .find((unit) => unit.id === definition.unitId)
      ?.lessons.find((lesson) => lesson.id === definition.lessonId);
    if (!owner || owner.interactiveLessonRef !== definition.id || definition.courseId !== course.id)
      throw new Error(`Interactive lesson has no matching Lesson: ${definition.id}`);
    const ownActivityIds = new Set(owner.activities.map((activity) => activity.id));
    for (const concept of definition.concepts)
      if (!concepts.has(concept)) throw new Error(`Unknown interactive concept ${concept}`);
    for (const example of definition.alternativeExamples)
      if (!concepts.has(example.conceptId))
        throw new Error(`Unknown example concept ${example.conceptId}`);
    const segmentIds = new Set<string>();
    const cueIds = new Set<string>();
    for (const segment of definition.segments) {
      if (segmentIds.has(segment.id)) throw new Error(`Duplicate segment ID ${segment.id}`);
      segmentIds.add(segment.id);
      for (const concept of segment.concepts)
        if (!concepts.has(concept)) throw new Error(`Unknown segment concept ${concept}`);
      const duration = segment.presentation?.durationMs ?? 0;
      if (segment.presentation) {
        const { mediaId, mode, transcript } = segment.presentation;
        if (mode !== "slides" && (!mediaId || media.get(mediaId)?.type !== mode))
          throw new Error(`Missing ${mode} media for ${segment.id}`);
        if (mediaId && !media.has(mediaId)) throw new Error(`Unknown media ${mediaId}`);
        for (const line of transcript)
          if (line.endMs <= line.startMs || line.endMs > duration)
            throw new Error(`Invalid transcript time in ${segment.id}`);
      }
      if (segment.cues.length && !segment.presentation)
        throw new Error(`Cues need presentation: ${segment.id}`);
      for (const anchor of segment.resumeAnchorsMs)
        if (anchor > duration) throw new Error(`Invalid resume anchor in ${segment.id}`);
      const visible = new Set<string>();
      const ordered = [...segment.cues].sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id));
      for (const cue of ordered) {
        if (cueIds.has(cue.id)) throw new Error(`Duplicate cue ID ${cue.id}`);
        cueIds.add(cue.id);
        if (cue.atMs > duration) throw new Error(`Cue outside duration: ${cue.id}`);
        const action: LessonAction = cue.action;
        if (action.type === "board.show") visible.add(action.element.id);
        if (action.type === "board.clear") visible.clear();
        if (action.type === "board.highlight" && !visible.has(action.targetId))
          throw new Error(`Unknown board target ${action.targetId}`);
        if (action.type === "audio.play" && media.get(action.mediaId)?.type !== "audio")
          throw new Error(`Unknown audio media ${action.mediaId}`);
        if (action.type === "activity.open" || action.type === "speech.request")
          validateActivity(action.activityRef, action.type === "speech.request", ownActivityIds);
      }
      if (segment.type === "checkpoint" && !segment.activityRef)
        throw new Error(`Checkpoint needs activityRef: ${segment.id}`);
      if (segment.activityRef)
        validateActivity(segment.activityRef, segment.type === "speaking", ownActivityIds);
    }
  }

  function validateActivity(activityId: string, speech: boolean, ownerIds: Set<string>) {
    const activity = activities.get(activityId);
    if (!activity) throw new Error(`Unknown interactive activityRef ${activityId}`);
    if (!ownerIds.has(activityId))
      throw new Error(`Interactive activity belongs to another Lesson: ${activityId}`);
    if (speech && activity.type !== "speaking")
      throw new Error(`Speaking segment requires speaking activity ${activityId}`);
  }
}
