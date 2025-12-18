import type { PlayerState, Phase, TurnSubPhase } from "../../types/game-state";
import { countVP, getAllCards, getPlayerColor } from "../../lib/board-utils";

interface OpponentBarProps {
  opponent: PlayerState;
  opponentId?: string; // Optional opponent ID for color
  opponentLabel?: string; // Display name for opponent
  isHumanTurn: boolean;
  phase: Phase;
  subPhase: TurnSubPhase;
}

function getPhaseBorderColor(
  isAiTurn: boolean,
  phase: Phase,
  subPhase: TurnSubPhase,
): string {
  if (isAiTurn) {
    // AI's turn - show phase colors
    if (
      subPhase === "awaiting_reaction" ||
      subPhase === "opponent_decision"
    ) {
      return "var(--color-reaction)";
    }
    if (phase === "action") return "var(--color-action-phase)";
    if (phase === "buy") return "var(--color-buy-phase)";
  }
  return "var(--color-border)";
}

interface OpponentStatsProps {
  opponent: PlayerState;
}

function OpponentStats({ opponent }: OpponentStatsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-4)",
        fontSize: "0.75rem",
        color: "var(--color-text-secondary)",
      }}
    >
      <span>
        Deck:{" "}
        <strong style={{ color: "var(--color-gold)" }}>
          {opponent.deck.length}
        </strong>
      </span>
      <span>
        Hand:{" "}
        <strong style={{ color: "var(--color-gold)" }}>
          {opponent.hand.length}
        </strong>
      </span>
      <span>
        Discard:{" "}
        <strong style={{ color: "var(--color-gold)" }}>
          {opponent.discard.length}
        </strong>
      </span>
    </div>
  );
}

export function OpponentBar({
  opponent,
  opponentId = "ai",
  opponentLabel,
  isHumanTurn,
  phase,
  subPhase,
}: OpponentBarProps) {
  const opponentVP = countVP(getAllCards(opponent));
  const borderColor = getPhaseBorderColor(!isHumanTurn, phase, subPhase);
  const playerColor = getPlayerColor(opponentId);
  const displayLabel = opponentLabel || "Opponent";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "var(--space-3) var(--space-4)",
        background: !isHumanTurn
          ? `linear-gradient(180deg, ${playerColor}26 0%, ${playerColor}0D 100%)` // 15% and 5% opacity
          : "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
        border: `2px solid ${borderColor}`,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <strong style={{ fontSize: "0.875rem", color: playerColor }}>
            {displayLabel}
          </strong>
          {!isHumanTurn && (
            <span
              style={{
                fontSize: "0.5rem",
                background: playerColor,
                color: "#fff",
                padding: "2px 6px",
                fontWeight: 600,
              }}
            >
              PLAYING
            </span>
          )}
        </div>
        <OpponentStats opponent={opponent} />
      </div>
      <div
        style={{
          fontSize: "0.875rem",
          color: playerColor,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <span
          style={{
            color: "var(--color-text-secondary)",
            fontWeight: 400,
            fontSize: "0.75rem",
          }}
        >
          VP:
        </span>
        {opponentVP}
      </div>
    </div>
  );
}
