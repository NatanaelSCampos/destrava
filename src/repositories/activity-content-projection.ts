import type { Activity } from "@/content/schema";
import { publicRequirements } from "@/content/capability-contracts";

/** Public content table payload. Private answers and capability data are not installed here. */
export function activitySeedPayload(activity: Activity) {
  const payload: Record<string, unknown> = { ...activity };
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
  if (activity.capabilityRequirements)
    payload.capabilityRequirements = publicRequirements(activity.capabilityRequirements);
  return payload;
}
