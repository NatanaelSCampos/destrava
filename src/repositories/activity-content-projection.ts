import type { Activity } from "@/content/schema";
import { publicActivity } from "@/content/public";

/** Public content table payload. Private answers and capability data are not installed here. */
export function activitySeedPayload(activity: Activity) {
  const payload: Record<string, unknown> = { ...publicActivity(activity) };
  for (const key of [
    "id",
    "type",
    "title",
    "prompt",
    "skill",
    "minutes",
    "source",
    "explanation",
    "answer",
    "answerOrder",
    "accepted",
    "fullAnswers",
    "answerPolicy",
    "options",
    "pairs",
  ])
    delete payload[key];

  return payload;
}
