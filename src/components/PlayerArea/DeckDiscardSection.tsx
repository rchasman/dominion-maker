import { useEffect, useRef } from "preact/hooks";
import type { CardName } from "../../types/game-state";
import type { PendingChoice } from "../../events/types";
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
  discard: CardName[];
  loading: boolean;
  deckTopRevealed: boolean;
  pendingChoice?: Extract<PendingChoice, { choiceType: "decision" }> | null;
  isInteractive: boolean;
  onCardClick?: (card: CardName, index: number) => void;
  inverted?: boolean;
}

function renderDiscardSelection(
  discard: CardName[],
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | undefined
    | null,
  onCardClick: ((card: CardName, index: number) => void) | undefined,
) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-1)",
        maxInlineSize: "12rem",
        justifyContent: "center",
        padding: "var(--space-2)",
        background: "rgba(16, 185, 129, 0.1)",
        border: "2px dashed #10b981",
        borderRadius: "4px",
      }}
    >
      {discard.map((card, i) => {
        const isOption = pendingChoice?.cardOptions?.includes(card) ?? true;
        return (
          <Card
            key={`${card}-${i}`}
            name={card}
            size="small"
            onClick={() => onCardClick?.(card, i)}
            {...(isOption && { highlightMode: "gain" as const })}
            disabled={!isOption}
          />
        );
      })}
    </div>
  );
}

function getDiscardContent(
  discard: CardName[],
  loading: boolean,
  shouldShowDiscardSelection: boolean,
  pendingChoiceAndClick: {
    pendingChoice:
      | Extract<PendingChoice, { choiceType: "decision" }>
      | undefined
      | null;
    onCardClick: ((card: CardName, index: number) => void) | undefined;
  },
) {
  if (loading) return <LoadingCardContent />;
  if (discard.length === 0) return <EmptyPileContent />;
  if (shouldShowDiscardSelection) {
    return renderDiscardSelection(
      discard,
      pendingChoiceAndClick.pendingChoice,
      pendingChoiceAndClick.onCardClick,
    );
  }
  return <Pile cards={discard} pileType="discard" size="medium" />;
}

export function DeckDiscardSection({
  deck,
  discard,
  loading,
  deckTopRevealed,
  pendingChoice,
  isInteractive,
  onCardClick,
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

  const shouldShowDiscardSelection = Boolean(
    pendingChoice && pendingChoice.from === "discard" && isInteractive,
  );

  const discardContent = getDiscardContent(
    discard,
    loading,
    shouldShowDiscardSelection,
    {
      pendingChoice,
      onCardClick,
    },
  );

  const knownDeckCards: CardName[] =
    deckTopRevealed && deck.length > 0 ? [deck[deck.length - 1]] : [];

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
              if (deck.length > 0) {
                return (
                  <Pile
                    cards={deck}
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
