import type { Player } from "../../types/game-state";
import type { PlayerInfo } from "../../multiplayer/p2p-room";

interface TurnIndicatorProps {
  isMyTurn: boolean;
  playerInfo: Record<string, PlayerInfo> | undefined;
  activePlayer: Player;
  phase: string;
}

const TURN_ACTIVE_BG = "rgba(34, 197, 94, 0.2)";
const TURN_ACTIVE_BORDER = "rgba(34, 197, 94, 0.5)";
const TURN_ACTIVE_COLOR = "#22c55e";

export function TurnIndicator({
  isMyTurn,
  playerInfo,
  activePlayer,
  phase,
}: TurnIndicatorProps) {
  const playerName = playerInfo?.[activePlayer]?.name ?? activePlayer;

  return (
    <div
      style={{
        ...styles.turnIndicator,
        background: isMyTurn
          ? TURN_ACTIVE_BG
          : "var(--color-bg-secondary)",
        borderColor: isMyTurn
          ? TURN_ACTIVE_BORDER
          : "var(--color-border-primary)",
        color: isMyTurn ? TURN_ACTIVE_COLOR : "var(--color-text-secondary)",
      }}
    >
      {isMyTurn ? "Your Turn!" : `${playerName}'s Turn`}
      <span style={styles.phaseTag}>{phase.toUpperCase()} PHASE</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  turnIndicator: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--space-3) var(--space-4)",
    borderRadius: "8px",
    border: "1px solid",
    fontSize: "1rem",
    fontWeight: 600,
  },
  phaseTag: {
    fontSize: "0.75rem",
    padding: "var(--space-1) var(--space-2)",
    background: "var(--color-bg-tertiary)",
    borderRadius: "4px",
  },
};
