import type { LiveTopic } from "./live-contract";

export const LIVE_MAX_TOPICS = 64;
export type LiveTopicUnit = {
  id: string;
  title: string;
  number: number;
  topics: LiveTopic[];
  matches: LiveTopic[];
};
/** Search changes visibility only. Unit selection always uses the full eligible unit. */
export function groupLiveTopics(
  topics: readonly LiveTopic[],
  query = "",
  unitId = "",
): LiveTopicUnit[] {
  const fold = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const terms = fold(query).trim().split(/\s+/u).filter(Boolean);
  const groups = new Map<string, LiveTopicUnit>();
  for (const topic of topics) {
    let group = groups.get(topic.unitId);
    if (!group) {
      group = {
        id: topic.unitId,
        title: topic.unitTitle,
        number: topic.unitNumber,
        topics: [],
        matches: [],
      };
      groups.set(topic.unitId, group);
    }
    group.topics.push(topic);
    const text = fold(
      [topic.title, topic.description, topic.unitTitle, "unidade " + topic.unitNumber].join(" "),
    );
    if (terms.every((term) => text.includes(term))) group.matches.push(topic);
  }
  return [...groups.values()]
    .sort((a, b) => a.number - b.number)
    .filter((group) => (!unitId || group.id === unitId) && group.matches.length > 0);
}
export function topicSelectionState(selected: readonly string[], ids: readonly string[]) {
  const chosen = new Set(selected);
  const count = ids.filter((id) => chosen.has(id)).length;
  return {
    count,
    all: ids.length > 0 && count === ids.length,
    partial: count > 0 && count < ids.length,
  };
}
/** Atomic: never silently drops part of a unit when the selection is too large. */
export function toggleLiveTopics(
  selected: readonly string[],
  ids: readonly string[],
): string[] | null {
  const targets = new Set(ids);
  const all = targets.size > 0 && [...targets].every((id) => selected.includes(id));
  const next = all
    ? selected.filter((id) => !targets.has(id))
    : [...new Set([...selected, ...ids])];
  return next.length > LIVE_MAX_TOPICS ? null : next;
}
