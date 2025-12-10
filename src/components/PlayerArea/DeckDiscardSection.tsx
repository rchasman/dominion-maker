import type { CardName } from "../../types/game-state";
import type { DecisionRequest } from "../../events/types";
import { Card } from "../Card";
import { Pile } from "../Pile";

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
  pendingDecision?: DecisionRequest | null;
  isInteractive: boolean;
  onCardClick?: (card: CardName, index: number) => void;
}

function getDeckContent(
  deck: CardName[],
  deckTopRevealed: boolean,
  knownDeckCards: CardName[],
  loading: boolean,
) {
  if (loading) return <LoadingCardContent />;
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
}

function renderDiscardSelection(
  discard: CardName[],
  pendingDecision: DecisionRequest | undefined | null,
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
        const isOption = pendingDecision?.cardOptions?.includes(card) ?? true;
        return (
          <Card
            key={`${card}-${i}`}
            name={card}
            size="small"
            onClick={() => onCardClick?.(card, i)}
            highlightMode={isOption ? "gain" : undefined}
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
  pendingDecisionAndClick: {
    pendingDecision: DecisionRequest | undefined | null;
    onCardClick: ((card: CardName, index: number) => void) | undefined;
  },
) {
  if (loading) return <LoadingCardContent />;
  if (discard.length === 0) return <EmptyPileContent />;
  if (shouldShowDiscardSelection) {
    return renderDiscardSelection(
      discard,
      pendingDecisionAndClick.pendingDecision,
      pendingDecisionAndClick.onCardClick,
    );
  }
  return <Pile cards={discard} pileType="discard" size="medium" />;
}

function renderDeckSection(
  deck: CardName[],
  deckTopRevealed: boolean,
  loading: boolean,
) {
  const knownDeckCards: CardName[] = [];
  if (deckTopRevealed && deck.length > 0) {
    knownDeckCards.push(deck[deck.length - 1]);
  }

  const deckContent = getDeckContent(
    deck,
    deckTopRevealed,
    knownDeckCards,
    loading,
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
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
      {deckContent}
    </div>
  );
}

export function DeckDiscardSection({
  deck,
  discard,
  loading,
  deckTopRevealed,
  pendingDecision,
  isInteractive,
  onCardClick,
}: DeckDiscardSectionProps) {
  const shouldShowDiscardSelection =
    pendingDecision && pendingDecision.from === "discard" && isInteractive;

  const discardContent = getDiscardContent(
    discard,
    loading,
    shouldShowDiscardSelection,
    {
      pendingDecision,
      onCardClick,
    },
  );

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
        {renderDeckSection(deck, deckTopRevealed, loading)}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
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
          {discardContent}
        </div>
      </div>
    </div>
  );
}
