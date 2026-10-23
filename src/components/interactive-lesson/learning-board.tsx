"use client";

import type { BoardState } from "@/domain/interactive-lesson/runtime";
import { LearningText } from "@/components/learning/text-presentation";
import { SpeakButton } from "@/components/audio/speak-button";

/** Shared board renderer; board execution, cue order and persisted logical values stay unchanged. */
export function LearningBoard({
  board,
  showTranslation,
}: {
  board: BoardState;
  showTranslation: boolean;
}) {
  return (
    <div className="live-board-elements">
      {board.elements.length ? (
        board.elements.map((element) => (
          <div
            key={element.id}
            className={`live-board-element ${board.highlightedIds.includes(element.id) ? "highlight" : ""}`}
          >
            {element.kind === "comparison" ? (
              <>
                <LearningText
                  as="span"
                  presentation={{ content: element.leftPresentation }}
                  text={element.left}
                />
                <LearningText
                  as="strong"
                  presentation={{ content: element.rightPresentation }}
                  text={element.right}
                />
              </>
            ) : (
              <>
                <div className="live-board-text">
                  <LearningText
                    presentation={{ content: element.textPresentation }}
                    text={element.text}
                  />
                  <SpeakButton text={element.text} label={`Ouvir ${element.text}`} />
                </div>
                {(showTranslation || board.translationVisible) && element.translation && (
                  <small>
                    <LearningText textRole="source" text={element.translation} />
                  </small>
                )}
              </>
            )}
          </div>
        ))
      ) : (
        <p className="live-board-placeholder">
          O quadro acompanha a explicação. Inicie a aula para ver os exemplos.
        </p>
      )}
      {board.caption && (
        <LearningText
          as="p"
          className="live-board-caption"
          presentation={{ content: board.captionPresentation }}
          text={board.caption}
        />
      )}
    </div>
  );
}
