"use client";

import { useId, useState } from "react";
import { Check, Eye, MessageCircle } from "lucide-react";
import { RecordedPhrase, TeachingCard } from "./teaching-card";
import type { PublicActivity } from "@/content/public";
import { LearningText, LearningTextarea } from "@/components/learning/text-presentation";
import { SpeakButton } from "@/components/audio/speak-button";
import { ConversationAvatar, SceneIllustration } from "./lesson-illustrations";
import { ActivityTask } from "./activity-task";
import { useResponseDraft } from "./use-response-draft";

export function FlashcardPractice({ activity, onComplete }: {
  activity: Extract<PublicActivity, { type: "flashcard" }>;
  onComplete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const answerId = useId();
  const inputId = useId();
  const { value, update, reloadSafe } = useResponseDraft(activity.id);
  const scene = activity.recallScene;
  return <div className="lesson-body recall-practice">
    <section className="recall-context-card">
      <div><span className="le-eyebrow"><MessageCircle size={14} aria-hidden="true" /> SUA VEZ NA CONVERSA</span>
        {(!scene || scene.title !== activity.title) && <h3>{scene?.title ?? activity.front}</h3>}
        {scene && <p>{scene.context}</p>}
      </div>
      {scene && <SceneIllustration kind={scene.illustration} label={scene.title} clock={scene.clock} />}
    </section>
    {scene ? <div className="practice-turn outgoing recall-attempt">
      <span className="practice-avatar"><ConversationAvatar alternate /></span>
      <section className="practice-bubble"><ActivityTask htmlFor={inputId}>{scene.action}</ActivityTask>
        <LearningTextarea id={inputId} presentation={activity.presentation} rows={2} maxLength={500}
          value={value.answer ?? ""} onChange={event => update({answer: event.target.value})}
          placeholder="Escreva o que você lembra…" aria-describedby={answerId + "-hint"} />
        <small id={answerId + "-hint"}>Tente primeiro. Depois, compare com um exemplo.</small>
        {!reloadSafe && <p role="status">Mantenha esta página aberta para conservar seu rascunho.</p>}
      </section>
    </div> : <LearningText as="p" presentation={activity.presentation} field="front" text={activity.front} />}
    <div className="recall-actions">
      <button type="button" className="secondary-button" aria-expanded={revealed} aria-controls={answerId}
        onClick={() => setRevealed(current => !current)}>
        <Eye size={17} aria-hidden="true" /> {revealed ? "Ocultar exemplo" : "Comparar com um exemplo"}
      </button>
      <button type="button" className="primary-button" disabled={!revealed || confirmed}
        onClick={() => {
          if (!revealed || confirmed) return;
          onComplete();
          setConfirmed(true);
        }}><Check size={17} aria-hidden="true" /> {confirmed ? "Resposta conferida" : "Conferi minha resposta"}</button>
    </div>
    {confirmed && <p role="status">Você conferiu sua resposta. Pode continuar para a próxima etapa.</p>}
    <section id={answerId} hidden={!revealed} className="recall-model" aria-label="Exemplo de conversa">
      {revealed && (scene ? <><h3>Uma forma de conversar</h3><TeachingCard teaching={scene.model} presentation={activity.presentation} /></> : <>
        <div className="recall-legacy-answer"><LearningText as="strong" presentation={activity.presentation} field="back" text={activity.back} />
          {activity.recordedBack ? <RecordedPhrase mediaId={activity.recordedBack.audioMediaId} label={"Ouvir: " + activity.back} /> : <SpeakButton variant={activity.variant} text={activity.back} label="Ouvir exemplo" />}
          {activity.recordedBack?.translation && <p className="teaching-translation">{activity.recordedBack.translation}</p>}
        </div>
        <LearningText as="p" presentation={activity.presentation} field="example" text={activity.example} />
      </>)}
    </section>
  </div>;
}
