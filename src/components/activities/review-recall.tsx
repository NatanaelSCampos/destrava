"use client";

import { useId, useState } from "react";
import { Check, Eye } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import { LearningText, LearningTextarea } from "@/components/learning/text-presentation";
import { SpeakButton } from "@/components/audio/speak-button";
import { useResponseDraft } from "./use-response-draft";
import { SceneCard } from "./scene-card";
import { ActivityTask } from "./activity-task";
import { RecordedPhrase } from "./teaching-card";

type Review = Extract<PublicActivity, {type: "review"}>;
function RecallCard({ activity, index, revealed, onReveal }: {
  activity: Review; index: number; revealed: boolean; onReveal: () => void;
}) {
  const card = activity.cards[index];
  const id = useId();
  const {value, update, reloadSafe} = useResponseDraft(activity.id + ":review:" + index);
  return <section className="review-recall-card">
    <header><span className="le-number">{String(index + 1).padStart(2, "0")}</span><h3>{card.label}</h3></header>
    <div className="review-recall-attempt">
      <ActivityTask htmlFor={id + "-attempt"}>{card.practice}</ActivityTask>
      <LearningTextarea id={id + "-attempt"} presentation={activity.presentation} rows={2} maxLength={500}
        value={value.answer ?? ""} onChange={event => update({answer: event.target.value})}
        placeholder="Escreva o que você lembra…" aria-describedby={id + "-hint"} />
      <p id={id + "-hint"}>Tente lembrar antes de conferir. O exemplo é um apoio para comparar.</p>
      {!reloadSafe && <p role="status">Mantenha esta página aberta para conservar seu rascunho.</p>}
    </div>
    <button type="button" className="secondary-button" aria-expanded={revealed} aria-controls={id + "-model"} onClick={onReveal}><Eye size={17} aria-hidden="true" /> {revealed ? "Exemplo disponível" : "Conferir um exemplo"}</button>
    <div id={id + "-model"} hidden={!revealed} className="review-recall-model">
      {revealed && <>
        {card.structure && <LearningText as="p" className="review-card-structure" presentation={activity.presentation} textRole="target" text={card.structure} />}
        {card.examples.map((example, i) => <div className="text-audio-row" key={i}>
          <LearningText as="p" presentation={activity.presentation} field="example" itemIndex={i} textRole="target" text={example} />
          {card.audioMediaIds?.[i] ? <RecordedPhrase mediaId={card.audioMediaIds[i]} label={"Ouvir exemplo: " + example} /> : <SpeakButton variant={activity.variant} text={example} label={"Ouvir exemplo: " + example} />}
        </div>)}
      </>}
    </div>
  </section>;
}
export function ReviewRecall({ activity, done, hideCompletion, onComplete }: {
  activity: Review; done: boolean; hideCompletion?: boolean; onComplete: () => void;
}) {
  const [revealed, setRevealed] = useState<number[]>([]);
  const ready = activity.cards.every((_, index) => revealed.includes(index));
  return <div className="review-recall">
    {activity.scene && <SceneCard scene={activity.scene} presentation={activity.presentation} eyebrow="Sua vez de lembrar" />}
    {activity.body && <LearningText as="p" presentation={activity.presentation} field="body" textRole="source" text={activity.body} />}
    {!!activity.steps.length && <ol className="review-recall-steps">{activity.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>}
    <div className="review-recall-grid">{activity.cards.map((_, index) => <RecallCard key={index} activity={activity} index={index} revealed={revealed.includes(index)} onReveal={() => setRevealed(current => current.includes(index) ? current : [...current, index])} />)}</div>
    {!hideCompletion && <button type="button" className={done ? "secondary-button" : "primary-button"} disabled={!ready} onClick={() => { if (ready) onComplete(); }}><Check size={16} aria-hidden="true" /> {done ? "Revisão concluída" : "Conferi minha revisão"}</button>}
  </div>;
}
