"use client";

import type { ReactNode } from "react";
import { Coffee, CupSoda, GlassWater, Croissant, Clock3, MapPin, Receipt, ShoppingBag, Users, MessageCircle } from "lucide-react";
import type { ActivityScene, SceneItem } from "@/content/activity-scene";
import type { ActivityPresentation } from "@/content/text-presentation";
import { LearningText } from "@/components/learning/text-presentation";
import { SceneIllustration } from "./lesson-illustrations";

const icons = {cup: Coffee, tea: CupSoda, water: GlassWater, bread: Croissant, clock: Clock3, pin: MapPin, receipt: Receipt, bag: ShoppingBag, people: Users, quote: MessageCircle};

export function SceneItemCard({ item, presentation }: {item: SceneItem; presentation?: ActivityPresentation}) {
  const Icon = icons[item.icon];
  return <li className="scene-item-card">
    <span className="scene-item-icon"><Icon aria-hidden="true" /></span>
    <div><LearningText as="strong" presentation={presentation} textRole="target" text={item.label} />
      {item.translation && <LearningText as="p" className="teaching-translation" presentation={presentation} textRole="source" text={item.translation} />}
      {item.detail && <LearningText as="p" className="scene-item-detail" presentation={presentation} textRole="source" text={item.detail} />}
    </div>
    {item.value && <LearningText as="strong" className="scene-item-value" presentation={presentation} textRole="target" text={item.value} />}
  </li>;
}

/** Public context and stimulus only. Models belong to a separate, deliberate reveal. */
export function SceneCard({ scene, presentation, children, eyebrow = "A cena" }: {
  scene: ActivityScene; presentation?: ActivityPresentation; children?: ReactNode; eyebrow?: string;
}) {
  return <section className={"scene-card scene-" + scene.illustration} aria-label={scene.title ?? eyebrow}>
    <div className="scene-card-hero">
      <div className="scene-card-copy"><span className="le-eyebrow"><MapPin size={13} aria-hidden="true" /> {eyebrow}</span>
        {scene.title && <LearningText as="h3" presentation={presentation} textRole="source" text={scene.title} />}
        <LearningText as="p" className="scene-context" presentation={presentation} textRole="source" text={scene.context} />
        {children}
      </div>
      <SceneIllustration kind={scene.illustration} label={scene.title ?? "Uma situação para conversar"} clock={scene.clock} />
    </div>
    {scene.items?.length ? <ul className="scene-item-grid">{scene.items.map((item, index) => <SceneItemCard key={index} item={item} presentation={presentation} />)}</ul> : null}
  </section>;
}

export function SceneCue({ scene, presentation, audio }: {
  scene: ActivityScene; presentation?: ActivityPresentation; audio?: ReactNode;
}) {
  if (!scene.cue) return null;
  return <><small className="scene-cue-speaker">{scene.cue.speaker ?? "A outra pessoa"}</small>
    <LearningText as="p" className="scene-cue-text" presentation={presentation} textRole="target" text={scene.cue.text} />
    {scene.cue.translation && <LearningText as="p" className="teaching-translation" presentation={presentation} textRole="source" text={scene.cue.translation} />}
    {audio}
  </>;
}
