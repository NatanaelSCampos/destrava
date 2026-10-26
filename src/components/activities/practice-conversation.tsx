"use client";
import { useId, type ReactNode } from "react";
import { ActivityTask } from "./activity-task";
import type { PublicActivity } from "@/content/public";
import { LearningText } from "@/components/learning/text-presentation";
import { SceneCard, SceneCue } from "./scene-card";
import { RecordedPhrase } from "./teaching-card";
import { ConversationAvatar, MessageIllustration } from "./lesson-illustrations";

export function PracticeConversation({ activity, children }: { activity: PublicActivity; children: ReactNode }) {
  const cue = activity.scene?.cue;
  const taskId = useId();
  return <div className={"practice-conversation" + (activity.type === "writing" ? " practice-writing" : "")}>
    {activity.scene ? <SceneCard scene={activity.scene} presentation={activity.presentation} eyebrow="Na conversa" /> :
      <div className="practice-scene"><div><span className="le-eyebrow">NA CONVERSA</span>
        <p>Prepare sua resposta. Agora é sua vez.</p></div><MessageIllustration /></div>}
    {cue && activity.scene && <div className="practice-turn incoming"><span className="practice-avatar"><ConversationAvatar /></span>
      <section className="practice-bubble">
        <SceneCue scene={activity.scene} presentation={activity.presentation} audio={cue.audioMediaId && <RecordedPhrase mediaId={cue.audioMediaId} label={"Ouvir: " + cue.text} />} />
      </section>
    </div>}
    <div className="practice-turn outgoing"><span className="practice-avatar"><ConversationAvatar alternate /></span>
      <section className="practice-bubble" aria-labelledby={taskId}>
        <ActivityTask id={taskId}><LearningText as="p" presentation={activity.presentation} field="prompt" textRole="source" text={activity.prompt} /></ActivityTask>
        {children}
      </section>
    </div>
  </div>;
}
