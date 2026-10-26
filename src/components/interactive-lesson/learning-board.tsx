"use client";

import type { BoardState } from "@/domain/interactive-lesson/runtime";
import type { SceneIllustrationKind, SceneItem } from "@/content/activity-scene";
import { BidiTextWarning, LearningText } from "@/components/learning/text-presentation";
import { narrationLine, type NarrationContext } from "@/domain/interactive-lesson/narration-controller";
import { Coffee, CupSoda, GlassWater, Croissant, Clock3, MapPin, Receipt, ShoppingBag, Users, MessageCircle, House, BedDouble, Sofa, KeyRound, Phone, Mail, BookOpen, BriefcaseBusiness, Volume2 } from "lucide-react";
import { SpeakButton } from "@/components/audio/speak-button";
import { SceneIllustration } from "@/components/activities/lesson-illustrations";

const icons = { cup: Coffee, tea: CupSoda, water: GlassWater, bread: Croissant, clock: Clock3,
  pin: MapPin, receipt: Receipt, bag: ShoppingBag, people: Users, quote: MessageCircle,
  home: House, bed: BedDouble, sofa: Sofa, key: KeyRound, phone: Phone, mail: Mail,
  book: BookOpen, briefcase: BriefcaseBusiness };
export type BoardTextRun = { text: string; language?: string };

/** Explicit language metadata only; unknown text stays neutral and is never assigned a voice. */
export function LearningRuns({ runs, context }: { runs: BoardTextRun[]; context?: NarrationContext }) {
  return <span>{runs.map((run, index) => {
    const line = context ? narrationLine(`run:${index}`, run.text, run.language, context) : null;
    if (!run.language || !line?.role)
      return <span key={index} lang={run.language ?? ""} dir="auto">{run.text}<BidiTextWarning text={run.text} /></span>;
    return <LearningText key={index} as="span" textRole={line.role}
      className={line.role === "target" ? "learning-inline-term" : undefined}
      presentation={{ content: { language: run.language } }} text={run.text} />;
  })}</span>;
}

// Optional presentation fields are shared with the public board contract.
type IllustratedElement = BoardState["elements"][number] & {
  illustration?: SceneIllustrationKind; icon?: SceneItem["icon"]; label?: string;
  runs?: BoardTextRun[];
};

/** Cues and logical text stay in the timeline; the board renders their current visual state. */
export function LearningBoard({ board, showTranslation, onNarrate, activeNarrationText, narrationContext }: {
  board: BoardState;
  showTranslation: boolean;
  onNarrate?: (element: BoardState["elements"][number]) => void;
  activeNarrationText?: string;
  narrationContext?: NarrationContext;
}) {
  const elements: IllustratedElement[] = board.elements;
  const scene = [...elements].reverse().find((element) => element.illustration);
  return <div className={`live-board-content ${scene ? "has-scene" : ""}`}>
    {scene?.illustration && <div className="live-board-scene">
      <SceneIllustration kind={scene.illustration} label={scene.label ?? "Cena da explicação"} />
    </div>}
    <div className="live-board-elements">
      {elements.length ? elements.map((element) => {
        const Icon = element.icon ? icons[element.icon] : null;
        const reading = Boolean(activeNarrationText && (element.kind === "comparison"
          ? element.left === activeNarrationText || element.right === activeNarrationText
          : element.text === activeNarrationText || element.translation === activeNarrationText ||
            element.runs?.some((run) => run.text === activeNarrationText)));
        const canNarrate = element.kind === "comparison" || !element.runs || element.runs.some((run, index) =>
          run.language && (!narrationContext || narrationLine(`board:${element.id}:${index}`, run.text, run.language, narrationContext).role !== null));
        return <div key={element.id} className={`live-board-element ${board.highlightedIds.includes(element.id) ? "highlight" : ""} ${reading ? "is-speaking" : ""}`}>
          {(Icon || element.label) && <div className="live-board-label">
            {Icon && <span className="live-board-icon"><Icon size={20} aria-hidden="true" /></span>}
            {element.label && <LearningText as="span" textRole="source" text={element.label} />}
          </div>}
          {element.kind === "comparison" ? <div className="live-board-comparison">
            <LearningText as="span" presentation={{ content: element.leftPresentation }} text={element.left} />
            <LearningText as="strong" presentation={{ content: element.rightPresentation }} text={element.right} />
            {onNarrate && <button type="button" className="speak-button" aria-label="Ouvir comparação" onClick={() => onNarrate(element)}><Volume2 size={18} aria-hidden="true" /></button>}
          </div> : <>
            <div className="live-board-text">
              {element.runs ? <LearningRuns runs={element.runs} context={narrationContext} />
                : <LearningText presentation={{ content: element.textPresentation }} text={element.text} />}
              {onNarrate && canNarrate ? <button type="button" className="speak-button" aria-label={`Ouvir ${element.text}`} onClick={() => onNarrate(element)}><Volume2 size={18} aria-hidden="true" /></button>
                : !element.runs ? <SpeakButton text={element.text} label={`Ouvir ${element.text}`} /> : null}
            </div>
            {(showTranslation || board.translationVisible) && element.translation && <small className="live-board-translation">
              <LearningText textRole="source" text={element.translation} />
            </small>}
          </>}
        </div>;
      }) : <p className="live-board-placeholder">Os exemplos aparecem aqui enquanto você acompanha a explicação.</p>}
      {board.caption && <LearningText as="p" className="live-board-caption" presentation={{ content: board.captionPresentation }} text={board.caption} />}
    </div>
  </div>;
}
