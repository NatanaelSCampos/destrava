import { createHash } from "node:crypto";
import type { LiveTopicContext } from "./live-contract";

/** The active course supplies identity/language. No lesson, answer bank or studied claim is imported. */
export function freeLiveTopic(
  course: { id: string; title: string },
  openingTopic?: string,
): LiveTopicContext {
  return {
    id:
      "free:" +
      createHash("sha256")
        .update(JSON.stringify([course.id, openingTopic ?? ""]))
        .digest("hex")
        .slice(0, 40),
    mode: "free",
    courseTitle: course.title,
    ...(openingTopic ? { openingTopic } : {}),
    title: openingTopic ? "Conversa livre · " + openingTopic : "Conversa livre",
    description:
      "Bate-papo no idioma do curso, acompanhando os interesses e as respostas do estudante.",
    unitId: "",
    unitTitle: "",
    unitNumber: 0,
    studiedActivities: 0,
    examples: [],
    objectives: [],
  };
}
