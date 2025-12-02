import type { CardName, PlayerState } from "../types/game-state";
import { Card } from "./Card";

interface PlayerAreaProps {
  player: PlayerState;
  label: string;
  isActive: boolean;
  isHuman: boolean;
  selectedCards: CardName[];
  onCardClick?: (card: CardName, index: number) => void;
}

export function PlayerArea({
  player,
  label,
  isActive,
  isHuman,
  selectedCards,
  onCardClick,
}: PlayerAreaProps) {
  return (
    <div
      style={{
        padding: "16px",
        border: isActive ? "2px solid #4CAF50" : "2px solid #ddd",
        borderRadius: "8px",
        background: isActive ? "#f0fff0" : "#fafafa",
      }}
    >
      <h3 style={{ margin: "0 0 12px 0" }}>
        {label} {isActive && "(Active)"}
      </h3>

      <div style={{ display: "flex", gap: "24px" }}>
        {/* Deck */}
        <div>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
            Deck ({player.deck.length})
          </div>
          {player.deck.length > 0 ? (
            <Card name={player.deck[0]} showBack />
          ) : (
            <div
              style={{
                width: "120px",
                height: "180px",
                border: "2px dashed #ccc",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
              }}
            >
              Empty
            </div>
          )}
        </div>

        {/* Discard */}
        <div>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
            Discard ({player.discard.length})
          </div>
          {player.discard.length > 0 ? (
            <Card name={player.discard[player.discard.length - 1]} />
          ) : (
            <div
              style={{
                width: "120px",
                height: "180px",
                border: "2px dashed #ccc",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
              }}
            >
              Empty
            </div>
          )}
        </div>

        {/* In Play */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
            In Play ({player.inPlay.length})
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {player.inPlay.map((card, i) => (
              <Card key={`${card}-${i}`} name={card} />
            ))}
          </div>
        </div>
      </div>

      {/* Hand */}
      <div style={{ marginTop: "16px" }}>
        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
          Hand ({player.hand.length})
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {isHuman ? (
            player.hand.map((card, i) => (
              <Card
                key={`${card}-${i}`}
                name={card}
                onClick={() => onCardClick?.(card, i)}
                selected={selectedCards.includes(card)}
              />
            ))
          ) : (
            // Hide AI's hand
            player.hand.map((_, i) => (
              <Card key={i} name="Copper" showBack />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
