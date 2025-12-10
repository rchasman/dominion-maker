import type { CardName } from "../../../types/game-state";
import type { GameStateSnapshot } from "../types";
import { getCardColor } from "../utils/cardUtils";

interface GameStatePaneProps {
  gameState: GameStateSnapshot | undefined;
}

function renderResourcesLine(
  phase: string,
  actions: number,
  buys: number,
  coins: number,
) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-4)",
        marginBottom: "var(--space-4)",
        padding: "var(--space-2)",
      }}
    >
      <span>
        <span style={{ color: "var(--color-text-secondary)" }}>Phase:</span>{" "}
        <span
          style={{
            color: "var(--color-text-primary)",
            fontWeight: 600,
            display: "inline-block",
            minWidth: "50px",
          }}
        >
          {phase}
        </span>
      </span>
      <span>
        <span style={{ color: "var(--color-text-secondary)" }}>Actions:</span>{" "}
        <span style={{ color: "var(--color-action)", fontWeight: 700 }}>
          {actions}
        </span>
      </span>
      <span>
        <span style={{ color: "var(--color-text-secondary)" }}>Buys:</span>{" "}
        <span style={{ color: "var(--color-buy)", fontWeight: 700 }}>
          {buys}
        </span>
      </span>
      <span>
        <span style={{ color: "var(--color-text-secondary)" }}>Coins:</span>{" "}
        <span
          style={{
            color: "var(--color-gold)",
            fontWeight: 700,
          }}
        >
          ${coins}
        </span>
      </span>
    </div>
  );
}

function renderCardList(cards: string[], title: string) {
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <div
        style={{
          color: "var(--color-text-secondary)",
          fontSize: "0.65rem",
          marginBottom: "var(--space-2)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        {cards.map((card: string, idx: number) => (
          <span
            key={idx}
            style={{
              color: getCardColor(card as CardName),
              padding: "var(--space-1) var(--space-2)",
              background: "var(--color-bg-tertiary)",
              borderRadius: "3px",
              fontSize: "0.7rem",
              fontWeight: 500,
            }}
          >
            {card}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderHandComposition(
  handCounts: { treasures: number; actions: number; total: number } | undefined,
  hand: string[] | undefined,
) {
  return (
    <>
      {handCounts && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <span style={{ color: "var(--color-text-secondary)" }}>Hand:</span>{" "}
          <span style={{ color: "var(--color-gold)" }}>
            {handCounts.treasures}T
          </span>
          {" / "}
          <span style={{ color: "var(--color-action)" }}>
            {handCounts.actions}A
          </span>
          {" / "}
          <span style={{ color: "var(--color-text-secondary)" }}>
            {handCounts.total} total
          </span>
        </div>
      )}
      {hand && hand.length > 0 && renderCardList(hand, "Hand Cards")}
    </>
  );
}

function renderInPlaySection(inPlay: string[] | undefined) {
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <div
        style={{
          color: "var(--color-text-secondary)",
          fontSize: "0.65rem",
          marginBottom: "var(--space-2)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        In Play
      </div>
      {inPlay && inPlay.length > 0 ? (
        renderCardList(inPlay, "")
      ) : (
        <div
          style={{
            fontSize: "0.7rem",
            color: "var(--color-text-secondary)",
            fontStyle: "italic",
          }}
        >
          None
        </div>
      )}
    </div>
  );
}

export function GameStatePane({ gameState }: GameStatePaneProps) {
  if (!gameState) return null;

  const { phase, actions, buys, coins, hand, handCounts, inPlay } = gameState;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "var(--space-5) var(--space-4) var(--space-3)",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            color: "var(--color-text-secondary)",
            fontWeight: 600,
            marginBottom: "var(--space-4)",
            textTransform: "uppercase",
            fontSize: "0.65rem",
            letterSpacing: "0.05em",
          }}
        >
          Game State
        </div>

        {renderResourcesLine(phase, actions, buys, coins)}
        {renderHandComposition(handCounts, hand)}
        {renderInPlaySection(inPlay)}
      </div>
    </div>
  );
}
