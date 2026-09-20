import { useEffect, useRef } from "preact/hooks";
import type { CardName } from "../../types/game-state";
import { Card } from "../Card";
import { Pile } from "../Pile";
import { useAnimationSafe } from "../../animation";
import { run } from "../../lib/run";

function EmptyPileContent() {
  return (
    <div
      style={{
        inlineSize: "100%",
        aspectRatio: "5 / 7.8",
        border: "1px dashed var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-muted)",
        fontSize: "0.5625rem",
        background: "var(--color-bg-primary)",
      }}
    >
      Empty
    </div>
  );
}

function LoadingCardContent() {
  return (
    <div
      style={{
        animation: "subtlePulse 3s ease-in-out infinite",
      }}
    >
      <Card name="Copper" showBack={true} size="medium" disabled={true} />
    </div>
  );
}

interface DeckDiscardSectionProps {
  deck: CardName[];
  deckCount?: number | undefined;
  discard: CardName[];
  loading: boolean;
  deckTopRevealed: boolean;
  inverted?: boolean;
}

function getDiscardContent(discard: CardName[], loading: boolean) {
  if (loading) return <LoadingCardContent />;
  if (discard.length === 0) return <EmptyPileContent />;
  return <Pile cards={discard} pileType="discard" size="medium" />;
}

export function DeckDiscardSection({
  deck,
  deckCount = deck.length,
  discard,
  loading,
  deckTopRevealed,
  inverted = false,
}: DeckDiscardSectionProps) {
  const animation = useAnimationSafe();
  const deckRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);

  // Register with player-specific zone names
  useEffect(() => {
    if (animation) {
      const suffix = inverted ? "-opponent" : "";
      if (deckRef.current) {
        animation.registerZoneRef(`deck${suffix}`, deckRef.current);
      }
      if (discardRef.current) {
        animation.registerZoneRef(`discard${suffix}`, discardRef.current);
      }
      return () => {
        animation.registerZoneRef(`deck${suffix}`, null);
        animation.registerZoneRef(`discard${suffix}`, null);
      };
    }
  }, [animation, inverted]);

  const discardContent = getDiscardContent(discard, loading);

  const topDeckCard = deck[deck.length - 1];
  const knownDeckCards: CardName[] =
    deckTopRevealed && topDeckCard !== undefined ? [topDeckCard] : [];

  return (
    <div
      className="deck-discard-container"
      style={{
        padding: "var(--space-2)",
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        minHeight: 0,
      }}
    >
      <div className="deck-discard-wrapper" style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minInlineSize: 0,
          }}
        >
          <div
            style={{
              fontSize: "0.5625rem",
              color: "rgb(205 133 63)",
              marginBlockEnd: "var(--space-2)",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Deck
          </div>
          <div ref={deckRef} style={{ inlineSize: "100%" }}>
            {run(() => {
              if (loading) {
                return <LoadingCardContent />;
              }
              if (deckCount > 0) {
                return (
                  <Pile
                    cards={deck}
                    count={deckCount}
                    knownCards={knownDeckCards}
                    pileType="deck"
                    size="medium"
                    showBack={!deckTopRevealed}
                  />
                );
              }
              return <EmptyPileContent />;
            })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minInlineSize: 0,
          }}
        >
          <div
            style={{
              fontSize: "0.5625rem",
              color: "rgb(180 180 180)",
              marginBlockEnd: "var(--space-2)",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Discard
          </div>
          <div ref={discardRef} style={{ inlineSize: "100%" }}>
            {discardContent}
          </div>
        </div>
      </div>
    </div>
  );
}
