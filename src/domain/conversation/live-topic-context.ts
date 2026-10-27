import { createHash } from "node:crypto";
import type { LiveTopicContext } from "./live-contract";
import { LIVE_MAX_TOPICS } from "./live-topic-selection";

/** Rebuild solely from eligible server topics. One unknown ID invalidates the whole request. */
export function selectedLiveTopicContext(
  eligible: readonly LiveTopicContext[],
  ids: readonly string[],
): LiveTopicContext | null {
  if (!ids.length || ids.length > LIVE_MAX_TOPICS || new Set(ids).size !== ids.length) return null;
  const requested = new Set(ids);
  const selected = eligible.filter((topic) => requested.has(topic.id));
  if (selected.length !== ids.length) return null;
  if (selected.length === 1) return selected[0];
  const units = [...new Map(selected.map((topic) => [topic.unitId, topic])).values()];
  const examples: LiveTopicContext["examples"] = [];
  // Round robin gives each chosen stage a chance before adding second examples.
  for (let round = 0; round < 8 && examples.length < 16; round++) {
    for (const topic of selected) {
      const example = topic.examples[round];
      if (example && !examples.some((item) => item.text === example.text)) examples.push(example);
      if (examples.length >= 16) break;
    }
  }
  const selection: LiveTopicContext = {
    id:
      "selection:" +
      createHash("sha256")
        .update(JSON.stringify(selected.map((topic) => topic.id)))
        .digest("hex")
        .slice(0, 40),
    title:
      selected.length +
      " etapas · " +
      (units.length === 1 ? "Unidade " + units[0].unitNumber : units.length + " unidades"),
    description: "Conversa combinando as etapas escolhidas pelo estudante.",
    unitId: units.length === 1 ? units[0].unitId : "",
    unitTitle: units.length === 1 ? units[0].unitTitle : "Várias unidades",
    unitNumber: units.length === 1 ? units[0].unitNumber : 0,
    studiedActivities: selected.reduce((sum, topic) => sum + topic.studiedActivities, 0),
    selectedTopics: selected.map(({ id, title, unitId, unitTitle, unitNumber }) => ({
      id,
      title,
      unitId,
      unitTitle,
      unitNumber,
    })),
    examples,
    objectives: [...new Set(selected.flatMap((topic) => topic.objectives))].slice(0, 12),
  };
  // The existing private storage accepts 14 KB, including language metadata added later.
  if (Buffer.byteLength(JSON.stringify(selection), "utf8") > 12_000) return null;
  return selection;
}
