import { useState } from "preact/hooks";
import type { CardName, TurnAction } from "../../../types/game-state";
import type { GameStateSnapshot } from "../types";
import { getCardColor } from "../utils/cardUtils";

interface GameStatePaneProps {
  gameState: GameStateSnapshot | undefined;
}

function getPhaseColor(phase: string): string {
  if (phase === "action") return "var(--color-action-phase)";
  if (phase === "buy") return "var(--color-buy-phase)";
  return "var(--color-text-primary)";
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
            color: getPhaseColor(phase),
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
        <span style={{ color: "var(--color-action-phase)", fontWeight: 700 }}>
          {actions}
        </span>
      </span>
      <span>
        <span style={{ color: "var(--color-text-secondary)" }}>Buys:</span>{" "}
        <span style={{ color: "var(--color-buy-phase)", fontWeight: 700 }}>
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
          {coins}
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
          <span style={{ color: "var(--color-action-phase)" }}>
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

const JSON_INDENT = 2;
const COPY_FEEDBACK_DURATION = 2000;

function TurnActionsSection({ turnHistory }: { turnHistory: TurnAction[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const json = JSON.stringify(turnHistory, null, JSON_INDENT);
    void navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
  };

  if (!turnHistory || turnHistory.length === 0) return null;

  return (
    <div style={{ marginTop: "var(--space-6)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-2)",
        }}
      >
        <div
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "0.65rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Turn Actions ({turnHistory.length})
        </div>
        <button
          onClick={handleCopy}
          style={{
            padding: "var(--space-1) var(--space-3)",
            fontSize: "0.65rem",
            fontWeight: 500,
            color: copied
              ? "var(--color-success)"
              : "var(--color-text-primary)",
            background: "var(--color-bg-tertiary)",
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            transition: "all 0.15s ease",
          }}
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
      </div>
      <pre
        style={{
          fontSize: "0.65rem",
          color: "var(--color-text-primary)",
          background: "var(--color-bg-tertiary)",
          padding: "var(--space-3)",
          borderRadius: "4px",
          overflow: "auto",
          maxHeight: "300px",
          border: "1px solid var(--color-border)",
          fontFamily: "monospace",
          lineHeight: 1.5,
        }}
      >
        {turnHistory.map(action => JSON.stringify(action)).join("\n")}
      </pre>
    </div>
  );
}

export function GameStatePane({ gameState }: GameStatePaneProps) {
  if (!gameState) return null;

  const { phase, actions, buys, coins, hand, handCounts, inPlay, turnHistory } =
    gameState;

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
        <TurnActionsSection turnHistory={turnHistory} />
      </div>
    </div>
  );
}
