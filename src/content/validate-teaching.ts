import { lessonStageIssues, type LessonStage } from "./lesson-stages";
import { hasExperiencePayload } from "./activity-scene";
import { inlinePresentationIssues } from "./validate-inline";
import type { ActivityPresentation } from "./text-presentation";
import { activityPayloadSchemas, objectiveActivityTypes } from "./activity-data";

type Activity = {
  title: string;
  presentation?: ActivityPresentation;
  id: string;
  prompt?: string;
  type: string;
  skills: string[];
  concepts: string[];
  payload: Record<string, unknown>;
};
type Lesson = {
  id?: string;
  stages?: LessonStage[];
  interactiveLessonRef?: string;
  activities: Activity[];
  objectives?: string[];
  objectiveLabels?: Record<string, string>;
  deferredRecovery?: {
    delayActivities: number;
    maxPerConcept: 1;
    rules: { sourceActivityIds: string[]; conceptId: string; activity: Activity }[];
  };
};
type Course = {
  schemaVersion: string;
  assessments?: { lessonId?: string }[];
  media: {
    id: string;
    type: string;
    src: string;
    metadata?: Record<string, unknown>;
  }[];
  units: { lessons: Lesson[] }[];
};
const objective = new Set<string>(objectiveActivityTypes);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ":" + canonical(item))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
function authoredExample(activity: Activity): string {
  const stimulus = Object.fromEntries(
    Object.entries(activity.payload).filter(
      ([key]) =>
        ![
          "feedback",
          "explanation",
          "supportActivityIds",
          "source",
          "answer",
          "accepted",
          "fullAnswers",
          "answerOrder",
        ].includes(key),
    ),
  );
  return canonical({ type: activity.type, prompt: activity.prompt ?? "", stimulus });
}
export function teachingCourseIssues(course: Course): string[] {
  const errors: string[] = [];
  const all = course.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => [
      ...lesson.activities,
      ...(lesson.deferredRecovery?.rules.map((rule) => rule.activity) ?? []),
    ]),
  );
  const seen = new Set<string>();
  const media = new Map(course.media.map((asset) => [asset.id, asset]));
  for (const activity of all) {
    if (seen.has(activity.id)) errors.push(`Duplicate activity ID: ${activity.id}`);
    seen.add(activity.id);
  }
  function audio(id: string, location: string) {
    const asset = media.get(id);
    if (!asset || asset.type !== "audio") {
      errors.push(`${location}: unknown audio asset ${id}`);
      return;
    }
    if (
      !(asset.src.startsWith("/media/") || asset.src.startsWith("assets/")) ||
      asset.src.includes("\\") ||
      /[%?#]/u.test(asset.src) ||
      asset.src.split("/").some((part) => part === "." || part === "..")
    )
      errors.push(
        `${location}: teaching audio requires a literal package assets/ or local /media/ path`,
      );
    for (const key of ["author", "license", "licenseUrl", "sourceUrl", "credit"])
      if (typeof asset.metadata?.[key] !== "string" || !(asset.metadata[key] as string).trim())
        errors.push(`${location}: missing audio attribution ${key}`);
    for (const key of ["licenseUrl", "sourceUrl"]) {
      try {
        const url = new URL(String(asset.metadata?.[key]));
        if (url.protocol !== "https:" && url.protocol !== "http:") throw Error();
        if (url.username || url.password) throw Error();
      } catch {
        errors.push(`${location}: invalid attribution URL ${key}`);
      }
    }
  }
  for (const unit of course.units)
    for (const lesson of unit.lessons) {
      if (lesson.stages) {
        if (!["1.9", "1.10", "1.11"].includes(course.schemaVersion))
          errors.push("Lesson stages require CoursePackage 1.9.");
        errors.push(...lessonStageIssues(lesson));
        if (
          lesson.interactiveLessonRef ||
          course.assessments?.some((item) => item.lessonId === lesson.id)
        )
          errors.push(
            "Stages require an ordinary lesson, outside guided and formal assessment routes.",
          );
      }
      if (lesson.objectiveLabels) {
        if (!["1.6", "1.7", "1.8", "1.9", "1.10", "1.11"].includes(course.schemaVersion))
          errors.push("Objective labels require CoursePackage 1.6.");
        for (const id of Object.keys(lesson.objectiveLabels))
          if (!lesson.objectives?.includes(id))
            errors.push("Objective label must reference a declared lesson objective: " + id);
      }
      const normal = new Map(lesson.activities.map((activity) => [activity.id, activity]));
      for (const rule of lesson.deferredRecovery?.rules ?? []) {
        if (!objective.has(rule.activity.type) || !rule.activity.concepts.includes(rule.conceptId))
          errors.push(
            `${rule.activity.id}: recovery requires an objective variant of the declared concept`,
          );
        if (new Set(rule.sourceActivityIds).size !== rule.sourceActivityIds.length)
          errors.push(`${rule.activity.id}: duplicate recovery sources`);
        for (const id of rule.sourceActivityIds) {
          const source = normal.get(id);
          if (
            !source ||
            !objective.has(source.type) ||
            !source.concepts.includes(rule.conceptId) ||
            !source.skills.some((skill) => rule.activity.skills.includes(skill))
          )
            errors.push(
              `${rule.activity.id}: recovery source must share lesson, concept and skill: ${id}`,
            );
          if (source && authoredExample(source) === authoredExample(rule.activity))
            errors.push(`${rule.activity.id}: recovery must use a different authored example`);
        }
      }
      const concepts = lesson.deferredRecovery?.rules.map((rule) => rule.conceptId) ?? [];
      if (new Set(concepts).size !== concepts.length)
        errors.push("Only one recovery variant per concept and lesson is supported.");
      for (const activity of [
        ...lesson.activities,
        ...(lesson.deferredRecovery?.rules.map((rule) => rule.activity) ?? []),
      ]) {
        const parsed = activityPayloadSchemas[
          activity.type as keyof typeof activityPayloadSchemas
        ]?.safeParse(activity.payload);
        if (!parsed?.success) {
          errors.push(`${activity.id}: invalid activity payload`);
          continue;
        }
        const data = parsed.data as Record<string, unknown>;
        const inline =
          activity.presentation?.annotations ||
          Object.keys(activity.presentation?.fields ?? {}).some((key) =>
            ["support", "explanation", "feedbackSummary", "feedbackAlternative"].includes(key),
          );
        if (
          (inline || data.recallScene) &&
          !["1.7", "1.8", "1.9", "1.10", "1.11"].includes(course.schemaVersion)
        )
          errors.push(
            activity.id + ": inline annotations and recall scenes require CoursePackage 1.7",
          );
        if (hasExperiencePayload(data) && !["1.8", "1.9", "1.10", "1.11"].includes(course.schemaVersion))
          errors.push(
            activity.id + ": authored scenes and review recall require CoursePackage 1.8",
          );
        if (data.reviewMode && !(data.cards as unknown[] | undefined)?.length)
          errors.push(activity.id + ": recall review requires at least one card");
        for (const card of (data.cards as
          { examples: string[]; audioMediaIds?: string[] }[] | undefined) ?? []) {
          if (card.audioMediaIds && card.audioMediaIds.length !== card.examples.length)
            errors.push(activity.id + ": review audio must align with each example");
          for (const id of card.audioMediaIds ?? []) audio(id, activity.id);
        }
        const extendedKinds = new Set(["home", "interior", "neighborhood", "profile"]);
        const extendedIcons = new Set(["home", "bed", "sofa", "key", "phone", "mail", "book", "briefcase"]);
        const authoredScenes = [data.scene, data.recallScene] as ({illustration?: string; items?: {icon: string}[]} | undefined)[];
        if (course.schemaVersion !== "1.11" && authoredScenes.some(item => item &&
          (extendedKinds.has(item.illustration ?? "") || item.items?.some(entry => extendedIcons.has(entry.icon)))))
          errors.push(activity.id + ": extended scene illustrations and icons require CoursePackage 1.11");
        const scene = data.scene as { cue?: { audioMediaId?: string } } | undefined;
        if (scene?.cue?.audioMediaId) audio(scene.cue.audioMediaId, activity.id);
        errors.push(
          ...inlinePresentationIssues({
            ...activity,
            payload: data,
            prompt: activity.prompt ?? "",
          }),
        );
        const recall = data.recallScene as
          { model: { lines: { text: string; audioMediaId?: string }[] } } | undefined;
        if (recall) {
          if (recall.model.lines[0].text !== data.back)
            errors.push(activity.id + ": recall model must begin with the declared back");
          for (const line of recall.model.lines)
            if (line.audioMediaId) audio(line.audioMediaId, activity.id);
        }
        const modern =
          data.teaching ||
          data.recordedBack ||
          data.feedback ||
          data.supportActivityIds ||
          lesson.deferredRecovery;
        if (modern && !["1.6", "1.7", "1.8", "1.9", "1.10", "1.11"].includes(course.schemaVersion))
          errors.push(`${activity.id}: teaching and deferred recovery require CoursePackage 1.6`);
        for (const id of (data.supportActivityIds as string[] | undefined) ?? [])
          if (normal.get(id)?.type !== "lesson_content")
            errors.push(
              `${activity.id}: help must reference lesson_content in the same lesson: ${id}`,
            );
        const teaching = data.teaching as { lines: { audioMediaId?: string }[] } | undefined;
        for (const line of teaching?.lines ?? [])
          if (line.audioMediaId) audio(line.audioMediaId, activity.id);
        const recorded = data.recordedBack as { audioMediaId: string } | undefined;
        if (recorded) audio(recorded.audioMediaId, activity.id);
        const feedback = data.feedback as { alternatives: { answer: string }[] } | undefined;
        if (feedback) {
          const options =
            activity.type === "true_false"
              ? ["true", "false"]
              : (data.options as string[] | undefined);
          const keys = feedback.alternatives.map((item) => item.answer);
          if (
            !options ||
            keys.length !== options.length ||
            new Set(keys).size !== keys.length ||
            keys.some((key) => !options.includes(key))
          )
            errors.push(`${activity.id}: feedback must cover each canonical option exactly once`);
        }
      }
    }
  return errors;
}
